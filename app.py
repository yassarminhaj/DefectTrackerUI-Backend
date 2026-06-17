import base64
import binascii
import json
import os
import re
import uuid
from datetime import date, datetime
from functools import wraps

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from flask import Flask, Response, redirect, request, send_file
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = os.path.dirname(__file__)
load_dotenv(os.path.join(ROOT, ".env"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-this-secret-key")

API = "/api/v1"
PLAYGROUND = os.path.join(ROOT, "api", "defect-tracker-mock-playground.html")
DEFAULT_USER_ID = "10000000-0000-0000-0000-000000000001"
ALLOWED_CONTEXTS = {"Test", "Prod", "All"}
PLACEHOLDER_PASSWORD_HASH = "phase1-placeholder-hash"
DEFAULT_DEV_PASSWORD = "Welcome123"
ALLOWED_ATTACHMENT_EXTENSIONS = {"png", "jpg", "jpeg", "pdf", "doc", "docx", "txt", "log", "json"}
ALLOWED_INLINE_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg"}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024
MAX_INLINE_IMAGE_DIMENSION = 10000
MAX_COMMENT_LENGTH = 2000
FILE_STORAGE_ROOT = os.getenv("FILE_STORAGE_ROOT", os.path.join(ROOT, "storage"))
_runtime_schema_checked = False
WORKFLOW_STATUS_COMPAT_ALIASES = {
    "testing": ["test", "retest"],
    "test": ["testing", "retest"],
    "reopen": ["reopened"],
    "reopened": ["reopen"],
    "reopeneddefect": ["reopened", "reopen"],
}


def dsn():
    url = os.getenv("DATABASE_URL", "")
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + url.split("://", 1)[1]
    if not url:
        raise RuntimeError("DATABASE_URL is required. Configure defect-tracker/.env before starting the app.")
    return url


def conn():
    return psycopg2.connect(dsn(), connect_timeout=3)


def q(sql, params=None):
    with conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or {})
        return list(cur.fetchall())


def one(sql, params=None):
    rows = q(sql, params)
    return rows[0] if rows else None


def execq(sql, params=None, fetch=False):
    with conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or {})
        out = list(cur.fetchall()) if fetch else None
        c.commit()
        return out


def ensure_runtime_schema():
    global _runtime_schema_checked
    if _runtime_schema_checked:
        return
    with conn() as c, c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("alter table defects add column if not exists release_version varchar(80)")
        cur.execute("alter table defects add column if not exists release_deployment_date date")
        # Phase 1 source of truth is the typed defect release fields. This keeps older seeded
        # rows readable after moving away from release-master-driven defect fixing.
        cur.execute(
            """
            update defects d
               set release_version = coalesce(d.release_version, r.release_version),
                   release_deployment_date = coalesce(d.release_deployment_date, r.actual_deployment_date, r.planned_deployment_date)
              from releases r
             where d.fixed_in_release_id = r.id
               and (d.release_version is null or d.release_deployment_date is null)
            """
        )
        c.commit()
    _runtime_schema_checked = True


def enc(value):
    if isinstance(value, (datetime, date, uuid.UUID)):
        return str(value)
    return str(value)


def js(data=None, status=200):
    if status == 204:
        return Response(status=204)
    return app.response_class(
        json.dumps(data if data is not None else {}, default=enc),
        status=status,
        mimetype="application/json",
    )


def err(code, message, status=400, fields=None):
    payload = {"error": {"code": code, "message": message}}
    if fields is not None:
        payload["error"]["fields"] = fields
    return js(payload, status)


@app.errorhandler(psycopg2.OperationalError)
def database_error(exc):
    return err("database_unavailable", str(exc), 503)


@app.errorhandler(psycopg2.IntegrityError)
def integrity_error(exc):
    return err("data_integrity_error", str(exc), 400)


@app.before_request
def ensure_api_schema():
    if request.path.startswith(API):
        ensure_runtime_schema()


def body():
    return request.get_json(silent=True) or {} if request.is_json else {}


def bool_arg(name):
    value = request.args.get(name)
    if value in (None, ""):
        return None
    return str(value).lower() in ("1", "true", "yes")


def int_arg(name, default, allowed=None):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return value if not allowed or value in allowed else default


def context():
    value = request.headers.get("X-Data-Context")
    if value in ALLOWED_CONTEXTS:
        return value
    user_id = authenticated_user_id()
    if user_id:
        user = one("select default_data_context from app_users where id=%(id)s and is_active=true", {"id": user_id})
        if user and user.get("default_data_context") in ALLOWED_CONTEXTS:
            return user["default_data_context"]
    return "Test"


def clean_environment_scope(value):
    if value in ("Test", "Prod"):
        return value
    return None


def infer_environment_scope(environment_name):
    normalized = (environment_name or "").strip().lower()
    # Business rule: only live production labels are scoped as Prod.
    # Everything else is a test/progress environment unless explicitly overridden by admin API.
    return "Prod" if normalized in ("prod", "production", "live") else "Test"


def current_user_id():
    return authenticated_user_id() or DEFAULT_USER_ID


def authenticated_user_id():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer live."):
        candidate = auth.split("Bearer live.", 1)[1].split(".", 1)[0]
        if re.fullmatch(r"[0-9a-fA-F-]{36}", candidate):
            return candidate
    return None


def parse_refresh_user_id(refresh_token):
    if not refresh_token:
        return None
    match = re.fullmatch(r"live\.refresh\.([0-9a-fA-F-]{36})\.[0-9a-fA-F-]{36}", str(refresh_token))
    return match.group(1) if match else None


def auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not authenticated_user_id():
            return err("unauthorized", "Authentication is required.", 401)
        return fn(*args, **kwargs)

    return wrapper


def current_user():
    return one("select * from app_users where id=%(id)s", {"id": current_user_id()}) or one(
        "select * from app_users order by created_at limit 1"
    )


def hash_password(password):
    return generate_password_hash(password or "")


def password_is_valid(stored_hash, candidate):
    if not stored_hash or not candidate:
        return False
    if stored_hash == PLACEHOLDER_PASSWORD_HASH:
        return candidate == DEFAULT_DEV_PASSWORD
    try:
        return check_password_hash(stored_hash, candidate)
    except ValueError:
        return False


def password_fields_are_valid(data, new_key="newPassword", confirm_key="confirmPassword"):
    new_password = data.get(new_key) or ""
    confirm_password = data.get(confirm_key) or ""
    if len(new_password) < 8:
        return False, "Password must be at least 8 characters."
    if new_password != confirm_password:
        return False, "Passwords do not match."
    return True, ""


def clean_text(value):
    return str(value or "").strip()


def clean_filename(value):
    name = clean_text(value)
    if not name or "/" in name or "\\" in name:
        return ""
    return name


def filename_extension(value):
    name = clean_filename(value)
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def decode_upload_content(data):
    content = clean_text(data.get("contentDataUrl") or data.get("dataUrl") or data.get("contentBase64"))
    if not content:
        return None
    if "," in content and content.lower().startswith("data:"):
        content = content.split(",", 1)[1]
    try:
        return base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError):
        return None


def defect_storage_key(defect_id, section, filename):
    defect = one("select defect_key from defects where id=%(id)s", {"id": defect_id})
    folder_key = clean_filename(defect["defect_key"]) if defect and defect.get("defect_key") else clean_filename(defect_id)
    return f"defects/{folder_key}/{section}/{filename}"


def storage_path(storage_key):
    parts = [part for part in str(storage_key or "").replace("\\", "/").split("/") if part]
    if not parts or any(part in (".", "..") for part in parts):
        raise ValueError("Invalid storage key.")
    target = os.path.abspath(os.path.join(FILE_STORAGE_ROOT, *parts))
    root = os.path.abspath(FILE_STORAGE_ROOT)
    if not target.startswith(root + os.sep) and target != root:
        raise ValueError("Invalid storage key.")
    return target


def write_storage_file(storage_key, file_bytes):
    target = storage_path(storage_key)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "wb") as handle:
        handle.write(file_bytes)


def remove_storage_file(storage_key):
    try:
        target = storage_path(storage_key)
    except ValueError:
        return
    if os.path.exists(target):
        os.remove(target)


def storage_file_response(record, fallback_filename, as_attachment=False):
    storage_key_value = record.get("storage_key") if record else None
    try:
        target = storage_path(storage_key_value)
    except ValueError:
        return err("file_missing", "Stored file path is invalid.", 500)
    if not os.path.isfile(target):
        return err("file_missing", "Stored file is missing from disk.", 500)
    return send_file(
        target,
        mimetype=record.get("content_type") or "application/octet-stream",
        as_attachment=as_attachment,
        download_name=record.get("original_filename") or fallback_filename,
        conditional=True,
    )


def clean_positive_int(value, default=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if number > 0 else default


def parse_date_value(value, field):
    if value in (None, ""):
        return None, None
    try:
        return date.fromisoformat(str(value)), None
    except ValueError:
        return None, err("validation_error", f"{field} must be a valid date.", 400, [{"field": field, "message": "Use YYYY-MM-DD format."}])


def email_is_valid(value):
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", clean_text(value)))


def body_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "active")


def validate_user_payload(data, creating=False, existing_user_id=None):
    name = clean_text(data.get("name"))
    email = clean_text(data.get("email"))
    username = clean_text(data.get("username"))
    default_context = data.get("defaultDataContext")

    if not name or len(name) < 2:
        return None, "Name must be at least 2 characters."
    if len(name) > 80:
        return None, "Name must be 80 characters or less."
    if not email or not email_is_valid(email):
        return None, "Email must be a valid email address."
    if not username or len(username) < 3:
        return None, "Username must be at least 3 characters."
    if len(username) > 40:
        return None, "Username must be 40 characters or less."
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", username):
        return None, "Username can use letters, numbers, dots, hyphens, and underscores."
    if default_context is not None and default_context not in ALLOWED_CONTEXTS:
        return None, "Default Context must be Test, Prod, or All."

    duplicate_params = {"email": email, "username": username}
    duplicate_clause = ""
    if existing_user_id:
        duplicate_clause = " and id <> %(id)s"
        duplicate_params["id"] = existing_user_id
    if one(f"select id from app_users where lower(email)=lower(%(email)s){duplicate_clause}", duplicate_params):
        return None, "Email already exists."
    if one(f"select id from app_users where lower(username)=lower(%(username)s){duplicate_clause}", duplicate_params):
        return None, "Username already exists."

    payload = {
        "name": name,
        "email": email,
        "username": username,
        "isActive": body_bool(data.get("isActive"), True),
        "defaultDataContext": default_context or "Test",
    }
    if creating:
        ok, message = password_fields_are_valid(data, "password", "confirmPassword")
        if not ok:
            return None, message
    return payload, ""


def validate_project_payload(data, existing_project_id=None):
    project_name = clean_text(data.get("projectName"))
    description = clean_text(data.get("description"))

    if not project_name:
        return None, "Project Name is required."
    if len(project_name) > 80:
        return None, "Project Name must be 80 characters or less."
    if len(description) > 180:
        return None, "Description must be 180 characters or less."

    duplicate_params = {"name": project_name}
    duplicate_clause = ""
    if existing_project_id:
        duplicate_clause = " and id <> %(id)s"
        duplicate_params["id"] = existing_project_id
    if one(f"select id from projects where lower(project_name)=lower(%(name)s){duplicate_clause}", duplicate_params):
        return None, "Project Name already exists."

    return {
        "projectName": project_name,
        "description": description,
        "isActive": body_bool(data.get("isActive"), True),
    }, ""


def validate_environment_payload(data, existing_env_id=None):
    environment_name = clean_text(data.get("environmentName"))
    description = clean_text(data.get("description"))

    if not environment_name:
        return None, "Environment Name is required."
    if len(environment_name) > 80:
        return None, "Environment Name must be 80 characters or less."
    if len(description) > 180:
        return None, "Description must be 180 characters or less."

    duplicate_params = {"name": environment_name}
    duplicate_clause = ""
    if existing_env_id:
        duplicate_clause = " and id <> %(id)s"
        duplicate_params["id"] = existing_env_id
    if one(f"select id from environments where lower(environment_name)=lower(%(name)s){duplicate_clause}", duplicate_params):
        return None, "Environment Name already exists."

    scope = None
    if "environmentScope" in data:
        scope = clean_environment_scope(data.get("environmentScope"))
        if not scope:
            return None, "Environment scope must be Test or Prod."
    elif environment_name:
        scope = infer_environment_scope(environment_name)

    return {
        "environmentName": environment_name,
        "description": description,
        "environmentScope": scope,
        "isActive": body_bool(data.get("isActive"), True),
        "sortOrder": data.get("sortOrder", 0),
    }, ""


def validate_release_payload(data, existing_release_id=None):
    project_id = clean_text(data.get("projectId"))
    release_version = clean_text(data.get("releaseVersion"))
    planned_date, planned_error = parse_date_value(data.get("plannedDeploymentDate"), "plannedDeploymentDate")
    actual_date, actual_error = parse_date_value(data.get("actualDeploymentDate"), "actualDeploymentDate")

    if planned_error:
        return None, planned_error
    if actual_error:
        return None, actual_error
    if not project_id:
        return None, err("validation_error", "Project is required.", 400, [{"field": "projectId", "message": "Project is required."}])
    if not one("select id from projects where id=%(id)s and is_active=true", {"id": project_id}):
        return None, err("not_found", "Project not found.", 404)
    if not release_version:
        return None, err("validation_error", "Release Version is required.", 400, [{"field": "releaseVersion", "message": "Release Version is required."}])
    if len(release_version) > 80:
        return None, err("validation_error", "Release Version must be 80 characters or less.", 400, [{"field": "releaseVersion", "message": "Release Version must be 80 characters or less."}])
    if planned_date and actual_date and actual_date < planned_date:
        return None, err("validation_error", "Actual Deployment Date must be on or after Planned Deployment Date.", 400, [{"field": "actualDeploymentDate", "message": "Actual Deployment Date must be on or after Planned Deployment Date."}])

    duplicate_params = {"project": project_id, "version": release_version}
    duplicate_clause = ""
    if existing_release_id:
        duplicate_clause = " and id <> %(id)s"
        duplicate_params["id"] = existing_release_id
    if one(f"select id from releases where project_id=%(project)s and lower(release_version)=lower(%(version)s){duplicate_clause}", duplicate_params):
        return None, err("validation_error", "Release Version already exists for this project.", 400, [{"field": "releaseVersion", "message": "Release Version already exists for this project."}])

    return {
        "projectId": project_id,
        "releaseVersion": release_version,
        "plannedDeploymentDate": planned_date.isoformat() if planned_date else None,
        "actualDeploymentDate": actual_date.isoformat() if actual_date else None,
        "isActive": body_bool(data.get("isActive"), True),
    }, None


def normalize_workflow_diagram(diagram):
    """Process nodes are real defect statuses; arrows generate allowed transitions."""
    if not isinstance(diagram, dict):
        return None, "Workflow diagram is required."

    raw_nodes = diagram.get("nodes")
    raw_edges = diagram.get("edges", [])
    if not isinstance(raw_nodes, list) or not raw_nodes:
        return None, "Workflow must include at least one process node."
    if not isinstance(raw_edges, list):
        return None, "Workflow connections must be a list."

    nodes, labels, node_ids = [], {}, set()
    for raw_node in raw_nodes:
        if not isinstance(raw_node, dict):
            continue
        node_id = clean_text(raw_node.get("id")) or f"node_{len(nodes) + 1}"
        label = clean_text(raw_node.get("label"))
        node_type = clean_text(raw_node.get("type") or "process").lower()
        if node_type != "process":
            continue
        if not label:
            return None, "Process node labels cannot be blank."
        if len(label) > 120:
            return None, "Process node labels must be 120 characters or less."
        label_key = workflow_status_key(label)
        if label_key in labels:
            return None, f"Duplicate process status: {label}."
        if node_id in node_ids:
            return None, f"Duplicate node id: {node_id}."
        position = raw_node.get("position") if isinstance(raw_node.get("position"), dict) else {}
        nodes.append({
            "id": node_id,
            "type": "process",
            "label": label,
            "position": {
                "x": float(position.get("x") or 0),
                "y": float(position.get("y") or 0),
            },
        })
        labels[label_key] = True
        node_ids.add(node_id)

    if not nodes:
        return None, "Workflow must include at least one process node."

    edges, edge_pairs = [], set()
    for raw_edge in raw_edges:
        if not isinstance(raw_edge, dict):
            continue
        source = clean_text(raw_edge.get("source"))
        target = clean_text(raw_edge.get("target"))
        if not source or not target:
            return None, "Each connection must have a source and target."
        if source not in node_ids or target not in node_ids:
            return None, "Each connection must use existing process nodes."
        if source == target:
            return None, "A status cannot connect to itself."
        pair = (source, target)
        if pair in edge_pairs:
            continue
        edge_id = clean_text(raw_edge.get("id")) or f"edge_{len(edges) + 1}"
        edge = {"id": edge_id, "source": source, "target": target}
        if clean_text(raw_edge.get("sourceHandle")):
            edge["sourceHandle"] = clean_text(raw_edge.get("sourceHandle"))
        if clean_text(raw_edge.get("targetHandle")):
            edge["targetHandle"] = clean_text(raw_edge.get("targetHandle"))
        edges.append(edge)
        edge_pairs.add(pair)

    normalized = {"nodes": nodes, "edges": edges}
    viewport = diagram.get("viewport")
    if isinstance(viewport, dict):
        normalized["viewport"] = viewport
    return normalized, ""


def upgrade_placeholder_password(user_id, password):
    execq(
        "update app_users set password_hash=%(hash)s, updated_at=now(), updated_by_user_id=%(id)s where id=%(id)s",
        {"id": user_id, "hash": hash_password(password)},
    )


def user_summary(u):
    if not u:
        return None
    summary = {
        "id": str(u["id"]),
        "name": u["name"],
        "username": u["username"],
        "email": u["email"],
    }
    if "default_data_context" in u:
        summary["defaultDataContext"] = u["default_data_context"]
    return summary


def user_dto(u):
    dto = user_summary(u)
    dto.update({
        "isActive": u["is_active"],
        "defaultDataContext": u["default_data_context"],
        "lastLoginAt": u.get("last_login_at"),
        "createdAt": u.get("created_at"),
        "updatedAt": u.get("updated_at"),
    })
    return dto


def project_dto(p):
    return None if not p else {
        "id": str(p["id"]),
        "projectName": p["project_name"],
        "description": p.get("description"),
        "isActive": p["is_active"],
        "createdAt": p.get("created_at"),
        "updatedAt": p.get("updated_at"),
    }


def env_dto(e):
    return None if not e else {
        "id": str(e["id"]),
        "environmentName": e["environment_name"],
        "environmentScope": e["environment_scope"],
        "description": e.get("description"),
        "isActive": e["is_active"],
        "sortOrder": e["sort_order"],
    }


def release_dto(r):
    return None if not r else {
        "id": str(r["id"]) if r.get("id") else None,
        "projectId": str(r["project_id"]) if r.get("project_id") else None,
        "releaseVersion": r["release_version"],
        "plannedDeploymentDate": r.get("planned_deployment_date"),
        "actualDeploymentDate": r.get("actual_deployment_date"),
        "isActive": r["is_active"],
    }


def lookup(row, kind):
    if kind == "severity":
        return {
            "id": row["severity_id"],
            "name": row["severity_name"],
            "rank": row["severity_rank"],
            "colorToken": row.get("severity_color_token"),
            "isActive": row["severity_is_active"],
        }
    return {
        "id": row["priority_id"],
        "name": row["priority_name"],
        "rank": row["priority_rank"],
        "isActive": row["priority_is_active"],
    }


@app.route(f"{API}/lookups/severities")
@auth
def severity_lookup():
    data = q("select id, severity_name, severity_rank, color_token, is_active from severity_levels where is_active=true order by severity_rank desc, severity_name")
    return js({"items": [{"id": row["id"], "name": row["severity_name"], "rank": row["severity_rank"], "colorToken": row.get("color_token"), "isActive": row["is_active"]} for row in data]})


@app.route(f"{API}/lookups/priorities")
@auth
def priority_lookup():
    data = q("select id, priority_name, priority_rank, is_active from priority_levels where is_active=true order by priority_rank desc, priority_name")
    return js({"items": [{"id": row["id"], "name": row["priority_name"], "rank": row["priority_rank"], "isActive": row["is_active"]} for row in data]})


def paged(items, page, page_size, total=None):
    total = len(items) if total is None else total
    return {
        "items": items,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": max(1, (total + page_size - 1) // page_size),
        },
    }


def active_workflow_id():
    wf = one("select id from workflow_definitions where is_active=true order by updated_at desc limit 1")
    return str(wf["id"]) if wf else None


def allowed_statuses(status):
    wf = active_workflow_id()
    if not wf or not status:
        return []
    source_status = canonical_workflow_status(status, wf)
    if not workflow_status_in_active_labels(source_status, wf):
        return []
    return [r["to_status"] for r in q(
        """
        select to_status from workflow_transitions
        where workflow_definition_id=%(wf)s and is_active=true and from_status=%(status)s
        order by display_order, to_status
        """,
        {"wf": wf, "status": source_status},
    )]


def workflow_process_labels(workflow_id):
    wf = one("select diagram_json from workflow_definitions where id=%(id)s", {"id": workflow_id})
    diagram = wf.get("diagram_json") if wf else {}
    return [
        clean_text(node.get("label"))
        for node in diagram.get("nodes", [])
        if isinstance(node, dict) and clean_text(node.get("type") or "process").lower() == "process" and clean_text(node.get("label"))
    ]


def workflow_status_key(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def workflow_process_label_map(workflow_id=None):
    wf = workflow_id or active_workflow_id()
    labels = workflow_process_labels(wf) if wf else []
    return {workflow_status_key(label): label for label in labels if workflow_status_key(label)}


def workflow_status_in_active_labels(status, workflow_id=None):
    key = workflow_status_key(status)
    return bool(key and key in workflow_process_label_map(workflow_id))


def canonical_workflow_status(status, workflow_id=None):
    key = workflow_status_key(status)
    label_map = workflow_process_label_map(workflow_id)
    if key in label_map:
        return label_map[key]
    for alias_key in WORKFLOW_STATUS_COMPAT_ALIASES.get(key, []):
        if alias_key in label_map:
            return label_map[alias_key]
    return clean_text(status)


def workflow_terminal_statuses(workflow_id=None):
    wf = workflow_id or active_workflow_id()
    if not wf:
        return []
    labels = workflow_process_labels(wf)
    outgoing = {
        workflow_status_key(row["from_status"])
        for row in q(
            """
            select distinct from_status from workflow_transitions
            where workflow_definition_id=%(wf)s and is_active=true
            """,
            {"wf": wf},
        )
    }
    return [label for label in labels if workflow_status_key(label) not in outgoing]


def workflow_semantic_status(status, semantic_key):
    return workflow_status_key(status) == workflow_status_key(semantic_key)


def is_workflow_open_status(status, workflow_id=None):
    canonical = canonical_workflow_status(status, workflow_id)
    if workflow_semantic_status(canonical, "Closed") or workflow_semantic_status(canonical, "Rejected"):
        return False
    terminal_keys = {workflow_status_key(label) for label in workflow_terminal_statuses(workflow_id)}
    return workflow_status_key(canonical) not in terminal_keys if terminal_keys else bool(workflow_status_key(canonical))


def workflow_status_filter_keys(status, workflow_id=None):
    target = canonical_workflow_status(status, workflow_id)
    target_key = workflow_status_key(target)
    keys = {workflow_status_key(status), target_key}
    for source_key, alias_keys in WORKFLOW_STATUS_COMPAT_ALIASES.items():
        if target_key in alias_keys:
            keys.add(source_key)
        if source_key == target_key:
            keys.update(alias_keys)
    return sorted(key for key in keys if key)


def status_filter_clause(column_name, param_name):
    return f" and regexp_replace(lower(coalesce({column_name}, '')), '[^a-z0-9]+', '', 'g')=any(%({param_name})s)"


def initial_status():
    wf = active_workflow_id()
    found = one(
        """
        select from_status from workflow_transitions
        where workflow_definition_id=%(wf)s and is_active=true
        order by display_order, from_status limit 1
        """,
        {"wf": wf},
    ) if wf else None
    if found:
        return found["from_status"]
    labels = workflow_process_labels(wf) if wf else []
    return labels[0] if labels else "Assigned"


def add_history(defect_id, event_type, field=None, old=None, new=None, meta=None, batch=None):
    execq(
        """
        insert into defect_history_events
            (defect_id,event_batch_id,event_type,field_name,old_value,new_value,metadata_json,actor_user_id)
        values (%(defect)s,%(batch)s,%(type)s,%(field)s,%(old)s,%(new)s,%(meta)s,%(actor)s)
        """,
        {
            "defect": defect_id,
            "batch": batch or str(uuid.uuid4()),
            "type": event_type,
            "field": field,
            "old": None if old is None else str(old),
            "new": None if new is None else str(new),
            "meta": psycopg2.extras.Json(meta or {}),
            "actor": current_user_id(),
        },
    )


@app.route("/")
def root():
    return redirect("/login.html")


@app.route("/api/playground")
def playground():
    response = send_file(PLAYGROUND)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/api/openapi.yaml")
def openapi():
    return send_file(os.path.join(ROOT, "api", "openapi.yaml"))


@app.route(f"{API}/health")
def health():
    try:
        count = one("select count(*) as count from information_schema.tables where table_schema='public'")
        return js({"ok": True, "publicTableCount": count["count"]})
    except Exception as exc:
        return err("database_unavailable", str(exc), 503)


@app.route(f"{API}/auth/login", methods=["POST"])
def login():
    data = body()
    user = one(
        "select * from app_users where username=%(username)s and is_active=true",
        {"username": data.get("username")},
    )
    if not user or not password_is_valid(user.get("password_hash"), data.get("password")):
        return err("invalid_credentials", "Invalid username or password.", 401)
    if user.get("password_hash") == PLACEHOLDER_PASSWORD_HASH:
        upgrade_placeholder_password(user["id"], data.get("password"))
        user["password_hash"] = hash_password(data.get("password"))
    execq("update app_users set last_login_at=now() where id=%(id)s", {"id": user["id"]})
    ctx = data.get("dataContext") if data.get("dataContext") in ALLOWED_CONTEXTS else user["default_data_context"]
    return js({
        "accessToken": f"live.{user['id']}.{uuid.uuid4()}",
        "refreshToken": f"live.refresh.{user['id']}.{uuid.uuid4()}",
        "tokenType": "Bearer",
        "expiresIn": 1800,
        "activeDataContext": ctx,
        "user": user_summary(user),
    })


@app.route(f"{API}/auth/refresh", methods=["POST"])
def refresh_token():
    user_id = parse_refresh_user_id(body().get("refreshToken"))
    if not user_id:
        return err("invalid_refresh_token", "Refresh token is invalid or expired.", 401)
    u = one("select * from app_users where id=%(id)s and is_active=true", {"id": user_id})
    if not u:
        return err("invalid_refresh_token", "Refresh token is invalid or expired.", 401)
    return js({
        "accessToken": f"live.{u['id']}.{uuid.uuid4()}",
        "refreshToken": f"live.refresh.{u['id']}.{uuid.uuid4()}",
        "tokenType": "Bearer",
        "expiresIn": 1800,
        "activeDataContext": u["default_data_context"],
        "user": user_summary(u),
    })


@app.route(f"{API}/auth/logout", methods=["POST"])
@auth
def logout():
    return js(status=204)


@app.route(f"{API}/auth/me")
@auth
def me():
    user = current_user()
    return js({
        "user": user_summary(user),
        "defaultDataContext": user["default_data_context"],
        "activeDataContext": context(),
        "availableDataContexts": ["Test", "Prod", "All"],
    })


@app.route(f"{API}/auth/profile", methods=["PATCH", "POST"])
@auth
def profile():
    email = body().get("email")
    if not email:
        return err("validation_error", "Email is required.", 400)
    updated = execq(
        "update app_users set email=%(email)s, updated_at=now(), updated_by_user_id=%(actor)s where id=%(id)s returning *",
        {"email": email, "actor": current_user_id(), "id": current_user_id()},
        True,
    )
    return js(user_dto(updated[0]))


@app.route(f"{API}/auth/password", methods=["POST", "PATCH"])
@auth
def password():
    data = body()
    user = current_user()
    previous_password = data.get("previousPassword") or data.get("currentPassword")
    if not password_is_valid(user.get("password_hash"), previous_password):
        return err("invalid_credentials", "Invalid username or password.", 401)
    ok, message = password_fields_are_valid(data)
    if not ok:
        return err("validation_error", message, 400)
    if previous_password == data.get("newPassword"):
        return err("validation_error", "New password must be different from previous password.", 400)
    execq(
        "update app_users set password_hash=%(hash)s, updated_at=now(), updated_by_user_id=%(id)s where id=%(id)s",
        {"id": current_user_id(), "hash": hash_password(data.get("newPassword"))},
    )
    execq(
        "insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'self_change','Password changed by user')",
        {"u": current_user_id(), "a": current_user_id()},
    )
    return js(status=204)


@app.route(f"{API}/users", methods=["GET", "POST"])
@auth
def users():
    if request.method == "GET":
        params, clauses = {}, []
        search, active = request.args.get("search"), bool_arg("isActive")
        if search:
            clauses.append("(name ilike %(search)s or username ilike %(search)s or email ilike %(search)s)")
            params["search"] = f"%{search}%"
        if active is not None:
            clauses.append("is_active=%(active)s")
            params["active"] = active
        where = "where " + " and ".join(clauses) if clauses else ""
        page, size = int_arg("page", 1), int_arg("pageSize", 10, {10, 40, 100})
        params.update({"limit": size, "offset": (page - 1) * size})
        data = q(f"select * from app_users {where} order by created_at limit %(limit)s offset %(offset)s", params)
        total = one(f"select count(*) as count from app_users {where}", params)["count"]
        return js(paged([user_dto(u) for u in data], page, size, total))
    data = body()
    payload, message = validate_user_payload(data, creating=True)
    if not payload:
        return err("validation_error", message, 400)
    created = execq(
        """
        insert into app_users (name,email,username,password_hash,is_active,default_data_context,created_by_user_id,updated_by_user_id)
        values (%(name)s,%(email)s,%(username)s,%(password_hash)s,%(active)s,%(ctx)s,%(actor)s,%(actor)s)
        returning *
        """,
        {"name": payload["name"], "email": payload["email"], "username": payload["username"], "password_hash": hash_password(data.get("password")), "active": payload["isActive"], "ctx": payload["defaultDataContext"], "actor": current_user_id()},
        True,
    )[0]
    execq("insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'reset','Initial password set')", {"u": created["id"], "a": current_user_id()})
    return js(user_dto(created), 201)


@app.route(f"{API}/users/<user_id>", methods=["PATCH"])
@auth
def update_user(user_id):
    data = body()
    existing = one("select id from app_users where id=%(id)s", {"id": user_id})
    if not existing:
        return err("not_found", "User not found.", 404)
    payload, message = validate_user_payload(data, existing_user_id=user_id)
    if not payload:
        return err("validation_error", message, 400)
    updated = execq(
        """
        update app_users set name=coalesce(%(name)s,name), email=coalesce(%(email)s,email),
            username=coalesce(%(username)s,username), is_active=coalesce(%(active)s,is_active),
            default_data_context=coalesce(%(ctx)s,default_data_context),
            updated_at=now(), updated_by_user_id=%(actor)s
        where id=%(id)s returning *
        """,
        {"id": user_id, "name": payload["name"], "email": payload["email"], "username": payload["username"], "active": payload["isActive"], "ctx": data.get("defaultDataContext"), "actor": current_user_id()},
        True,
    )
    return js(user_dto(updated[0])) if updated else err("not_found", "User not found.", 404)


@app.route(f"{API}/users/<user_id>/password", methods=["POST", "PATCH"])
@auth
def reset_password(user_id):
    target_user = one("select * from app_users where id=%(id)s", {"id": user_id})
    if not target_user:
        return err("not_found", "User not found.", 404)
    data = body()
    previous_password = data.get("previousPassword") or data.get("currentPassword")
    if not password_is_valid(target_user.get("password_hash"), previous_password):
        return err("invalid_credentials", "Previous Password is incorrect.", 401)
    ok, message = password_fields_are_valid(data)
    if not ok:
        return err("validation_error", message, 400)
    if previous_password == data.get("newPassword"):
        return err("validation_error", "New password must be different from previous password.", 400)
    execq(
        "update app_users set password_hash=%(hash)s, updated_at=now(), updated_by_user_id=%(actor)s where id=%(id)s",
        {"id": user_id, "actor": current_user_id(), "hash": hash_password(data.get("newPassword"))},
    )
    execq("insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'reset','Password reset by administrator')", {"u": user_id, "a": current_user_id()})
    return js(status=204)


def list_master(table, dto, order, extra=None):
    params, clauses = {}, []
    search, active = request.args.get("search"), bool_arg("isActive")
    if search:
        col = "project_name" if table == "projects" else "environment_name"
        clauses.append(f"({col} ilike %(search)s or description ilike %(search)s)")
        params["search"] = f"%{search}%"
    if active is not None:
        clauses.append("is_active=%(active)s")
        params["active"] = active
    if table == "environments" and request.args.get("scope"):
        clauses.append("environment_scope=%(scope)s")
        params["scope"] = request.args.get("scope")
    if table == "releases" and request.args.get("projectId"):
        clauses.append("project_id=%(project)s")
        params["project"] = request.args.get("projectId")
    where = "where " + " and ".join(clauses) if clauses else ""
    return js({"items": [dto(x) for x in q(f"select * from {table} {where} order by {order}", params)]})


@app.route(f"{API}/projects", methods=["GET", "POST"])
@auth
def projects():
    if request.method == "GET":
        return list_master("projects", project_dto, "project_name")
    data = body()
    payload, message = validate_project_payload(data)
    if not payload:
        return err("validation_error", message, 400)
    created = execq(
        "insert into projects (project_name,description,is_active,created_by_user_id,updated_by_user_id) values (%(n)s,%(d)s,%(a)s,%(u)s,%(u)s) returning *",
        {"n": payload["projectName"], "d": payload["description"], "a": payload["isActive"], "u": current_user_id()},
        True,
    )[0]
    return js(project_dto(created), 201)


@app.route(f"{API}/projects/<project_id>", methods=["PATCH"])
@auth
def update_project(project_id):
    data = body()
    existing = one("select id from projects where id=%(id)s", {"id": project_id})
    if not existing:
        return err("not_found", "Project not found.", 404)
    payload, message = validate_project_payload(data, existing_project_id=project_id)
    if not payload:
        return err("validation_error", message, 400)
    updated = execq(
        "update projects set project_name=coalesce(%(n)s,project_name), description=%(d)s, is_active=coalesce(%(a)s,is_active), updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *",
        {"id": project_id, "n": payload["projectName"], "d": payload["description"], "a": payload["isActive"], "u": current_user_id()},
        True,
    )
    return js(project_dto(updated[0])) if updated else err("not_found", "Project not found.", 404)


@app.route(f"{API}/environments", methods=["GET", "POST"])
@auth
def environments():
    if request.method == "GET":
        return list_master("environments", env_dto, "sort_order, environment_name")
    data = body()
    payload, message = validate_environment_payload(data)
    if not payload:
        return err("validation_error", message, 400)
    created = execq(
        """
        insert into environments (environment_name,environment_scope,description,is_active,sort_order,created_by_user_id,updated_by_user_id)
        values (%(n)s,%(s)s,%(d)s,%(a)s,%(o)s,%(u)s,%(u)s) returning *
        """,
        {"n": payload["environmentName"], "s": payload["environmentScope"], "d": payload["description"], "a": payload["isActive"], "o": payload["sortOrder"], "u": current_user_id()},
        True,
    )[0]
    return js(env_dto(created), 201)


@app.route(f"{API}/environments/<env_id>", methods=["PATCH"])
@auth
def update_environment(env_id):
    data = body()
    existing = one("select id from environments where id=%(id)s", {"id": env_id})
    if not existing:
        return err("not_found", "Environment not found.", 404)
    payload, message = validate_environment_payload(data, existing_env_id=env_id)
    if not payload:
        return err("validation_error", message, 400)
    updated = execq(
        """
        update environments set environment_name=coalesce(%(n)s,environment_name), environment_scope=coalesce(%(s)s,environment_scope),
            description=%(d)s, is_active=coalesce(%(a)s,is_active), sort_order=coalesce(%(o)s,sort_order),
            updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *
        """,
        {"id": env_id, "n": payload["environmentName"], "s": payload["environmentScope"], "d": payload["description"], "a": payload["isActive"], "o": payload["sortOrder"], "u": current_user_id()},
        True,
    )
    return js(env_dto(updated[0])) if updated else err("not_found", "Environment not found.", 404)


@app.route(f"{API}/releases", methods=["GET", "POST"])
@auth
def releases():
    if request.method == "GET":
        return list_master("releases", release_dto, "release_version")
    data = body()
    payload, validation = validate_release_payload(data)
    if validation:
        return validation
    created = execq(
        """
        insert into releases (project_id,release_version,planned_deployment_date,actual_deployment_date,is_active,created_by_user_id,updated_by_user_id)
        values (%(p)s,%(v)s,%(pd)s,%(ad)s,%(a)s,%(u)s,%(u)s) returning *
        """,
        {"p": payload["projectId"], "v": payload["releaseVersion"], "pd": payload["plannedDeploymentDate"], "ad": payload["actualDeploymentDate"], "a": payload["isActive"], "u": current_user_id()},
        True,
    )[0]
    return js(release_dto(created), 201)


@app.route(f"{API}/releases/<release_id>", methods=["PATCH"])
@auth
def update_release(release_id):
    data = body()
    existing = one("select * from releases where id=%(id)s", {"id": release_id})
    if not existing:
        return err("not_found", "Release not found.", 404)
    merged = {
        "projectId": data.get("projectId", existing["project_id"]),
        "releaseVersion": data.get("releaseVersion", existing["release_version"]),
        "plannedDeploymentDate": data.get("plannedDeploymentDate", existing.get("planned_deployment_date")),
        "actualDeploymentDate": data.get("actualDeploymentDate", existing.get("actual_deployment_date")),
        "isActive": data.get("isActive", existing.get("is_active")),
    }
    payload, validation = validate_release_payload(merged, release_id)
    if validation:
        return validation
    updated = execq(
        """
        update releases set project_id=coalesce(%(p)s,project_id), release_version=coalesce(%(v)s,release_version),
            planned_deployment_date=%(pd)s, actual_deployment_date=%(ad)s, is_active=coalesce(%(a)s,is_active),
            updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *
        """,
        {"id": release_id, "p": payload["projectId"], "v": payload["releaseVersion"], "pd": payload["plannedDeploymentDate"], "ad": payload["actualDeploymentDate"], "a": payload["isActive"], "u": current_user_id()},
        True,
    )
    return js(release_dto(updated[0])) if updated else err("not_found", "Release not found.", 404)


def trans_dto(t):
    return {"id": str(t["id"]), "fromStatus": t["from_status"], "toStatus": t["to_status"], "displayOrder": t["display_order"], "isActive": t["is_active"]}


def workflow_dto(w):
    transitions = q("select * from workflow_transitions where workflow_definition_id=%(id)s and is_active=true order by from_status, display_order, to_status", {"id": w["id"]})
    statuses = workflow_process_labels(str(w["id"]))
    return {
        "id": str(w["id"]),
        "workflowName": w["workflow_name"],
        "versionNo": w["version_no"],
        "isActive": w["is_active"],
        "diagram": w["diagram_json"],
        "statuses": statuses,
        "terminalStatuses": workflow_terminal_statuses(str(w["id"])),
        "initialStatus": initial_status(),
        "transitions": [trans_dto(t) for t in transitions],
    }


@app.route(f"{API}/workflow", methods=["GET", "POST", "PUT"])
@auth
def workflow():
    if request.method == "GET":
        wf = one("select * from workflow_definitions where is_active=true order by updated_at desc limit 1")
        return js(workflow_dto(wf)) if wf else err("not_found", "No active workflow configured.", 404)

    data = body()
    diagram, message = normalize_workflow_diagram(data.get("diagram") or {})
    if not diagram:
        return err("validation_error", message, 400)
    nodes = {n.get("id"): n for n in diagram.get("nodes", []) if n.get("id")}
    execq("update workflow_definitions set is_active=false where is_active=true")
    version = one("select coalesce(max(version_no),0)+1 as v from workflow_definitions")["v"]
    wf = execq(
        "insert into workflow_definitions (workflow_name,diagram_json,version_no,is_active,created_by_user_id,updated_by_user_id) values (%(n)s,%(d)s,%(v)s,true,%(u)s,%(u)s) returning *",
        {"n": clean_text(data.get("workflowName")) or "Default Workflow", "d": psycopg2.extras.Json(diagram), "v": version, "u": current_user_id()},
        True,
    )[0]
    # The transition table is regenerated from process-node arrows so defect moves stay queryable.
    for i, edge in enumerate(diagram.get("edges", []), start=1):
        source, target = nodes.get(edge.get("source")), nodes.get(edge.get("target"))
        if source and target and source.get("label") and target.get("label"):
            execq("insert into workflow_transitions (workflow_definition_id,from_status,to_status,display_order,is_active) values (%(wf)s,%(f)s,%(t)s,%(o)s,true)", {"wf": wf["id"], "f": source["label"], "t": target["label"], "o": i})
    return js(workflow_dto(wf))


@app.route(f"{API}/workflow/transitions")
@auth
def workflow_transitions():
    wf = active_workflow_id()
    if not wf:
        return err("not_found", "No active workflow configured.", 404)
    from_status = clean_text(request.args.get("fromStatus"))
    if not from_status:
        return err("validation_error", "fromStatus is required.", 400)
    current_status = canonical_workflow_status(from_status, wf)
    if not workflow_status_in_active_labels(current_status, wf):
        return err("validation_error", f"fromStatus '{from_status}' is not in the active workflow.", 400)
    params, where = {"wf": wf, "from": current_status}, "workflow_definition_id=%(wf)s and is_active=true and from_status=%(from)s"
    data = q(f"select * from workflow_transitions where {where} order by from_status, display_order, to_status", params) if wf else []
    return js({"currentStatus": current_status, "allowedStatuses": [t["to_status"] for t in data], "items": [trans_dto(t) for t in data]})


def defect_sql(extra="", limit=True):
    lim = "limit %(limit)s offset %(offset)s" if limit else ""
    return f"""
        select d.*, p.id project_id_value, p.project_name, p.description project_description, p.is_active project_is_active, p.created_at project_created_at, p.updated_at project_updated_at,
          e.id environment_id_value, e.environment_name, e.environment_scope, e.description environment_description, e.is_active environment_is_active, e.sort_order environment_sort_order,
          s.id severity_id, s.severity_name, s.severity_rank, s.color_token severity_color_token, s.is_active severity_is_active,
          pr.id priority_id, pr.priority_name, pr.priority_rank, pr.is_active priority_is_active,
          au.id assigned_id, au.name assigned_name, au.username assigned_username, au.email assigned_email,
          cu.id created_user_id, cu.name created_name, cu.username created_username, cu.email created_email,
          d.release_version defect_release_version, d.release_deployment_date defect_release_deployment_date,
          r.id release_id_value, r.project_id release_project_id, r.release_version linked_release_version, r.planned_deployment_date, r.actual_deployment_date, r.is_active release_is_active
        from defects d
        join projects p on p.id=d.project_id
        join environments e on e.id=d.environment_id
        join severity_levels s on s.id=d.severity_id
        join priority_levels pr on pr.id=d.priority_id
        join app_users au on au.id=d.assigned_to_user_id
        join app_users cu on cu.id=d.created_by_user_id
        left join releases r on r.id=d.fixed_in_release_id
        where d.is_deleted=false {extra}
        order by d.created_at desc {lim}
    """


def normalize_key(value):
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def duplicate_candidate_dto(d):
    return {
        "id": str(d["id"]),
        "defectKey": d["defect_key"],
        "title": d["title"],
        "project": d["project_name"],
        "environment": d["environment_name"],
        "moduleComponent": d.get("module_component"),
        "status": canonical_workflow_status(d["current_status"]),
        "assignedTo": d["assigned_name"],
        "createdAt": d.get("created_at"),
    }


def find_duplicate_defects(data):
    incoming_title = normalize_key(data.get("title"))
    if not incoming_title or not data.get("projectId"):
        return []
    rows = q(
        defect_sql(
            """
            and d.project_id=%(project)s
            """,
            False,
        ),
        {"project": data.get("projectId")},
    )
    matches = []
    for row in rows:
        if normalize_key(row.get("title")) != incoming_title:
            continue
        matches.append(duplicate_candidate_dto(row))
    return matches[:5]


def defect_dto(d, detail=False):
    project = {"id": d["project_id_value"], "project_name": d["project_name"], "description": d["project_description"], "is_active": d["project_is_active"], "created_at": d["project_created_at"], "updated_at": d["project_updated_at"]}
    env = {"id": d["environment_id_value"], "environment_name": d["environment_name"], "environment_scope": d["environment_scope"], "description": d["environment_description"], "is_active": d["environment_is_active"], "sort_order": d["environment_sort_order"]}
    assigned = {"id": d["assigned_id"], "name": d["assigned_name"], "username": d["assigned_username"], "email": d["assigned_email"]}
    created = {"id": d["created_user_id"], "name": d["created_name"], "username": d["created_username"], "email": d["created_email"]}
    release_version = d.get("defect_release_version") or d.get("linked_release_version")
    release_deployment_date = d.get("defect_release_deployment_date") or d.get("actual_deployment_date") or d.get("planned_deployment_date")
    rel = None
    if release_version or d.get("release_id_value"):
        rel = {
            "id": d.get("release_id_value"),
            "project_id": d.get("release_project_id") or d["project_id_value"],
            "release_version": release_version,
            "planned_deployment_date": release_deployment_date,
            "actual_deployment_date": release_deployment_date,
            "is_active": d.get("release_is_active", True),
        }
    canonical_status = canonical_workflow_status(d["current_status"])
    dto = {"id": str(d["id"]), "defectKey": d["defect_key"], "title": d["title"], "project": project_dto(project), "environment": env_dto(env), "severity": lookup(d, "severity"), "priority": lookup(d, "priority"), "currentStatus": canonical_status, "assignedTo": user_summary(assigned), "createdBy": user_summary(created), "fixedInRelease": release_dto(rel), "releaseVersion": release_version, "releaseDeploymentDate": release_deployment_date, "fixDate": d.get("fix_date"), "closureDate": d.get("closure_date"), "createdAt": d.get("created_at"), "updatedAt": d.get("updated_at")}
    if clean_text(canonical_status) != clean_text(d["current_status"]):
        dto["storedStatus"] = d["current_status"]
    if detail:
        dto.update({"description": d["description"], "moduleComponent": d.get("module_component"), "stepsHtml": d.get("steps_html"), "expectedResult": d.get("expected_result"), "actualResult": d.get("actual_result"), "allowedNextStatuses": allowed_statuses(canonical_status), "attachments": attachments_for(str(d["id"])), "inlineAssets": inline_for(str(d["id"])), "comments": comments_for(str(d["id"]))})
    return dto


def context_extra(params):
    if context() == "All":
        return ""
    params["ctx"] = context()
    return " and e.environment_scope=%(ctx)s"


def is_uuid_text(value):
    try:
        uuid.UUID(str(value or ""))
        return True
    except (TypeError, ValueError):
        return False


def defect_identifier_clause(defect_ref, params):
    value = clean_text(defect_ref)
    if is_uuid_text(value):
        params["id"] = value
        return "d.id=%(id)s"
    params["defect_key"] = value
    return "lower(d.defect_key)=lower(%(defect_key)s)"


def resolve_defect_id(defect_ref, scoped=False):
    if not clean_text(defect_ref):
        return None
    params = {}
    extra = " and " + defect_identifier_clause(defect_ref, params)
    if scoped:
        extra += " and p.is_active=true" + context_extra(params)
    found = one(
        "select d.id from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id where d.is_deleted=false" + extra,
        params,
    )
    return str(found["id"]) if found else None


def visible_defect_id(defect_ref):
    return resolve_defect_id(defect_ref, scoped=True)


def defect_is_visible(defect_id):
    return bool(visible_defect_id(defect_id))


def require_visible_defect(defect_id):
    if defect_is_visible(defect_id):
        return None
    return err("not_found", "Defect not found.", 404)


def validate_attachment_payload(data):
    name = clean_filename(data.get("filename") or data.get("originalFilename"))
    ext = filename_extension(name)
    size = clean_positive_int(data.get("fileSizeBytes"))
    file_bytes = decode_upload_content(data)
    if not name:
        return None, err("validation_error", "Attachment filename is required.", 400, [{"field": "filename", "message": "Filename is required."}])
    if not ext or ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        return None, err("validation_error", "Attachment file type is not supported.", 400, [{"field": "filename", "message": "Allowed file types: png, jpg, jpeg, pdf, doc, docx, txt, log, json."}])
    if file_bytes is None:
        return None, err("validation_error", "Attachment file content is required.", 400, [{"field": "contentDataUrl", "message": "File content is required."}])
    actual_size = len(file_bytes)
    if size is None:
        size = actual_size
    if size > MAX_ATTACHMENT_BYTES or actual_size > MAX_ATTACHMENT_BYTES:
        return None, err("validation_error", "Attachment file size exceeds the 5 MB limit.", 400, [{"field": "fileSizeBytes", "message": "File size must be 5 MB or less."}])
    return {
        "filename": name,
        "extension": ext,
        "contentType": clean_text(data.get("contentType")) or "application/octet-stream",
        "fileSizeBytes": actual_size,
        "fileBytes": file_bytes,
    }, None


def validate_inline_asset_payload(data):
    name = clean_filename(data.get("filename") or data.get("originalFilename"))
    ext = filename_extension(name)
    content_type = clean_text(data.get("contentType")) or "image/png"
    size = clean_positive_int(data.get("fileSizeBytes"))
    file_bytes = decode_upload_content(data)
    width = clean_positive_int(data.get("widthPx"))
    height = clean_positive_int(data.get("heightPx"))
    if not name:
        return None, err("validation_error", "Inline image filename is required.", 400, [{"field": "filename", "message": "Filename is required."}])
    if ext not in {"png", "jpg", "jpeg"} or content_type.lower() not in ALLOWED_INLINE_IMAGE_TYPES:
        return None, err("validation_error", "Inline assets must be pasted images.", 400, [{"field": "contentType", "message": "Inline assets must be png, jpg, or jpeg images."}])
    if file_bytes is None:
        return None, err("validation_error", "Inline image content is required.", 400, [{"field": "contentDataUrl", "message": "Image content is required."}])
    actual_size = len(file_bytes)
    if size is None:
        size = actual_size
    if size > MAX_INLINE_IMAGE_BYTES or actual_size > MAX_INLINE_IMAGE_BYTES:
        return None, err("validation_error", "Inline image size exceeds the 5 MB limit.", 400, [{"field": "fileSizeBytes", "message": "Image size must be 5 MB or less."}])
    if width is not None and width > MAX_INLINE_IMAGE_DIMENSION:
        return None, err("validation_error", "Inline image width is too large.", 400, [{"field": "widthPx", "message": "Width must be 10000px or less."}])
    if height is not None and height > MAX_INLINE_IMAGE_DIMENSION:
        return None, err("validation_error", "Inline image height is too large.", 400, [{"field": "heightPx", "message": "Height must be 10000px or less."}])
    return {
        "filename": name,
        "contentType": content_type,
        "fileSizeBytes": actual_size,
        "fileBytes": file_bytes,
        "widthPx": width,
        "heightPx": height,
    }, None


def validate_inline_asset_dimensions(data):
    width = clean_positive_int(data.get("widthPx"))
    height = clean_positive_int(data.get("heightPx"))
    if width is None and height is None:
        return None, err("validation_error", "At least one inline image dimension is required.", 400)
    if width is not None and width > MAX_INLINE_IMAGE_DIMENSION:
        return None, err("validation_error", "Inline image width is too large.", 400, [{"field": "widthPx", "message": "Width must be 10000px or less."}])
    if height is not None and height > MAX_INLINE_IMAGE_DIMENSION:
        return None, err("validation_error", "Inline image height is too large.", 400, [{"field": "heightPx", "message": "Height must be 10000px or less."}])
    return {"widthPx": width, "heightPx": height}, None


def validate_comment_payload(data):
    comment_text = clean_text(data.get("commentText"))
    if not comment_text:
        return None, err("validation_error", "Comment is required.", 400, [{"field": "commentText", "message": "Comment is required."}])
    if len(comment_text) > MAX_COMMENT_LENGTH:
        return None, err("validation_error", "Comment must be 2000 characters or less.", 400, [{"field": "commentText", "message": "Comment must be 2000 characters or less."}])
    return comment_text, None


def validate_defect_release_dates(old, data):
    next_status = canonical_workflow_status(data.get("currentStatus", old.get("current_status")))
    next_release_version = clean_text(data["releaseVersion"]) if "releaseVersion" in data else clean_text(old.get("release_version"))
    next_deployment_date = data.get("releaseDeploymentDate", old.get("release_deployment_date"))
    next_fix_date = data.get("fixDate", old.get("fix_date"))
    next_closure_date = data.get("closureDate", old.get("closure_date"))
    deployment_date_value, deployment_error = parse_date_value(next_deployment_date, "releaseDeploymentDate")
    fix_date_value, fix_error = parse_date_value(next_fix_date, "fixDate")
    closure_date_value, closure_error = parse_date_value(next_closure_date, "closureDate")

    if deployment_error:
        return deployment_error
    if fix_error:
        return fix_error
    if closure_error:
        return closure_error
    if next_release_version and len(next_release_version) > 80:
        return err("validation_error", "Release Version must be 80 characters or less.", 400, [{"field": "releaseVersion", "message": "Release Version must be 80 characters or less."}])
    if fix_date_value and fix_date_value > date.today():
        return err("validation_error", "Fix Date cannot be greater than today.", 400, [{"field": "fixDate", "message": "Fix Date cannot be greater than today."}])
    if not workflow_semantic_status(next_status, "Closed") and "closureDate" in data and data.get("closureDate") not in (None, ""):
        return err("validation_error", "Closure Date is available only when status is Closed.", 400, [{"field": "closureDate", "message": "Closure Date is available only when status is Closed."}])
    if workflow_semantic_status(next_status, "Fixed"):
        if not next_release_version:
            return err("validation_error", "Release Version is required when fixing a defect.", 400, [{"field": "releaseVersion", "message": "Release Version is required when fixing a defect."}])
        if not deployment_date_value:
            return err("validation_error", "Release Deployment Date is required when fixing a defect.", 400, [{"field": "releaseDeploymentDate", "message": "Release Deployment Date is required when fixing a defect."}])
        if not fix_date_value:
            return err("validation_error", "Fix Date is required when fixing a defect.", 400, [{"field": "fixDate", "message": "Fix Date is required when fixing a defect."}])
    if workflow_semantic_status(next_status, "Closed"):
        if not closure_date_value:
            return err("validation_error", "Closure Date is required when closing a defect.", 400, [{"field": "closureDate", "message": "Closure Date is required when closing a defect."}])
    if fix_date_value and closure_date_value and (workflow_semantic_status(next_status, "Closed") or "closureDate" in data) and closure_date_value < fix_date_value:
        return err("validation_error", "Closure Date must be on or after Fix Date.", 400, [{"field": "closureDate", "message": "Closure Date must be on or after Fix Date."}])
    return None


@app.route(f"{API}/defects", methods=["GET", "POST"])
@auth
def defects():
    if request.method == "GET":
        params = {}
        extra = " and p.is_active=true" + context_extra(params)
        for arg, col in [("projectId", "d.project_id"), ("environmentId", "d.environment_id"), ("assignedToUserId", "d.assigned_to_user_id"), ("releaseId", "d.fixed_in_release_id"), ("severityId", "d.severity_id"), ("priorityId", "d.priority_id")]:
            if request.args.get(arg):
                extra += f" and {col}=%({arg})s"
                params[arg] = request.args.get(arg)
        if request.args.get("status"):
            extra += status_filter_clause("d.current_status", "statusKeys")
            params["statusKeys"] = workflow_status_filter_keys(request.args.get("status"))
        if request.args.get("releaseVersion"):
            extra += " and lower(d.release_version)=lower(%(releaseVersion)s)"
            params["releaseVersion"] = request.args.get("releaseVersion")
        if request.args.get("search"):
            extra += " and (d.defect_key ilike %(search)s or d.title ilike %(search)s or d.description ilike %(search)s)"
            params["search"] = f"%{request.args.get('search')}%"
        page, size = int_arg("page", 1), int_arg("pageSize", 10, {10, 40, 100})
        params.update({"limit": size, "offset": (page - 1) * size})
        data = q(defect_sql(extra), params)
        total = one("select count(*) count from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id where d.is_deleted=false " + extra, params)["count"]
        return js(paged([defect_dto(d) for d in data], page, size, total))
    data = body()
    if not bool_arg("forceCreate"):
        duplicates = find_duplicate_defects(data)
        if duplicates:
            return js(
                {
                    "error": {
                        "code": "possible_duplicate_defect",
                        "message": "A defect with the same title already exists in this project. Review it before submitting, or retry with forceCreate=true to create anyway.",
                        "duplicateCandidates": duplicates,
                    }
                },
                409,
            )
    key = next_defect_key()
    created = execq(
        """
        insert into defects (defect_key,title,description,project_id,module_component,environment_id,severity_id,priority_id,current_status,assigned_to_user_id,created_by_user_id,steps_html,expected_result,actual_result,updated_by_user_id)
        values (%(key)s,%(title)s,%(description)s,%(project)s,%(module)s,%(environment)s,%(severity)s,%(priority)s,%(status)s,%(assigned)s,%(actor)s,%(steps)s,%(expected)s,%(actual)s,%(actor)s)
        returning id
        """,
        {"key": key, "title": data.get("title"), "description": data.get("description"), "project": data.get("projectId"), "module": data.get("moduleComponent"), "environment": data.get("environmentId"), "severity": data.get("severityId"), "priority": data.get("priorityId"), "status": initial_status(), "assigned": data.get("assignedToUserId"), "actor": current_user_id(), "steps": data.get("stepsHtml"), "expected": data.get("expectedResult"), "actual": data.get("actualResult")},
        True,
    )[0]
    add_history(str(created["id"]), "defect_created", None, None, key)
    return get_defect_response(str(created["id"]), 201)


def next_defect_key():
    found = one("select coalesce(max((regexp_replace(defect_key, '^DF-', ''))::int),1041)+1 next_no from defects where defect_key ~ '^DF-[0-9]+$'")
    return f"DF-{found['next_no']}"


@app.route(f"{API}/defects/<defect_id>", methods=["GET", "PATCH", "DELETE"])
@auth
def defect_detail(defect_id, status=200):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    if request.method == "DELETE":
        out = execq("update defects set is_deleted=true, updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning id", {"id": resolved_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Defect not found.", 404)
        add_history(resolved_id, "field_updated", "is_deleted", "false", "true")
        return js(status=204)
    if request.method == "PATCH":
        return patch_defect(resolved_id)
    return get_defect_response(resolved_id, status, scoped=True)


def get_defect_response(defect_id, status=200, scoped=False):
    resolved_id = resolve_defect_id(defect_id, scoped=scoped)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    params = {"id": resolved_id}
    extra = " and d.id=%(id)s"
    if scoped:
        extra += " and p.is_active=true" + context_extra(params)
    d = one(defect_sql(extra, False), params)
    return js(defect_dto(d, True), status) if d else err("not_found", "Defect not found.", 404)


def patch_defect(defect_id):
    old_params = {"id": defect_id}
    old = one(
        "select d.* from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id where d.id=%(id)s and d.is_deleted=false and p.is_active=true" + context_extra(old_params),
        old_params,
    )
    if not old:
        return err("not_found", "Defect not found.", 404)
    mapping = {"title": "title", "description": "description", "projectId": "project_id", "moduleComponent": "module_component", "environmentId": "environment_id", "severityId": "severity_id", "priorityId": "priority_id", "currentStatus": "current_status", "assignedToUserId": "assigned_to_user_id", "stepsHtml": "steps_html", "expectedResult": "expected_result", "actualResult": "actual_result", "releaseVersion": "release_version", "releaseDeploymentDate": "release_deployment_date", "fixDate": "fix_date", "closureDate": "closure_date"}
    data, sets, params, batch = body(), [], {"id": defect_id, "actor": current_user_id()}, str(uuid.uuid4())
    old_status = canonical_workflow_status(old.get("current_status"))
    if "currentStatus" in data:
        data["currentStatus"] = canonical_workflow_status(data.get("currentStatus"))
    if "currentStatus" in data and data.get("currentStatus") != old_status:
        allowed = allowed_statuses(old_status)
        if data.get("currentStatus") not in allowed:
            return err(
                "invalid_status_transition",
                f"Cannot move defect from {old_status} to {data.get('currentStatus')}.",
                400,
                [{"field": "currentStatus", "message": f"Allowed next statuses: {', '.join(allowed) or 'none'}."}],
            )
    release_date_error = validate_defect_release_dates(old, data)
    if release_date_error:
        return release_date_error
    for k, col in mapping.items():
        if k in data:
            sets.append(f"{col}=%({col})s")
            params[col] = data.get(k)
            if str(old.get(col)) != str(data.get(k)):
                typ = {"current_status": "status_changed", "assigned_to_user_id": "assignment_changed", "severity_id": "severity_changed", "priority_id": "priority_changed", "fixed_in_release_id": "release_updated", "release_version": "release_updated", "release_deployment_date": "release_updated"}.get(col, "field_updated")
                add_history(defect_id, typ, col, old.get(col), data.get(k), batch=batch)
    if sets:
        execq(f"update defects set {', '.join(sets)}, updated_at=now(), updated_by_user_id=%(actor)s where id=%(id)s", params)
    return get_defect_response(defect_id)


@app.route(f"{API}/defects/<defect_id>/allowed-statuses")
@auth
def defect_allowed(defect_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    d = one("select current_status from defects where id=%(id)s and is_deleted=false", {"id": resolved_id})
    current_status = canonical_workflow_status(d["current_status"]) if d else None
    return js({"currentStatus": current_status, "allowedStatuses": allowed_statuses(current_status)}) if d else err("not_found", "Defect not found.", 404)


def attachments_for(defect_id):
    data = q("select a.*, u.id user_id, u.name, u.username, u.email from defect_attachments a left join app_users u on u.id=a.uploaded_by_user_id where a.defect_id=%(id)s and a.is_deleted=false order by a.uploaded_at", {"id": defect_id})
    return [attachment_dto(a) for a in data]


def attachment_dto(a):
    return {"id": str(a["id"]), "defectId": str(a["defect_id"]), "originalFilename": a["original_filename"], "contentType": a.get("content_type"), "fileExtension": a.get("file_extension"), "fileSizeBytes": a["file_size_bytes"], "contentUrl": f"{API}/defects/{a['defect_id']}/attachments/{a['id']}/content", "uploadedBy": user_summary({"id": a.get("user_id"), "name": a.get("name"), "username": a.get("username"), "email": a.get("email")}) if a.get("user_id") else None, "uploadedAt": a.get("uploaded_at")}


@app.route(f"{API}/defects/<defect_id>/attachments", methods=["GET", "POST"])
@auth
def attachments(defect_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    if request.method == "GET":
        return js({"items": attachments_for(resolved_id)})
    data = body()
    payload, validation = validate_attachment_payload(data)
    if validation:
        return validation
    storage_key = defect_storage_key(resolved_id, "attachments", payload["filename"])
    write_storage_file(storage_key, payload["fileBytes"])
    try:
        created = execq("insert into defect_attachments (defect_id,original_filename,storage_key,content_type,file_extension,file_size_bytes,uploaded_by_user_id) values (%(d)s,%(n)s,%(k)s,%(t)s,%(e)s,%(s)s,%(u)s) returning *", {"d": resolved_id, "n": payload["filename"], "k": storage_key, "t": payload["contentType"], "e": payload["extension"], "s": payload["fileSizeBytes"], "u": current_user_id()}, True)[0]
    except Exception:
        remove_storage_file(storage_key)
        raise
    add_history(resolved_id, "attachment_uploaded", "attachment", None, payload["filename"], {"attachment_id": str(created["id"])})
    return js(attachment_dto({**created, **{"user_id": current_user_id(), "name": current_user()["name"], "username": current_user()["username"], "email": current_user()["email"]}}), 201)


@app.route(f"{API}/defects/<defect_id>/attachments/<attachment_id>", methods=["DELETE"])
@auth
def delete_attachment(defect_id, attachment_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    out = execq("update defect_attachments set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning original_filename", {"id": attachment_id, "d": resolved_id, "u": current_user_id()}, True)
    if not out:
        return err("not_found", "Attachment not found.", 404)
    add_history(resolved_id, "attachment_deleted", "attachment", out[0]["original_filename"], None, {"attachment_id": attachment_id})
    return js(status=204)


@app.route(f"{API}/defects/<defect_id>/attachments/<attachment_id>/content")
@auth
def attachment_content(defect_id, attachment_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    a = one("select * from defect_attachments where id=%(id)s and defect_id=%(d)s and is_deleted=false", {"id": attachment_id, "d": resolved_id})
    return storage_file_response(a, f"attachment-{attachment_id}", True) if a else err("not_found", "Attachment not found.", 404)


def inline_for(defect_id):
    return [inline_dto(a) for a in q("select * from defect_inline_assets where defect_id=%(id)s and is_deleted=false order by created_at", {"id": defect_id})]


def inline_dto(a):
    return {"id": str(a["id"]), "defectId": str(a["defect_id"]), "assetKind": a["asset_kind"], "originalFilename": a.get("original_filename"), "contentType": a["content_type"], "fileSizeBytes": a.get("file_size_bytes"), "widthPx": a.get("width_px"), "heightPx": a.get("height_px"), "contentUrl": f"{API}/defects/{a['defect_id']}/inline-assets/{a['id']}/content", "createdAt": a.get("created_at")}


@app.route(f"{API}/defects/<defect_id>/inline-assets", methods=["POST"])
@auth
def upload_inline(defect_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    data = body()
    payload, validation = validate_inline_asset_payload(data)
    if validation:
        return validation
    storage_key = defect_storage_key(resolved_id, "inline", payload["filename"])
    write_storage_file(storage_key, payload["fileBytes"])
    try:
        created = execq("insert into defect_inline_assets (defect_id,asset_kind,original_filename,storage_key,content_type,file_size_bytes,width_px,height_px,created_by_user_id) values (%(d)s,'steps_image',%(n)s,%(k)s,%(t)s,%(s)s,%(w)s,%(h)s,%(u)s) returning *", {"d": resolved_id, "n": payload["filename"], "k": storage_key, "t": payload["contentType"], "s": payload["fileSizeBytes"], "w": payload["widthPx"], "h": payload["heightPx"], "u": current_user_id()}, True)[0]
    except Exception:
        remove_storage_file(storage_key)
        raise
    add_history(resolved_id, "inline_asset_added", "steps_html", None, payload["filename"], {"inline_asset_id": str(created["id"])})
    return js(inline_dto(created), 201)


@app.route(f"{API}/defects/<defect_id>/inline-assets/<asset_id>", methods=["PATCH", "DELETE"])
@auth
def inline_asset(defect_id, asset_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    if request.method == "DELETE":
        out = execq("update defect_inline_assets set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning original_filename", {"id": asset_id, "d": resolved_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Inline asset not found.", 404)
        add_history(resolved_id, "inline_asset_deleted", "steps_html", out[0]["original_filename"], None, {"inline_asset_id": asset_id})
        return js(status=204)
    data = body()
    dimensions, validation = validate_inline_asset_dimensions(data)
    if validation:
        return validation
    out = execq("update defect_inline_assets set width_px=coalesce(%(w)s,width_px), height_px=coalesce(%(h)s,height_px) where id=%(id)s and defect_id=%(d)s returning *", {"id": asset_id, "d": resolved_id, "w": dimensions["widthPx"], "h": dimensions["heightPx"]}, True)
    if not out:
        return err("not_found", "Inline asset not found.", 404)
    add_history(resolved_id, "field_updated", "inline_asset_size", None, f"{dimensions.get('widthPx') or '-'}x{dimensions.get('heightPx') or '-'}", {"inline_asset_id": asset_id})
    return js(inline_dto(out[0]))


@app.route(f"{API}/defects/<defect_id>/inline-assets/<asset_id>/content")
@auth
def inline_content(defect_id, asset_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    a = one("select * from defect_inline_assets where id=%(id)s and defect_id=%(d)s and is_deleted=false", {"id": asset_id, "d": resolved_id})
    return storage_file_response(a, f"inline-asset-{asset_id}", False) if a else err("not_found", "Inline asset not found.", 404)


def comments_for(defect_id):
    data = q("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.defect_id=%(id)s and c.is_deleted=false order by c.created_at", {"id": defect_id})
    return [comment_dto(c) for c in data]


def comment_dto(c):
    return {"id": str(c["id"]), "defectId": str(c["defect_id"]), "commentText": c["comment_text"], "createdBy": user_summary({"id": c["user_id"], "name": c["name"], "username": c["username"], "email": c["email"]}), "createdAt": c["created_at"], "updatedAt": c.get("updated_at")}


@app.route(f"{API}/defects/<defect_id>/comments", methods=["GET", "POST"])
@auth
def comments(defect_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    if request.method == "GET":
        return js({"items": comments_for(resolved_id)})
    data = body()
    comment_text, validation = validate_comment_payload(data)
    if validation:
        return validation
    created = execq("insert into defect_comments (defect_id,comment_text,created_by_user_id) values (%(d)s,%(t)s,%(u)s) returning id", {"d": resolved_id, "t": comment_text, "u": current_user_id()}, True)[0]
    add_history(resolved_id, "comment_added", "comment", None, comment_text, {"comment_id": str(created["id"])})
    c = one("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.id=%(id)s", {"id": created["id"]})
    return js(comment_dto(c), 201)


@app.route(f"{API}/defects/<defect_id>/comments/<comment_id>", methods=["PATCH", "DELETE"])
@auth
def comment(defect_id, comment_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    if request.method == "DELETE":
        out = execq("update defect_comments set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning comment_text", {"id": comment_id, "d": resolved_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Comment not found.", 404)
        add_history(resolved_id, "comment_deleted", "comment", out[0]["comment_text"], None, {"comment_id": comment_id})
        return js(status=204)
    data = body()
    comment_text, validation = validate_comment_payload(data)
    if validation:
        return validation
    old = one("select comment_text from defect_comments where id=%(id)s and defect_id=%(d)s and is_deleted=false", {"id": comment_id, "d": resolved_id})
    out = execq("update defect_comments set comment_text=%(t)s, updated_at=now() where id=%(id)s and defect_id=%(d)s and is_deleted=false returning id", {"id": comment_id, "d": resolved_id, "t": comment_text}, True)
    if not out:
        return err("not_found", "Comment not found.", 404)
    add_history(resolved_id, "comment_updated", "comment", old["comment_text"] if old else None, comment_text, {"comment_id": comment_id})
    c = one("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.id=%(id)s", {"id": comment_id})
    return js(comment_dto(c))


@app.route(f"{API}/defects/<defect_id>/history")
@auth
def history(defect_id):
    resolved_id = visible_defect_id(defect_id)
    if not resolved_id:
        return err("not_found", "Defect not found.", 404)
    page, size = int_arg("page", 1), int_arg("pageSize", 10, {10, 40, 100})
    params = {"id": resolved_id, "limit": size, "offset": (page - 1) * size}
    data = q("select h.*, u.id user_id, u.name, u.username, u.email from defect_history_events h left join app_users u on u.id=h.actor_user_id where h.defect_id=%(id)s order by h.created_at desc limit %(limit)s offset %(offset)s", params)
    total = one("select count(*) count from defect_history_events where defect_id=%(id)s", params)["count"]
    items = [{"id": str(h["id"]), "defectId": str(h["defect_id"]), "eventBatchId": str(h["event_batch_id"]), "eventType": h["event_type"], "fieldName": h["field_name"], "oldValue": h["old_value"], "newValue": h["new_value"], "metadata": h["metadata_json"], "actor": user_summary({"id": h.get("user_id"), "name": h.get("name"), "username": h.get("username"), "email": h.get("email")}) if h.get("user_id") else None, "createdAt": h["created_at"]} for h in data]
    return js(paged(items, page, size, total))


@app.route(f"{API}/dashboard/summary")
@auth
def dashboard_summary():
    params = {}
    extra = " and p.is_active=true" + context_extra(params)
    data = q("select d.current_status, d.severity_id, d.priority_id from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id where d.is_deleted=false " + extra, params)
    wf = active_workflow_id()
    rows = [{**d, "workflow_status": canonical_workflow_status(d["current_status"], wf)} for d in data]
    open_rows = [d for d in rows if is_workflow_open_status(d["workflow_status"], wf)]
    return js({
        "dataContext": context(),
        "totalDefects": len(rows),
        "openDefects": len(open_rows),
        "fixedDefects": len([d for d in rows if workflow_semantic_status(d["workflow_status"], "Fixed")]),
        "closedDefects": len([d for d in rows if workflow_semantic_status(d["workflow_status"], "Closed")]),
        "reopenedDefects": len([d for d in rows if workflow_semantic_status(d["workflow_status"], "Reopened") or workflow_semantic_status(d["workflow_status"], "Re-Open")]),
        "criticalDefects": len([d for d in rows if d["severity_id"] == 4]),
        "highPriorityOpenDefects": len([d for d in open_rows if d["priority_id"] in (3, 4)]),
    })


def dashboard_filter_extra(params):
    extra = " and p.is_active=true" + context_extra(params)
    for arg, col in [("projectId", "d.project_id"), ("environmentId", "d.environment_id"), ("assignedToUserId", "d.assigned_to_user_id"), ("releaseId", "d.fixed_in_release_id"), ("severityId", "d.severity_id"), ("priorityId", "d.priority_id")]:
        if request.args.get(arg):
            extra += f" and {col}=%({arg})s"
            params[arg] = request.args.get(arg)
    if request.args.get("status"):
        extra += status_filter_clause("d.current_status", "statusKeys")
        params["statusKeys"] = workflow_status_filter_keys(request.args.get("status"))
    if request.args.get("releaseVersion"):
        extra += " and lower(d.release_version)=lower(%(releaseVersion)s)"
        params["releaseVersion"] = request.args.get("releaseVersion")
    if request.args.get("createdFrom"):
        extra += " and d.created_at::date >= %(createdFrom)s"
        params["createdFrom"] = request.args.get("createdFrom")
    if request.args.get("createdTo"):
        extra += " and d.created_at::date <= %(createdTo)s"
        params["createdTo"] = request.args.get("createdTo")
    return extra


def series(title, values):
    counts = {}
    for v in values:
        counts[v or "Unassigned"] = counts.get(v or "Unassigned", 0) + 1
    return {"key": title.lower().replace(" ", "-"), "title": title, "chartType": "bar", "series": [{"label": k, "value": v} for k, v in counts.items()]}


@app.route(f"{API}/dashboard/charts")
@auth
def dashboard_charts():
    params = {}
    extra = dashboard_filter_extra(params)
    data = q("select d.current_status, s.severity_name, p.project_name, e.environment_name from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id join severity_levels s on s.id=d.severity_id where d.is_deleted=false " + extra, params)
    wf = active_workflow_id()
    return js({"dataContext": context(), "charts": [series("Defects by Status", [canonical_workflow_status(d["current_status"], wf) for d in data]), series("Defects by Severity", [d["severity_name"] for d in data]), series("Defects by Project", [d["project_name"] for d in data]), series("Defects by Environment", [d["environment_name"] for d in data])]})


if __name__ == "__main__":
    app.run(debug=True)

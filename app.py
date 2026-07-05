import json
import os
import re
import uuid
from datetime import date, datetime
from functools import wraps

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from flask import Flask, Response, request, send_file

load_dotenv(".env")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-this-secret-key")

API = "/api/v1"
ROOT = os.path.dirname(__file__)
PLAYGROUND = os.path.join(ROOT, "api", "defect-tracker-mock-playground.html")
DEFAULT_USER_ID = "10000000-0000-0000-0000-000000000001"
ALLOWED_CONTEXTS = {"Test", "Prod", "All"}


def dsn():
    url = os.getenv("DATABASE_URL", "")
    if url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + url.split("://", 1)[1]
    return url or "postgresql://defect_user:defect_password@localhost:5434/defect_tracker"


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
    value = request.headers.get("X-Data-Context") or "Test"
    return value if value in ALLOWED_CONTEXTS else "Test"


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
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer live."):
        candidate = auth.split("Bearer live.", 1)[1].split(".", 1)[0]
        if re.fullmatch(r"[0-9a-fA-F-]{36}", candidate):
            return candidate
    return DEFAULT_USER_ID


def auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper


def current_user():
    return one("select * from app_users where id=%(id)s", {"id": current_user_id()}) or one(
        "select * from app_users order by created_at limit 1"
    )


def user_summary(u):
    return None if not u else {
        "id": str(u["id"]),
        "name": u["name"],
        "username": u["username"],
        "email": u["email"],
    }


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
        "id": str(r["id"]),
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
    return [r["to_status"] for r in q(
        """
        select to_status from workflow_transitions
        where workflow_definition_id=%(wf)s and is_active=true and from_status=%(status)s
        order by display_order, to_status
        """,
        {"wf": wf, "status": status},
    )]


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
    return found["from_status"] if found else "Assigned"


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
    response = send_file(PLAYGROUND)
    response.headers["Cache-Control"] = "no-store"
    return response


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
    if not user:
        return err("invalid_credentials", "Invalid username or password.", 401)
    execq("update app_users set last_login_at=now() where id=%(id)s", {"id": user["id"]})
    ctx = data.get("dataContext") if data.get("dataContext") in ALLOWED_CONTEXTS else user["default_data_context"]
    return js({
        "accessToken": f"live.{user['id']}.{uuid.uuid4()}",
        "refreshToken": f"live.refresh.{uuid.uuid4()}",
        "tokenType": "Bearer",
        "expiresIn": 1800,
        "activeDataContext": ctx,
        "user": user_summary(user),
    })


@app.route(f"{API}/auth/refresh", methods=["POST"])
def refresh_token():
    u = current_user()
    return js({
        "accessToken": f"live.{u['id']}.{uuid.uuid4()}",
        "refreshToken": body().get("refreshToken") or f"live.refresh.{uuid.uuid4()}",
        "tokenType": "Bearer",
        "expiresIn": 1800,
        "activeDataContext": u["default_data_context"],
        "user": user_summary(u),
    })


@app.route(f"{API}/auth/logout", methods=["POST"])
def logout():
    return js(status=204)


@app.route(f"{API}/auth/me")
@auth
def me():
    return js({"user": user_summary(current_user()), "activeDataContext": context(), "availableDataContexts": ["Test", "Prod", "All"]})


@app.route(f"{API}/auth/profile", methods=["PATCH", "POST"])
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
def password():
    data = body()
    if data.get("newPassword") != data.get("confirmPassword"):
        return err("validation_error", "Passwords do not match.", 400)
    execq(
        "insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'self_change','Password changed from API playground')",
        {"u": current_user_id(), "a": current_user_id()},
    )
    return js(status=204)


@app.route(f"{API}/users", methods=["GET", "POST"])
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
    if data.get("password") != data.get("confirmPassword"):
        return err("validation_error", "Passwords do not match.", 400)
    created = execq(
        """
        insert into app_users (name,email,username,password_hash,is_active,default_data_context,created_by_user_id,updated_by_user_id)
        values (%(name)s,%(email)s,%(username)s,'phase1-placeholder-hash',%(active)s,%(ctx)s,%(actor)s,%(actor)s)
        returning *
        """,
        {"name": data.get("name"), "email": data.get("email"), "username": data.get("username"), "active": data.get("isActive", True), "ctx": data.get("defaultDataContext") or "Test", "actor": current_user_id()},
        True,
    )[0]
    execq("insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'reset','Initial password set')", {"u": created["id"], "a": current_user_id()})
    return js(user_dto(created), 201)


@app.route(f"{API}/users/<user_id>", methods=["PATCH"])
def update_user(user_id):
    data = body()
    updated = execq(
        """
        update app_users set name=coalesce(%(name)s,name), email=coalesce(%(email)s,email),
            username=coalesce(%(username)s,username), is_active=coalesce(%(active)s,is_active),
            default_data_context=coalesce(%(ctx)s,default_data_context),
            updated_at=now(), updated_by_user_id=%(actor)s
        where id=%(id)s returning *
        """,
        {"id": user_id, "name": data.get("name"), "email": data.get("email"), "username": data.get("username"), "active": data.get("isActive"), "ctx": data.get("defaultDataContext"), "actor": current_user_id()},
        True,
    )
    return js(user_dto(updated[0])) if updated else err("not_found", "User not found.", 404)


@app.route(f"{API}/users/<user_id>/password", methods=["POST", "PATCH"])
def reset_password(user_id):
    if not one("select id from app_users where id=%(id)s", {"id": user_id}):
        return err("not_found", "User not found.", 404)
    data = body()
    if data.get("newPassword") != data.get("confirmPassword"):
        return err("validation_error", "Passwords do not match.", 400)
    execq("insert into user_password_events (user_id,changed_by_user_id,change_type,notes) values (%(u)s,%(a)s,'reset','Password reset from API playground')", {"u": user_id, "a": current_user_id()})
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
def projects():
    if request.method == "GET":
        return list_master("projects", project_dto, "project_name")
    data = body()
    created = execq(
        "insert into projects (project_name,description,is_active,created_by_user_id,updated_by_user_id) values (%(n)s,%(d)s,%(a)s,%(u)s,%(u)s) returning *",
        {"n": data.get("projectName"), "d": data.get("description"), "a": data.get("isActive", True), "u": current_user_id()},
        True,
    )[0]
    return js(project_dto(created), 201)


@app.route(f"{API}/projects/<project_id>", methods=["PATCH"])
def update_project(project_id):
    data = body()
    updated = execq(
        "update projects set project_name=coalesce(%(n)s,project_name), description=%(d)s, is_active=coalesce(%(a)s,is_active), updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *",
        {"id": project_id, "n": data.get("projectName"), "d": data.get("description"), "a": data.get("isActive"), "u": current_user_id()},
        True,
    )
    return js(project_dto(updated[0])) if updated else err("not_found", "Project not found.", 404)


@app.route(f"{API}/environments", methods=["GET", "POST"])
def environments():
    if request.method == "GET":
        return list_master("environments", env_dto, "sort_order, environment_name")
    data = body()
    scope = infer_environment_scope(data.get("environmentName"))
    created = execq(
        """
        insert into environments (environment_name,environment_scope,description,is_active,sort_order,created_by_user_id,updated_by_user_id)
        values (%(n)s,%(s)s,%(d)s,%(a)s,%(o)s,%(u)s,%(u)s) returning *
        """,
        {"n": data.get("environmentName"), "s": scope, "d": data.get("description"), "a": data.get("isActive", True), "o": data.get("sortOrder", 0), "u": current_user_id()},
        True,
    )[0]
    return js(env_dto(created), 201)


@app.route(f"{API}/environments/<env_id>", methods=["PATCH"])
def update_environment(env_id):
    data = body()
    scope = clean_environment_scope(data.get("environmentScope")) if "environmentScope" in data else None
    if "environmentScope" in data and not scope:
        return err(
            "validation_error",
            "Environment scope must be Test or Prod.",
            400,
            [{"field": "environmentScope", "message": "Use Test for DEV/SIT/UAT/Pre-Prod style environments, or Prod for production."}],
        )
    updated = execq(
        """
        update environments set environment_name=coalesce(%(n)s,environment_name), environment_scope=coalesce(%(s)s,environment_scope),
            description=%(d)s, is_active=coalesce(%(a)s,is_active), sort_order=coalesce(%(o)s,sort_order),
            updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *
        """,
        {"id": env_id, "n": data.get("environmentName"), "s": scope, "d": data.get("description"), "a": data.get("isActive"), "o": data.get("sortOrder"), "u": current_user_id()},
        True,
    )
    return js(env_dto(updated[0])) if updated else err("not_found", "Environment not found.", 404)


@app.route(f"{API}/releases", methods=["GET", "POST"])
def releases():
    if request.method == "GET":
        return list_master("releases", release_dto, "release_version")
    data = body()
    created = execq(
        """
        insert into releases (project_id,release_version,planned_deployment_date,actual_deployment_date,is_active,created_by_user_id,updated_by_user_id)
        values (%(p)s,%(v)s,%(pd)s,%(ad)s,%(a)s,%(u)s,%(u)s) returning *
        """,
        {"p": data.get("projectId"), "v": data.get("releaseVersion"), "pd": data.get("plannedDeploymentDate"), "ad": data.get("actualDeploymentDate"), "a": data.get("isActive", True), "u": current_user_id()},
        True,
    )[0]
    return js(release_dto(created), 201)


@app.route(f"{API}/releases/<release_id>", methods=["PATCH"])
def update_release(release_id):
    data = body()
    updated = execq(
        """
        update releases set project_id=coalesce(%(p)s,project_id), release_version=coalesce(%(v)s,release_version),
            planned_deployment_date=%(pd)s, actual_deployment_date=%(ad)s, is_active=coalesce(%(a)s,is_active),
            updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning *
        """,
        {"id": release_id, "p": data.get("projectId"), "v": data.get("releaseVersion"), "pd": data.get("plannedDeploymentDate"), "ad": data.get("actualDeploymentDate"), "a": data.get("isActive"), "u": current_user_id()},
        True,
    )
    return js(release_dto(updated[0])) if updated else err("not_found", "Release not found.", 404)


def trans_dto(t):
    return {"id": str(t["id"]), "fromStatus": t["from_status"], "toStatus": t["to_status"], "displayOrder": t["display_order"], "isActive": t["is_active"]}


def workflow_dto(w):
    transitions = q("select * from workflow_transitions where workflow_definition_id=%(id)s and is_active=true order by from_status, display_order, to_status", {"id": w["id"]})
    return {"id": str(w["id"]), "workflowName": w["workflow_name"], "versionNo": w["version_no"], "isActive": w["is_active"], "diagram": w["diagram_json"], "transitions": [trans_dto(t) for t in transitions]}


@app.route(f"{API}/workflow", methods=["GET", "POST", "PUT"])
def workflow():
    if request.method == "GET":
        wf = one("select * from workflow_definitions where is_active=true order by updated_at desc limit 1")
        return js(workflow_dto(wf)) if wf else err("not_found", "No active workflow configured.", 404)
    data, diagram = body(), body().get("diagram") or {}
    nodes = {n.get("id"): n for n in diagram.get("nodes", []) if n.get("id")}
    execq("update workflow_definitions set is_active=false where is_active=true")
    version = one("select coalesce(max(version_no),0)+1 as v from workflow_definitions")["v"]
    wf = execq(
        "insert into workflow_definitions (workflow_name,diagram_json,version_no,is_active,created_by_user_id,updated_by_user_id) values (%(n)s,%(d)s,%(v)s,true,%(u)s,%(u)s) returning *",
        {"n": data.get("workflowName") or "Default Workflow", "d": psycopg2.extras.Json(diagram), "v": version, "u": current_user_id()},
        True,
    )[0]
    for i, edge in enumerate(diagram.get("edges", []), start=1):
        source, target = nodes.get(edge.get("source")), nodes.get(edge.get("target"))
        if source and target and source.get("label") and target.get("label"):
            execq("insert into workflow_transitions (workflow_definition_id,from_status,to_status,display_order,is_active) values (%(wf)s,%(f)s,%(t)s,%(o)s,true)", {"wf": wf["id"], "f": source["label"], "t": target["label"], "o": i})
    return js(workflow_dto(wf))


@app.route(f"{API}/workflow/transitions")
def workflow_transitions():
    wf = active_workflow_id()
    params, where = {"wf": wf}, "workflow_definition_id=%(wf)s and is_active=true"
    if request.args.get("fromStatus"):
        where += " and from_status=%(from)s"
        params["from"] = request.args.get("fromStatus")
    data = q(f"select * from workflow_transitions where {where} order by from_status, display_order, to_status", params) if wf else []
    return js({"items": [trans_dto(t) for t in data]})


def defect_sql(extra="", limit=True):
    lim = "limit %(limit)s offset %(offset)s" if limit else ""
    return f"""
        select d.*, p.id project_id_value, p.project_name, p.description project_description, p.is_active project_is_active, p.created_at project_created_at, p.updated_at project_updated_at,
          e.id environment_id_value, e.environment_name, e.environment_scope, e.description environment_description, e.is_active environment_is_active, e.sort_order environment_sort_order,
          s.id severity_id, s.severity_name, s.severity_rank, s.color_token severity_color_token, s.is_active severity_is_active,
          pr.id priority_id, pr.priority_name, pr.priority_rank, pr.is_active priority_is_active,
          au.id assigned_id, au.name assigned_name, au.username assigned_username, au.email assigned_email,
          cu.id created_user_id, cu.name created_name, cu.username created_username, cu.email created_email,
          r.id release_id_value, r.project_id release_project_id, r.release_version, r.planned_deployment_date, r.actual_deployment_date, r.is_active release_is_active
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
        "status": d["current_status"],
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
    rel = {"id": d["release_id_value"], "project_id": d["release_project_id"], "release_version": d["release_version"], "planned_deployment_date": d["planned_deployment_date"], "actual_deployment_date": d["actual_deployment_date"], "is_active": d["release_is_active"]} if d.get("release_id_value") else None
    dto = {"id": str(d["id"]), "defectKey": d["defect_key"], "title": d["title"], "project": project_dto(project), "environment": env_dto(env), "severity": lookup(d, "severity"), "priority": lookup(d, "priority"), "currentStatus": d["current_status"], "assignedTo": user_summary(assigned), "createdBy": user_summary(created), "fixedInRelease": release_dto(rel), "fixDate": d.get("fix_date"), "closureDate": d.get("closure_date"), "createdAt": d.get("created_at"), "updatedAt": d.get("updated_at")}
    if detail:
        dto.update({"description": d["description"], "moduleComponent": d.get("module_component"), "stepsHtml": d.get("steps_html"), "expectedResult": d.get("expected_result"), "actualResult": d.get("actual_result"), "allowedNextStatuses": allowed_statuses(d["current_status"]), "attachments": attachments_for(str(d["id"])), "inlineAssets": inline_for(str(d["id"])), "comments": comments_for(str(d["id"]))})
    return dto


def context_extra(params):
    if context() == "All":
        return ""
    params["ctx"] = context()
    return " and e.environment_scope=%(ctx)s"


@app.route(f"{API}/defects", methods=["GET", "POST"])
def defects():
    if request.method == "GET":
        params = {}
        extra = " and p.is_active=true" + context_extra(params)
        for arg, col in [("projectId", "d.project_id"), ("environmentId", "d.environment_id"), ("status", "d.current_status"), ("assignedToUserId", "d.assigned_to_user_id"), ("releaseId", "d.fixed_in_release_id"), ("severityId", "d.severity_id"), ("priorityId", "d.priority_id")]:
            if request.args.get(arg):
                extra += f" and {col}=%({arg})s"
                params[arg] = request.args.get(arg)
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
def defect_detail(defect_id, status=200):
    if request.method == "DELETE":
        out = execq("update defects set is_deleted=true, updated_at=now(), updated_by_user_id=%(u)s where id=%(id)s returning id", {"id": defect_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Defect not found.", 404)
        add_history(defect_id, "field_updated", "is_deleted", "false", "true")
        return js(status=204)
    if request.method == "PATCH":
        return patch_defect(defect_id)
    return get_defect_response(defect_id, status)


def get_defect_response(defect_id, status=200):
    d = one(defect_sql(" and d.id=%(id)s", False), {"id": defect_id})
    return js(defect_dto(d, True), status) if d else err("not_found", "Defect not found.", 404)


def patch_defect(defect_id):
    old = one("select * from defects where id=%(id)s and is_deleted=false", {"id": defect_id})
    if not old:
        return err("not_found", "Defect not found.", 404)
    mapping = {"title": "title", "description": "description", "projectId": "project_id", "moduleComponent": "module_component", "environmentId": "environment_id", "severityId": "severity_id", "priorityId": "priority_id", "currentStatus": "current_status", "assignedToUserId": "assigned_to_user_id", "stepsHtml": "steps_html", "expectedResult": "expected_result", "actualResult": "actual_result", "fixedInReleaseId": "fixed_in_release_id", "fixDate": "fix_date", "closureDate": "closure_date"}
    data, sets, params, batch = body(), [], {"id": defect_id, "actor": current_user_id()}, str(uuid.uuid4())
    if "currentStatus" in data and data.get("currentStatus") != old.get("current_status"):
        allowed = allowed_statuses(old.get("current_status"))
        if data.get("currentStatus") not in allowed:
            return err(
                "invalid_status_transition",
                f"Cannot move defect from {old.get('current_status')} to {data.get('currentStatus')}.",
                400,
                [{"field": "currentStatus", "message": f"Allowed next statuses: {', '.join(allowed) or 'none'}."}],
            )
    for k, col in mapping.items():
        if k in data:
            sets.append(f"{col}=%({col})s")
            params[col] = data.get(k)
            if str(old.get(col)) != str(data.get(k)):
                typ = {"current_status": "status_changed", "assigned_to_user_id": "assignment_changed", "severity_id": "severity_changed", "priority_id": "priority_changed", "fixed_in_release_id": "release_updated"}.get(col, "field_updated")
                add_history(defect_id, typ, col, old.get(col), data.get(k), batch=batch)
    if sets:
        execq(f"update defects set {', '.join(sets)}, updated_at=now(), updated_by_user_id=%(actor)s where id=%(id)s", params)
    return get_defect_response(defect_id)


@app.route(f"{API}/defects/<defect_id>/allowed-statuses")
def defect_allowed(defect_id):
    d = one("select current_status from defects where id=%(id)s and is_deleted=false", {"id": defect_id})
    return js({"currentStatus": d["current_status"], "allowedStatuses": allowed_statuses(d["current_status"])}) if d else err("not_found", "Defect not found.", 404)


def attachments_for(defect_id):
    data = q("select a.*, u.id user_id, u.name, u.username, u.email from defect_attachments a left join app_users u on u.id=a.uploaded_by_user_id where a.defect_id=%(id)s and a.is_deleted=false order by a.uploaded_at", {"id": defect_id})
    return [attachment_dto(a) for a in data]


def attachment_dto(a):
    return {"id": str(a["id"]), "defectId": str(a["defect_id"]), "originalFilename": a["original_filename"], "contentType": a.get("content_type"), "fileExtension": a.get("file_extension"), "fileSizeBytes": a["file_size_bytes"], "contentUrl": f"{API}/defects/{a['defect_id']}/attachments/{a['id']}/content", "uploadedBy": user_summary({"id": a.get("user_id"), "name": a.get("name"), "username": a.get("username"), "email": a.get("email")}) if a.get("user_id") else None, "uploadedAt": a.get("uploaded_at")}


@app.route(f"{API}/defects/<defect_id>/attachments", methods=["GET", "POST"])
def attachments(defect_id):
    if request.method == "GET":
        return js({"items": attachments_for(defect_id)})
    data = body()
    name = data.get("filename") or data.get("originalFilename") or "playground-upload.txt"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "txt"
    created = execq("insert into defect_attachments (defect_id,original_filename,storage_key,content_type,file_extension,file_size_bytes,uploaded_by_user_id) values (%(d)s,%(n)s,%(k)s,%(t)s,%(e)s,%(s)s,%(u)s) returning *", {"d": defect_id, "n": name, "k": f"defects/{defect_id}/attachments/{name}", "t": data.get("contentType") or "application/octet-stream", "e": ext, "s": data.get("fileSizeBytes") or 0, "u": current_user_id()}, True)[0]
    add_history(defect_id, "attachment_uploaded", "attachment", None, name, {"attachment_id": str(created["id"])})
    return js(attachment_dto({**created, **{"user_id": current_user_id(), "name": current_user()["name"], "username": current_user()["username"], "email": current_user()["email"]}}), 201)


@app.route(f"{API}/defects/<defect_id>/attachments/<attachment_id>", methods=["DELETE"])
def delete_attachment(defect_id, attachment_id):
    out = execq("update defect_attachments set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning original_filename", {"id": attachment_id, "d": defect_id, "u": current_user_id()}, True)
    if not out:
        return err("not_found", "Attachment not found.", 404)
    add_history(defect_id, "attachment_deleted", "attachment", out[0]["original_filename"], None, {"attachment_id": attachment_id})
    return js(status=204)


@app.route(f"{API}/defects/<defect_id>/attachments/<attachment_id>/content")
def attachment_content(defect_id, attachment_id):
    a = one("select * from defect_attachments where id=%(id)s and defect_id=%(d)s and is_deleted=false", {"id": attachment_id, "d": defect_id})
    return js({"message": "File storage is not wired yet.", "attachmentId": attachment_id}) if a else err("not_found", "Attachment not found.", 404)


def inline_for(defect_id):
    return [inline_dto(a) for a in q("select * from defect_inline_assets where defect_id=%(id)s and is_deleted=false order by created_at", {"id": defect_id})]


def inline_dto(a):
    return {"id": str(a["id"]), "defectId": str(a["defect_id"]), "assetKind": a["asset_kind"], "originalFilename": a.get("original_filename"), "contentType": a["content_type"], "fileSizeBytes": a.get("file_size_bytes"), "widthPx": a.get("width_px"), "heightPx": a.get("height_px"), "contentUrl": f"{API}/defects/{a['defect_id']}/inline-assets/{a['id']}/content", "createdAt": a.get("created_at")}


@app.route(f"{API}/defects/<defect_id>/inline-assets", methods=["POST"])
def upload_inline(defect_id):
    data = body()
    name = data.get("filename") or data.get("originalFilename") or "inline-step.png"
    created = execq("insert into defect_inline_assets (defect_id,asset_kind,original_filename,storage_key,content_type,file_size_bytes,width_px,height_px,created_by_user_id) values (%(d)s,'steps_image',%(n)s,%(k)s,%(t)s,%(s)s,%(w)s,%(h)s,%(u)s) returning *", {"d": defect_id, "n": name, "k": f"defects/{defect_id}/inline/{name}", "t": data.get("contentType") or "image/png", "s": data.get("fileSizeBytes"), "w": data.get("widthPx"), "h": data.get("heightPx"), "u": current_user_id()}, True)[0]
    add_history(defect_id, "inline_asset_added", "steps_html", None, name, {"inline_asset_id": str(created["id"])})
    return js(inline_dto(created), 201)


@app.route(f"{API}/defects/<defect_id>/inline-assets/<asset_id>", methods=["PATCH", "DELETE"])
def inline_asset(defect_id, asset_id):
    if request.method == "DELETE":
        out = execq("update defect_inline_assets set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning original_filename", {"id": asset_id, "d": defect_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Inline asset not found.", 404)
        add_history(defect_id, "inline_asset_deleted", "steps_html", out[0]["original_filename"], None, {"inline_asset_id": asset_id})
        return js(status=204)
    data = body()
    out = execq("update defect_inline_assets set width_px=coalesce(%(w)s,width_px), height_px=coalesce(%(h)s,height_px) where id=%(id)s and defect_id=%(d)s returning *", {"id": asset_id, "d": defect_id, "w": data.get("widthPx"), "h": data.get("heightPx")}, True)
    if not out:
        return err("not_found", "Inline asset not found.", 404)
    add_history(defect_id, "field_updated", "inline_asset_size", None, f"{data.get('widthPx')}x{data.get('heightPx')}", {"inline_asset_id": asset_id})
    return js(inline_dto(out[0]))


@app.route(f"{API}/defects/<defect_id>/inline-assets/<asset_id>/content")
def inline_content(defect_id, asset_id):
    a = one("select * from defect_inline_assets where id=%(id)s and defect_id=%(d)s and is_deleted=false", {"id": asset_id, "d": defect_id})
    return js({"message": "Inline image storage is not wired yet.", "inlineAsset": inline_dto(a)}) if a else err("not_found", "Inline asset not found.", 404)


def comments_for(defect_id):
    data = q("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.defect_id=%(id)s and c.is_deleted=false order by c.created_at", {"id": defect_id})
    return [comment_dto(c) for c in data]


def comment_dto(c):
    return {"id": str(c["id"]), "defectId": str(c["defect_id"]), "commentText": c["comment_text"], "createdBy": user_summary({"id": c["user_id"], "name": c["name"], "username": c["username"], "email": c["email"]}), "createdAt": c["created_at"], "updatedAt": c.get("updated_at")}


@app.route(f"{API}/defects/<defect_id>/comments", methods=["GET", "POST"])
def comments(defect_id):
    if request.method == "GET":
        return js({"items": comments_for(defect_id)})
    data = body()
    created = execq("insert into defect_comments (defect_id,comment_text,created_by_user_id) values (%(d)s,%(t)s,%(u)s) returning id", {"d": defect_id, "t": data.get("commentText"), "u": current_user_id()}, True)[0]
    add_history(defect_id, "comment_added", "comment", None, data.get("commentText"), {"comment_id": str(created["id"])})
    c = one("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.id=%(id)s", {"id": created["id"]})
    return js(comment_dto(c), 201)


@app.route(f"{API}/defects/<defect_id>/comments/<comment_id>", methods=["PATCH", "DELETE"])
def comment(defect_id, comment_id):
    if request.method == "DELETE":
        out = execq("update defect_comments set is_deleted=true, deleted_at=now(), deleted_by_user_id=%(u)s where id=%(id)s and defect_id=%(d)s returning comment_text", {"id": comment_id, "d": defect_id, "u": current_user_id()}, True)
        if not out:
            return err("not_found", "Comment not found.", 404)
        add_history(defect_id, "comment_deleted", "comment", out[0]["comment_text"], None, {"comment_id": comment_id})
        return js(status=204)
    old = one("select comment_text from defect_comments where id=%(id)s and defect_id=%(d)s", {"id": comment_id, "d": defect_id})
    out = execq("update defect_comments set comment_text=%(t)s, updated_at=now() where id=%(id)s and defect_id=%(d)s returning id", {"id": comment_id, "d": defect_id, "t": body().get("commentText")}, True)
    if not out:
        return err("not_found", "Comment not found.", 404)
    add_history(defect_id, "comment_updated", "comment", old["comment_text"] if old else None, body().get("commentText"), {"comment_id": comment_id})
    c = one("select c.*, u.id user_id, u.name, u.username, u.email from defect_comments c join app_users u on u.id=c.created_by_user_id where c.id=%(id)s", {"id": comment_id})
    return js(comment_dto(c))


@app.route(f"{API}/defects/<defect_id>/history")
def history(defect_id):
    page, size = int_arg("page", 1), int_arg("pageSize", 10, {10, 40, 100})
    params = {"id": defect_id, "limit": size, "offset": (page - 1) * size}
    data = q("select h.*, u.id user_id, u.name, u.username, u.email from defect_history_events h left join app_users u on u.id=h.actor_user_id where h.defect_id=%(id)s order by h.created_at desc limit %(limit)s offset %(offset)s", params)
    total = one("select count(*) count from defect_history_events where defect_id=%(id)s", params)["count"]
    items = [{"id": str(h["id"]), "defectId": str(h["defect_id"]), "eventBatchId": str(h["event_batch_id"]), "eventType": h["event_type"], "fieldName": h["field_name"], "oldValue": h["old_value"], "newValue": h["new_value"], "metadata": h["metadata_json"], "actor": user_summary({"id": h.get("user_id"), "name": h.get("name"), "username": h.get("username"), "email": h.get("email")}) if h.get("user_id") else None, "createdAt": h["created_at"]} for h in data]
    return js(paged(items, page, size, total))


@app.route(f"{API}/dashboard/summary")
def dashboard_summary():
    params = {}
    extra = " and p.is_active=true" + context_extra(params)
    data = q("select d.current_status, d.severity_id from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id where d.is_deleted=false " + extra, params)
    return js({"dataContext": context(), "totalDefects": len(data), "openDefects": len([d for d in data if d["current_status"] not in ("Closed", "Rejected")]), "fixedDefects": len([d for d in data if d["current_status"] == "Fixed"]), "closedDefects": len([d for d in data if d["current_status"] == "Closed"]), "reopenedDefects": len([d for d in data if d["current_status"] == "Reopened"]), "criticalDefects": len([d for d in data if d["severity_id"] == 4])})


def series(title, values):
    counts = {}
    for v in values:
        counts[v or "Unassigned"] = counts.get(v or "Unassigned", 0) + 1
    return {"key": title.lower().replace(" ", "-"), "title": title, "chartType": "bar", "series": [{"label": k, "value": v} for k, v in counts.items()]}


@app.route(f"{API}/dashboard/charts")
def dashboard_charts():
    params = {}
    extra = " and p.is_active=true" + context_extra(params)
    data = q("select d.current_status, s.severity_name, p.project_name, e.environment_name from defects d join projects p on p.id=d.project_id join environments e on e.id=d.environment_id join severity_levels s on s.id=d.severity_id where d.is_deleted=false " + extra, params)
    return js({"dataContext": context(), "charts": [series("Defects by Status", [d["current_status"] for d in data]), series("Defects by Severity", [d["severity_name"] for d in data]), series("Defects by Project", [d["project_name"] for d in data]), series("Defects by Environment", [d["environment_name"] for d in data])]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

(function () {
  var current = window.location.pathname.split("/").pop() || "dashboard.html";
  var navTarget = current;

  if (current === "index.html") {
    navTarget = "dashboard.html";
  }

  if (current === "defect_detail.html" || current === "defect_edit.html") {
    navTarget = "defect_list.html";
  }

  var contextStorageKey = "defectTrackerDataContext";
  var authStorageKey = "defectTrackerAuth";
  var userStorageKey = "defectTrackerUser";
  var dataSource = window.DefectTrackerData || {
    contexts: ["Test", "Prod", "All"],
    normalizeContext: function (context) { return ["Test", "Prod", "All"].indexOf(context) > -1 ? context : "Test"; },
    getDefectsForContext: function () { return []; },
    getEnvironmentsForContext: function () { return []; }
  };
  var uiIcons = {
    chevronLeft: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    grip: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="1.8"/><circle cx="15" cy="8" r="1.8"/><circle cx="9" cy="16" r="1.8"/><circle cx="15" cy="16" r="1.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    resize: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 16l8-8M13 17l4-4"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.2v5.2"/><circle cx="12" cy="7.4" r="1"/></svg>'
  };

  function setIconContent(element, iconMarkup) {
    if (element) element.innerHTML = iconMarkup;
  }

  function normalizeStatusKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function getStatusBadgeClass(value) {
    var key = normalizeStatusKey(value);
    var statusClasses = {
      "new": "badge-new",
      "assigned": "badge-assigned",
      "in-progress": "badge-progress",
      "inprogress": "badge-progress",
      "testing": "badge-retest",
      "test": "badge-retest",
      "fixed": "badge-fixed",
      "retest": "badge-retest",
      "closed": "badge-closed",
      "reopened": "badge-reopened",
      "re-open": "badge-reopened",
      "developer-rejected": "badge-reopened",
      "rejected": "badge-reopened",
      "not-a-defect": "badge-closed",
      "assigned-again": "badge-assigned"
    };
    return statusClasses[key] || "badge-neutral";
  }

  function isOpenWorkflowStatus(status, terminalStatuses) {
    var key = normalizeStatusKey(status);
    var terminalKeys = (terminalStatuses || []).map(normalizeStatusKey).filter(Boolean);
    if (!key || ["closed", "rejected"].indexOf(key) !== -1) return false;
    return terminalKeys.length ? terminalKeys.indexOf(key) === -1 : true;
  }

  function workflowStatusLabelsFromPayload(payload) {
    if (payload && Array.isArray(payload.statuses) && payload.statuses.length) {
      return payload.statuses.filter(Boolean);
    }
    var nodes = payload && payload.diagram && Array.isArray(payload.diagram.nodes) ? payload.diagram.nodes : [];
    return nodes.filter(function (node) {
      return (node.type || "process") === "process" && node.label;
    }).map(function (node) {
      return node.label;
    });
  }

  function normalizeDataContext(context) {
    return dataSource.normalizeContext ? dataSource.normalizeContext(context) : (["Test", "Prod", "All"].indexOf(context) > -1 ? context : "Test");
  }

  function getStoredDataContext() {
    try {
      return normalizeDataContext(window.localStorage.getItem(contextStorageKey));
    } catch (error) {
      return "Test";
    }
  }

  function setStoredDataContext(context) {
    var nextContext = normalizeDataContext(context);
    try {
      window.localStorage.setItem(contextStorageKey, nextContext);
    } catch (error) {
      // Ignore storage errors in restricted browser modes.
    }
    return nextContext;
  }

  function getStoredAuth() {
    try {
      var raw = window.localStorage.getItem(authStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setStoredAuth(authPayload) {
    try {
      window.localStorage.setItem(authStorageKey, JSON.stringify({
        accessToken: authPayload.accessToken,
        refreshToken: authPayload.refreshToken,
        tokenType: authPayload.tokenType || "Bearer",
        expiresIn: authPayload.expiresIn || null,
        savedAt: Date.now()
      }));
      setStoredUser(authPayload.user || {});
    } catch (error) {
      // Ignore storage errors in restricted browser modes.
    }
  }

  function clearStoredAuth() {
    try {
      window.localStorage.removeItem(authStorageKey);
      window.localStorage.removeItem(userStorageKey);
      window.localStorage.removeItem("defectTrackerProfileEmail");
    } catch (error) {
      // Ignore storage errors in restricted browser modes.
    }
  }

  function getStoredUser() {
    try {
      var raw = window.localStorage.getItem(userStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setStoredUser(user) {
    try {
      window.localStorage.setItem(userStorageKey, JSON.stringify(user || {}));
    } catch (error) {
      // Ignore storage errors in restricted browser modes.
    }
  }

  function getAuthHeader() {
    var auth = getStoredAuth();
    if (!auth || !auth.accessToken) return "";
    return (auth.tokenType || "Bearer") + " " + auth.accessToken;
  }

  function redirectToLoginAfterSessionExpired() {
    clearStoredAuth();
    window.location.href = "login.html";
  }

  function showSessionExpiredDialog() {
    var existing = document.getElementById("sessionExpiredModal");
    if (existing) {
      existing.classList.add("open");
      existing.setAttribute("aria-hidden", "false");
      return;
    }
    var modal = document.createElement("div");
    modal.id = "sessionExpiredModal";
    modal.className = "modal session-expired-modal open";
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = '<div class="modal-card session-expired-card" role="dialog" aria-modal="true" aria-labelledby="sessionExpiredTitle"><div class="modal-title-row"><div><h2 id="sessionExpiredTitle">Session expired</h2><p class="modal-subtitle">Your session could not be refreshed. Please sign in again.</p></div></div><div class="modal-actions"><button class="button-primary" type="button" data-session-login>Go to Login</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector("[data-session-login]").addEventListener("click", redirectToLoginAfterSessionExpired);
  }

  function parseApiResponse(response) {
    return response.text().then(function (text) {
      var payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (parseError) {
        var contentType = response.headers && response.headers.get ? response.headers.get("Content-Type") : "";
        var fallback = response.ok ? "The server returned an unexpected response." : "Request failed with an unexpected server response.";
        var error = new Error(fallback);
        error.status = response.status;
        error.contentType = contentType;
        throw error;
      }
      if (!response.ok) {
        var message = payload && payload.error && payload.error.message ? payload.error.message : "Request failed.";
        var error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    });
  }

  function refreshAuthToken() {
    var auth = getStoredAuth();
    if (!auth || !auth.refreshToken) {
      return Promise.reject(new Error("Session expired."));
    }
    return fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Data-Context": getStoredDataContext()
      },
      body: JSON.stringify({ refreshToken: auth.refreshToken })
    }).then(parseApiResponse).then(function (payload) {
      setStoredAuth(payload);
      return payload;
    });
  }

  function apiFetch(path, options) {
    var requestOptions = Object.assign({ method: "GET" }, options || {});
    var skipAuthRefresh = Boolean(requestOptions.skipAuthRefresh);
    var authRetry = Boolean(requestOptions.authRetry);
    delete requestOptions.skipAuthRefresh;
    delete requestOptions.authRetry;
    var headers = Object.assign({}, requestOptions.headers || {});
    headers["X-Data-Context"] = getStoredDataContext();
    if (!(requestOptions.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    var authHeader = getAuthHeader();
    if (authHeader) headers.Authorization = authHeader;
    requestOptions.headers = headers;
    return fetch(path, requestOptions).then(parseApiResponse).catch(function (error) {
      if (error.status === 401 && !skipAuthRefresh && !authRetry && current !== "login.html") {
        return refreshAuthToken().then(function () {
          return apiFetch(path, Object.assign({}, options || {}, { authRetry: true }));
        }).catch(function (refreshError) {
          showSessionExpiredDialog();
          throw refreshError;
        });
      }
      throw error;
    });
  }

  function parseBlobResponse(response) {
    if (response.ok) {
      return response.blob().then(function (blob) {
        return { blob: blob, response: response };
      });
    }
    return response.text().then(function (text) {
      var payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (error) {
        payload = {};
      }
      var message = payload && payload.error && payload.error.message ? payload.error.message : "File request failed.";
      var errObj = new Error(message);
      errObj.status = response.status;
      errObj.payload = payload;
      throw errObj;
    });
  }

  function apiBlobFetch(path, options) {
    var requestOptions = Object.assign({ method: "GET" }, options || {});
    var skipAuthRefresh = Boolean(requestOptions.skipAuthRefresh);
    var authRetry = Boolean(requestOptions.authRetry);
    delete requestOptions.skipAuthRefresh;
    delete requestOptions.authRetry;
    var headers = Object.assign({}, requestOptions.headers || {});
    headers["X-Data-Context"] = getStoredDataContext();
    var authHeader = getAuthHeader();
    if (authHeader) headers.Authorization = authHeader;
    requestOptions.headers = headers;
    return fetch(path, requestOptions).then(parseBlobResponse).catch(function (error) {
      if (error.status === 401 && !skipAuthRefresh && !authRetry && current !== "login.html") {
        return refreshAuthToken().then(function () {
          return apiBlobFetch(path, Object.assign({}, options || {}, { authRetry: true }));
        }).catch(function (refreshError) {
          showSessionExpiredDialog();
          throw refreshError;
        });
      }
      throw error;
    });
  }

  function requireAuthForPage() {
    if (current === "login.html") return;
    if (current === "index.html") return;
    if (!getStoredAuth()) {
      window.location.href = "login.html";
    }
  }

  requireAuthForPage();

  function getScopedDefectRecords() {
    return (dataSource.getDefectsForContext ? dataSource.getDefectsForContext(getStoredDataContext()) : []).map(function (record) {
      return Object.assign({ createdBy: "qa.user" }, record);
    });
  }

  function getScopedEnvironments() {
    return dataSource.getEnvironmentsForContext ? dataSource.getEnvironmentsForContext(getStoredDataContext()) : [];
  }

  function getContextLabel(context) {
    return normalizeDataContext(context) + " Context";
  }

  function dataReadMessage() {
    var activeContext = getStoredDataContext();
    var messages = {
      "dashboard.html": "Loading " + activeContext + " dashboard data...",
      "defect_list.html": "Loading " + activeContext + " defects...",
      "defect_create.html": "Loading defect form options...",
      "defect_detail.html": "Loading defect details...",
      "defect_edit.html": "Loading defect details...",
      "projects.html": "Loading projects...",
      "users.html": "Loading users...",
      "environments.html": "Loading environments...",
      "status_workflow.html": "Loading status workflow...",
      "reports.html": "Loading " + activeContext + " report data...",
      "login.html": "Checking account details..."
    };
    return messages[current] || "Loading data...";
  }

  var loaderRequests = new Map();
  var loaderRequestId = 0;
  var loader = document.createElement("div");
  var loaderText = document.createElement("p");

  loader.className = "dt-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-hidden", "true");
  loader.dataset.pendingRequests = "0";
  loader.innerHTML = '<div class="dt-loader-panel"><div class="dt-loader-mark">DT</div><p class="dt-loader-text"></p><div class="dt-loader-bar"></div></div>';
  loaderText = loader.querySelector(".dt-loader-text");
  document.body.appendChild(loader);

  function showLoader(message) {
    loaderRequestId += 1;
    loaderRequests.set(loaderRequestId, message || dataReadMessage());
    loaderText.textContent = loaderRequests.get(loaderRequestId);
    loader.setAttribute("aria-hidden", "false");
    loader.dataset.pendingRequests = String(loaderRequests.size);
    loader.classList.add("is-visible");
    return loaderRequestId;
  }

  function hideLoader(requestId) {
    if (requestId != null) {
      loaderRequests.delete(requestId);
    } else {
      var firstRequest = loaderRequests.keys().next();
      if (!firstRequest.done) loaderRequests.delete(firstRequest.value);
    }
    if (loaderRequests.size > 0) {
      var remainingMessages = Array.from(loaderRequests.values());
      loaderText.textContent = remainingMessages[remainingMessages.length - 1];
      loader.dataset.pendingRequests = String(loaderRequests.size);
      return;
    }
    loader.classList.remove("is-visible");
    loader.setAttribute("aria-hidden", "true");
    loader.dataset.pendingRequests = "0";
  }

  window.DefectTrackerLoader = {
    show: showLoader,
    hide: hideLoader,
    withLoading: function (task, message) {
      var requestId = showLoader(message);
      return Promise.resolve()
        .then(task)
        .finally(function () { hideLoader(requestId); });
    }
  };

  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, options) {
      var requestMethod = String((options && options.method) || (input && input.method) || "GET").toUpperCase();
      var tracksDataRead = requestMethod === "GET";
      var requestId = null;
      if (tracksDataRead) {
        requestId = showLoader(dataReadMessage());
      }
      try {
        var request = nativeFetch.apply(null, arguments);
        return tracksDataRead ? request.finally(function () { hideLoader(requestId); }) : request;
      } catch (error) {
        if (tracksDataRead) hideLoader(requestId);
        throw error;
      }
    };
  }

  var validationRules = {
    attachmentExtensions: ["png", "jpg", "jpeg", "pdf", "doc", "docx", "txt", "log", "json"],
    maxFiles: 10,
    maxFileBytes: 5 * 1024 * 1024
  };

  // Phase 1 keeps validation message copy parameterized in the UI.
  // Phase 2 can map these same message patterns to Flask/server constants.
  var validationMessages = {
    required: function (label) { return label + " is required."; },
    minLength: function (label, min) { return label + " must be at least " + min + " characters."; },
    maxLength: function (label, max) { return label + " must be " + max + " characters or less."; },
    email: function (label) { return label + " must be a valid email address."; },
    pattern: function (label) { return label + " has an invalid format."; },
    dateRange: function (fromLabel, toLabel) { return toLabel + " must be on or after " + fromLabel + "."; },
    duplicate: function (label) { return label + " already exists."; },
    maxFiles: function () { return "Attachments allow no more than " + validationRules.maxFiles + " files."; },
    unsupportedFile: function (fileName) { return fileName + " uses an unsupported file type."; },
    fileTooLarge: function (fileName) { return fileName + " must be 5 MB or less."; },
    match: function (fieldLabel, sourceLabel) { return fieldLabel + " must match " + sourceLabel + "."; },
    different: function (fieldLabel, sourceLabel) { return fieldLabel + " must be different from " + sourceLabel + "."; }
  };

  function fieldValue(field) {
    if (!field) return "";
    if (field.hasAttribute && field.hasAttribute("contenteditable")) return field.textContent.trim();
    return String(field.value == null ? "" : field.value).trim();
  }

  function applyAutocompletePolicy(root) {
    var scope = root || document;
    var forms = scope.matches && scope.matches("form") ? [scope] : Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll("form") : []);
    forms.forEach(function (form) {
      form.setAttribute("autocomplete", form.closest(".login-page") ? "on" : "off");
      form.setAttribute("novalidate", "novalidate");
    });

    var fields = [];
    if (scope.matches && scope.matches("input, textarea")) fields.push(scope);
    fields = fields.concat(Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll("input, textarea") : []));
    fields.forEach(function (field) {
      var type = String(field.getAttribute("type") || field.tagName || "").toLowerCase();
      if (["hidden", "file", "checkbox", "radio", "button", "submit"].indexOf(type) !== -1) return;
      if (field.hasAttribute("autocomplete")) return;
      if (field.closest(".login-page")) {
        if (field.id === "username") field.setAttribute("autocomplete", "username");
        else if (field.id === "password") field.setAttribute("autocomplete", "current-password");
        return;
      }
      if (type === "password") {
        var currentPasswordField = field.matches("[data-password-previous], [data-profile-current-password]");
        field.setAttribute("autocomplete", currentPasswordField ? "current-password" : "new-password");
        return;
      }
      field.setAttribute("autocomplete", "off");
    });
  }

  function getFieldLabel(field) {
    if (!field) return "This field";
    var id = field.id;
    var label = id ? document.querySelector('label[for="' + id + '"]') : null;
    if (!label) label = field.closest("div, td, section") ? field.closest("div, td, section").querySelector("label") : null;
    return label ? label.textContent.replace("*", "").trim() : "This field";
  }

  function getFieldErrorHost(field) {
    if (!field) return null;
    if (field.closest(".record-table")) return null;
    return field.closest(".tiptap-shell, .edit-field, .form-grid > div, .user-form-grid > div, .password-form-grid > div, .profile-form-grid > div, .login-card form, .modal-card") || field.parentElement;
  }

  function clearFieldError(field) {
    if (!field) return;
    var describedBy = field.getAttribute("aria-describedby");
    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    field.removeAttribute("title");
    if (typeof field.setCustomValidity === "function") field.setCustomValidity("");
    if (describedBy) {
      describedBy.split(/\s+/).forEach(function (id) {
        var error = id ? document.getElementById(id) : null;
        if (error && error.classList.contains("field-error")) {
          error.remove();
        }
      });
    }
    if (field.dataset && field.dataset.validationKey) {
      Array.prototype.slice.call(document.querySelectorAll('.field-error[data-for="' + field.dataset.validationKey + '"]')).forEach(function (error) {
        error.remove();
      });
    }
  }

  function setFieldError(field, message) {
    if (!field || !message) return;
    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("title", message);
    var host = getFieldErrorHost(field);
    if (!host) return;
    if (field.dataset && !field.dataset.validationKey) field.dataset.validationKey = field.id || field.name || ("field-" + Date.now() + "-" + Math.floor(Math.random() * 1000));
    var fieldKey = field.dataset ? field.dataset.validationKey : (field.id || field.name || "field");
    Array.prototype.slice.call(document.querySelectorAll('.field-error[data-for="' + fieldKey + '"]')).forEach(function (error) { error.remove(); });
    var error = document.createElement("div");
    var errorId = fieldKey + "-error";
    error.className = "field-error";
    error.id = errorId;
    error.setAttribute("data-for", fieldKey);
    error.textContent = message;
    field.setAttribute("aria-describedby", errorId);
    if (field.closest(".login-card form") && field.parentElement === host) {
      field.insertAdjacentElement("afterend", error);
    } else {
      host.appendChild(error);
    }
  }

  function clearValidation(scope) {
    var root = scope || document;
    Array.prototype.slice.call(root.querySelectorAll(".is-invalid")).forEach(clearFieldError);
    Array.prototype.slice.call(root.querySelectorAll(".field-error")).forEach(function (error) {
      error.remove();
    });
  }

  function createValidationState(scope, messageElement) {
    clearValidation(scope);
    return { ok: true, first: null, messages: [], scope: scope, messageElement: messageElement || null };
  }

  function addValidationError(state, field, message) {
    state.ok = false;
    if (!state.first) state.first = field;
    state.messages.push(message);
    setFieldError(field, message);
  }

  function requiredField(state, field, message) {
    if (!field) return;
    if (field.disabled) return;
    if (!fieldValue(field)) addValidationError(state, field, message || validationMessages.required(getFieldLabel(field)));
  }

  function maxLengthField(state, field, max, message) {
    if (!field || field.disabled) return;
    if (fieldValue(field).length > max) addValidationError(state, field, message || validationMessages.maxLength(getFieldLabel(field), max));
  }

  function minLengthField(state, field, min, message) {
    var value = fieldValue(field);
    if (value && value.length < min) addValidationError(state, field, message || validationMessages.minLength(getFieldLabel(field), min));
  }

  function patternField(state, field, pattern, message) {
    var value = fieldValue(field);
    if (value && !pattern.test(value)) addValidationError(state, field, message || validationMessages.pattern(getFieldLabel(field)));
  }

  function emailField(state, field, required) {
    var value = fieldValue(field);
    if (!value && required) {
      addValidationError(state, field, validationMessages.required(getFieldLabel(field)));
      return;
    }
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      addValidationError(state, field, validationMessages.email(getFieldLabel(field)));
    }
  }

  function dateRangeFields(state, fromField, toField, message) {
    var from = fieldValue(fromField);
    var to = fieldValue(toField);
    if (from && to && from > to) {
      addValidationError(state, toField, message || validationMessages.dateRange(getFieldLabel(fromField), getFieldLabel(toField)));
    }
  }

  function localTodayValue() {
    var today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().slice(0, 10);
  }

  function dateNotFutureField(state, field, message) {
    var value = fieldValue(field);
    if (value && value > localTodayValue()) {
      addValidationError(state, field, message || (getFieldLabel(field) + " cannot be greater than today."));
    }
  }

  function getSelectedInputFiles(input) {
    if (!input) return [];
    if (input._queuedFiles) return input._queuedFiles.slice();
    return Array.prototype.slice.call(input.files || []);
  }

  function validateFileInput(state, input) {
    if (!input) return;
    var files = getSelectedInputFiles(input);
    if (files.length > validationRules.maxFiles) {
      addValidationError(state, input, validationMessages.maxFiles());
      return;
    }
    files.some(function (file) {
      var extension = (file.name.split(".").pop() || "").toLowerCase();
      if (validationRules.attachmentExtensions.indexOf(extension) === -1) {
        addValidationError(state, input, validationMessages.unsupportedFile(file.name));
        return true;
      }
      if (file.size > validationRules.maxFileBytes) {
        addValidationError(state, input, validationMessages.fileTooLarge(file.name));
        return true;
      }
      return false;
    });
  }

  function setValidationMessage(element, text, state) {
    if (!element) return;
    element.textContent = text || "";
    element.classList.toggle("is-error", state === "error");
    element.classList.toggle("is-success", state === "success");
  }

  var validationToastTimer = null;
  function showValidationToast(text) {
    if (!text) return;
    var toast = document.querySelector("[data-validation-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "validation-toast";
      toast.setAttribute("data-validation-toast", "");
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("is-error");
    toast.classList.add("is-visible");
    window.clearTimeout(validationToastTimer);
    validationToastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function revealValidationField(field) {
    if (!field) return;
    var panel = field.closest("[data-tab-panel]");
    if (!panel || !panel.hidden) return;
    var tabs = panel.closest("[data-tabs]");
    if (!tabs) return;
    var target = panel.getAttribute("data-tab-panel");
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll("[data-tab-target]"));
    var panels = Array.prototype.slice.call(tabs.querySelectorAll("[data-tab-panel]"));
    buttons.forEach(function (button) {
      var isActive = button.getAttribute("data-tab-target") === target;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    panels.forEach(function (item) {
      var isActive = item === panel;
      item.classList.toggle("active", isActive);
      item.hidden = !isActive;
    });
  }

  function finishValidation(state, successText) {
    if (!state.ok) {
      var hasFieldMessages = state.scope && state.scope.querySelector && state.scope.querySelector(".field-error");
      setValidationMessage(state.messageElement, hasFieldMessages ? "" : (state.messages[0] || "Fix the highlighted fields."), hasFieldMessages ? "" : "error");
      revealValidationField(state.first);
      if (state.first && typeof state.first.focus === "function") state.first.focus();
      return false;
    }
    setValidationMessage(state.messageElement, successText || "", successText ? "success" : "");
    return true;
  }

  function clearEditedFieldValidation(event) {
    var target = event.target;
    if (!target || !target.matches) return;
    var field = target.matches("input, select, textarea, [contenteditable='true']")
      ? target
      : target.closest("input, select, textarea, [contenteditable='true']");
    if (!field || !field.classList.contains("is-invalid")) return;
    clearFieldError(field);
    var summaryRoot = field.closest("form, .modal-card");
    if (summaryRoot) {
      var summary = summaryRoot.querySelector("[data-form-message], [data-profile-message], [data-user-message], [data-password-message]");
      setValidationMessage(summary, "", "");
    }
  }

  document.addEventListener("input", clearEditedFieldValidation, true);
  document.addEventListener("change", clearEditedFieldValidation, true);

  function validateLiveTextArea(field, maxLength) {
    if (!field) return;
    if (field.disabled) {
      clearFieldError(field);
      return;
    }
    var value = fieldValue(field);
    if (!value) {
      setFieldError(field, validationMessages.required(getFieldLabel(field)));
      return;
    }
    if (maxLength && value.length > maxLength) {
      setFieldError(field, validationMessages.maxLength(getFieldLabel(field), maxLength));
      return;
    }
    clearFieldError(field);
  }

  function setupLiveResultValidation() {
    ["#expected", "#actual", "#editExpected", "#editActual"].forEach(function (selector) {
      var field = document.querySelector(selector);
      if (!field) return;
      var max = selector.indexOf("actual") !== -1 || selector.indexOf("expected") !== -1 ? 1500 : 1500;
      var handler = function () {
        validateLiveTextArea(field, max);
      };
      field.addEventListener("input", handler);
      field.addEventListener("blur", handler);
    });
  }

  setupLiveResultValidation();

  function getExistingColumnValues(tableBody, columnIndex, excludeRow) {
    if (!tableBody) return [];
    return Array.prototype.slice.call(tableBody.querySelectorAll("tr")).filter(function (row) {
      return row !== excludeRow && !row.hidden && !row.classList.contains("inline-add-row");
    }).map(function (row) {
      return row.cells[columnIndex] ? row.cells[columnIndex].textContent.trim().toLowerCase() : "";
    }).filter(Boolean);
  }

  function validateDuplicateName(state, field, tableBody, columnIndex, excludeRow, label) {
    var value = fieldValue(field).toLowerCase();
    if (!value) return;
    if (getExistingColumnValues(tableBody, columnIndex, excludeRow).indexOf(value) !== -1) {
      addValidationError(state, field, validationMessages.duplicate(label || getFieldLabel(field)));
    }
  }

  function validatePasswordPair(state, currentField, newField, confirmField, requireAll) {
    var current = fieldValue(currentField);
    var next = fieldValue(newField);
    var confirm = fieldValue(confirmField);
    var any = current || next || confirm;
    if (!any && !requireAll) return;
    requiredField(state, currentField);
    requiredField(state, newField);
    requiredField(state, confirmField);
    if (next) minLengthField(state, newField, 8);
    if (next && confirm && next !== confirm) addValidationError(state, confirmField, "Passwords must match.");
    if (current && next && current === next) addValidationError(state, newField, "Use a different new password.");
  }

  function validateDefectForm(form) {
    var isEdit = form.id === "defectEditForm";
    var message = form.querySelector("[data-form-message]");
    var state = createValidationState(form, message);
    var title = form.querySelector(isEdit ? "#editTitle" : "#title");
    var description = form.querySelector(isEdit ? "#editDescription" : "#description");
    var moduleField = form.querySelector(isEdit ? "#editModule" : "#module");
    var project = form.querySelector(isEdit ? "#editProject" : "#project");
    var environment = form.querySelector(isEdit ? "#editEnvironment" : "#environment");
    var severity = form.querySelector(isEdit ? "#editSeverity" : "#severity");
    var priority = form.querySelector(isEdit ? "#editPriority" : "#priority");
    var status = form.querySelector(isEdit ? "#editStatus" : "#status");
    var assigned = form.querySelector(isEdit ? "#editAssigned" : "#assigned");
    var steps = form.querySelector("[data-steps-editor]");
    var expected = form.querySelector(isEdit ? "#editExpected" : "#expected");
    var actual = form.querySelector(isEdit ? "#editActual" : "#actual");
    var release = form.querySelector("#editRelease");
    var deployment = form.querySelector("#editDeployment");
    var fixDate = form.querySelector("#editFixDate");
    var closureDate = form.querySelector("#editClosureDate");
    var attachmentInput = form.querySelector("[data-file-input]");

    if (title) {
      requiredField(state, title);
      minLengthField(state, title, 5);
      maxLengthField(state, title, 120);
    }
    requiredField(state, description);
    minLengthField(state, description, 10);
    maxLengthField(state, description, 1000);
    maxLengthField(state, moduleField, 80);
    [project, environment, severity, priority, status, assigned].forEach(function (field) { requiredField(state, field); });
    maxLengthField(state, steps, 4000);
    requiredField(state, expected);
    maxLengthField(state, expected, 1500);
    requiredField(state, actual);
    maxLengthField(state, actual, 1500);
    validateFileInput(state, attachmentInput);

    if (isEdit && fixDate) {
      dateNotFutureField(state, fixDate, "Fix Date cannot be greater than today.");
    }
    if (isEdit && release) {
      maxLengthField(state, release, 80);
    }
    if (isEdit && status && status.value === "Fixed") {
      requiredField(state, release, "Release Version is required when fixing a defect.");
      requiredField(state, deployment, "Release Deployment Date is required when fixing a defect.");
      requiredField(state, fixDate, "Fix Date is required when fixing a defect.");
    }
    if (isEdit && status && status.value === "Closed") {
      requiredField(state, closureDate, "Closure Date is required when closing a defect.");
    }
    if (fixDate && closureDate && !closureDate.disabled) dateRangeFields(state, fixDate, closureDate, "Closure Date must be on or after Fix Date.");
    return finishValidation(state, form.getAttribute("data-form-success") || "Defect saved for review");
  }

  function validateLoginForm(form) {
    var state = createValidationState(form, form.querySelector("[data-form-message]"));
    var username = form.querySelector("#username");
    var password = form.querySelector("#password");
    requiredField(state, username);
    minLengthField(state, username, 3);
    requiredField(state, password);
    return finishValidation(state, "");
  }

  function showAccountConfirmationDialog(options) {
    var dialogOptions = options || {};
    var existing = document.getElementById("accountConfirmationModal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "accountConfirmationModal";
    modal.className = "modal account-confirmation-modal open";
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = '<div class="modal-card account-confirmation-card" role="dialog" aria-modal="true" aria-labelledby="accountConfirmationTitle"><div class="modal-title-row"><div><h2 id="accountConfirmationTitle">' + (dialogOptions.title || "Profile updated") + '</h2><p class="modal-subtitle">' + (dialogOptions.message || "Your changes were saved successfully.") + '</p></div></div><div class="modal-actions"><button class="button-primary" type="button" data-account-confirm>' + (dialogOptions.actionLabel || "Done") + '</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector("[data-account-confirm]").addEventListener("click", function () {
      modal.remove();
      if (typeof dialogOptions.onConfirm === "function") {
        dialogOptions.onConfirm();
      }
    });
    if (dialogOptions.autoConfirmMs && dialogOptions.autoConfirmMs > 0) {
      window.setTimeout(function () {
        var confirmButton = modal.querySelector("[data-account-confirm]");
        if (confirmButton && document.body.contains(modal)) {
          confirmButton.click();
        }
      }, dialogOptions.autoConfirmMs);
    }
  }

  function getSelectedLoginContext() {
    var active = document.querySelector("[data-login-context].active");
    return active ? normalizeDataContext(active.getAttribute("data-login-context")) : "";
  }

  function performLogin(form) {
    var message = form.querySelector("[data-form-message]");
    var loginButton = form.querySelector("[data-login-link]");
    var username = form.querySelector("#username");
    var password = form.querySelector("#password");
    var selectedContext = getSelectedLoginContext();
    setValidationMessage(message, "", "");
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = "Logging in...";
    }
    var loginPayload = {
      username: fieldValue(username),
      password: fieldValue(password)
    };
    if (selectedContext) {
      loginPayload.dataContext = selectedContext;
    }
    return apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(loginPayload)
    }).then(function (payload) {
      setStoredDataContext(payload.activeDataContext || selectedContext || "Test");
      setStoredAuth(payload);
      setValidationMessage(message, "Login successful.", "success");
      window.location.href = "dashboard.html";
    }).catch(function (error) {
      setValidationMessage(message, error.message || "Invalid username or password.", "error");
      if (password && typeof password.focus === "function") password.focus();
    }).finally(function () {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
      }
    });
  }

  (function setupLoginContextSelector() {
    var loginContextGroup = document.querySelector("[data-login-context-group]");
    if (!loginContextGroup) return;
    var selectedContext = "";

    function renderLoginContext() {
      Array.prototype.slice.call(loginContextGroup.querySelectorAll("[data-login-context]")).forEach(function (button) {
        var isActive = button.getAttribute("data-login-context") === selectedContext;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    loginContextGroup.addEventListener("click", function (event) {
      var button = event.target.closest("[data-login-context]");
      if (!button) return;
      selectedContext = normalizeDataContext(button.getAttribute("data-login-context"));
      renderLoginContext();
    });

    renderLoginContext();
  })();

  (function setupDefectListSort() {
    var defectTable = document.querySelector("[data-defect-list-table]");
    if (!defectTable) return;
    if (defectTable.hasAttribute("data-client-pagination")) return;
    var tbody = defectTable.querySelector("tbody");
    if (!tbody) return;
    var headers = Array.prototype.slice.call(defectTable.querySelectorAll("th[data-sort-key]"));
    if (!headers.length) return;
    var severityWeights = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    var priorityWeights = { P1: 4, P2: 3, P3: 2, P4: 1 };
    var sortKeyToIndex = {};
    headers.forEach(function (th, index) {
      sortKeyToIndex[th.getAttribute("data-sort-key")] = index;
    });
    var currentSortKey = null;
    var currentSortAsc = true;
    function getCellText(row, columnIndex) {
      var cell = row.children[columnIndex];
      if (!cell) return "";
      return cell.textContent.trim();
    }
    function compareValues(key, a, b) {
      if (key === "severity") {
        return (severityWeights[a] || 0) - (severityWeights[b] || 0);
      }
      if (key === "priority") {
        return (priorityWeights[a] || 0) - (priorityWeights[b] || 0);
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }
    function applySort(key) {
      if (currentSortKey === key) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortKey = key;
        currentSortAsc = true;
      }
      var columnIndex = sortKeyToIndex[key];
      var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
      rows.sort(function (a, b) {
        var result = compareValues(key, getCellText(a, columnIndex), getCellText(b, columnIndex));
        return currentSortAsc ? result : -result;
      });
      rows.forEach(function (row) {
        tbody.appendChild(row);
      });
      headers.forEach(function (th) {
        th.classList.remove("sorted-asc", "sorted-desc");
      });
      var activeHeader = defectTable.querySelector('th[data-sort-key="' + key + '"]');
      if (activeHeader) {
        activeHeader.classList.add(currentSortAsc ? "sorted-asc" : "sorted-desc");
      }
    }
    headers.forEach(function (th) {
      th.addEventListener("click", function () {
        applySort(th.getAttribute("data-sort-key"));
      });
    });
  })();

  // Wires up an Export split-button: a primary "Current view" button + a caret that opens a small
  // menu with two items ("Current view" / "All columns"). The supplied exportFn is called with the
  // chosen mode string ("current" | "all"). Designed to be safe if any element is missing.
  function initExportSplit(root, exportFn) {
    if (!root || typeof exportFn !== "function") return;
    var toggle = root.querySelector("[data-export-toggle]");
    var menu = root.querySelector("[data-export-menu]");
    var main = root.querySelector(".export-split-main");
    if (!toggle || !menu) return;
    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", outsideClick, true);
      document.removeEventListener("keydown", keyHandler, true);
    }
    function openMenu() {
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      document.addEventListener("click", outsideClick, true);
      document.addEventListener("keydown", keyHandler, true);
    }
    function outsideClick(event) {
      if (!root.contains(event.target)) closeMenu();
    }
    function keyHandler(event) {
      if (event.key === "Escape") { closeMenu(); toggle.focus(); }
    }
    function handleTriggerClick(event) {
      event.stopPropagation();
      event.preventDefault();
      if (menu.hidden) openMenu(); else closeMenu();
    }
    toggle.addEventListener("click", handleTriggerClick);
    if (main) main.addEventListener("click", handleTriggerClick);
    Array.prototype.slice.call(menu.querySelectorAll("[data-export-mode]")).forEach(function (item) {
      item.addEventListener("click", function () {
        var mode = item.getAttribute("data-export-mode") || "current";
        closeMenu();
        exportFn(mode);
      });
    });
  }

  function getPagedRows(rows, page, pageSize) {
    var start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }

  function renderTablePagination(root, state, totalItems, itemLabel, onPageChange) {
    if (!root) return;
    var totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    root.innerHTML = "";
    root.hidden = false;

    var pageSizeLabel = document.createElement("label");
    var pageSizeText = document.createElement("span");
    var pageSizeSelect = document.createElement("select");
    pageSizeLabel.className = "table-page-size";
    pageSizeText.textContent = "Rows";
    [10, 40, 100].forEach(function (size) {
      var option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.value = String(state.pageSize);
    pageSizeSelect.setAttribute("aria-label", itemLabel + " page size");
    pageSizeSelect.addEventListener("change", function () {
      state.pageSize = Number(pageSizeSelect.value) || 10;
      state.page = 1;
      onPageChange(1);
    });
    pageSizeLabel.appendChild(pageSizeText);
    pageSizeLabel.appendChild(pageSizeSelect);
    root.appendChild(pageSizeLabel);

    if (totalItems <= state.pageSize) {
      var singleSummary = document.createElement("span");
      singleSummary.className = "table-page-summary";
      singleSummary.textContent = totalItems ? "All records shown" : "No records";
      root.appendChild(singleSummary);
      root.setAttribute("aria-label", itemLabel + " pagination");
      return;
    }

    var previous = document.createElement("button");
    var next = document.createElement("button");
    var summary = document.createElement("span");
    summary.className = "table-page-summary";
    previous.type = "button";
    next.type = "button";
    previous.textContent = "Previous";
    next.textContent = "Next";
    previous.disabled = state.page === 1;
    next.disabled = state.page === totalPages;
    summary.textContent = "Page " + state.page + " of " + totalPages;

    previous.addEventListener("click", function () {
      if (state.page <= 1) return;
      onPageChange(state.page - 1);
    });
    next.addEventListener("click", function () {
      if (state.page >= totalPages) return;
      onPageChange(state.page + 1);
    });

    root.appendChild(previous);
    root.appendChild(summary);
    root.appendChild(next);
    root.setAttribute("aria-label", itemLabel + " pagination");
  }

  (function setupBackLink() {
    var backLinks = Array.prototype.slice.call(document.querySelectorAll("[data-back-link]"));
    var editDefectLink = document.querySelector("[data-edit-defect-link]");
    var cancelDefectLinks = Array.prototype.slice.call(document.querySelectorAll("[data-cancel-defect-link]"));
    var params = new URLSearchParams(window.location.search);
    var back = params.get("back");

    function isUnsafeBackTarget(target) {
      return /^(https?:|\/\/|javascript:|data:)/i.test(target || "");
    }

    function getBackPage(target) {
      var cleanTarget = String(target || "").split("?")[0].split("#")[0].replace(/\\/g, "/").toLowerCase();
      if (cleanTarget.indexOf("dashboard.html") !== -1) return "dashboard";
      if (cleanTarget.indexOf("defect_list.html") !== -1) return "defects";
      return "defects";
    }

    var safeReferrer = document.referrer && !isUnsafeBackTarget(document.referrer) ? document.referrer : "";
    var safeBack = back && !isUnsafeBackTarget(back)
      ? back
      : (safeReferrer && getBackPage(safeReferrer) === "dashboard" ? safeReferrer : "defect_list.html");
    var backPage = getBackPage(back || document.referrer || safeBack);

    backLinks.forEach(function (backLink) {
      backLink.setAttribute("href", safeBack);
      var label = backLink.querySelector("span");
      var linkText = backPage === "dashboard" ? "&larr; Back to Dashboard" : "&larr; Back to Defects";
      if (label) label.innerHTML = linkText;
      else backLink.innerHTML = linkText;
    });

    if (editDefectLink) {
      if (backPage === "dashboard") {
        editDefectLink.remove();
        return;
      }

      var defectId = params.get("id") || "DF-1042";
      editDefectLink.hidden = false;
      editDefectLink.removeAttribute("aria-hidden");
      editDefectLink.href = "defect_edit.html?id=" + encodeURIComponent(defectId) + "&back=" + encodeURIComponent(safeBack);
    }

    cancelDefectLinks.forEach(function (cancelDefectLink) {
      var cancelDefectId = params.get("id") || "DF-1042";
      cancelDefectLink.href = "defect_detail.html?id=" + encodeURIComponent(cancelDefectId) + "&back=" + encodeURIComponent(safeBack);
    });
  })();

  var appShell = document.querySelector(".app-shell");
  var sidebar = document.querySelector(".sidebar");
  var sidebarToggle = document.querySelector("[data-sidebar-toggle]");
  var sidebarToggleIcon = document.querySelector("[data-sidebar-toggle-icon]");
  var sidebarStorageKey = "defectTrackerSidebarCollapsed";
  var sidebarModeStorageKey = "defectTrackerSidebarMode";
  var sidebarRestoreTab = null;

  function getSidebarLabel(link) {
    var clone = link.cloneNode(true);
    var icon = clone.querySelector(".nav-icon");
    if (icon) icon.remove();
    return clone.textContent.trim();
  }

  function refreshAfterSidebarChange() {
    window.dispatchEvent(new Event("resize"));
    window.setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
    }, 220);
  }

  function setSidebarMode(mode) {
    if (!appShell) return;
    var isCollapsed = mode === "collapsed";
    var isHidden = mode === "hidden";
    appShell.classList.toggle("sidebar-collapsed", isCollapsed);
    appShell.classList.toggle("sidebar-hidden", isHidden);
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
      sidebarToggle.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar");
      sidebarToggle.title = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
    }
    if (sidebarToggleIcon) {
      setIconContent(sidebarToggleIcon, isCollapsed ? uiIcons.chevronRight : uiIcons.chevronLeft);
    }
    if (sidebarRestoreTab) {
      sidebarRestoreTab.classList.toggle("is-visible", isHidden);
      sidebarRestoreTab.hidden = !isHidden;
    }
  }

  function saveSidebarMode(mode) {
    try {
      window.localStorage.setItem(sidebarModeStorageKey, mode);
      window.localStorage.setItem(sidebarStorageKey, String(mode === "collapsed"));
    } catch (error) {
      // Ignore storage errors in restricted browser modes.
    }
  }

  if (appShell && sidebar) {
    var storedUser = getStoredUser() || {};
    var displayUsername = storedUser.username || "qa.user";
    var displayEmail = storedUser.email || "qa.user@improvesoftwarelabs.com";
    var profileUser = Object.assign({}, storedUser);
    var brandLink = sidebar.querySelector(".brand");
    if (brandLink) {
      brandLink.setAttribute("role", "link");
      brandLink.setAttribute("tabindex", "0");
      brandLink.setAttribute("title", "Go to dashboard");
      brandLink.setAttribute("aria-label", "Go to dashboard");
      brandLink.addEventListener("click", function () {
        window.location.href = "dashboard.html";
      });
      brandLink.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.location.href = "dashboard.html";
        }
      });
    }

    var sidebarProfile = document.createElement("div");
    sidebarProfile.className = "sidebar-profile";
    sidebarProfile.innerHTML = '<button class="sidebar-profile-trigger" type="button" aria-expanded="false" data-profile-trigger><span class="sidebar-profile-user">' + displayUsername + '</span><span class="sidebar-profile-separator">|</span><span class="sidebar-profile-context" data-profile-context></span></button><div class="sidebar-profile-menu" data-profile-menu hidden><div class="profile-menu-head"><strong>' + displayUsername + '</strong><button class="profile-icon-button" type="button" title="Open profile" aria-label="Open profile" data-open-profile-modal><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg></button></div><div class="profile-context-block"><span class="profile-context-label">Context</span><div class="profile-context-links" role="group" aria-label="Data context"><button class="context-menu-option" type="button" data-profile-context-option="Test">Test</button><span aria-hidden="true">|</span><button class="context-menu-option" type="button" data-profile-context-option="Prod">Prod</button><span aria-hidden="true">|</span><button class="context-menu-option" type="button" data-profile-context-option="All">All</button></div></div><a class="profile-menu-action profile-logout-link" href="login.html" data-logout-link>Logout</a></div>';
    sidebar.appendChild(sidebarProfile);

    var profileTrigger = sidebarProfile.querySelector("[data-profile-trigger]");
    var profileMenu = sidebarProfile.querySelector("[data-profile-menu]");
    var profileContextLabel = sidebarProfile.querySelector("[data-profile-context]");
    var profileContextButtons = Array.prototype.slice.call(sidebarProfile.querySelectorAll("[data-profile-context-option]"));
    var openProfileModalButton = sidebarProfile.querySelector("[data-open-profile-modal]");
    var logoutLink = sidebarProfile.querySelector("[data-logout-link]");

    function getProfileEmail() {
      return (profileUser && profileUser.email) || displayEmail;
    }

    function applyProfileUser(user) {
      if (!user) return;
      profileUser = Object.assign({}, profileUser || {}, user);
      displayEmail = profileUser.email || displayEmail;
      displayUsername = profileUser.username || displayUsername;
      setStoredUser(profileUser);
    }

    function refreshProfileUser() {
      return apiFetch("/api/v1/auth/me").then(function (payload) {
        applyProfileUser(payload.user || {});
        return profileUser;
      });
    }

    function ensureProfileModal() {
      var existing = document.getElementById("profileModal");
      if (existing) return existing;
      var modal = document.createElement("div");
      modal.id = "profileModal";
      modal.className = "modal profile-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = '<div class="modal-card profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle"><div class="modal-title-row"><div><h2 id="profileModalTitle">Profile</h2><p class="modal-subtitle">Update account contact and password details.</p></div></div><div class="profile-modal-summary"><strong>' + displayUsername + '</strong></div><div class="profile-form-grid"><div><label for="profileEmail">Email</label><input id="profileEmail" type="email" data-profile-email></div><div><label for="profileCurrentPassword">Current Password</label><input id="profileCurrentPassword" type="password" data-profile-current-password></div><div><label for="profileNewPassword">New Password</label><input id="profileNewPassword" type="password" data-profile-new-password></div><div><label for="profileConfirmPassword">Confirm Password</label><input id="profileConfirmPassword" type="password" data-profile-confirm-password></div></div><p class="modal-message" data-profile-message></p><div class="modal-actions"><button type="button" data-close-profile-modal>Cancel</button><button class="button-primary" type="button" data-save-profile>Save Profile</button></div></div>';
      document.body.appendChild(modal);
      modal.querySelector("[data-save-profile]").addEventListener("click", function (event) {
        event.preventDefault();
        saveProfileModal();
      });
      return modal;
    }

    function openProfileModal() {
      var modal = ensureProfileModal();
      var emailInput = modal.querySelector("[data-profile-email]");
      var message = modal.querySelector("[data-profile-message]");
      if (emailInput) {
        emailInput.value = getProfileEmail();
        emailInput.disabled = true;
      }
      Array.prototype.slice.call(modal.querySelectorAll("input[type='password']")).forEach(function (input) {
        input.value = "";
      });
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error", "is-success");
      }
      clearValidation(modal);
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      setProfileMessage(modal, "Loading profile...", "");
      refreshProfileUser().then(function () {
        if (emailInput) {
          emailInput.value = getProfileEmail();
          emailInput.disabled = false;
          emailInput.focus();
        }
        setProfileMessage(modal, "", "");
      }).catch(function (error) {
        if (emailInput) emailInput.disabled = false;
        setProfileMessage(modal, error.message || "Profile could not be loaded.", "error");
      });
    }

    function closeProfileModal() {
      var modal = document.getElementById("profileModal");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    function setProfileMessage(modal, text, state) {
      var message = modal.querySelector("[data-profile-message]");
      if (!message) return;
      message.textContent = text || "";
      message.classList.toggle("is-error", state === "error");
      message.classList.toggle("is-success", state === "success");
    }

    function finishProfileValidation(state, modal) {
      if (!state.ok) {
        setProfileMessage(modal, modal.querySelector(".field-error") ? "" : "Review the highlighted profile fields.", modal.querySelector(".field-error") ? "" : "error");
        if (state.first && typeof state.first.focus === "function") state.first.focus();
        return false;
      }
      setProfileMessage(modal, "", "");
      return true;
    }

    function saveProfileModal() {
      var modal = ensureProfileModal();
      var emailInput = modal.querySelector("[data-profile-email]");
      var currentPassword = modal.querySelector("[data-profile-current-password]");
      var newPassword = modal.querySelector("[data-profile-new-password]");
      var confirmPassword = modal.querySelector("[data-profile-confirm-password]");
      var saveButton = modal.querySelector("[data-save-profile]");
      var state = createValidationState(modal, null);
      var email = emailInput ? emailInput.value.trim() : "";
      var originalEmail = getProfileEmail().trim();
      var emailChanged = email.toLowerCase() !== originalEmail.toLowerCase();
      var wantsPasswordChange = [currentPassword, newPassword, confirmPassword].some(function (input) {
        return input && input.value.trim();
      });

      emailField(state, emailInput, true);
      if (!emailChanged && !wantsPasswordChange) {
        setProfileMessage(modal, "Update email or enter a new password.", "error");
        if (newPassword && typeof newPassword.focus === "function") newPassword.focus();
        return;
      }
      validatePasswordPair(state, currentPassword, newPassword, confirmPassword, wantsPasswordChange);
      if (!finishProfileValidation(state, modal)) return;

      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
      }
      setProfileMessage(modal, "Saving profile...", "");

      var tasks = Promise.resolve();
      if (wantsPasswordChange) {
        tasks = tasks.then(function () {
          return apiFetch("/api/v1/auth/password", {
            method: "POST",
            body: JSON.stringify({
              previousPassword: fieldValue(currentPassword),
              newPassword: fieldValue(newPassword),
              confirmPassword: fieldValue(confirmPassword)
            })
          });
        });
      }
      if (emailChanged) {
        tasks = tasks.then(function () {
          return apiFetch("/api/v1/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({ email: email })
          }).then(function (user) {
            applyProfileUser(user);
          });
        });
      }

      tasks.then(function () {
        Array.prototype.slice.call(modal.querySelectorAll("input[type='password']")).forEach(function (input) {
          input.value = "";
        });
        if (wantsPasswordChange) {
          closeProfileModal();
          showAccountConfirmationDialog({
            title: "Password updated",
            message: emailChanged ? "Profile updated. Please sign in again with your new password." : "Please sign in again with your new password.",
            actionLabel: "Go to Login",
            onConfirm: redirectToLoginAfterSessionExpired
          });
        } else {
          closeProfileModal();
          showAccountConfirmationDialog({
            title: "Profile updated",
            message: "Your email address was updated successfully.",
            actionLabel: "Done"
          });
        }
      }).catch(function (error) {
        setProfileMessage(modal, error.message || "Profile update failed.", "error");
        showValidationToast(error.message || "Profile update failed.");
      }).finally(function () {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save Profile";
        }
      });
    }

    function renderProfileContext() {
      var activeContext = getStoredDataContext();
      if (profileContextLabel) profileContextLabel.textContent = activeContext;
      profileContextButtons.forEach(function (button) {
        var isActive = button.getAttribute("data-profile-context-option") === activeContext;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function closeProfileMenu() {
      profileMenu.hidden = true;
      profileTrigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", handleProfileOutsideClick, true);
      document.removeEventListener("keydown", handleProfileKeydown, true);
    }

    function openProfileMenu() {
      renderProfileContext();
      profileMenu.hidden = false;
      profileTrigger.setAttribute("aria-expanded", "true");
      document.addEventListener("click", handleProfileOutsideClick, true);
      document.addEventListener("keydown", handleProfileKeydown, true);
    }

    function handleProfileOutsideClick(event) {
      if (!sidebarProfile.contains(event.target)) closeProfileMenu();
    }

    function handleProfileKeydown(event) {
      if (event.key === "Escape") closeProfileMenu();
    }

    profileTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      if (profileMenu.hidden) openProfileMenu();
      else closeProfileMenu();
    });

    if (openProfileModalButton) {
      openProfileModalButton.addEventListener("click", function () {
        closeProfileMenu();
        openProfileModal();
      });
    }

    document.addEventListener("click", function (event) {
      var modal = document.getElementById("profileModal");
      if (!modal) return;
      if (event.target === modal || event.target.closest("[data-close-profile-modal]")) {
        closeProfileModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeProfileModal();
    });

    profileContextButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var previousContext = getStoredDataContext();
        var nextContext = setStoredDataContext(button.getAttribute("data-profile-context-option"));
        renderProfileContext();
        closeProfileMenu();
        if (nextContext === previousContext) return;
        window.dispatchEvent(new CustomEvent("defectTrackerContextChanged", { detail: { context: nextContext } }));
        if (current !== "login.html") {
          showLoader("Switching to " + nextContext + " context...");
          window.setTimeout(function () {
            window.location.reload();
          }, 50);
        }
      });
    });

    if (logoutLink) {
      logoutLink.addEventListener("click", function (event) {
        event.preventDefault();
        apiFetch("/api/v1/auth/logout", { method: "POST", skipAuthRefresh: true }).catch(function () {
          // Logout should end the local session even if the server is already unavailable.
        }).finally(function () {
          clearStoredAuth();
          window.location.href = "login.html";
        });
      });
    }

    renderProfileContext();
    refreshProfileUser().catch(function () {
      // Keep the last authenticated user snapshot visible; API-backed actions still surface errors.
    });

    var sidebarHideAction = document.createElement("button");
    sidebarHideAction.type = "button";
    sidebarHideAction.className = "sidebar-hide-action";
    sidebarHideAction.textContent = "Hide Menu";
    sidebarHideAction.title = "Hide menu";
    sidebarHideAction.setAttribute("data-sidebar-hide", "");
    sidebar.appendChild(sidebarHideAction);

    sidebarRestoreTab = document.createElement("button");
    sidebarRestoreTab.type = "button";
    sidebarRestoreTab.className = "sidebar-restore-tab";
    sidebarRestoreTab.innerHTML = uiIcons.chevronRight;
    sidebarRestoreTab.hidden = true;
    sidebarRestoreTab.title = "Show menu";
    sidebarRestoreTab.setAttribute("aria-label", "Show menu");
    sidebarRestoreTab.setAttribute("data-sidebar-restore", "");
    document.body.appendChild(sidebarRestoreTab);

    var savedSidebarMode = "expanded";
    try {
      savedSidebarMode = window.localStorage.getItem(sidebarModeStorageKey) || (window.localStorage.getItem(sidebarStorageKey) === "true" ? "collapsed" : "expanded");
    } catch (error) {
      savedSidebarMode = "expanded";
    }
    if (["expanded", "collapsed", "hidden"].indexOf(savedSidebarMode) === -1) {
      savedSidebarMode = "expanded";
    }
    setSidebarMode(savedSidebarMode);

    sidebarHideAction.addEventListener("click", function (event) {
      setSidebarMode("hidden");
      saveSidebarMode("hidden");
      refreshAfterSidebarChange();
      if (event.detail) sidebarHideAction.blur();
    });

    sidebarRestoreTab.addEventListener("click", function (event) {
      setSidebarMode("expanded");
      saveSidebarMode("expanded");
      refreshAfterSidebarChange();
      if (event.detail) sidebarRestoreTab.blur();
    });

    if (sidebarToggle) sidebarToggle.addEventListener("click", function (event) {
      var nextCollapsed = !appShell.classList.contains("sidebar-collapsed");
      var nextMode = nextCollapsed ? "collapsed" : "expanded";
      setSidebarMode(nextMode);
      saveSidebarMode(nextMode);
      refreshAfterSidebarChange();
      if (event.detail) sidebarToggle.blur();
    });

    window.requestAnimationFrame(function () {
      appShell.classList.add("is-sidebar-ready");
    });
  }

  document.querySelectorAll("[data-nav]").forEach(function (link) {
    if (!link.getAttribute("title")) {
      link.setAttribute("title", getSidebarLabel(link));
    }
    var href = link.getAttribute("href");
    if (href === navTarget) {
      link.classList.add("active");
    }
  });

  function fileQueueKey(file) {
    return [file.name, file.size, file.lastModified || 0].join("|");
  }

  function syncNativeFileInput(input) {
    if (!input || !window.DataTransfer || !input._queuedFiles) return;
    var transfer = new DataTransfer();
    input._queuedFiles.forEach(function (file) {
      transfer.items.add(file);
    });
    input.files = transfer.files;
  }

  function renderQueuedFiles(input) {
    var listId = input.getAttribute("data-file-input");
    var list = document.getElementById(listId);
    if (!list) return;
    var files = getSelectedInputFiles(input);
    list.innerHTML = "";
    if (!files.length) {
      list.innerHTML = "<li>No files selected</li>";
      return;
    }
    files.forEach(function (file, index) {
      var item = document.createElement("li");
      var sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      item.textContent = file.name + " - " + sizeMb + " MB";
      item.setAttribute("data-file-index", String(index));
      list.appendChild(item);
    });
  }

  function addFilesToQueue(input, selectedFiles) {
    var existing = input._queuedFiles || [];
    var seen = {};
    var next = [];
    existing.concat(selectedFiles || []).forEach(function (file) {
      var key = fileQueueKey(file);
      if (seen[key]) return;
      seen[key] = true;
      next.push(file);
    });
    input._queuedFiles = next;
    syncNativeFileInput(input);
    renderQueuedFiles(input);
  }

  function clearFileQueue(input) {
    if (!input) return;
    input._queuedFiles = [];
    input.value = "";
    syncNativeFileInput(input);
    renderQueuedFiles(input);
  }

  document.querySelectorAll("[data-file-input]").forEach(function (input) {
    input._queuedFiles = getSelectedInputFiles(input);
    renderQueuedFiles(input);
    input.addEventListener("change", function () {
      var selected = Array.prototype.slice.call(input.files || []);
      addFilesToQueue(input, selected);
      var state = createValidationState(input.closest(".span-2, .edit-field, .tab-panel, form") || input.parentElement, null);
      validateFileInput(state, input);
    });
  });

  document.querySelectorAll("[data-context-environment-select]").forEach(function (select) {
    var environments = getScopedEnvironments();
    select.innerHTML = "";
    environments.forEach(function (environment) {
      var option = document.createElement("option");
      option.value = environment.name;
      option.textContent = environment.name;
      select.appendChild(option);
    });
    if (!select.value && environments.length) {
      select.value = environments[0].name;
    }
  });

  var modal = document.getElementById("previewModal");
  if (modal) {
    var activePreviewUrl = null;
    var activePreviewZoom = 1;

    function resetPreviewUrl() {
      if (activePreviewUrl) {
        window.URL.revokeObjectURL(activePreviewUrl);
        activePreviewUrl = null;
      }
      activePreviewZoom = 1;
    }

    function applyPreviewZoom(previewArea) {
      var image = previewArea ? previewArea.querySelector("[data-preview-zoom-image]") : null;
      if (!image) return;
      image.style.width = Math.round(activePreviewZoom * 100) + "%";
      image.setAttribute("data-preview-zoom", activePreviewZoom.toFixed(2));
    }

    function buildImagePreviewToolbar() {
      var toolbar = document.createElement("div");
      toolbar.className = "attachment-preview-toolbar";
      toolbar.innerHTML = '<button type="button" data-preview-zoom-out aria-label="Zoom out">-</button><button type="button" data-preview-zoom-reset>Reset</button><button type="button" data-preview-zoom-in aria-label="Zoom in">+</button>';
      return toolbar;
    }

    function setPreviewContent(fileName, content, options) {
      var previewArea = modal.querySelector(".modal-preview");
      var title = modal.querySelector(".section-title");
      if (!previewArea) return;
      options = options || {};
      if (title) title.textContent = options.title || "Attachment Preview";
      previewArea.innerHTML = "";
      if (content) {
        if (content.tagName && content.tagName.toLowerCase() === "img") {
          var scrollArea = document.createElement("div");
          activePreviewZoom = 1;
          content.setAttribute("data-preview-zoom-image", "");
          content.classList.add("is-zoomable");
          scrollArea.className = "attachment-preview-scroll";
          scrollArea.appendChild(content);
          previewArea.appendChild(buildImagePreviewToolbar());
          previewArea.appendChild(scrollArea);
          previewArea.classList.add("is-zoomable-preview");
          applyPreviewZoom(previewArea);
        } else {
          previewArea.classList.remove("is-zoomable-preview");
          previewArea.appendChild(content);
        }
      } else {
        var message = document.createElement("p");
        message.className = "attachment-preview-message";
        message.textContent = "Preview is available for images and PDFs. Use Download for this attachment.";
        previewArea.appendChild(message);
        previewArea.classList.remove("is-zoomable-preview");
      }
      previewArea.setAttribute("aria-label", fileName || "Attachment preview");
    }

    function attachmentTypeSupportsPreview(contentType) {
      var normalizedType = String(contentType || "").toLowerCase();
      return normalizedType.indexOf("image/") === 0 || normalizedType === "application/pdf";
    }

    function openPreviewModal(fileName, content, options) {
      setPreviewContent(fileName || "Attachment", content, options);
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }

    window.openStepsScreenshotPreview = function (src, label) {
      if (!src) return;
      var image = document.createElement("img");
      image.className = "attachment-preview-image";
      image.src = src;
      image.alt = label || "Steps screenshot";
      openPreviewModal(label || "Steps screenshot", image, { title: "Screenshot Preview" });
    };

    function closePreviewModal() {
      if (modal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      resetPreviewUrl();
    }

    function downloadAttachment(url, fileName, trigger) {
      if (!url) return;
      var originalText = trigger ? trigger.textContent : "";
      if (trigger) {
        trigger.disabled = true;
        trigger.textContent = "Downloading...";
      }
      apiBlobFetch(url).then(function (result) {
        var objectUrl = window.URL.createObjectURL(result.blob);
        var link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName || "attachment";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
          window.URL.revokeObjectURL(objectUrl);
        }, 1000);
      }).catch(function (error) {
        showValidationToast(error.message || "Unable to download attachment.");
      }).finally(function () {
        if (trigger) {
          trigger.disabled = false;
          trigger.textContent = originalText || "Download";
        }
      });
    }

    function previewAttachment(url, fileName, contentType, trigger) {
      if (!url) return;
      var normalizedType = String(contentType || "").toLowerCase();
      if (!attachmentTypeSupportsPreview(normalizedType)) {
        resetPreviewUrl();
        openPreviewModal(fileName);
        return;
      }
      var originalText = trigger ? trigger.textContent : "";
      if (trigger) {
        trigger.disabled = true;
        trigger.textContent = "Loading...";
      }
      apiBlobFetch(url).then(function (result) {
        var blobType = result.blob.type || normalizedType;
        if (!attachmentTypeSupportsPreview(blobType)) {
          resetPreviewUrl();
          openPreviewModal(fileName);
          return;
        }
        resetPreviewUrl();
        activePreviewUrl = window.URL.createObjectURL(result.blob);
        if (String(blobType).toLowerCase() === "application/pdf") {
          var frame = document.createElement("iframe");
          frame.className = "attachment-preview-pdf";
          frame.src = activePreviewUrl;
          frame.title = fileName || "PDF preview";
          openPreviewModal(fileName, frame);
        } else {
          var image = document.createElement("img");
          image.className = "attachment-preview-image";
          image.src = activePreviewUrl;
          image.alt = fileName || "Attachment preview";
          openPreviewModal(fileName, image);
        }
      }).catch(function (error) {
        showValidationToast(error.message || "Unable to preview attachment.");
      }).finally(function () {
        if (trigger) {
          trigger.disabled = false;
          trigger.textContent = originalText || "Preview";
        }
      });
    }

    document.addEventListener("click", function (event) {
      var downloadButton = event.target.closest("[data-attachment-download]");
      var previewButton = event.target.closest("[data-attachment-preview]");
      if (downloadButton) {
        event.preventDefault();
        downloadAttachment(downloadButton.getAttribute("data-attachment-url"), downloadButton.getAttribute("data-attachment-name"), downloadButton);
        return;
      }
      if (previewButton) {
        event.preventDefault();
        previewAttachment(previewButton.getAttribute("data-attachment-url"), previewButton.getAttribute("data-attachment-name"), previewButton.getAttribute("data-attachment-type"), previewButton);
      }
    });

    modal.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", function () {
        closePreviewModal();
      });
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closePreviewModal();
        return;
      }
      var previewArea = modal.querySelector(".modal-preview");
      if (event.target.closest("[data-preview-zoom-in]")) {
        activePreviewZoom = Math.min(3, activePreviewZoom + 0.25);
        applyPreviewZoom(previewArea);
      } else if (event.target.closest("[data-preview-zoom-out]")) {
        activePreviewZoom = Math.max(0.5, activePreviewZoom - 0.25);
        applyPreviewZoom(previewArea);
      } else if (event.target.closest("[data-preview-zoom-reset]")) {
        activePreviewZoom = 1;
        applyPreviewZoom(previewArea);
      }
    });

    document.addEventListener("click", function (event) {
      var inlineImage = event.target.closest("[data-inline-step-preview]");
      if (!inlineImage) return;
      event.preventDefault();
      window.openStepsScreenshotPreview(inlineImage.src, inlineImage.getAttribute("alt") || "Steps screenshot");
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var inlineImage = event.target && event.target.closest ? event.target.closest("[data-inline-step-preview]") : null;
      if (!inlineImage) return;
      event.preventDefault();
      inlineImage.click();
    });
  }

  var detailTitle = document.querySelector("[data-detail-field='title']");
  var detailAttachmentsBody = document.querySelector("[data-detail-attachments]");
  var detailCommentsRoot = document.querySelector("[data-detail-comments]");
  var detailHistoryRoot = document.querySelector("[data-detail-history]");
  var detailStepsBlobUrls = [];

  function textOrDash(value) {
    return value == null || value === "" ? "-" : String(value);
  }

  function dateOnlyForDetail(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function formatDateTimeForDetail(value) {
    if (!value) return "-";
    return String(value).replace("T", " ").slice(0, 16);
  }

  function userDisplayName(user) {
    return user && (user.name || user.username || user.email) ? (user.name || user.username || user.email) : "-";
  }

  function lookupName(lookupValue) {
    return lookupValue && (lookupValue.name || lookupValue.severityName || lookupValue.priorityName) ? (lookupValue.name || lookupValue.severityName || lookupValue.priorityName) : "";
  }

  function setDetailText(name, value) {
    document.querySelectorAll("[data-detail-field='" + name + "']").forEach(function (element) {
      element.textContent = textOrDash(value);
    });
  }

  function setDetailHtml(name, value) {
    document.querySelectorAll("[data-detail-field='" + name + "']").forEach(function (element) {
      element.innerHTML = value || "-";
    });
  }

  function resetDetailStepsBlobUrls() {
    detailStepsBlobUrls.forEach(function (url) {
      window.URL.revokeObjectURL(url);
    });
    detailStepsBlobUrls = [];
  }

  function protectedInlineAssetPath(src) {
    if (!src || String(src).indexOf("/inline-assets/") === -1 || String(src).indexOf("/content") === -1) return "";
    try {
      var parsed = new URL(src, window.location.origin);
      if (parsed.origin !== window.location.origin) return "";
      if (parsed.pathname.indexOf("/api/v1/defects/") !== 0) return "";
      return parsed.pathname + parsed.search;
    } catch (error) {
      return "";
    }
  }

  function prepareStepsHtmlForView(html) {
    resetDetailStepsBlobUrls();
    if (!html) return Promise.resolve("-");
    var doc = new DOMParser().parseFromString(String(html), "text/html");
    var images = Array.prototype.slice.call(doc.querySelectorAll("img"));
    images.forEach(function (image) {
      image.classList.add("detail-step-image");
      image.setAttribute("data-inline-step-preview", "");
      image.setAttribute("role", "button");
      image.setAttribute("tabindex", "0");
      image.setAttribute("title", "Open screenshot preview");
      image.setAttribute("alt", image.getAttribute("alt") || "Steps screenshot");
    });
    var protectedImages = images.map(function (image) {
      return { image: image, path: protectedInlineAssetPath(image.getAttribute("src") || "") };
    }).filter(function (entry) {
      return entry.path;
    });
    if (!protectedImages.length) return Promise.resolve(doc.body.innerHTML || "-");
    return Promise.all(protectedImages.map(function (entry) {
      return apiBlobFetch(entry.path).then(function (result) {
        var objectUrl = window.URL.createObjectURL(result.blob);
        detailStepsBlobUrls.push(objectUrl);
        entry.image.setAttribute("src", objectUrl);
      }).catch(function () {
        entry.image.setAttribute("alt", entry.image.getAttribute("alt") || "Inline screenshot unavailable");
        entry.image.removeAttribute("src");
      });
    })).then(function () {
      return doc.body.innerHTML || "-";
    });
  }

  function getDetailBadgeClass(value, field) {
    var key = String(value || "").toLowerCase().replace(/\s+/g, "-");
    if (field === "severity") return "badge-" + key;
    if (field === "priority") return key === "p1" || key === "p2" ? "badge-danger" : "badge-neutral";
    if (field === "status") return getStatusBadgeClass(value);
    return "badge-neutral";
  }

  function setDetailBadge(field, value, suffix) {
    var badge = document.querySelector("[data-detail-badge='" + field + "']");
    if (!badge) return;
    badge.className = "badge " + getDetailBadgeClass(value, field);
    badge.textContent = textOrDash(value) + (suffix || "");
  }

  function attachmentContentType(item) {
    var contentType = item && item.contentType ? String(item.contentType) : "";
    var ext = item && item.fileExtension ? String(item.fileExtension).toLowerCase() : "";
    if (contentType) return contentType;
    if (["png", "jpg", "jpeg"].indexOf(ext) > -1) return ext === "png" ? "image/png" : "image/jpeg";
    if (ext === "pdf") return "application/pdf";
    return "application/octet-stream";
  }

  function attachmentSupportsPreview(item) {
    var contentType = attachmentContentType(item).toLowerCase();
    return contentType.indexOf("image/") === 0 || contentType === "application/pdf";
  }

  function buildAttachmentActionButton(item, action, label) {
    var button = document.createElement("button");
    var fileName = item.originalFilename || "Attachment";
    button.type = "button";
    button.className = action === "download" ? "button" : "";
    button.textContent = label;
    button.setAttribute(action === "download" ? "data-attachment-download" : "data-attachment-preview", "");
    button.setAttribute("data-attachment-url", item.contentUrl || "");
    button.setAttribute("data-attachment-name", fileName);
    button.setAttribute("data-attachment-type", attachmentContentType(item));
    if (!item.contentUrl) {
      button.disabled = true;
    }
    return button;
  }

  function renderDetailAttachments(items) {
    if (!detailAttachmentsBody) return;
    detailAttachmentsBody.innerHTML = "";
    (items || []).forEach(function (item) {
      var row = document.createElement("tr");
      var fileCell = document.createElement("td");
      var typeCell = document.createElement("td");
      var actionsCell = document.createElement("td");
      var downloadButton = buildAttachmentActionButton(item, "download", "Download");
      var previewButton = buildAttachmentActionButton(item, "preview", "Preview");
      var fileName = item.originalFilename || "Attachment";
      fileCell.textContent = fileName;
      typeCell.textContent = (item.fileExtension || item.contentType || "-").toString().toUpperCase();
      actionsCell.appendChild(downloadButton);
      if (attachmentSupportsPreview(item)) {
        actionsCell.appendChild(document.createTextNode(" "));
        actionsCell.appendChild(previewButton);
      }
      row.appendChild(fileCell);
      row.appendChild(typeCell);
      row.appendChild(actionsCell);
      detailAttachmentsBody.appendChild(row);
    });
    if (!(items || []).length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 3;
      emptyCell.className = "chart-empty";
      emptyCell.textContent = "No attachments uploaded.";
      emptyRow.appendChild(emptyCell);
      detailAttachmentsBody.appendChild(emptyRow);
    }
  }

  function renderDetailComments(items) {
    if (!detailCommentsRoot) return;
    detailCommentsRoot.innerHTML = "";
    (items || []).forEach(function (item) {
      var comment = document.createElement("div");
      var author = document.createElement("strong");
      var text = document.createElement("p");
      var meta = document.createElement("div");
      comment.className = "comment";
      author.textContent = userDisplayName(item.createdBy);
      text.textContent = item.commentText || "";
      meta.className = "comment-meta";
      meta.textContent = formatDateTimeForDetail(item.createdAt);
      comment.appendChild(author);
      comment.appendChild(text);
      comment.appendChild(meta);
      detailCommentsRoot.appendChild(comment);
    });
    if (!(items || []).length) {
      detailCommentsRoot.innerHTML = '<div class="chart-empty">No comments added.</div>';
    }
  }

  function historyTitle(eventType) {
    return String(eventType || "field_updated").replace(/_/g, " ").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function historyFieldLabel(fieldName) {
    var labels = {
      assigned_to_user_id: "Assigned To",
      closure_date: "Closure Date",
      current_status: "Status",
      description: "Description",
      environment_id: "Environment",
      expected_result: "Expected Result",
      fix_date: "Fix Date",
      inline_asset_size: "Screenshot Size",
      module_component: "Module",
      priority_id: "Priority",
      project_id: "Project",
      release_deployment_date: "Release Deployment Date",
      release_version: "Release Version",
      severity_id: "Severity",
      steps_html: "Steps to Replicate",
      title: "Title",
      actual_result: "Actual Result"
    };
    return labels[fieldName] || historyTitle(fieldName || "field_updated");
  }

  function compactHistoryValue(value, options) {
    if (value == null || value === "") return "blank";
    options = options || {};
    var text = String(value).replace(/\s+/g, " ").trim();
    if (!text) return "blank";
    if (/<img\b/i.test(text) || /^data:image\//i.test(text)) return "screenshot content";
    if (/<[^>]+>/.test(text)) {
      var parsed = new DOMParser().parseFromString(text, "text/html");
      text = parsed.body.textContent.replace(/\s+/g, " ").trim() || "formatted content";
    }
    if ((text.charAt(0) === "{" && text.charAt(text.length - 1) === "}") || (text.charAt(0) === "[" && text.charAt(text.length - 1) === "]")) {
      try {
        var parsedJson = JSON.parse(text);
        text = Array.isArray(parsedJson) ? parsedJson.length + " values" : Object.keys(parsedJson).join(", ");
      } catch (error) {
        // Keep the original text when it is not valid JSON.
      }
    }
    var max = options.max || 120;
    return text.length > max ? text.slice(0, max - 3) + "..." : text;
  }

  function historyBodyText(item) {
    var type = item && item.eventType ? item.eventType : "field_updated";
    var field = item && item.fieldName ? item.fieldName : "";
    var oldValue = compactHistoryValue(item && item.oldValue);
    var newValue = compactHistoryValue(item && item.newValue);
    var fieldLabel = historyFieldLabel(field);

    if (type === "defect_created") return "Created defect " + compactHistoryValue(item && item.newValue) + ".";
    if (type === "status_changed") return "Status changed from " + oldValue + " to " + newValue + ".";
    if (type === "assignment_changed") return "Assignment changed from " + oldValue + " to " + newValue + ".";
    if (type === "severity_changed") return "Severity changed from " + oldValue + " to " + newValue + ".";
    if (type === "priority_changed") return "Priority changed from " + oldValue + " to " + newValue + ".";
    if (type === "release_updated") return fieldLabel + " changed from " + oldValue + " to " + newValue + ".";
    if (type === "attachment_uploaded") return "Uploaded attachment " + newValue + ".";
    if (type === "attachment_deleted") return "Removed attachment " + oldValue + ".";
    if (type === "inline_asset_added") return "Added screenshot " + newValue + ".";
    if (type === "inline_asset_deleted") return "Removed screenshot " + oldValue + ".";
    if (type === "comment_added") return "Added comment: " + compactHistoryValue(item && item.newValue, { max: 90 }) + ".";
    if (type === "comment_updated") return "Updated comment from " + compactHistoryValue(item && item.oldValue, { max: 60 }) + " to " + compactHistoryValue(item && item.newValue, { max: 60 }) + ".";
    if (type === "comment_deleted") return "Deleted comment: " + compactHistoryValue(item && item.oldValue, { max: 90 }) + ".";
    if (field) return fieldLabel + " changed from " + oldValue + " to " + newValue + ".";
    return compactHistoryValue((item && item.newValue) || type);
  }

  function renderHistoryList(root, items) {
    if (!root) return;
    root.innerHTML = "";
    (items || []).forEach(function (item) {
      var entry = document.createElement("div");
      var title = document.createElement("strong");
      var body = document.createElement("div");
      var meta = document.createElement("div");
      entry.className = "timeline-item";
      title.textContent = historyTitle(item.eventType);
      body.className = "timeline-body";
      body.textContent = historyBodyText(item);
      meta.className = "timeline-meta";
      meta.textContent = formatDateTimeForDetail(item.createdAt) + " by " + userDisplayName(item.actor);
      entry.appendChild(title);
      entry.appendChild(body);
      entry.appendChild(meta);
      root.appendChild(entry);
    });
    if (!(items || []).length) {
      root.innerHTML = '<div class="chart-empty">No history recorded.</div>';
    }
  }

  function renderDetailHistory(items) {
    renderHistoryList(detailHistoryRoot, items);
  }

  function renderDefectDetail(defect, historyPayload) {
    var defectKey = defect.defectKey || defect.id || "-";
    var projectName = defect.project && defect.project.projectName ? defect.project.projectName : "";
    var environmentName = defect.environment && defect.environment.environmentName ? defect.environment.environmentName : "";
    var assignedName = userDisplayName(defect.assignedTo);
    var createdName = userDisplayName(defect.createdBy);
    var severity = lookupName(defect.severity);
    var priority = lookupName(defect.priority);
    var release = defect.fixedInRelease || {};

    setDetailText("defectKey", defectKey);
    setDetailText("project", projectName);
    setDetailText("environment", environmentName);
    setDetailText("assignedTo", "Assigned to " + assignedName);
    setDetailText("createdBy", "Created by " + createdName);
    setDetailText("title", defect.title || "");
    setDetailText("generalDefectKey", defectKey);
    setDetailText("generalProject", projectName);
    setDetailText("generalEnvironment", environmentName);
    setDetailText("module", defect.moduleComponent || "-");
    setDetailText("generalAssignedTo", assignedName);
    setDetailText("generalCreatedBy", createdName);
    setDetailText("description", defect.description || "");
    setDetailHtml("steps", "Loading steps...");
    setDetailText("expected", defect.expectedResult || "");
    setDetailText("actual", defect.actualResult || "");
    setDetailText("releaseVersion", release.releaseVersion || "-");
    setDetailText("deploymentDate", dateOnlyForDetail(release.actualDeploymentDate || release.plannedDeploymentDate) || "-");
    setDetailText("fixDate", dateOnlyForDetail(defect.fixDate) || "-");
    setDetailText("closureDate", dateOnlyForDetail(defect.closureDate) || "-");
    setDetailBadge("status", defect.currentStatus || "-");
    setDetailBadge("severity", severity || "-", " Severity");
    setDetailBadge("priority", priority || "-", " Priority");
    renderDetailAttachments(defect.attachments || []);
    renderDetailComments(defect.comments || []);
    renderDetailHistory(historyPayload && historyPayload.items ? historyPayload.items : []);

    if (detailTitle) document.title = defectKey + " | Defect Tracker";
    var detailEditLink = document.querySelector("[data-edit-defect-link]");
    if (detailEditLink && detailEditLink.parentNode) {
      var params = new URLSearchParams(window.location.search);
      var back = params.get("back") || "defect_list.html";
      detailEditLink.title = "Edit " + defectKey;
      detailEditLink.setAttribute("aria-label", "Edit " + defectKey);
      detailEditLink.href = "defect_edit.html?id=" + encodeURIComponent(defect.id) + "&back=" + encodeURIComponent(back);
    }
    return prepareStepsHtmlForView(defect.stepsHtml).then(function (stepsHtml) {
      setDetailHtml("steps", stepsHtml);
    });
  }

  function showDefectDetailError(error) {
    if (detailTitle) detailTitle.textContent = error && error.message ? error.message : "Unable to load defect.";
    resetDetailStepsBlobUrls();
    setDetailHtml("steps", "-");
    renderDetailAttachments([]);
    renderDetailComments([]);
    renderDetailHistory([]);
  }

  function loadDefectDetailPage() {
    if (!detailTitle) return;
    var params = new URLSearchParams(window.location.search);
    var defectId = params.get("id");
    if (!defectId) {
      showDefectDetailError(new Error("Missing defect id."));
      return;
    }
    Promise.all([
      apiFetch("/api/v1/defects/" + encodeURIComponent(defectId)),
      apiFetch("/api/v1/defects/" + encodeURIComponent(defectId) + "/history?page=1&pageSize=100")
    ]).then(function (results) {
      return renderDefectDetail(results[0], results[1]);
    }).catch(showDefectDetailError);
  }

  loadDefectDetailPage();

  var defectEditForm = document.getElementById("defectEditForm");
  var editAttachmentsBody = document.querySelector("[data-edit-attachments]");
  var editCommentsRoot = document.querySelector("[data-edit-comments]");
  var editHistoryRoot = document.querySelector("[data-edit-history]");
  var activeEditDefect = null;
  var activeEditLookups = null;

  function setEditText(name, value) {
    document.querySelectorAll("[data-edit-detail='" + name + "']").forEach(function (element) {
      element.textContent = textOrDash(value);
    });
  }

  function setEditBadge(field, value, suffix) {
    var badge = document.querySelector("[data-edit-badge='" + field + "']");
    if (!badge) return;
    badge.className = "badge " + getDetailBadgeClass(value, field);
    badge.textContent = textOrDash(value) + (suffix || "");
  }

  function setControlValue(control, value) {
    if (!control) return;
    control.value = value == null ? "" : String(value);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Unable to read " + file.name + "."));
      };
      reader.readAsDataURL(file);
    });
  }

  function buildAttachmentPayload(file) {
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        contentDataUrl: dataUrl
      };
    });
  }

  function fillSelect(select, items, options) {
    if (!select) return;
    var settings = options || {};
    var currentValue = select.value;
    select.innerHTML = "";
    if (settings.placeholder) {
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = settings.placeholder;
      select.appendChild(placeholder);
    }
    (items || []).forEach(function (item) {
      var option = document.createElement("option");
      option.value = String(settings.value ? settings.value(item) : item.id);
      option.textContent = String(settings.label ? settings.label(item) : item.name);
      select.appendChild(option);
    });
    if (settings.selected != null) select.value = String(settings.selected);
    else if (currentValue) select.value = currentValue;
  }

  function includeSelectedStatus(currentStatus, allowedStatuses) {
    var values = [currentStatus].concat(allowedStatuses || []).filter(Boolean);
    return values.filter(function (value, index) { return values.indexOf(value) === index; }).map(function (status) {
      return { id: status, name: status };
    });
  }

  function renderEditAttachments(items) {
    if (!editAttachmentsBody) return;
    editAttachmentsBody.innerHTML = "";
    (items || []).forEach(function (item) {
      var row = document.createElement("tr");
      var fileCell = document.createElement("td");
      var typeCell = document.createElement("td");
      var actionsCell = document.createElement("td");
      var downloadButton = buildAttachmentActionButton(item, "download", "Download");
      var previewButton = buildAttachmentActionButton(item, "preview", "Preview");
      var fileName = item.originalFilename || "Attachment";
      fileCell.textContent = fileName;
      typeCell.textContent = (item.fileExtension || item.contentType || "-").toString().toUpperCase();
      actionsCell.appendChild(downloadButton);
      if (attachmentSupportsPreview(item)) {
        actionsCell.appendChild(document.createTextNode(" "));
        actionsCell.appendChild(previewButton);
      }
      row.appendChild(fileCell);
      row.appendChild(typeCell);
      row.appendChild(actionsCell);
      editAttachmentsBody.appendChild(row);
    });
    if (!(items || []).length) {
      editAttachmentsBody.innerHTML = '<tr><td colspan="3" class="chart-empty">No attachments uploaded.</td></tr>';
    }
  }

  function renderEditComments(items) {
    if (!editCommentsRoot) return;
    var commentEntry = editCommentsRoot.querySelector(".comment-entry");
    editCommentsRoot.innerHTML = "";
    (items || []).forEach(function (item) {
      var comment = document.createElement("div");
      var author = document.createElement("strong");
      var text = document.createElement("p");
      var meta = document.createElement("div");
      comment.className = "comment";
      author.textContent = userDisplayName(item.createdBy);
      text.textContent = item.commentText || "";
      meta.className = "comment-meta";
      meta.textContent = formatDateTimeForDetail(item.createdAt);
      comment.appendChild(author);
      comment.appendChild(text);
      comment.appendChild(meta);
      editCommentsRoot.appendChild(comment);
    });
    if (!(items || []).length) {
      var empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = "No comments added.";
      editCommentsRoot.appendChild(empty);
    }
    if (commentEntry) editCommentsRoot.appendChild(commentEntry);
  }

  function renderEditHistory(items) {
    renderHistoryList(editHistoryRoot, items);
  }

  function setEditStepsHtml(html) {
    var editor = document.querySelector("[data-steps-editor]");
    var output = document.querySelector("[data-steps-html]");
    var nextHtml = html || "<p></p>";
    if (window.defectStepsEditor && typeof window.defectStepsEditor.commands.setContent === "function") {
      window.defectStepsEditor.commands.setContent(nextHtml);
    } else if (editor) {
      editor.innerHTML = nextHtml;
      if (output) output.value = nextHtml;
    }
  }

  function refreshEditHero(defect) {
    var projectName = defect.project && defect.project.projectName ? defect.project.projectName : "";
    var environmentName = defect.environment && defect.environment.environmentName ? defect.environment.environmentName : "";
    var assignedName = userDisplayName(defect.assignedTo);
    var createdName = userDisplayName(defect.createdBy);
    var severity = lookupName(defect.severity);
    var priority = lookupName(defect.priority);
    setEditText("defectKey", defect.defectKey || defect.id);
    setEditText("project", projectName);
    setEditText("environment", environmentName);
    setEditText("assignedTo", "Assigned to " + assignedName);
    setEditText("createdBy", "Created by " + createdName);
    setEditText("title", defect.title || "");
    setEditBadge("status", defect.currentStatus || "-");
    setEditBadge("severity", severity || "-", " Severity");
    setEditBadge("priority", priority || "-", " Priority");
    document.title = (defect.defectKey || "Edit Defect") + " | Defect Tracker";
  }

  function updateReleaseSourceNote() {
    var note = document.querySelector("[data-release-source-note]");
    if (!note) return;
    note.textContent = "Required when Status is Fixed so testers can plan validation.";
  }

  function updateReleaseDateControls() {
    var statusSelect = document.getElementById("editStatus");
    var release = document.getElementById("editRelease");
    var deployment = document.getElementById("editDeployment");
    var fixDate = document.getElementById("editFixDate");
    var closureDate = document.getElementById("editClosureDate");
    var isFixed = statusSelect && statusSelect.value === "Fixed";
    var isClosed = statusSelect && statusSelect.value === "Closed";
    if (fixDate) {
      fixDate.max = localTodayValue();
    }
    if (!isFixed) {
      clearFieldError(release);
      clearFieldError(deployment);
      if (fixDate && !fieldValue(fixDate)) clearFieldError(fixDate);
    }
    if (closureDate) {
      closureDate.disabled = !isClosed;
      closureDate.setAttribute("aria-disabled", isClosed ? "false" : "true");
      closureDate.title = isClosed ? "" : "Closure Date is enabled only when Status is Closed.";
      if (!isClosed) clearFieldError(closureDate);
    }
    updateReleaseSourceNote();
  }

  function populateEditForm(defect, lookups, historyPayload) {
    activeEditDefect = defect;
    activeEditLookups = lookups;
    refreshEditHero(defect);
    setControlValue(document.getElementById("editDefectId"), defect.defectKey || defect.id);
    setControlValue(document.getElementById("editTitle"), defect.title);
    setControlValue(document.getElementById("editModule"), defect.moduleComponent);
    setControlValue(document.getElementById("editCreatedBy"), userDisplayName(defect.createdBy));
    setControlValue(document.getElementById("editDescription"), defect.description);
    setControlValue(document.getElementById("editExpected"), defect.expectedResult);
    setControlValue(document.getElementById("editActual"), defect.actualResult);
    setControlValue(document.getElementById("editRelease"), defect.releaseVersion || (defect.fixedInRelease && defect.fixedInRelease.releaseVersion) || "");
    setControlValue(document.getElementById("editDeployment"), dateOnlyForDetail(defect.releaseDeploymentDate || (defect.fixedInRelease && (defect.fixedInRelease.actualDeploymentDate || defect.fixedInRelease.plannedDeploymentDate))));
    setControlValue(document.getElementById("editFixDate"), dateOnlyForDetail(defect.fixDate));
    setControlValue(document.getElementById("editClosureDate"), dateOnlyForDetail(defect.closureDate));
    setEditStepsHtml(defect.stepsHtml);
    fillSelect(document.getElementById("editProject"), lookups.projects, { selected: defect.project && defect.project.id, value: function (item) { return item.id; }, label: function (item) { return item.projectName; } });
    var projectSelect = document.getElementById("editProject");
    if (projectSelect) {
      projectSelect.disabled = true;
      projectSelect.setAttribute("aria-readonly", "true");
    }
    fillSelect(document.getElementById("editEnvironment"), lookups.environments, { selected: defect.environment && defect.environment.id, value: function (item) { return item.id; }, label: function (item) { return item.environmentName; } });
    fillSelect(document.getElementById("editAssigned"), lookups.users, { selected: defect.assignedTo && defect.assignedTo.id, value: function (item) { return item.id; }, label: function (item) { return item.name || item.username; } });
    fillSelect(document.getElementById("editSeverity"), lookups.severities, { selected: defect.severity && defect.severity.id, value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    fillSelect(document.getElementById("editPriority"), lookups.priorities, { selected: defect.priority && defect.priority.id, value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    fillSelect(document.getElementById("editStatus"), includeSelectedStatus(defect.currentStatus, defect.allowedNextStatuses), { selected: defect.currentStatus, value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    renderEditAttachments(defect.attachments || []);
    renderEditComments(defect.comments || []);
    renderEditHistory(historyPayload && historyPayload.items ? historyPayload.items : []);
    updateReleaseDateControls();
    return Promise.resolve();
  }

  function showEditLoadError(error) {
    var title = document.querySelector("[data-edit-detail='title']");
    if (title) title.textContent = error && error.message ? error.message : "Unable to load defect.";
    setValidationMessage(defectEditForm ? defectEditForm.querySelector("[data-form-message]") : null, error && error.message ? error.message : "Unable to load defect.", "error");
  }

  function loadDefectEditPage() {
    if (!defectEditForm) return;
    var params = new URLSearchParams(window.location.search);
    var defectId = params.get("id");
    if (!defectId) {
      showEditLoadError(new Error("Missing defect id."));
      return;
    }
    Promise.all([
      apiFetch("/api/v1/defects/" + encodeURIComponent(defectId)),
      apiFetch("/api/v1/projects?isActive=true"),
      apiFetch("/api/v1/environments?isActive=true"),
      apiFetch("/api/v1/users?page=1&pageSize=100&isActive=true"),
      apiFetch("/api/v1/lookups/severities"),
      apiFetch("/api/v1/lookups/priorities"),
      apiFetch("/api/v1/defects/" + encodeURIComponent(defectId) + "/history?page=1&pageSize=100")
    ]).then(function (results) {
      return populateEditForm(results[0], {
        projects: results[1].items || [],
        environments: results[2].items || [],
        users: results[3].items || [],
        severities: results[4].items || [],
        priorities: results[5].items || []
      }, results[6]);
    }).catch(showEditLoadError);
  }

  function editDetailBackTarget() {
    var params = new URLSearchParams(window.location.search);
    var back = params.get("back") || "defect_list.html";
    return /dashboard\.html/i.test(back) ? "dashboard.html" : "defect_list.html";
  }

  function buildDefectEditPayload() {
    var stepsOutput = document.querySelector("[data-steps-html]");
    if (window.defectStepsEditor && stepsOutput) {
      stepsOutput.value = window.defectStepsEditor.getHTML();
    }
    var statusValue = fieldValue(document.getElementById("editStatus"));
    var payload = {
      title: fieldValue(document.getElementById("editTitle")),
      description: fieldValue(document.getElementById("editDescription")),
      projectId: activeEditDefect && activeEditDefect.project && activeEditDefect.project.id ? activeEditDefect.project.id : fieldValue(document.getElementById("editProject")),
      moduleComponent: fieldValue(document.getElementById("editModule")),
      environmentId: fieldValue(document.getElementById("editEnvironment")),
      severityId: Number(fieldValue(document.getElementById("editSeverity"))),
      priorityId: Number(fieldValue(document.getElementById("editPriority"))),
      currentStatus: statusValue,
      assignedToUserId: fieldValue(document.getElementById("editAssigned")),
      stepsHtml: stepsOutput ? stepsOutput.value : "",
      expectedResult: fieldValue(document.getElementById("editExpected")),
      actualResult: fieldValue(document.getElementById("editActual")),
      releaseVersion: fieldValue(document.getElementById("editRelease")) || null,
      releaseDeploymentDate: fieldValue(document.getElementById("editDeployment")) || null,
      fixDate: fieldValue(document.getElementById("editFixDate")) || null
    };
    if (statusValue === "Closed") {
      payload.closureDate = fieldValue(document.getElementById("editClosureDate")) || null;
    }
    return payload;
  }

  function uploadEditAttachments(defectId) {
    var input = document.getElementById("editAttachments");
    var files = getSelectedInputFiles(input);
    if (!files.length) return Promise.resolve();
    return Promise.all(files.map(function (file) {
      return buildAttachmentPayload(file).then(function (payload) {
        return apiFetch("/api/v1/defects/" + encodeURIComponent(defectId) + "/attachments", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      });
    })).then(function () {
      clearFileQueue(input);
    });
  }

  function hashText(value) {
    var hash = 0;
    var text = String(value || "");
    for (var i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function estimateBase64Bytes(src) {
    var base64 = String(src || "").split(",", 2)[1] || "";
    var padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(1, Math.floor((base64.length * 3) / 4) - padding);
  }

  function extractInlineImageMetadata(html, existingAssets) {
    if (!html || !String(html).includes("data:image/")) return [];
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(html), "text/html");
    var existingNames = new Set((existingAssets || []).map(function (asset) {
      return asset.originalFilename;
    }).filter(Boolean));
    return Array.prototype.slice.call(doc.querySelectorAll("img")).map(function (img) {
      var src = img.getAttribute("src") || "";
      var match = src.match(/^data:(image\/(?:png|jpe?g));base64,/i);
      if (!match) return null;
      var contentType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
      var ext = contentType === "image/png" ? "png" : "jpg";
      var filename = "steps-image-" + hashText(src) + "." + ext;
      if (existingNames.has(filename)) return null;
      existingNames.add(filename);
      return {
        filename: filename,
        contentType: contentType,
        fileSizeBytes: estimateBase64Bytes(src),
        contentDataUrl: src,
        widthPx: Number(img.getAttribute("width")) || null,
        heightPx: Number(img.getAttribute("height")) || null
      };
    }).filter(Boolean);
  }

  function uploadInlineAssets(defectId, stepsHtml, existingAssets) {
    var assets = extractInlineImageMetadata(stepsHtml, existingAssets);
    if (!assets.length) return Promise.resolve();
    return Promise.all(assets.map(function (asset) {
      return apiFetch("/api/v1/defects/" + encodeURIComponent(defectId) + "/inline-assets", {
        method: "POST",
        body: JSON.stringify(asset)
      });
    }));
  }

  function saveDefectEdit() {
    if (!defectEditForm || !activeEditDefect) return;
    if (!validateDefectForm(defectEditForm)) return;
    var message = defectEditForm.querySelector("[data-form-message]");
    var saveButton = defectEditForm.querySelector("button[type='submit']");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }
    apiFetch("/api/v1/defects/" + encodeURIComponent(activeEditDefect.id), {
      method: "PATCH",
      body: JSON.stringify(buildDefectEditPayload())
    }).then(function (payload) {
      return uploadEditAttachments(payload.id).then(function () {
        return payload;
      });
    }).then(function (payload) {
      var stepsOutput = document.querySelector("[data-steps-html]");
      return uploadInlineAssets(payload.id, stepsOutput ? stepsOutput.value : "", activeEditDefect.inlineAssets || []).then(function () {
        return payload;
      });
    }).then(function (payload) {
      return apiFetch("/api/v1/defects/" + encodeURIComponent(payload.id));
    }).then(function (payload) {
      return Promise.all([
        Promise.resolve(payload),
        apiFetch("/api/v1/defects/" + encodeURIComponent(payload.id) + "/history?page=1&pageSize=100")
      ]);
    }).then(function (results) {
      return populateEditForm(results[0], activeEditLookups || {}, results[1]).then(function () {
        setValidationMessage(message, "Defect changes saved.", "success");
        showAccountConfirmationDialog({
          title: "Defect updated",
          message: (results[0].defectKey || "Defect") + " was saved successfully.",
          actionLabel: "View Defect",
          onConfirm: function () {
            window.location.href = "defect_detail.html?id=" + encodeURIComponent(results[0].id) + "&back=" + encodeURIComponent(editDetailBackTarget());
          }
        });
      });
    }).catch(function (error) {
      setValidationMessage(message, error.message || "Unable to save defect.", "error");
      showValidationToast(error.message || "Unable to save defect.");
    }).finally(function () {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
      }
    });
  }

  if (defectEditForm) {
    loadDefectEditPage();
    var editStatusSelect = document.getElementById("editStatus");
    if (editStatusSelect) {
      editStatusSelect.addEventListener("change", updateReleaseDateControls);
    }
    updateReleaseDateControls();
  }

  var defectCreateForm = current === "defect_create.html" ? document.querySelector("form[data-demo-form]") : null;
  var activeCreateLookups = null;

  function getWorkflowInitialStatus(workflowPayload) {
    if (workflowPayload && workflowPayload.initialStatus) return workflowPayload.initialStatus;
    var transitions = workflowPayload && workflowPayload.transitions ? workflowPayload.transitions : [];
    if (transitions.length && transitions[0].fromStatus) return transitions[0].fromStatus;
    var statuses = workflowStatusLabelsFromPayload(workflowPayload);
    return statuses.length ? statuses[0] : "Assigned";
  }

  function environmentQueryForContext() {
    var ctx = getStoredDataContext();
    if (ctx === "All") return "?isActive=true";
    return "?isActive=true&scope=" + encodeURIComponent(ctx);
  }

  function populateCreateForm(results) {
    var projects = results[0].items || [];
    var environments = results[1].items || [];
    var users = results[2].items || [];
    var severities = results[3].items || [];
    var priorities = results[4].items || [];
    var initialStatus = getWorkflowInitialStatus(results[5]);
    var storedUser = getStoredUser() || {};
    activeCreateLookups = { projects: projects, environments: environments, users: users, severities: severities, priorities: priorities, initialStatus: initialStatus };
    fillSelect(document.getElementById("project"), projects, { value: function (item) { return item.id; }, label: function (item) { return item.projectName; } });
    fillSelect(document.getElementById("environment"), environments, { value: function (item) { return item.id; }, label: function (item) { return item.environmentName; } });
    fillSelect(document.getElementById("assigned"), users, { value: function (item) { return item.id; }, label: function (item) { return item.name || item.username; } });
    fillSelect(document.getElementById("severity"), severities, { value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    fillSelect(document.getElementById("priority"), priorities, { value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    fillSelect(document.getElementById("status"), [{ id: initialStatus, name: initialStatus }], { selected: initialStatus, value: function (item) { return item.id; }, label: function (item) { return item.name; } });
    setControlValue(document.getElementById("createdBy"), storedUser.username || storedUser.name || "Current user");
  }

  function showCreateLoadError(error) {
    setValidationMessage(defectCreateForm ? defectCreateForm.querySelector("[data-form-message]") : null, error && error.message ? error.message : "Unable to load create form data.", "error");
  }

  function loadDefectCreatePage() {
    if (!defectCreateForm) return;
    Promise.all([
      apiFetch("/api/v1/projects?isActive=true"),
      apiFetch("/api/v1/environments" + environmentQueryForContext()),
      apiFetch("/api/v1/users?page=1&pageSize=100&isActive=true"),
      apiFetch("/api/v1/lookups/severities"),
      apiFetch("/api/v1/lookups/priorities"),
      apiFetch("/api/v1/workflow")
    ]).then(populateCreateForm).catch(showCreateLoadError);
  }

  function buildDefectCreatePayload() {
    var stepsOutput = document.querySelector("[data-steps-html]");
    if (window.defectStepsEditor && stepsOutput) {
      stepsOutput.value = window.defectStepsEditor.getHTML();
    }
    return {
      title: fieldValue(document.getElementById("title")),
      description: fieldValue(document.getElementById("description")),
      projectId: fieldValue(document.getElementById("project")),
      moduleComponent: fieldValue(document.getElementById("module")),
      environmentId: fieldValue(document.getElementById("environment")),
      severityId: Number(fieldValue(document.getElementById("severity"))),
      priorityId: Number(fieldValue(document.getElementById("priority"))),
      assignedToUserId: fieldValue(document.getElementById("assigned")),
      stepsHtml: stepsOutput ? stepsOutput.value : "",
      expectedResult: fieldValue(document.getElementById("expected")),
      actualResult: fieldValue(document.getElementById("actual"))
    };
  }

  function uploadCreateAttachments(defectId) {
    var input = document.getElementById("attachments");
    var files = getSelectedInputFiles(input);
    if (!files.length) return Promise.resolve();
    return Promise.all(files.map(function (file) {
      return buildAttachmentPayload(file).then(function (payload) {
        return apiFetch("/api/v1/defects/" + encodeURIComponent(defectId) + "/attachments", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      });
    })).then(function () {
      clearFileQueue(input);
    });
  }

  function showDuplicateDefectDialog(errorPayload, retryCallback) {
    var existing = document.getElementById("duplicateDefectModal");
    if (existing) existing.remove();
    var candidates = errorPayload && errorPayload.error && errorPayload.error.duplicateCandidates ? errorPayload.error.duplicateCandidates : [];
    var modal = document.createElement("div");
    var card = document.createElement("div");
    var title = document.createElement("h2");
    var message = document.createElement("p");
    var list = document.createElement("div");
    var actions = document.createElement("div");
    var cancel = document.createElement("button");
    var proceed = document.createElement("button");
    modal.id = "duplicateDefectModal";
    modal.className = "modal account-confirmation-modal open";
    modal.setAttribute("aria-hidden", "false");
    card.className = "modal-card account-confirmation-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    title.textContent = "Possible duplicate defect";
    message.className = "modal-subtitle";
    message.textContent = "A defect with the same title already exists in this project. Review the candidates before creating another record.";
    list.className = "duplicate-candidate-list";
    candidates.slice(0, 5).forEach(function (candidate) {
      var item = document.createElement("div");
      item.className = "duplicate-candidate";
      item.textContent = (candidate.defectKey || candidate.id || "Defect") + " | " + (candidate.title || "") + " | " + (candidate.status || "");
      list.appendChild(item);
    });
    actions.className = "modal-actions";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    proceed.type = "button";
    proceed.className = "button-primary";
    proceed.textContent = "Create Anyway";
    cancel.addEventListener("click", function () { modal.remove(); });
    proceed.addEventListener("click", function () {
      modal.remove();
      retryCallback();
    });
    actions.appendChild(cancel);
    actions.appendChild(proceed);
    card.appendChild(title);
    card.appendChild(message);
    if (candidates.length) card.appendChild(list);
    card.appendChild(actions);
    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  function submitCreateDefect(forceCreate) {
    if (!defectCreateForm) return;
    if (!validateDefectForm(defectCreateForm)) return;
    var message = defectCreateForm.querySelector("[data-form-message]");
    var saveButton = defectCreateForm.querySelector("button[type='submit']");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = forceCreate ? "Creating..." : "Checking...";
    }
    var path = "/api/v1/defects" + (forceCreate ? "?forceCreate=true" : "");
    apiFetch(path, {
      method: "POST",
      body: JSON.stringify(buildDefectCreatePayload())
    }).then(function (payload) {
      return uploadCreateAttachments(payload.id).then(function () { return payload; });
    }).then(function (payload) {
      var stepsOutput = document.querySelector("[data-steps-html]");
      return uploadInlineAssets(payload.id, stepsOutput ? stepsOutput.value : "", []).then(function () { return payload; });
    }).then(function (payload) {
      setValidationMessage(message, "Defect saved for review.", "success");
      showAccountConfirmationDialog({
        title: "Defect created",
        message: (payload.defectKey || "Defect") + " was saved successfully.",
        actionLabel: "View Defect",
        onConfirm: function () {
          window.location.href = "defect_detail.html?id=" + encodeURIComponent(payload.id) + "&back=defect_list.html";
        }
      });
    }).catch(function (error) {
      if (error.status === 409 && error.payload && error.payload.error && error.payload.error.code === "possible_duplicate_defect") {
        showDuplicateDefectDialog(error.payload, function () { submitCreateDefect(true); });
        return;
      }
      setValidationMessage(message, error.message || "Unable to create defect.", "error");
      showValidationToast(error.message || "Unable to create defect.");
    }).finally(function () {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Defect";
      }
    });
  }

  if (defectCreateForm) {
    loadDefectCreatePage();
  }

  document.querySelectorAll("[data-tabs]").forEach(function (tabs) {
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll("[data-tab-target]"));
    var panels = Array.prototype.slice.call(tabs.querySelectorAll("[data-tab-panel]"));

    buttons.forEach(function (button) {
      button.setAttribute("aria-selected", button.classList.contains("active") ? "true" : "false");
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-tab-target");

        buttons.forEach(function (item) {
          var isActive = item === button;
          item.classList.toggle("active", isActive);
          item.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        panels.forEach(function (panel) {
          var isActive = panel.getAttribute("data-tab-panel") === target;
          panel.classList.toggle("active", isActive);
          panel.hidden = !isActive;
        });
      });
    });
  });

  var dashboardTableBody = document.querySelector("[data-dashboard-table-body]");
  var chartGrid = document.querySelector("[data-chart-grid]");
  var chartModal = document.querySelector("[data-chart-modal]");

  if (dashboardTableBody && chartGrid && chartModal) {
    var defectRecords = getScopedDefectRecords();
    defectRecords.forEach(function (record) {
      record.createdBy = record.createdBy || "qa.user";
    });
    var tableFilters = Array.prototype.slice.call(document.querySelectorAll("[data-table-filter]"));
    var resultCount = document.querySelector("[data-dashboard-result-count]");
    var openChartButton = document.querySelector("[data-open-chart-modal]");
    var closeChartButtons = Array.prototype.slice.call(chartModal.querySelectorAll("[data-close-chart-modal]"));
    var saveChartButton = chartModal.querySelector("[data-save-chart]");
    var chartTitleInput = chartModal.querySelector("[data-chart-title]");
    var chartTypeInput = chartModal.querySelector("[data-chart-type]");
    var chartGroupInput = chartModal.querySelector("[data-chart-group]");
    var chartModalTitle = chartModal.querySelector("[data-chart-modal-title]");
    var clearTableFiltersButton = document.querySelector("[data-clear-dashboard-filters]");
    var activeChart = null;
    var labelMap = {
      status: "Status",
      severity: "Severity",
      project: "Project",
      environment: "Environment",
      assignedTo: "Assigned To",
      releaseVersion: "Release Version"
    };

    function getBadgeClass(value, field) {
      var key = String(value).toLowerCase().replace(/\s+/g, "-");
      if (field === "severity") return "badge-" + key;
      if (field === "status") return getStatusBadgeClass(value);
      return "badge-neutral";
    }

    function createBadge(value, field) {
      var badge = document.createElement("span");
      badge.className = "badge " + getBadgeClass(value, field);
      badge.textContent = value;
      return badge;
    }

    function collectFilters(controls) {
      var filters = {};
      controls.forEach(function (control) {
        var field = control.getAttribute("data-table-filter") || control.getAttribute("data-chart-filter");
        if (control.value) filters[field] = control.value;
      });
      return filters;
    }

    function applyFilters(records, filters) {
      return records.filter(function (record) {
        return Object.keys(filters).every(function (field) {
          return record[field] === filters[field];
        });
      });
    }

    function groupRecords(records, field) {
      var counts = {};
      records.forEach(function (record) {
        var value = record[field] || "Not set";
        counts[value] = (counts[value] || 0) + 1;
      });
      return Object.keys(counts).sort().map(function (key) {
        return { label: key, value: counts[key] };
      });
    }

    function appendTextCell(row, text) {
      var cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }

    function renderDashboardTable() {
      var rows = applyFilters(defectRecords, collectFilters(tableFilters));
      dashboardTableBody.innerHTML = "";
      rows.forEach(function (record) {
        var row = document.createElement("tr");
        appendTextCell(row, record.id);
        appendTextCell(row, record.title);
        appendTextCell(row, record.project);
        appendTextCell(row, record.environment);
        var severityCell = document.createElement("td");
        severityCell.appendChild(createBadge(record.severity, "severity"));
        row.appendChild(severityCell);
        appendTextCell(row, record.priority);
        var statusCell = document.createElement("td");
        statusCell.appendChild(createBadge(record.status, "status"));
        row.appendChild(statusCell);
        appendTextCell(row, record.assignedTo);
        appendTextCell(row, record.releaseVersion);
        appendTextCell(row, record.createdBy);
        appendTextCell(row, record.createdDate);
        dashboardTableBody.appendChild(row);
      });
      if (resultCount) {
        resultCount.textContent = rows.length + " defects";
      }
    }

    function getChartMeta(filters) {
      var active = Object.keys(filters).map(function (field) {
        return (labelMap[field] || field) + ": " + filters[field];
      });
      return active.length ? active.join(", ") : "All defects";
    }

    function renderBarChart(container, data, type) {
      var max = Math.max.apply(null, data.map(function (row) { return row.value; }).concat([1]));
      var bars = document.createElement("div");
      bars.className = "chart-bars" + (type === "horizontal" ? " chart-horizontal" : "");
      data.forEach(function (row) {
        var item = document.createElement("div");
        var label = document.createElement("div");
        var track = document.createElement("div");
        var fill = document.createElement("div");
        var value = document.createElement("div");
        item.className = "chart-row";
        label.className = "chart-label";
        track.className = "chart-track";
        fill.className = "chart-fill";
        value.className = "chart-value";
        label.textContent = row.label;
        fill.style.width = Math.max(8, Math.round((row.value / max) * 100)) + "%";
        value.textContent = row.value;
        track.appendChild(fill);
        item.appendChild(label);
        item.appendChild(track);
        item.appendChild(value);
        bars.appendChild(item);
      });
      container.appendChild(bars);
    }

    function renderDonutChart(container, data) {
      var total = data.reduce(function (sum, row) { return sum + row.value; }, 0);
      var layout = document.createElement("div");
      var donut = document.createElement("div");
      layout.className = "donut-layout";
      donut.className = "donut-visual";
      donut.textContent = total;
      layout.appendChild(donut);
      layout.appendChild(createChartList(data));
      container.appendChild(layout);
    }

    function createChartList(data) {
      var list = document.createElement("ul");
      list.className = "tile-list";
      data.forEach(function (row) {
        var item = document.createElement("li");
        var label = document.createElement("span");
        var value = document.createElement("strong");
        label.textContent = row.label;
        value.textContent = row.value;
        item.appendChild(label);
        item.appendChild(value);
        list.appendChild(item);
      });
      return list;
    }

    function createChart(config, target) {
      var sharedFilters = collectFilters(tableFilters);
      var records = applyFilters(defectRecords, sharedFilters);
      var data = groupRecords(records, config.groupBy);
      var chart = target || document.createElement("article");
      chart.className = "chart-card";
      chart.dataset.chartConfig = JSON.stringify(config);
      chart.innerHTML = "";
      var titleRow = document.createElement("div");
      var titleWrap = document.createElement("div");
      var actions = document.createElement("div");
      var editButton = document.createElement("button");
      var deleteButton = document.createElement("button");
      var title = document.createElement("h3");
      var meta = document.createElement("div");
      titleRow.className = "chart-title-row";
      actions.className = "chart-actions";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.setAttribute("data-edit-chart", "");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute("data-delete-chart", "");
      title.textContent = config.title || "Defect Chart";
      meta.className = "chart-meta";
      meta.textContent = (labelMap[config.groupBy] || config.groupBy) + " | " + getChartMeta(sharedFilters);
      titleWrap.appendChild(title);
      titleWrap.appendChild(meta);
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      titleRow.appendChild(titleWrap);
      titleRow.appendChild(actions);
      chart.appendChild(titleRow);

      if (!data.length) {
        var empty = document.createElement("div");
        empty.className = "chart-empty";
        empty.textContent = "No defects match this chart criteria.";
        chart.appendChild(empty);
      } else if (config.type === "donut") {
        renderDonutChart(chart, data);
      } else {
        renderBarChart(chart, data, config.type);
      }

      return chart;
    }

    function renderAllCharts() {
      chartGrid.querySelectorAll(".chart-card").forEach(function (chart) {
        if (!chart.dataset.chartConfig) return;
        createChart(JSON.parse(chart.dataset.chartConfig), chart);
      });
    }

    function resetChartForm() {
      chartTitleInput.value = "";
      chartTypeInput.value = "bar";
      chartGroupInput.value = "status";
    }

    function openChartModal(chart) {
      activeChart = chart || null;
      if (activeChart && activeChart.dataset.chartConfig) {
        var config = JSON.parse(activeChart.dataset.chartConfig);
        chartTitleInput.value = config.title;
        chartTypeInput.value = config.type;
        chartGroupInput.value = config.groupBy;
        chartModalTitle.textContent = "Edit Chart";
        saveChartButton.textContent = "Save Changes";
      } else {
        resetChartForm();
        chartModalTitle.textContent = "Add Chart";
        saveChartButton.textContent = "Add Chart";
      }
      chartModal.classList.add("open");
      chartModal.setAttribute("aria-hidden", "false");
      chartTitleInput.focus();
    }

    function closeChartModal() {
      chartModal.classList.remove("open");
      chartModal.setAttribute("aria-hidden", "true");
      activeChart = null;
    }

    function collectChartConfig() {
      var groupBy = chartGroupInput.value;
      return {
        title: chartTitleInput.value.trim() || "Defects by " + (labelMap[groupBy] || groupBy),
        type: chartTypeInput.value,
        groupBy: groupBy
      };
    }

    tableFilters.forEach(function (control) {
      control.addEventListener("change", function () {
        renderDashboardTable();
        renderAllCharts();
      });
    });

    if (clearTableFiltersButton) {
      clearTableFiltersButton.addEventListener("click", function () {
        tableFilters.forEach(function (control) {
          control.value = "";
        });
        renderDashboardTable();
        renderAllCharts();
      });
    }

    if (openChartButton) {
      openChartButton.addEventListener("click", function () {
        openChartModal(null);
      });
    }

    closeChartButtons.forEach(function (button) {
      button.addEventListener("click", closeChartModal);
    });

    chartModal.addEventListener("click", function (event) {
      if (event.target === chartModal) {
        closeChartModal();
      }
    });

    if (saveChartButton) {
      saveChartButton.addEventListener("click", function () {
        var chart = activeChart || document.createElement("article");
        createChart(collectChartConfig(), chart);
        if (!activeChart) {
          chartGrid.appendChild(chart);
        }
        closeChartModal();
      });
    }

    chartGrid.addEventListener("click", function (event) {
      var editButton = event.target.closest("[data-edit-chart]");
      var deleteButton = event.target.closest("[data-delete-chart]");

      if (editButton) {
        openChartModal(editButton.closest(".chart-card"));
      }

      if (deleteButton) {
        deleteButton.closest(".chart-card").remove();
      }
    });

    chartGrid.querySelectorAll("[data-default-chart]").forEach(function (chart) {
      var type = chart.getAttribute("data-default-chart");
      createChart({
        title: type === "status" ? "Defects by Status" : "Defects by Severity",
        type: type === "status" ? "bar" : "donut",
        groupBy: type,
        filters: {}
      }, chart);
    });

    renderDashboardTable();
  }

  var reportTableBody = document.querySelector("[data-report-table-body]");
  var reportChartGrid = document.querySelector("[data-report-chart-grid]");
  var reportChartModal = document.querySelector("[data-report-chart-modal]");

  if (reportTableBody && reportChartGrid && reportChartModal) {
    var reportToday = new Date();
    var reportRecords = [];
    var dashboardSummary = null;
    var dashboardCharts = [];
    var dashboardWorkflowStatuses = [];
    var dashboardWorkflowTerminalStatuses = [];
    var reportFilters = Array.prototype.slice.call(document.querySelectorAll("[data-report-filter]"));
    var reportResultCount = document.querySelector("[data-report-result-count]");
    var reportPaginationRoot = document.querySelector("[data-report-pagination]");
    var reportChartDrilldownPanel = document.querySelector("[data-dashboard-chart-drilldown]");
    var reportChartDrilldownText = document.querySelector("[data-dashboard-chart-drilldown-text]");
    var clearReportChartDrilldownButton = document.querySelector("[data-clear-dashboard-chart-drilldown]");
    var reportTableSection = reportTableBody.closest(".dashboard-section");
    var reportFilterPanel = document.querySelector(".dashboard-filter-panel");
    var reportFilterBody = document.querySelector("[data-dashboard-filter-body]");
    var toggleReportFiltersButton = document.querySelector("[data-toggle-dashboard-filters]");
    var resetReportButton = document.querySelector("[data-dashboard-reset]");
    var exportReportButton = document.querySelector("[data-dashboard-export]");
    var openReportChartModalButton = document.querySelector("[data-open-report-chart-modal]");
    var restoreReportChartSelect = document.querySelector("[data-restore-report-chart]");
    var closeReportChartModalButtons = Array.prototype.slice.call(reportChartModal.querySelectorAll("[data-close-report-chart-modal]"));
    var saveReportChartButton = reportChartModal.querySelector("[data-save-report-chart]");
    var reportChartTitleInput = reportChartModal.querySelector("[data-report-chart-title]");
    var reportChartTypeInput = reportChartModal.querySelector("[data-report-chart-type]");
    var reportChartGroupInput = reportChartModal.querySelector("[data-report-chart-group]");
    var reportChartStackInput = reportChartModal.querySelector("[data-report-chart-stack]");
    var reportChartStackRow = reportChartModal.querySelector("[data-stack-by-row]");
    var reportChartInstances = {};
    var draggedReportChart = null;
    var createdTrendHelpText = "Shows how many defects were created each month based on Created Date. Counts follow the current dashboard context, active projects, filters, and selected KPI tile. Click a chart point to filter the table.";
    var reportChartDefinitions = {
      status: { title: "Defects by Status", type: "doughnut", groupBy: "status", span: 4, tall: false },
      severity: { title: "Defects by Severity", type: "bar", groupBy: "severity", span: 4, tall: false },
      environment: { title: "Defects by Environment", type: "doughnut", groupBy: "environment", span: 4, tall: false },
      releaseVersion: {
        title: "Defects by Release",
        type: "horizontal",
        groupBy: "releaseVersion",
        span: 6,
        tall: false,
        helpText: "Shows non-closed defects by release so teams can track work awaiting deployment, retest, or closure."
      },
      trend: { title: "Created Defect Trend", type: "line", groupBy: "createdMonth", span: 6, tall: false, helpText: createdTrendHelpText }
    };
    var reportSortKey = "createdDate";
    var reportSortAsc = false;
    var reportPagination = { page: 1, pageSize: 10 };
    var activeReportKpi = null;
    var activeChartDrilldown = null;
    var labelMap = {
      status: "Status",
      severity: "Severity",
      priority: "Priority",
      project: "Project",
      environment: "Environment",
      assignedTo: "Assigned To",
      releaseVersion: "Release Version",
      createdMonth: "Created Month"
    };

    function cssToken(name) {
      return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function tokenMix(name, amount) {
      return "color-mix(in srgb, " + cssToken(name) + " " + amount + "%, transparent)";
    }

    function mixChartColor(primaryToken, primaryAmount, secondaryToken) {
      return "color-mix(in srgb, " + cssToken(primaryToken) + " " + primaryAmount + "%, " + cssToken(secondaryToken || "--surface") + ")";
    }

    var chartColors = {
      Critical: cssToken("--sev-critical"),
      High: cssToken("--sev-high"),
      Medium: cssToken("--sev-medium"),
      Low: cssToken("--sev-low"),
      New: cssToken("--status-new"),
      Assigned: cssToken("--status-assigned"),
      "In Progress": cssToken("--status-in-progress"),
      Fixed: cssToken("--status-fixed"),
      Retest: cssToken("--status-retest"),
      Closed: cssToken("--status-closed"),
      Reopened: cssToken("--status-reopened"),
      "Developer Rejected": mixChartColor("--status-reopened", 72, "--sev-high"),
      "Not a Defect": mixChartColor("--status-closed", 74, "--surface"),
      "Assigned Again": mixChartColor("--status-assigned", 72, "--primary"),
      P1: cssToken("--sev-critical"),
      P2: cssToken("--sev-high"),
      P3: cssToken("--sev-medium"),
      P4: cssToken("--sev-low")
    };
    var dimensionColorPalettes = {
      project: [
        cssToken("--status-closed"),
        mixChartColor("--status-retest", 88, "--surface"),
        cssToken("--status-in-progress"),
        mixChartColor("--status-assigned", 82, "--primary"),
        mixChartColor("--sev-high", 78, "--surface"),
        cssToken("--status-fixed")
      ],
      environment: [
        cssToken("--status-new"),
        cssToken("--status-assigned"),
        cssToken("--status-in-progress"),
        cssToken("--status-fixed"),
        cssToken("--status-retest"),
        cssToken("--status-closed")
      ],
      assignedTo: [
        cssToken("--status-closed"),
        mixChartColor("--status-in-progress", 76, "--surface"),
        cssToken("--status-retest"),
        mixChartColor("--status-assigned", 76, "--primary"),
        mixChartColor("--sev-medium", 78, "--surface"),
        mixChartColor("--sev-high", 80, "--surface")
      ],
      releaseVersion: [
        mixChartColor("--status-new", 82, "--primary"),
        cssToken("--status-assigned"),
        cssToken("--status-in-progress"),
        cssToken("--status-fixed"),
        cssToken("--status-closed"),
        mixChartColor("--sev-low", 82, "--primary")
      ],
      createdMonth: [
        cssToken("--status-assigned"),
        cssToken("--status-in-progress"),
        cssToken("--status-retest"),
        cssToken("--status-closed"),
        mixChartColor("--sev-medium", 82, "--surface")
      ]
    };
    var neutralPalette = dimensionColorPalettes.project.concat(dimensionColorPalettes.assignedTo);

    if (window.Chart) {
      Chart.defaults.font.family = cssToken("--font-sans");
      Chart.defaults.color = cssToken("--muted");
      Chart.defaults.borderColor = tokenMix("--primary", 18);
      if (window.ChartDataLabels && !Chart._dtDataLabelsRegistered) {
        Chart.register(window.ChartDataLabels);
        Chart.defaults.set("plugins.datalabels", { display: false });
        Chart._dtDataLabelsRegistered = true;
      }
    }

    var kpiBaseline = {
      total: 0,
      open: 0,
      fixed: 0,
      closed: 0,
      highOpen: 0
    };

    function dateOnly(value) {
      return value ? String(value).slice(0, 10) : "";
    }

    function apiDefectToReportRecord(defect) {
      var createdDate = dateOnly(defect.createdAt);
      var created = createdDate ? new Date(createdDate + "T00:00:00") : reportToday;
      return {
        id: defect.defectKey || defect.id,
        title: defect.title || "",
        description: defect.description || "",
        project: defect.project && defect.project.projectName ? defect.project.projectName : "",
        environment: defect.environment && defect.environment.environmentName ? defect.environment.environmentName : "",
        severity: defect.severity && defect.severity.name ? defect.severity.name : "",
        priority: defect.priority && defect.priority.name ? defect.priority.name : "",
        status: defect.currentStatus || "",
        assignedTo: defect.assignedTo && defect.assignedTo.name ? defect.assignedTo.name : "",
        releaseVersion: defect.fixedInRelease && defect.fixedInRelease.releaseVersion ? defect.fixedInRelease.releaseVersion : "",
        createdBy: defect.createdBy && defect.createdBy.username ? defect.createdBy.username : "",
        createdDate: createdDate,
        createdMonth: createdDate ? createdDate.slice(0, 7) : "Not set",
        deploymentDate: defect.fixedInRelease ? dateOnly(defect.fixedInRelease.actualDeploymentDate || defect.fixedInRelease.plannedDeploymentDate) : "",
        fixDate: dateOnly(defect.fixDate),
        closureDate: dateOnly(defect.closureDate),
        age: Math.max(0, Math.round((reportToday - created) / 86400000))
      };
    }

    function dashboardSummaryToBaseline(summary) {
      kpiBaseline = {
        total: summary ? summary.totalDefects || 0 : 0,
        open: summary ? summary.openDefects || 0 : 0,
        fixed: summary ? summary.fixedDefects || 0 : 0,
        closed: summary ? summary.closedDefects || 0 : 0,
        highOpen: summary ? summary.highPriorityOpenDefects || 0 : 0
      };
    }

    function uniqueValues(field) {
      return Array.from(new Set(reportRecords.map(function (record) {
        return record[field];
      }).filter(Boolean))).sort();
    }

    function fillReportSelect(field, overrideValues) {
      var select = document.querySelector('[data-report-filter="' + field + '"]');
      if (!select) return;
      var firstOption = select.querySelector("option");
      select.innerHTML = "";
      if (firstOption) select.appendChild(firstOption);
      (overrideValues || uniqueValues(field)).forEach(function (value) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }

    function getReportFilters() {
      var filters = {};
      reportFilters.forEach(function (control) {
        filters[control.getAttribute("data-report-filter")] = control.value.trim();
      });
      return filters;
    }

    function syncFiltersToUrl() {
      var filters = getReportFilters();
      var params = new URLSearchParams();
      Object.keys(filters).forEach(function (key) {
        if (filters[key]) params.set(key, filters[key]);
      });
      if (activeReportKpi) params.set("kpi", activeReportKpi);
      if (activeChartDrilldown && activeChartDrilldown.criteria) {
        activeChartDrilldown.criteria.slice(0, 2).forEach(function (criterion, index) {
          var suffix = index ? String(index + 1) : "";
          params.set("chartField" + suffix, criterion.field);
          params.set("chartValue" + suffix, criterion.value);
        });
      }
      var queryString = params.toString();
      var newUrl = window.location.pathname + (queryString ? "?" + queryString : "") + window.location.hash;
      window.history.replaceState(null, "", newUrl);
    }

    function applyUrlFilters() {
      var params = new URLSearchParams(window.location.search);
      reportFilters.forEach(function (control) {
        var key = control.getAttribute("data-report-filter");
        var value = params.get(key);
        if (value !== null) control.value = value;
      });
      var kpiParam = params.get("kpi");
      if (kpiParam && ["open", "fixed", "closed", "highOpen"].indexOf(kpiParam) !== -1) {
        activeReportKpi = kpiParam;
      }
      activeChartDrilldown = collectUrlChartDrilldown(params);
      updateChartDrilldownVisual();
      updateActiveKpiVisual();
    }

    function collectUrlChartDrilldown(params) {
      var criteria = [];
      ["", "2"].forEach(function (suffix) {
        var field = params.get("chartField" + suffix);
        var value = params.get("chartValue" + suffix);
        if (field && value && canUseChartDrilldownField(field)) {
          criteria.push({ field: field, value: value });
        }
      });
      return criteria.length ? { criteria: criteria } : null;
    }

    function recordMatchesReportFilters(record, filters) {
      var search = (filters.search || "").toLowerCase();
      if (filters.project && record.project !== filters.project) return false;
      if (filters.environment && record.environment !== filters.environment) return false;
      if (filters.status && record.status !== filters.status) return false;
      if (filters.severity && record.severity !== filters.severity) return false;
      if (filters.priority && record.priority !== filters.priority) return false;
      if (filters.assignedTo && record.assignedTo !== filters.assignedTo) return false;
      if (filters.releaseVersion && record.releaseVersion !== filters.releaseVersion) return false;
      if (filters.from && record.createdDate < filters.from) return false;
      if (filters.to && record.createdDate > filters.to) return false;
      if (search) {
        var searchable = [record.id, record.title, record.project, record.environment, record.status, record.severity, record.priority, record.assignedTo, record.createdBy, record.releaseVersion].join(" ").toLowerCase();
        if (searchable.indexOf(search) === -1) return false;
      }
      return true;
    }

    function recordMatchesActiveKpi(record) {
      if (activeReportKpi === "open") return isOpenStatus(record.status);
      if (activeReportKpi === "fixed") return record.status === "Fixed";
      if (activeReportKpi === "closed") return record.status === "Closed";
      if (activeReportKpi === "highOpen") {
        return isOpenStatus(record.status) && (record.priority === "P1" || record.priority === "P2");
      }
      return true;
    }

    function getDashboardScopedReportRecords() {
      var filters = getReportFilters();
      return reportRecords.filter(function (record) {
        return recordMatchesReportFilters(record, filters) && recordMatchesActiveKpi(record);
      });
    }

    function getFilteredReportRecords() {
      return getDashboardScopedReportRecords().filter(function (record) {
        return recordMatchesChartDrilldown(record);
      });
    }

    function isOpenStatus(status) {
      return isOpenWorkflowStatus(status, dashboardWorkflowTerminalStatuses);
    }

    function canUseChartDrilldownField(field) {
      return ["status", "severity", "priority", "project", "environment", "assignedTo", "releaseVersion", "createdMonth", "aging"].indexOf(field) !== -1;
    }

    function isAgingMatch(record, bucket) {
      if (!isOpenStatus(record.status)) return false;
      if (bucket === "0-7") return record.age <= 7;
      if (bucket === "8-14") return record.age >= 8 && record.age <= 14;
      if (bucket === "15-30") return record.age >= 15 && record.age <= 30;
      if (bucket === "31+") return record.age >= 31;
      return false;
    }

    function recordMatchesChartCriterion(record, criterion) {
      if (!criterion || !criterion.field) return true;
      if (criterion.field === "aging") return isAgingMatch(record, criterion.value);
      return String(record[criterion.field] || "Not set") === String(criterion.value || "Not set");
    }

    function recordMatchesChartDrilldown(record) {
      if (!activeChartDrilldown || !activeChartDrilldown.criteria) return true;
      if (activeChartDrilldown.excludeClosed && normalizeStatusKey(record.status) === "closed") return false;
      return activeChartDrilldown.criteria.every(function (criterion) {
        return recordMatchesChartCriterion(record, criterion);
      });
    }

    function chartDrilldownLabel() {
      if (!activeChartDrilldown || !activeChartDrilldown.criteria) return "";
      return activeChartDrilldown.criteria.map(function (criterion) {
        return (labelMap[criterion.field] || criterion.field) + " = " + criterion.value;
      }).join(" | ");
    }

    function updateChartDrilldownVisual() {
      if (!reportChartDrilldownPanel || !reportChartDrilldownText) return;
      var text = chartDrilldownLabel();
      reportChartDrilldownPanel.hidden = !text;
      reportChartDrilldownText.textContent = text;
    }

    function clearChartDrilldown() {
      activeChartDrilldown = null;
      resetReportPagination();
      refreshReportDashboard();
    }

    function drawAttentionToReportTable() {
      if (!reportTableSection) return;
      reportTableSection.scrollIntoView({ behavior: "smooth", block: "start" });
      reportTableSection.classList.remove("is-table-focus");
      void reportTableSection.offsetWidth;
      reportTableSection.classList.add("is-table-focus");
      window.setTimeout(function () {
        reportTableSection.classList.remove("is-table-focus");
      }, 1100);
    }

    function renderReportKpis() {
      setKpi("total", kpiBaseline.total);
      setKpi("open", kpiBaseline.open);
      setKpi("fixed", kpiBaseline.fixed);
      setKpi("closed", kpiBaseline.closed);
      setKpi("highOpen", kpiBaseline.highOpen);
      setKpiNote("total", getStoredDataContext() + " context");
      setKpiNote("open", kpiBaseline.total ? Math.round((kpiBaseline.open / kpiBaseline.total) * 100) + "% of context" : "No defects");
      setKpiNote("closed", kpiBaseline.total ? Math.round((kpiBaseline.closed / kpiBaseline.total) * 100) + "% of context" : "No defects");
    }

    function setKpi(key, value, baseline) {
      var el = document.querySelector('[data-kpi-value="' + key + '"]');
      if (!el) return;
      if (baseline === undefined || baseline === null || value === baseline) {
        el.textContent = value;
        return;
      }
      el.innerHTML = "";
      var currentSpan = document.createElement("span");
      currentSpan.className = "summary-value-current";
      currentSpan.textContent = value;
      var baselineSpan = document.createElement("span");
      baselineSpan.className = "summary-value-baseline";
      baselineSpan.textContent = " of " + baseline;
      el.appendChild(currentSpan);
      el.appendChild(baselineSpan);
    }

    function setKpiNote(key, value) {
      var el = document.querySelector('[data-kpi-note="' + key + '"]');
      if (el) el.textContent = value;
    }

    function getKpiKeyFromCard(card) {
      var valueEl = card.querySelector("[data-kpi-value]");
      return valueEl ? valueEl.getAttribute("data-kpi-value") : null;
    }

    function updateActiveKpiVisual() {
      document.querySelectorAll(".dashboard-kpi").forEach(function (card) {
        var key = getKpiKeyFromCard(card);
        if (key && key === activeReportKpi) {
          card.classList.add("is-active");
        } else {
          card.classList.remove("is-active");
        }
      });
    }

    function handleKpiTileClick(event) {
      var card = event.target.closest(".dashboard-kpi");
      if (!card) return;
      var key = getKpiKeyFromCard(card);
      if (!key) return;
      activeChartDrilldown = null;
      if (key === "total") {
        activeReportKpi = null;
        reportFilters.forEach(function (control) { control.value = ""; });
      } else if (activeReportKpi === key) {
        activeReportKpi = null;
      } else {
        activeReportKpi = key;
      }
      reportPagination.page = 1;
      updateActiveKpiVisual();
      refreshReportDashboard({ refreshCharts: true });
    }

    function countBy(rows, field) {
      var counts = {};
      rows.forEach(function (record) {
        var value = record[field] || "Not set";
        counts[value] = (counts[value] || 0) + 1;
      });
      return Object.keys(counts).sort().map(function (label) {
        return { label: label, value: counts[label] };
      });
    }

    function countAging(rows) {
      var buckets = { "0-7": 0, "8-14": 0, "15-30": 0, "31+": 0 };
      rows.filter(function (record) { return isOpenStatus(record.status); }).forEach(function (record) {
        if (record.age <= 7) buckets["0-7"] += 1;
        else if (record.age <= 14) buckets["8-14"] += 1;
        else if (record.age <= 30) buckets["15-30"] += 1;
        else buckets["31+"] += 1;
      });
      return Object.keys(buckets).map(function (label) {
        return { label: label, value: buckets[label] };
      });
    }

    function getReportStackBy(config) {
      var stackBy = config.stackBy || "severity";
      if (stackBy === config.groupBy) {
        stackBy = config.groupBy === "severity" ? "status" : "severity";
      }
      return stackBy;
    }

    function countByGroupAndStack(rows, groupBy, stackBy) {
      var groupSet = {};
      var stackSet = {};
      rows.forEach(function (record) {
        var groupValue = record[groupBy] || "Not set";
        var stackValue = record[stackBy] || "Not set";
        groupSet[groupValue] = true;
        stackSet[stackValue] = true;
      });
      var groupLabels = Object.keys(groupSet).sort();
      var stackLabels = Object.keys(stackSet).sort();
      var matrix = {};
      stackLabels.forEach(function (stackLabel) {
        matrix[stackLabel] = groupLabels.map(function () { return 0; });
      });
      rows.forEach(function (record) {
        var groupValue = record[groupBy] || "Not set";
        var stackValue = record[stackBy] || "Not set";
        var groupIndex = groupLabels.indexOf(groupValue);
        if (groupIndex !== -1) {
          matrix[stackValue][groupIndex] += 1;
        }
      });
      return { labels: groupLabels, stacks: stackLabels, matrix: matrix };
    }

    function colorForLabel(label, dimension, index) {
      if (chartColors[label]) return chartColors[label];
      if (dimension === "status") {
        var statusKey = normalizeStatusKey(label);
        if (statusKey === "new") return cssToken("--status-new");
        if (statusKey === "assigned" || statusKey === "assigned-again") return cssToken("--status-assigned");
        if (statusKey === "in-progress" || statusKey === "inprogress") return cssToken("--status-in-progress");
        if (statusKey === "fixed") return cssToken("--status-fixed");
        if (statusKey === "test" || statusKey === "testing" || statusKey === "retest") return cssToken("--status-retest");
        if (statusKey === "closed" || statusKey === "not-a-defect") return cssToken("--status-closed");
        if (statusKey === "reopened" || statusKey === "re-open" || statusKey === "rejected" || statusKey === "developer-rejected") return cssToken("--status-reopened");
      }
      var palette = dimensionColorPalettes[dimension] || neutralPalette;
      return palette[index % palette.length];
    }

    function colorsFor(labels, dimension) {
      return labels.map(function (label, index) {
        return colorForLabel(label, dimension, index);
      });
    }

    function chartMetaText(rows) {
      return rows.length + " defects in current view";
    }

    function rowsForReportChart(config, rows) {
      if (config && config.groupBy === "releaseVersion") {
        return rows.filter(function (record) {
          return normalizeStatusKey(record.status) !== "closed";
        });
      }
      return rows;
    }

    function getReportChartTitle(card, config) {
      var heading = card ? card.querySelector(".chart-title-row h3") : null;
      return (config && config.title) || (heading && heading.textContent.trim()) || "Chart";
    }

    function reportChartTypeLabel(type) {
      var labels = {
        bar: "bar chart",
        horizontal: "horizontal bar chart",
        doughnut: "doughnut chart",
        pie: "pie chart",
        line: "trend chart",
        stacked: "stacked bar chart"
      };
      return labels[type] || "chart";
    }

    function defaultReportChartHelpText(config, title) {
      var groupLabel = labelMap[config.groupBy] || config.groupBy || "selected field";
      var typeLabel = reportChartTypeLabel(config.type);
      var sharedScope = "Counts follow the current dashboard context, active projects, filters, and selected KPI tile.";
      var clickHint = "Click a chart value to filter the table.";
      if (config.groupBy === "createdMonth") {
        return "Shows how many defects were created each month based on Created Date. " + sharedScope + " " + clickHint;
      }
      if (config.type === "stacked") {
        var stackLabel = labelMap[getReportStackBy(config)] || getReportStackBy(config);
        return "Shows " + groupLabel + " distribution stacked by " + stackLabel + ". " + sharedScope + " " + clickHint;
      }
      return "Shows " + title + " as a " + typeLabel + " grouped by " + groupLabel + ". " + sharedScope + " " + clickHint;
    }

    function closeAllReportChartHelp(exceptCard) {
      reportChartGrid.querySelectorAll(".report-chart-card").forEach(function (card) {
        if (exceptCard && card === exceptCard) return;
        setReportChartHelpVisible(card, false);
      });
    }

    function setReportChartHelpVisible(card, visible) {
      var panel = card.querySelector("[data-chart-help-panel]");
      var trigger = card.querySelector("[data-chart-help-trigger]");
      card.classList.toggle("is-chart-help-open", visible);
      if (trigger) trigger.setAttribute("aria-expanded", visible ? "true" : "false");
      if (panel) panel.hidden = !visible;
    }

    function wireReportChartHelp(card) {
      if (!card || card.getAttribute("data-chart-help-wired") === "true") return;
      card.setAttribute("data-chart-help-wired", "true");

      card.addEventListener("click", function (event) {
        var trigger = event.target.closest("[data-chart-help-trigger]");
        var closeButton = event.target.closest("[data-chart-help-close]");
        if (trigger) {
          event.preventDefault();
          var nextVisible = !card.classList.contains("is-chart-help-open");
          closeAllReportChartHelp(nextVisible ? card : null);
          setReportChartHelpVisible(card, nextVisible);
          return;
        }
        if (closeButton) {
          event.preventDefault();
          setReportChartHelpVisible(card, false);
        }
      });
    }

    function applyReportChartHelp(card, config) {
      var title = getReportChartTitle(card, config);
      var helpText = config && config.helpText ? config.helpText : defaultReportChartHelpText(config || {}, title);
      var heading = card.querySelector(".chart-title-row h3");
      var existingPanel = card.querySelector("[data-chart-help-panel]");
      var existingTrigger = card.querySelector("[data-chart-help-trigger]");
      if (!helpText) {
        card.removeAttribute("title");
        card.removeAttribute("aria-label");
        card.removeAttribute("data-chart-help");
        setReportChartHelpVisible(card, false);
        if (heading) heading.removeAttribute("title");
        if (existingPanel) existingPanel.remove();
        if (existingTrigger) existingTrigger.remove();
        return;
      }
      card.removeAttribute("title");
      card.setAttribute("data-chart-help", helpText);
      card.setAttribute("aria-label", title + ". " + helpText);
      if (heading) heading.removeAttribute("title");
      if (!existingTrigger && heading) {
        existingTrigger = document.createElement("button");
        existingTrigger.type = "button";
        existingTrigger.className = "chart-help-trigger";
        existingTrigger.setAttribute("data-chart-help-trigger", "");
        existingTrigger.setAttribute("aria-label", "Open chart help");
        existingTrigger.setAttribute("aria-expanded", "false");
        existingTrigger.title = "Chart help";
        existingTrigger.textContent = "i";
        heading.insertAdjacentElement("afterend", existingTrigger);
      } else if (existingTrigger) {
        existingTrigger.textContent = "i";
        if (heading && existingTrigger.previousElementSibling !== heading) {
          heading.insertAdjacentElement("afterend", existingTrigger);
        }
      }
      if (!existingPanel) {
        existingPanel = document.createElement("div");
        existingPanel.className = "chart-help-panel";
        existingPanel.setAttribute("data-chart-help-panel", "");
        existingPanel.setAttribute("role", "dialog");
        existingPanel.setAttribute("aria-label", "Chart help");
        existingPanel.hidden = true;
        existingPanel.innerHTML = '<div class="chart-help-panel-head"><strong>Chart help</strong><button class="chart-help-close" type="button" data-chart-help-close aria-label="Close chart help">' + uiIcons.close + '</button></div><p class="chart-help-panel-copy" data-chart-help-copy></p>';
        var titleRow = card.querySelector(".chart-title-row");
        if (titleRow && titleRow.parentNode) {
          titleRow.parentNode.insertBefore(existingPanel, titleRow.nextSibling);
        } else {
          card.appendChild(existingPanel);
        }
      }
      var copy = existingPanel.querySelector("[data-chart-help-copy]");
      if (copy) copy.textContent = helpText;
      wireReportChartHelp(card);
    }

    function normalizeChartType(type) {
      if (type === "horizontal") return "bar";
      if (type === "stacked") return "bar";
      return type;
    }

    function isRoundChart(type) {
      return type === "doughnut" || type === "pie";
    }

    var chartValuesStorageKey = "defectTrackerShowChartValues";
    var showChartValues = false;
    try {
      showChartValues = window.localStorage.getItem(chartValuesStorageKey) === "true";
    } catch (e) {
      showChartValues = false;
    }
    var chartLabelOpacity = showChartValues ? 1 : 0;
    var chartValuesAnimationFrame = null;

    function persistChartValuesPreference() {
      try {
        window.localStorage.setItem(chartValuesStorageKey, showChartValues ? "true" : "false");
      } catch (e) {
        /* localStorage unavailable — fall through */
      }
    }

    function getDataLabelsConfig(type, isStacked, configType) {
      var base = {
        display: true,
        clamp: true,
        clip: false,
        opacity: chartLabelOpacity,
        color: cssToken("--text"),
        font: { family: cssToken("--font-sans"), weight: "600", size: 11 },
        formatter: function (value) {
          return value === 0 || value == null ? "" : value;
        }
      };
      if (isRoundChart(type)) {
        return Object.assign({}, base, {
          color: cssToken("--surface"),
          font: { family: cssToken("--font-sans"), weight: "600", size: 12 },
          display: function (context) {
            var dataset = context.chart.data.datasets[0];
            var total = dataset.data.reduce(function (a, b) { return a + (b || 0); }, 0);
            var value = dataset.data[context.dataIndex];
            if (!value || !total) return false;
            return (value / total) > 0.06;
          }
        });
      }
      if (isStacked) {
        return Object.assign({}, base, {
          color: cssToken("--surface"),
          anchor: "center",
          align: "center",
          display: function (context) {
            var v = context.dataset.data[context.dataIndex];
            return v && v > 0;
          }
        });
      }
      if (type === "line") {
        return Object.assign({}, base, {
          anchor: "end",
          align: "top",
          offset: 4,
          display: function (context) {
            var data = context.dataset.data;
            var i = context.dataIndex;
            if (i === data.length - 1) return true;
            if (i === 0) return false;
            return data[i] > data[i - 1] && data[i] > data[i + 1];
          }
        });
      }
      if (configType === "horizontal") {
        return Object.assign({}, base, {
          anchor: "end",
          align: "right",
          offset: 4
        });
      }
      return Object.assign({}, base, {
        anchor: "end",
        align: "top",
        offset: 2
      });
    }

    function getReportChartConfig(card) {
      var id = card.getAttribute("data-chart-id");
      if (reportChartDefinitions[id]) {
        return reportChartDefinitions[id];
      }
      return JSON.parse(card.getAttribute("data-chart-config") || "{}");
    }

    function createReportChartCard(id, definition) {
      var card = document.createElement("article");
      card.className = "report-chart-card";
      if (definition.span >= 8) card.classList.add("wide-chart");
      else if (definition.span === 6) card.classList.add("half-chart");
      card.setAttribute("data-chart-id", id);
      card.innerHTML = '<div class="chart-title-row"><div><h3></h3><p class="chart-meta" data-chart-meta>All defects</p></div></div><div class="canvas-wrap"><canvas></canvas></div>';
      card.querySelector("h3").textContent = definition.title;
      applyReportChartHelp(card, definition);
      return card;
    }

    function updateRestoreChartOptions() {
      if (!restoreReportChartSelect) return;
      var activeIds = Array.prototype.slice.call(reportChartGrid.querySelectorAll(".report-chart-card")).map(function (card) {
        return card.getAttribute("data-chart-id");
      });
      var removedIds = Object.keys(reportChartDefinitions).filter(function (id) {
        return activeIds.indexOf(id) === -1;
      });
      restoreReportChartSelect.innerHTML = '<option value="">Restore removed chart</option>';
      removedIds.forEach(function (id) {
        var option = document.createElement("option");
        option.value = id;
        option.textContent = reportChartDefinitions[id].title;
        restoreReportChartSelect.appendChild(option);
      });
      restoreReportChartSelect.hidden = removedIds.length === 0;
    }

    function restoreReportChart(id) {
      var definition = reportChartDefinitions[id];
      if (!definition || reportChartGrid.querySelector('[data-chart-id="' + id + '"]')) return;
      var card = createReportChartCard(id, definition);
      reportChartGrid.appendChild(card);
      renderReportChart(card, definition, getDashboardScopedReportRecords());
      updateRestoreChartOptions();
    }

    function getCardSpan(card) {
      var attr = Number(card.getAttribute("data-chart-span"));
      if (attr) return attr;
      if (card.classList.contains("wide-chart")) return 8;
      if (card.classList.contains("half-chart")) return 6;
      return 4;
    }

    function prepareReportChartCard(card) {
      var titleRow = card.querySelector(".chart-title-row");
      var actions = card.querySelector(".chart-actions");
      var resizeHandle = card.querySelector("[data-resize-report-chart]");

      if (!titleRow) return;

      if (!actions) {
        actions = document.createElement("div");
        actions.className = "chart-actions";
        titleRow.appendChild(actions);
      }

      if (!card.querySelector("[data-chart-drag-handle]")) {
        var dragHandle = document.createElement("button");
        dragHandle.type = "button";
        dragHandle.className = "chart-drag-handle";
        dragHandle.setAttribute("data-chart-drag-handle", "");
        dragHandle.setAttribute("aria-label", "Move chart");
        dragHandle.title = "Move chart";
        dragHandle.innerHTML = uiIcons.grip;
        actions.insertBefore(dragHandle, actions.firstChild);
      } else {
        card.querySelector("[data-chart-drag-handle]").innerHTML = uiIcons.grip;
      }

      if (!card.querySelector("[data-remove-report-chart]")) {
        var removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "chart-remove-button";
        removeButton.setAttribute("data-remove-report-chart", "");
        removeButton.setAttribute("aria-label", "Remove chart");
        removeButton.title = "Remove chart";
        removeButton.innerHTML = uiIcons.close;
        actions.appendChild(removeButton);
      } else {
        var existingRemove = card.querySelector("[data-remove-report-chart]");
        existingRemove.classList.add("chart-remove-button");
        existingRemove.setAttribute("aria-label", "Remove chart");
        existingRemove.title = "Remove chart";
        existingRemove.innerHTML = uiIcons.close;
      }

      if (!resizeHandle) {
        resizeHandle = document.createElement("button");
        resizeHandle.type = "button";
        resizeHandle.className = "chart-resize-handle";
        resizeHandle.setAttribute("data-resize-report-chart", "");
        resizeHandle.setAttribute("aria-label", "Resize chart");
        resizeHandle.title = "Drag to resize";
        resizeHandle.innerHTML = uiIcons.resize;
        card.appendChild(resizeHandle);
      } else {
        resizeHandle.innerHTML = uiIcons.resize;
      }

      card.draggable = false;
    }

    function resizeReportChartInstance(card) {
      var chartId = card.getAttribute("data-chart-instance-id");
      if (window.Chart && chartId && reportChartInstances[chartId]) {
        var canvasWrap = card.querySelector(".canvas-wrap");
        if (canvasWrap) {
          reportChartInstances[chartId].resize(canvasWrap.clientWidth, canvasWrap.clientHeight);
        } else {
          reportChartInstances[chartId].resize();
        }
      }
    }

    function renderReportChart(card, config, rows) {
      prepareReportChartCard(card);
      applyReportChartHelp(card, config);
      rows = rowsForReportChart(config, rows);
      var canvas = card.querySelector("canvas");
      var meta = card.querySelector("[data-chart-meta]");
      var chartId = card.getAttribute("data-chart-instance-id") || card.getAttribute("data-chart-id") || ("chart-" + Date.now());
      var existingFallback = card.querySelector("[data-chart-fallback]");
      var type = normalizeChartType(config.type);
      var isStacked = config.type === "stacked";
      var labels;
      var datasets;

      if (isStacked) {
        var stackBy = getReportStackBy(config);
        var stackedData = countByGroupAndStack(rows, config.groupBy, stackBy);
        labels = stackedData.labels;
        datasets = stackedData.stacks.map(function (stackLabel, index) {
          var color = colorForLabel(stackLabel, stackBy, index);
          return {
            label: stackLabel,
            data: stackedData.matrix[stackLabel],
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
          };
        });
      } else {
        var dataRows = config.groupBy === "aging" ? countAging(rows) : countBy(rows, config.groupBy);
        labels = dataRows.map(function (row) { return row.label; });
        var values = dataRows.map(function (row) { return row.value; });
        var labelColors = colorsFor(labels, config.groupBy);
        datasets = [{
          label: "Defects",
          data: values,
          backgroundColor: type === "line" ? tokenMix("--status-in-progress", 25) : labelColors,
          borderColor: type === "line" ? cssToken("--status-in-progress") : labelColors,
          borderWidth: type === "line" ? 2 : 1,
          fill: type === "line",
          tension: .35
        }];
      }

      card.setAttribute("data-chart-instance-id", chartId);
      if (meta) meta.textContent = chartMetaText(rows);

      if (existingFallback) {
        existingFallback.remove();
      }

      if (!window.Chart) {
        if (canvas) canvas.hidden = true;
        var fallback = document.createElement("div");
        fallback.className = "chart-empty";
        fallback.setAttribute("data-chart-fallback", "");
        fallback.textContent = "Chart preview is waiting for Chart.js to load.";
        card.appendChild(fallback);
        return;
      }

      if (canvas) canvas.hidden = false;

      if (reportChartInstances[chartId]) {
        reportChartInstances[chartId].destroy();
      }

      var showLegend = isRoundChart(type) || isStacked;
      var roundChart = isRoundChart(type);
      var scales;
      if (roundChart) {
        scales = {};
      } else if (isStacked) {
        scales = {
          x: { stacked: true, grid: { display: false }, ticks: { color: cssToken("--muted"), font: { family: cssToken("--font-sans"), size: 13, weight: "600" } } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: cssToken("--muted"), font: { family: cssToken("--font-sans"), size: 13, weight: "600" } } }
        };
      } else {
        scales = {
          x: { grid: { display: false }, ticks: { color: cssToken("--muted"), font: { family: cssToken("--font-sans"), size: 13, weight: "600" } } },
          y: { beginAtZero: true, ticks: { precision: 0, color: cssToken("--muted"), font: { family: cssToken("--font-sans"), size: 13, weight: "600" } } }
        };
      }
      if (!roundChart) {
        var chartValueGrace = "15%";
        if (config.type === "horizontal") {
          scales.x.grace = chartValueGrace;
        } else {
          scales.y.grace = chartValueGrace;
        }
      }

      function reportTooltipConfig() {
        var tooltipConfig = { displayColors: isStacked };
        if (config.groupBy === "createdMonth") {
          tooltipConfig.callbacks = {
            title: function (items) {
              return items && items.length ? "Created Month: " + items[0].label : "Created Month";
            },
            label: function (context) {
              var value = context.parsed && context.parsed.y != null ? context.parsed.y : context.raw;
              return "Defects created: " + value;
            },
            afterBody: function () {
              return "Based on Created Date in the current dashboard scope.";
            }
          };
        }
        return tooltipConfig;
      }

      reportChartInstances[chartId] = new Chart(canvas.getContext("2d"), {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: config.type === "horizontal" ? "y" : "x",
          onClick: function (event, elements, chart) {
            handleReportChartDrilldown(config, chart, elements);
          },
          onHover: function (event, elements) {
            if (event.native && event.native.target) {
              event.native.target.style.cursor = elements && elements.length ? "pointer" : "default";
            }
          },
          plugins: {
            legend: { display: showLegend, position: "bottom", labels: { boxWidth: 10, padding: 10 } },
            tooltip: reportTooltipConfig(),
            datalabels: getDataLabelsConfig(type, isStacked, config.type)
          },
          scales: scales
        }
      });
    }

    function handleReportChartDrilldown(config, chart, elements) {
      if (!elements || !elements.length || !chart || !chart.data) return;
      var element = elements[0];
      var dataIndex = element.index;
      var datasetIndex = element.datasetIndex || 0;
      var criteria = [];
      var groupLabel = chart.data.labels && chart.data.labels[dataIndex];
      if (canUseChartDrilldownField(config.groupBy) && groupLabel !== undefined && groupLabel !== null) {
        criteria.push({ field: config.groupBy, value: String(groupLabel) });
      }
      if (config.type === "stacked") {
        var stackBy = getReportStackBy(config);
        var dataset = chart.data.datasets && chart.data.datasets[datasetIndex];
        if (dataset && canUseChartDrilldownField(stackBy) && dataset.label !== undefined && dataset.label !== null) {
          criteria.push({ field: stackBy, value: String(dataset.label) });
        }
      }
      if (!criteria.length) return;
      activeChartDrilldown = {
        criteria: criteria,
        excludeClosed: config.groupBy === "releaseVersion"
      };
      resetReportPagination();
      refreshReportDashboard({ refreshCharts: false, scrollToTable: true });
    }

    function renderAllReportCharts(rows) {
      reportChartGrid.querySelectorAll(".report-chart-card").forEach(function (card) {
        renderReportChart(card, getReportChartConfig(card), rows);
      });
      updateRestoreChartOptions();
    }

    function easeChartValueMotion(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function applyChartValueMotion(chart, opacity) {
      if (!chart || !chart.options) return;
      if (chart.options.plugins && chart.options.plugins.datalabels) {
        chart.options.plugins.datalabels.opacity = opacity;
      }
      chart.update("none");
    }

    function animateChartValueVisibility(nextVisible) {
      var cancelAnimation = window.cancelAnimationFrame || window.clearTimeout;
      var requestAnimation = window.requestAnimationFrame || function (callback) {
        return window.setTimeout(function () { callback(Date.now()); }, 16);
      };
      if (chartValuesAnimationFrame) {
        cancelAnimation(chartValuesAnimationFrame);
      }
      var start = chartLabelOpacity;
      var end = nextVisible ? 1 : 0;
      if (nextVisible) {
        showChartValues = true;
        persistChartValuesPreference();
        applyChartValuesButtonState();
        if (chartLabelOpacity <= 0) {
          chartLabelOpacity = 0;
          start = 0;
        }
      } else {
        showChartValues = false;
        persistChartValuesPreference();
        applyChartValuesButtonState();
      }
      var startedAt = window.performance && window.performance.now ? window.performance.now() : Date.now();
      var duration = 220;

      function step(now) {
        var elapsed = Math.min(1, (now - startedAt) / duration);
        chartLabelOpacity = start + ((end - start) * easeChartValueMotion(elapsed));
        Object.keys(reportChartInstances).forEach(function (key) {
          applyChartValueMotion(reportChartInstances[key], chartLabelOpacity);
        });
        if (elapsed < 1) {
          chartValuesAnimationFrame = requestAnimation(step);
          return;
        }
        chartLabelOpacity = end;
        chartValuesAnimationFrame = null;
        Object.keys(reportChartInstances).forEach(function (key) {
          applyChartValueMotion(reportChartInstances[key], chartLabelOpacity);
        });
      }

      chartValuesAnimationFrame = requestAnimation(step);
    }

    function getReportBadgeClass(value, field) {
      var key = String(value).toLowerCase().replace(/\s+/g, "-");
      if (field === "severity") return "badge-" + key;
      if (field === "status") return getStatusBadgeClass(value);
      return "badge-neutral";
    }

    function createReportBadge(value, field) {
      var badge = document.createElement("span");
      badge.className = "badge " + getReportBadgeClass(value, field);
      badge.textContent = value;
      return badge;
    }

    function appendReportCell(row, text, className) {
      var cell = document.createElement("td");
      cell.textContent = text;
      if (className) cell.className = className;
      row.appendChild(cell);
    }

    function sortedReportRows(rows) {
      var severityWeights = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      var priorityWeights = { P1: 4, P2: 3, P3: 2, P4: 1 };
      return rows.slice().sort(function (a, b) {
        var left = a[reportSortKey];
        var right = b[reportSortKey];
        if (reportSortKey === "severity") {
          var leftSev = severityWeights[left] || 0;
          var rightSev = severityWeights[right] || 0;
          return reportSortAsc ? leftSev - rightSev : rightSev - leftSev;
        }
        if (reportSortKey === "priority") {
          var leftPri = priorityWeights[left] || 0;
          var rightPri = priorityWeights[right] || 0;
          return reportSortAsc ? leftPri - rightPri : rightPri - leftPri;
        }
        if (typeof left === "number" && typeof right === "number") {
          return reportSortAsc ? left - right : right - left;
        }
        var leftStr = String(left == null ? "" : left);
        var rightStr = String(right == null ? "" : right);
        return reportSortAsc
          ? leftStr.localeCompare(rightStr, undefined, { numeric: true, sensitivity: "base" })
          : rightStr.localeCompare(leftStr, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    function renderReportTable(rows) {
      reportTableBody.innerHTML = "";
      var sortedRows = sortedReportRows(rows);
      var totalRows = sortedRows.length;
      var totalPages = Math.max(1, Math.ceil(totalRows / reportPagination.pageSize));
      reportPagination.page = Math.min(Math.max(1, reportPagination.page), totalPages);
      var pageRows = getPagedRows(sortedRows, reportPagination.page, reportPagination.pageSize);

      pageRows.forEach(function (record) {
        var row = document.createElement("tr");
        var idCell = document.createElement("td");
        var idLink = document.createElement("a");
        idLink.className = "defect-id-link";
        idLink.textContent = record.id;
        idLink.title = "View " + record.id;
        idLink.setAttribute("aria-label", "View " + record.id);
        var backTarget = window.location.pathname + window.location.search;
        idLink.href = "defect_detail.html?id=" + encodeURIComponent(record.id) + "&back=" + encodeURIComponent(backTarget);
        idCell.appendChild(idLink);
        row.appendChild(idCell);
        var titleCell = document.createElement("td");
        titleCell.className = "report-title-cell";
        titleCell.textContent = record.title;
        titleCell.title = record.title;
        row.appendChild(titleCell);
        appendReportCell(row, record.project);
        appendReportCell(row, record.environment);
        var severityCell = document.createElement("td");
        severityCell.appendChild(createReportBadge(record.severity, "severity"));
        row.appendChild(severityCell);
        appendReportCell(row, record.priority);
        var statusCell = document.createElement("td");
        statusCell.appendChild(createReportBadge(record.status, "status"));
        row.appendChild(statusCell);
        appendReportCell(row, record.assignedTo);
        appendReportCell(row, record.releaseVersion);
        appendReportCell(row, record.createdBy);
        appendReportCell(row, record.createdDate);
        appendReportCell(row, record.age + "d");
        reportTableBody.appendChild(row);
      });

      if (!totalRows) {
        var emptyRow = document.createElement("tr");
        var emptyCell = document.createElement("td");
        emptyCell.colSpan = 12;
        emptyCell.className = "chart-empty";
        emptyCell.textContent = "No defects match the current dashboard filters.";
        emptyRow.appendChild(emptyCell);
        reportTableBody.appendChild(emptyRow);
      }

      if (reportResultCount) {
        if (!totalRows) {
          reportResultCount.textContent = "0 defects";
        } else {
          var start = ((reportPagination.page - 1) * reportPagination.pageSize) + 1;
          var end = Math.min(start + pageRows.length - 1, totalRows);
          if (totalRows === reportRecords.length) {
            reportResultCount.textContent = "Showing " + start + "-" + end + " of " + totalRows + " defects";
          } else {
            reportResultCount.textContent = "Showing " + start + "-" + end + " of " + totalRows + " filtered defects";
          }
        }
      }

      renderTablePagination(reportPaginationRoot, reportPagination, totalRows, "Dashboard defects", function (page) {
        reportPagination.page = page;
        renderReportTable(getFilteredReportRecords());
      });
    }

    function resetReportPagination() {
      reportPagination.page = 1;
    }

    function refreshReportDashboard(options) {
      var refreshOptions = options || {};
      var chartRows = getDashboardScopedReportRecords();
      var rows = chartRows.filter(function (record) {
        return recordMatchesChartDrilldown(record);
      });
      updateChartDrilldownVisual();
      if (refreshOptions.refreshCharts !== false) {
        renderAllReportCharts(chartRows);
      }
      renderReportTable(rows);
      syncFiltersToUrl();
      if (refreshOptions.scrollToTable) {
        window.setTimeout(drawAttentionToReportTable, 40);
      }
    }

    function refreshReportDashboardFromNewCriteria() {
      var dateState = createValidationState(document.querySelector(".dashboard-filter-panel") || document, null);
      maxLengthField(dateState, document.querySelector('[data-report-filter="search"]'), 80);
      dateRangeFields(
        dateState,
        document.querySelector('[data-report-filter="from"]'),
        document.querySelector('[data-report-filter="to"]'),
        "Created To must be on or after Created From."
      );
      if (!finishValidation(dateState, "")) return;
      activeChartDrilldown = null;
      resetReportPagination();
      refreshReportDashboard({ refreshCharts: true });
    }

    function toggleReportFilters() {
      if (!reportFilterPanel || !reportFilterBody || !toggleReportFiltersButton) return;
      var isCollapsed = reportFilterPanel.classList.toggle("is-collapsed");
      var toggleLabel = toggleReportFiltersButton.querySelector("[data-filter-toggle-label]");
      reportFilterBody.hidden = isCollapsed;
      if (toggleLabel) toggleLabel.textContent = isCollapsed ? "Expand" : "Collapse";
      toggleReportFiltersButton.setAttribute("aria-expanded", String(!isCollapsed));
    }

    function resetReportFilters() {
      reportFilters.forEach(function (control) {
        control.value = "";
      });
      activeReportKpi = null;
      activeChartDrilldown = null;
      updateActiveKpiVisual();
      refreshReportDashboardFromNewCriteria();
    }

    // Columns visible in the dashboard's defect summary table (kept in sync with dashboard.html thead).
    var REPORT_VISIBLE_COLUMNS = ["id", "title", "project", "environment", "severity", "priority", "status", "assignedTo", "releaseVersion", "createdBy", "createdDate", "age"];
    // Full superset of fields a defect record can carry. "All columns" exports this even if some fields
    // are not yet populated in the static data layer — when richer data lands, the export grows automatically.
    var REPORT_ALL_COLUMNS = ["id", "title", "description", "project", "environment", "severity", "priority", "status", "assignedTo", "createdBy", "createdDate", "releaseVersion", "deploymentDate", "fixDate", "closureDate", "age"];
    var REPORT_COLUMN_LABELS = {
      id: "Defect ID", title: "Title", description: "Description", project: "Project", environment: "Environment",
      severity: "Severity", priority: "Priority", status: "Status", assignedTo: "Assigned To", createdBy: "Created By",
      createdDate: "Created Date", releaseVersion: "Release Version", deploymentDate: "Release Deployment Date",
      fixDate: "Fix Date", closureDate: "Closure Date", age: "Age"
    };

    function exportReportCsv(mode) {
      var rows = getFilteredReportRecords();
      var isAll = mode === "all";
      var columns = isAll ? REPORT_ALL_COLUMNS : REPORT_VISIBLE_COLUMNS;
      var escapeCell = function (value) {
        var text = String(value == null ? "" : value).replace(/"/g, '""');
        return /[",\n]/.test(text) ? '"' + text + '"' : text;
      };
      var header = columns.map(function (column) { return escapeCell(REPORT_COLUMN_LABELS[column] || column); }).join(",");
      var csv = [header].concat(rows.map(function (record) {
        return columns.map(function (column) { return escapeCell(record[column]); }).join(",");
      })).join("\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = isAll ? "defect_dashboard_all_columns.csv" : "defect_dashboard_current_view.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    }

    function updateStackByVisibility() {
      if (!reportChartStackRow) return;
      var isStacked = reportChartTypeInput.value === "stacked";
      if (isStacked) {
        reportChartStackRow.removeAttribute("hidden");
      } else {
        reportChartStackRow.setAttribute("hidden", "");
      }
    }

    function openReportChartModal() {
      clearValidation(reportChartModal);
      reportChartTitleInput.value = "";
      reportChartTypeInput.value = "bar";
      reportChartGroupInput.value = "status";
      if (reportChartStackInput) reportChartStackInput.value = "severity";
      updateStackByVisibility();
      reportChartModal.classList.add("open");
      reportChartModal.setAttribute("aria-hidden", "false");
      reportChartTitleInput.focus();
    }

    function closeReportChartModal() {
      clearValidation(reportChartModal);
      reportChartModal.classList.remove("open");
      reportChartModal.setAttribute("aria-hidden", "true");
    }

    function addReportChart() {
      var groupBy = reportChartGroupInput.value;
      var chartType = reportChartTypeInput.value;
      var stackBy = reportChartStackInput ? reportChartStackInput.value : "severity";
      var title = reportChartTitleInput.value.trim();
      var state = createValidationState(reportChartModal, null);
      maxLengthField(state, reportChartTitleInput, 80);
      requiredField(state, reportChartTypeInput);
      requiredField(state, reportChartGroupInput);
      if (chartType === "stacked" && reportChartStackInput && groupBy === stackBy) {
        addValidationError(state, reportChartStackInput, "Stack By must be different from Group By.");
      }
      if (!finishValidation(state, "")) return;
      if (!title) {
        if (chartType === "stacked") {
          title = "Defects by " + (labelMap[groupBy] || groupBy) + " (stacked by " + (labelMap[stackBy] || stackBy) + ")";
        } else {
          title = "Defects by " + (labelMap[groupBy] || groupBy);
        }
      }
      var chartId = "custom-" + Date.now();
      var card = document.createElement("article");
      card.className = "report-chart-card";
      card.setAttribute("data-chart-id", chartId);
      var configToSave = { type: chartType, groupBy: groupBy };
      if (chartType === "stacked") configToSave.stackBy = stackBy;
      card.setAttribute("data-chart-config", JSON.stringify(configToSave));
      card.innerHTML = '<div class="chart-title-row"><div><h3></h3><p class="chart-meta" data-chart-meta>All defects</p></div></div><div class="canvas-wrap"><canvas></canvas></div>';
      card.querySelector("h3").textContent = title;
      reportChartGrid.appendChild(card);
      renderReportChart(card, JSON.parse(card.getAttribute("data-chart-config")), getDashboardScopedReportRecords());
      closeReportChartModal();
    }

    function buildDashboardDefectsUrl(page) {
      return "/api/v1/defects?page=" + page + "&pageSize=100";
    }

    function fetchAllDashboardDefects(page, accumulated) {
      var nextPage = page || 1;
      var rows = accumulated || [];
      return apiFetch(buildDashboardDefectsUrl(nextPage)).then(function (payload) {
        var items = payload.items || [];
        rows = rows.concat(items.map(apiDefectToReportRecord));
        var pagination = payload.pagination || {};
        if (pagination.totalPages && nextPage < pagination.totalPages) {
          return fetchAllDashboardDefects(nextPage + 1, rows);
        }
        return rows;
      });
    }

    function populateDashboardFilters() {
      ["project", "environment", "severity", "priority", "assignedTo", "releaseVersion"].forEach(function (field) {
        fillReportSelect(field);
      });
      fillReportSelect("status", dashboardWorkflowStatuses);
    }

    function showDashboardLoadFailure(error) {
      reportRecords = [];
      dashboardSummary = null;
      dashboardCharts = [];
      dashboardSummaryToBaseline(null);
      renderReportKpis();
      renderAllReportCharts(reportRecords);
      renderReportTable(reportRecords);
      if (reportResultCount) {
        reportResultCount.textContent = error && error.message ? error.message : "Unable to load dashboard data.";
      }
    }

    function loadDashboardData() {
      return Promise.all([
        apiFetch("/api/v1/dashboard/summary"),
        apiFetch("/api/v1/dashboard/charts"),
        fetchAllDashboardDefects(),
        apiFetch("/api/v1/workflow")
      ]).then(function (results) {
        dashboardSummary = results[0] || {};
        dashboardCharts = results[1] && results[1].charts ? results[1].charts : [];
        reportRecords = results[2] || [];
        dashboardWorkflowStatuses = workflowStatusLabelsFromPayload(results[3]);
        dashboardWorkflowTerminalStatuses = results[3] && Array.isArray(results[3].terminalStatuses) ? results[3].terminalStatuses : [];
        dashboardSummaryToBaseline(dashboardSummary);
        populateDashboardFilters();
        applyUrlFilters();
        renderReportKpis();
        refreshReportDashboard({ refreshCharts: true });
      }).catch(showDashboardLoadFailure);
    }

    reportFilters.forEach(function (control) {
      control.addEventListener("input", refreshReportDashboardFromNewCriteria);
      control.addEventListener("change", refreshReportDashboardFromNewCriteria);
    });

    document.querySelectorAll("[data-sort-key]").forEach(function (header) {
      header.addEventListener("click", function () {
        var key = header.getAttribute("data-sort-key");
        if (reportSortKey === key) reportSortAsc = !reportSortAsc;
        else {
          reportSortKey = key;
          reportSortAsc = true;
        }
        document.querySelectorAll("[data-sort-key]").forEach(function (item) {
          item.classList.remove("sorted-asc", "sorted-desc");
        });
        header.classList.add(reportSortAsc ? "sorted-asc" : "sorted-desc");
        resetReportPagination();
        renderReportTable(getFilteredReportRecords());
      });
    });

    if (toggleReportFiltersButton) toggleReportFiltersButton.addEventListener("click", toggleReportFilters);
    if (resetReportButton) resetReportButton.addEventListener("click", resetReportFilters);
    if (clearReportChartDrilldownButton) clearReportChartDrilldownButton.addEventListener("click", clearChartDrilldown);
    initExportSplit(document.querySelector("[data-export-split]"), exportReportCsv);
    if (openReportChartModalButton) openReportChartModalButton.addEventListener("click", openReportChartModal);
    var dashboardKpiGrid = document.querySelector(".dashboard-kpi-grid");
    if (dashboardKpiGrid) dashboardKpiGrid.addEventListener("click", handleKpiTileClick);

    var chartValuesToggleButton = document.querySelector("[data-toggle-chart-values]");
    function applyChartValuesButtonState() {
      if (!chartValuesToggleButton) return;
      chartValuesToggleButton.setAttribute("aria-pressed", showChartValues ? "true" : "false");
      var labelText = showChartValues ? "Hide values on charts" : "Show values on charts";
      chartValuesToggleButton.setAttribute("aria-label", labelText);
      chartValuesToggleButton.title = labelText;
    }
    applyChartValuesButtonState();
    if (chartValuesToggleButton) {
      chartValuesToggleButton.addEventListener("click", function () {
        animateChartValueVisibility(!showChartValues);
      });
    }
    if (restoreReportChartSelect) {
      restoreReportChartSelect.addEventListener("change", function () {
        if (!restoreReportChartSelect.value) return;
        restoreReportChart(restoreReportChartSelect.value);
        restoreReportChartSelect.value = "";
      });
    }
    if (saveReportChartButton) saveReportChartButton.addEventListener("click", addReportChart);
    if (reportChartTypeInput) reportChartTypeInput.addEventListener("change", updateStackByVisibility);
    closeReportChartModalButtons.forEach(function (button) {
      button.addEventListener("click", closeReportChartModal);
    });
    reportChartModal.addEventListener("click", function (event) {
      if (event.target === reportChartModal) closeReportChartModal();
    });
    reportChartGrid.addEventListener("click", function (event) {
      var removeButton = event.target.closest("[data-remove-report-chart]");
      if (!removeButton) return;
      var card = removeButton.closest(".report-chart-card");
      var chartId = card.getAttribute("data-chart-instance-id");
      if (chartId && reportChartInstances[chartId]) {
        reportChartInstances[chartId].destroy();
        delete reportChartInstances[chartId];
      }
      card.remove();
      updateRestoreChartOptions();
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-chart-help-trigger]") && !event.target.closest("[data-chart-help-panel]")) {
        closeAllReportChartHelp();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllReportChartHelp();
      }
    });
    reportChartGrid.addEventListener("dragstart", function (event) {
      var handle = event.target.closest("[data-chart-drag-handle]");
      var card = event.target.closest(".report-chart-card");
      if (!handle || !card) {
        event.preventDefault();
        return;
      }
      draggedReportChart = card;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.getAttribute("data-chart-id") || "");
    });
    reportChartGrid.addEventListener("dragover", function (event) {
      var targetCard = event.target.closest(".report-chart-card");
      if (!draggedReportChart || !targetCard || targetCard === draggedReportChart) return;
      event.preventDefault();
      targetCard.classList.add("is-drop-target");
      event.dataTransfer.dropEffect = "move";
    });
    reportChartGrid.addEventListener("dragleave", function (event) {
      var targetCard = event.target.closest(".report-chart-card");
      if (targetCard) targetCard.classList.remove("is-drop-target");
    });
    reportChartGrid.addEventListener("drop", function (event) {
      var targetCard = event.target.closest(".report-chart-card");
      if (!draggedReportChart || !targetCard || targetCard === draggedReportChart) return;
      event.preventDefault();
      var targetBox = targetCard.getBoundingClientRect();
      var placeAfter = event.clientX > targetBox.left + targetBox.width / 2;
      targetCard.classList.remove("is-drop-target");
      reportChartGrid.insertBefore(draggedReportChart, placeAfter ? targetCard.nextSibling : targetCard);
      Object.keys(reportChartInstances).forEach(function (key) {
        reportChartInstances[key].resize();
      });
    });
    reportChartGrid.addEventListener("dragend", function () {
      reportChartGrid.querySelectorAll(".report-chart-card").forEach(function (card) {
        card.classList.remove("is-dragging", "is-drop-target");
      });
      draggedReportChart = null;
    });
    reportChartGrid.addEventListener("pointerdown", function (event) {
      var dragHandle = event.target.closest("[data-chart-drag-handle]");
      var resizeHandle = event.target.closest("[data-resize-report-chart]");

      if (dragHandle) {
        event.preventDefault();
        var movingCard = dragHandle.closest(".report-chart-card");
        var startX = event.clientX;
        var startY = event.clientY;
        var startRect = null;
        var placeholder = null;
        var pointerOffsetX = 0;
        var pointerOffsetY = 0;
        var hasStartedMove = false;

        function startMove(moveEvent) {
          startRect = movingCard.getBoundingClientRect();
          pointerOffsetX = startX - startRect.left;
          pointerOffsetY = startY - startRect.top;
          placeholder = document.createElement("article");
          placeholder.className = "chart-drop-placeholder";
          placeholder.style.gridColumn = movingCard.style.gridColumn || getComputedStyle(movingCard).gridColumnEnd.replace("span ", "span ");
          placeholder.style.height = startRect.height + "px";
          placeholder.setAttribute("data-chart-drop-placeholder", "");
          reportChartGrid.insertBefore(placeholder, movingCard);
          movingCard.classList.add("is-moving");
          movingCard.style.position = "fixed";
          movingCard.style.left = startRect.left + "px";
          movingCard.style.top = startRect.top + "px";
          movingCard.style.width = startRect.width + "px";
          movingCard.style.height = startRect.height + "px";
          movingCard.style.gridColumn = "";
          hasStartedMove = true;
          onMoveChart(moveEvent);
        }

        function onMoveChart(moveEvent) {
          if (!hasStartedMove) {
            var distanceX = moveEvent.clientX - startX;
            var distanceY = moveEvent.clientY - startY;
            if (Math.sqrt(distanceX * distanceX + distanceY * distanceY) < 8) {
              return;
            }
            startMove(moveEvent);
            return;
          }
          movingCard.style.left = (moveEvent.clientX - pointerOffsetX) + "px";
          movingCard.style.top = (moveEvent.clientY - pointerOffsetY) + "px";
          var target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          var targetCard = target ? target.closest(".report-chart-card") : null;
          reportChartGrid.querySelectorAll(".report-chart-card").forEach(function (card) {
            if (card !== movingCard) card.classList.remove("is-drop-target");
          });
          if (targetCard && targetCard !== movingCard) {
            var targetBox = targetCard.getBoundingClientRect();
            var placeAfter = moveEvent.clientX > targetBox.left + targetBox.width / 2;
            targetCard.classList.add("is-drop-target");
            reportChartGrid.insertBefore(placeholder, placeAfter ? targetCard.nextSibling : targetCard);
          } else if (target === reportChartGrid || (target && target.closest("[data-report-chart-grid]"))) {
            var cards = Array.prototype.slice.call(reportChartGrid.querySelectorAll(".report-chart-card:not(.is-moving)"));
            var placed = false;
            cards.some(function (card) {
              var box = card.getBoundingClientRect();
              if (moveEvent.clientY < box.top + box.height / 2) {
                reportChartGrid.insertBefore(placeholder, card);
                placed = true;
                return true;
              }
              return false;
            });
            if (!placed) reportChartGrid.appendChild(placeholder);
          }
        }

        function onDropChart(upEvent) {
          if (!hasStartedMove) {
            document.removeEventListener("pointermove", onMoveChart);
            document.removeEventListener("pointerup", onDropChart);
            return;
          }
          reportChartGrid.insertBefore(movingCard, placeholder);
          placeholder.remove();
          movingCard.style.position = "";
          movingCard.style.left = "";
          movingCard.style.top = "";
          movingCard.style.width = "";
          movingCard.style.height = "";
          movingCard.style.gridColumn = movingCard.getAttribute("data-chart-span") ? "span " + movingCard.getAttribute("data-chart-span") : "";
          reportChartGrid.querySelectorAll(".report-chart-card").forEach(function (card) {
            card.classList.remove("is-dragging", "is-moving", "is-drop-target");
          });
          Object.keys(reportChartInstances).forEach(function (key) {
            reportChartInstances[key].resize();
          });
          document.removeEventListener("pointermove", onMoveChart);
          document.removeEventListener("pointerup", onDropChart);
        }

        document.addEventListener("pointermove", onMoveChart);
        document.addEventListener("pointerup", onDropChart);
        return;
      }

      if (!resizeHandle) return;
      event.preventDefault();
      var card = resizeHandle.closest(".report-chart-card");
      var canvasWrap = card.querySelector(".canvas-wrap");
      var startX = event.clientX;
      var startY = event.clientY;
      var initialSpan = getCardSpan(card);
      var initialHeight = canvasWrap.offsetHeight;
      var spanOptions = [4, 6, 8, 12];

      function onPointerMove(moveEvent) {
        var spanStep = Math.round((moveEvent.clientX - startX) / 130);
        var spanIndex = Math.max(0, Math.min(spanOptions.length - 1, spanOptions.indexOf(initialSpan) + spanStep));
        var nextSpan = spanOptions[spanIndex];
        var nextHeight = Math.max(210, Math.min(520, initialHeight + moveEvent.clientY - startY));
        card.style.gridColumn = "span " + nextSpan;
        card.setAttribute("data-chart-span", String(nextSpan));
        canvasWrap.style.height = nextHeight + "px";
        card.classList.remove("wide-chart", "half-chart");
        resizeReportChartInstance(card);
      }

      function onPointerUp() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        resizeReportChartInstance(card);
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });

    document.querySelector('[data-sort-key="createdDate"]').classList.add("sorted-desc");
    loadDashboardData();
  }

  var addProjectButton = document.querySelector("[data-add-row-trigger]");
  var addProjectRow = document.querySelector("[data-add-row]");
  var projectTableBody = document.querySelector("[data-project-table-body]");

  if (addProjectButton && addProjectRow && projectTableBody) {
    var projectNameInput = addProjectRow.querySelector("[data-project-name]");
    var projectDescriptionInput = addProjectRow.querySelector("[data-project-description]");
    var projectStatusInput = addProjectRow.querySelector("[data-project-status]");
    var saveProjectButton = addProjectRow.querySelector("[data-save-project]");
    var cancelProjectButton = addProjectRow.querySelector("[data-cancel-project]");

    function getProjectBadgeClass(status) {
      return status === "Active" ? "badge-active" : "badge-inactive";
    }

    function createProjectEditButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "Edit";
      button.setAttribute("data-edit-project", "");
      return button;
    }

    function projectDtoToTableData(project) {
      return {
        id: project.id,
        name: project.projectName || "Unnamed Project",
        description: project.description || "No description added.",
        status: project.isActive ? "Active" : "Inactive"
      };
    }

    function applyProjectRowMetadata(row, data) {
      if (data.id) {
        row.dataset.projectId = data.id;
      }
    }

    function getProjectRowData(row) {
      return {
        id: row.dataset.projectId,
        name: row.cells[0].textContent.trim(),
        description: row.cells[1].textContent.trim(),
        status: row.cells[2].textContent.trim() || "Active"
      };
    }

    function renderProjectRow(row, data) {
      var badge = document.createElement("span");
      row.classList.remove("inline-edit-row");
      row.dataset.originalProject = "";
      applyProjectRowMetadata(row, data);
      row.cells[0].classList.remove("table-edit-cell");
      row.cells[1].classList.remove("table-edit-cell");
      row.cells[0].textContent = data.name;
      row.cells[1].textContent = data.description || "No description added.";
      badge.className = "badge " + getProjectBadgeClass(data.status);
      badge.textContent = data.status;
      row.cells[2].replaceChildren(badge);
      row.cells[3].replaceChildren(createProjectEditButton());
    }

    function createProjectRow(project) {
      var data = projectDtoToTableData(project);
      var row = document.createElement("tr");
      var nameCell = document.createElement("td");
      var descriptionCell = document.createElement("td");
      var statusCell = document.createElement("td");
      var actionsCell = document.createElement("td");
      var badge = document.createElement("span");

      applyProjectRowMetadata(row, data);
      nameCell.textContent = data.name;
      descriptionCell.textContent = data.description;
      badge.className = "badge " + getProjectBadgeClass(data.status);
      badge.textContent = data.status;
      statusCell.appendChild(badge);
      actionsCell.appendChild(createProjectEditButton());
      row.appendChild(nameCell);
      row.appendChild(descriptionCell);
      row.appendChild(statusCell);
      row.appendChild(actionsCell);
      return row;
    }

    function showProjectTableMessage(text) {
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "muted";
      cell.textContent = text;
      row.appendChild(cell);
      projectTableBody.replaceChildren(addProjectRow, row);
    }

    function loadProjectsFromApi() {
      showProjectTableMessage("Loading projects...");
      return apiFetch("/api/v1/projects").then(function (payload) {
        var projects = payload.items || [];
        projectTableBody.replaceChildren(addProjectRow);
        projects.forEach(function (project) {
          projectTableBody.appendChild(createProjectRow(project));
        });
        if (!projects.length) {
          showProjectTableMessage("No projects found.");
        }
      }).catch(function (error) {
        showProjectTableMessage(error.message || "Unable to load projects.");
      });
    }

    function startProjectRowEdit(row) {
      if (row.classList.contains("inline-edit-row") || row === addProjectRow) {
        return;
      }

      var data = getProjectRowData(row);
      var nameInput = document.createElement("input");
      var descriptionInput = document.createElement("input");
      var statusToggle = document.createElement("div");
      var activeButton = document.createElement("button");
      var inactiveButton = document.createElement("button");
      var actions = document.createElement("div");
      var saveButton = document.createElement("button");
      var cancelButton = document.createElement("button");

      row.dataset.originalProject = JSON.stringify(data);
      row.classList.add("inline-edit-row");

      nameInput.type = "text";
      nameInput.className = "table-edit-input";
      nameInput.value = data.name;
      descriptionInput.type = "text";
      descriptionInput.className = "table-edit-input";
      descriptionInput.value = data.description === "No description added." ? "" : data.description;
      row.cells[0].classList.add("table-edit-cell");
      row.cells[1].classList.add("table-edit-cell");

      statusToggle.className = "table-status-toggle";
      statusToggle.setAttribute("data-project-edit-status", data.status);
      activeButton.type = "button";
      activeButton.textContent = "Active";
      activeButton.setAttribute("data-status-option", "Active");
      inactiveButton.type = "button";
      inactiveButton.textContent = "Inactive";
      inactiveButton.setAttribute("data-status-option", "Inactive");
      statusToggle.appendChild(activeButton);
      statusToggle.appendChild(inactiveButton);
      updateProjectStatusToggle(statusToggle, data.status);

      actions.className = "row-actions";
      saveButton.type = "button";
      saveButton.className = "button-primary";
      saveButton.textContent = "Save";
      saveButton.setAttribute("data-save-project-edit", "");
      cancelButton.type = "button";
      cancelButton.textContent = "Cancel";
      cancelButton.setAttribute("data-cancel-project-edit", "");
      actions.appendChild(saveButton);
      actions.appendChild(cancelButton);

      row.cells[0].replaceChildren(nameInput);
      row.cells[1].replaceChildren(descriptionInput);
      row.cells[2].replaceChildren(statusToggle);
      row.cells[3].replaceChildren(actions);
      nameInput.focus();
      nameInput.select();
    }

    function updateProjectStatusToggle(toggle, status) {
      toggle.setAttribute("data-project-edit-status", status);
      Array.prototype.slice.call(toggle.querySelectorAll("[data-status-option]")).forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-status-option") === status);
      });
    }

    function updateAddProjectStatusToggle(status) {
      projectStatusInput.setAttribute("data-project-status", status);
      Array.prototype.slice.call(projectStatusInput.querySelectorAll("[data-project-add-status-option]")).forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-project-add-status-option") === status);
      });
    }

    function saveProjectRowEdit(row) {
      var nameInput = row.cells[0].querySelector("input");
      var descriptionInput = row.cells[1].querySelector("input");
      var statusToggle = row.cells[2].querySelector("[data-project-edit-status]");
      var name = nameInput.value.trim();
      var state = createValidationState(row, null);

      requiredField(state, nameInput);
      maxLengthField(state, nameInput, 80);
      maxLengthField(state, descriptionInput, 180);
      validateDuplicateName(state, nameInput, projectTableBody, 0, row, "Project Name");
      if (!finishValidation(state, "")) return;

      renderProjectRow(row, {
        name: name,
        description: descriptionInput.value.trim(),
        status: statusToggle.getAttribute("data-project-edit-status") || "Active"
      });
    }

    function saveProjectRowEditToApi(row) {
      var nameInput = row.cells[0].querySelector("input");
      var descriptionInput = row.cells[1].querySelector("input");
      var statusToggle = row.cells[2].querySelector("[data-project-edit-status]");
      var saveButton = row.cells[3].querySelector("[data-save-project-edit]");
      var name = nameInput.value.trim();
      var description = descriptionInput.value.trim();
      var status = statusToggle.getAttribute("data-project-edit-status") || "Active";
      var state = createValidationState(row, null);

      requiredField(state, nameInput);
      maxLengthField(state, nameInput, 80);
      maxLengthField(state, descriptionInput, 180);
      validateDuplicateName(state, nameInput, projectTableBody, 0, row, "Project Name");
      if (!finishValidation(state, "")) return;

      if (!row.dataset.projectId) {
        showValidationToast("Project record is missing its database id.");
        nameInput.setCustomValidity("Project record is missing its database id.");
        nameInput.reportValidity();
        window.setTimeout(function () {
          nameInput.setCustomValidity("");
        }, 1200);
        return;
      }

      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving";
      }

      apiFetch("/api/v1/projects/" + encodeURIComponent(row.dataset.projectId), {
        method: "PATCH",
        body: JSON.stringify({
          projectName: name,
          description: description,
          isActive: status === "Active"
        })
      }).then(function (updatedProject) {
        renderProjectRow(row, projectDtoToTableData(updatedProject));
      }).catch(function (error) {
        showValidationToast(error.message || "Unable to save project.");
        nameInput.setCustomValidity(error.message || "Unable to save project.");
        nameInput.reportValidity();
        window.setTimeout(function () {
          nameInput.setCustomValidity("");
        }, 1200);
      }).finally(function () {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save";
        }
      });
    }

    function cancelProjectRowEdit(row) {
      var data = row.dataset.originalProject ? JSON.parse(row.dataset.originalProject) : getProjectRowData(row);
      renderProjectRow(row, data);
    }

    function resetProjectRow() {
      projectNameInput.value = "";
      projectDescriptionInput.value = "";
      updateAddProjectStatusToggle("Active");
    }

    function setProjectRowVisible(isVisible) {
      addProjectRow.hidden = !isVisible;
      addProjectButton.innerHTML = isVisible ? "<span>-</span> Cancel" : "<span>+</span> Add Project";
      addProjectButton.setAttribute("aria-label", isVisible ? "Cancel new project" : "Add project");
      if (isVisible) {
        projectNameInput.focus();
      }
    }

    addProjectButton.addEventListener("click", function () {
      var shouldShow = addProjectRow.hidden;
      setProjectRowVisible(shouldShow);
      if (shouldShow) {
        resetProjectRow();
      }
    });

    cancelProjectButton.addEventListener("click", function () {
      resetProjectRow();
      setProjectRowVisible(false);
    });

    saveProjectButton.addEventListener("click", function () {
      var name = projectNameInput.value.trim();
      var description = projectDescriptionInput.value.trim();
      var status = projectStatusInput.getAttribute("data-project-status") || "Active";
      var state = createValidationState(addProjectRow, null);

      requiredField(state, projectNameInput);
      maxLengthField(state, projectNameInput, 80);
      maxLengthField(state, projectDescriptionInput, 180);
      validateDuplicateName(state, projectNameInput, projectTableBody, 0, addProjectRow, "Project Name");
      if (!finishValidation(state, "")) return;

      saveProjectButton.disabled = true;
      saveProjectButton.textContent = "Saving";

      apiFetch("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          projectName: name,
          description: description,
          isActive: status === "Active"
        })
      }).then(function (createdProject) {
        projectTableBody.insertBefore(createProjectRow(createdProject), addProjectRow.nextSibling);
        resetProjectRow();
        setProjectRowVisible(false);
        showAccountConfirmationDialog({
          title: "Project created",
          message: name + " was added successfully.",
          actionLabel: "Done"
        });
      }).catch(function (error) {
        showValidationToast(error.message || "Unable to save project.");
        projectNameInput.setCustomValidity(error.message || "Unable to save project.");
        projectNameInput.reportValidity();
        window.setTimeout(function () {
          projectNameInput.setCustomValidity("");
        }, 1200);
      }).finally(function () {
        saveProjectButton.disabled = false;
        saveProjectButton.textContent = "Save";
      });
    });

    projectTableBody.addEventListener("click", function (event) {
      var editButton = event.target.closest("[data-edit-project]");
      var saveButton = event.target.closest("[data-save-project-edit]");
      var cancelButton = event.target.closest("[data-cancel-project-edit]");
      var addStatusOption = event.target.closest("[data-project-add-status-option]");
      var statusOption = event.target.closest("[data-status-option]");
      var row = event.target.closest("tr");

      if (!row) {
        return;
      }

      if (editButton) {
        startProjectRowEdit(row);
      } else if (saveButton) {
        saveProjectRowEditToApi(row);
      } else if (cancelButton) {
        cancelProjectRowEdit(row);
      } else if (addStatusOption) {
        updateAddProjectStatusToggle(addStatusOption.getAttribute("data-project-add-status-option"));
      } else if (statusOption) {
        updateProjectStatusToggle(statusOption.closest("[data-project-edit-status]"), statusOption.getAttribute("data-status-option"));
      }
    });

    loadProjectsFromApi();
  }

  function initSimpleInlineManager(config) {
    var addButton = document.querySelector(config.trigger);
    var addRow = document.querySelector(config.row);
    var tableBody = document.querySelector(config.body);

    if (!tableBody) {
      return;
    }

    var hasInlineAdd = !config.modalAdd && addButton && addRow;

    var inputs = config.inputs.map(function (item) {
      return {
        key: item.key,
        fallback: item.fallback,
        type: item.type,
        element: addRow ? addRow.querySelector(item.selector) : null
      };
    });
    var statusInput = addRow ? addRow.querySelector(config.statusSelector) : null;
    var saveButton = addRow ? addRow.querySelector(config.save) : null;
    var cancelButton = addRow ? addRow.querySelector(config.cancel) : null;
    var editSelector = "[" + config.editAttribute + "]";
    var originalDataKey = "original" + config.recordName.charAt(0).toUpperCase() + config.recordName.slice(1).replace(/\s+/g, "");

    function resetRow() {
      inputs.forEach(function (input) {
        if (input.element) input.element.value = "";
      });
      setAddStatusValue("Active");
    }

    function getBadgeClass(status) {
      return status === "Active" ? "badge-active" : "badge-inactive";
    }

    function validateSimpleInlineControls(state, row, controls, excludeRow) {
      controls.forEach(function (item, index) {
        var input = item.element;
        if (!input) return;
        if (index === 0) {
          var recordLabel = config.recordName === "environment" ? "Environment Name" : "Name";
          requiredField(state, input, validationMessages.required(recordLabel));
          maxLengthField(state, input, 80, validationMessages.maxLength(recordLabel, 80));
          if (config.recordName === "environment") {
            validateDuplicateName(state, input, tableBody, 0, excludeRow, "Environment Name");
          }
        }
        if (item.key === "description") {
          maxLengthField(state, input, 180);
        }
        if (item.key === "email") {
          emailField(state, input, true);
          validateDuplicateName(state, input, tableBody, 1, excludeRow, "Email");
        }
        if (item.key === "username") {
          requiredField(state, input, validationMessages.required("Username"));
          minLengthField(state, input, 3, validationMessages.minLength("Username", 3));
          maxLengthField(state, input, 40, validationMessages.maxLength("Username", 40));
          patternField(state, input, /^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dots, hyphens, and underscores.");
          validateDuplicateName(state, input, tableBody, 2, excludeRow, "Username");
        }
      });
    }

    function createEditButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "Edit";
      button.setAttribute(config.editAttribute, "");
      return button;
    }

    function createPasswordButton() {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "Password";
      button.setAttribute("data-reset-user-password", "");
      return button;
    }

    function appendRowActions(cell) {
      var actions = document.createElement("div");
      actions.className = "row-actions";
      actions.appendChild(createEditButton());
      if (config.passwordAction) {
        actions.appendChild(createPasswordButton());
      }
      cell.replaceChildren(actions);
    }

    function getRowData(row) {
      var data = {};
      inputs.forEach(function (input, index) {
        data[input.key] = row.cells[index].textContent.trim();
      });
      data.status = row.cells[inputs.length].textContent.trim() || "Active";
      return data;
    }

    function renderRow(row, data) {
      var badge = document.createElement("span");
      row.classList.remove("inline-edit-row");
      row.dataset[originalDataKey] = "";
      if (config.afterRenderRow) {
        config.afterRenderRow(row, data);
      }
      inputs.forEach(function (input, index) {
        row.cells[index].classList.remove("table-edit-cell");
        row.cells[index].textContent = data[input.key] || input.fallback;
      });
      badge.className = "badge " + getBadgeClass(data.status);
      badge.textContent = data.status;
      row.cells[inputs.length].replaceChildren(badge);
      appendRowActions(row.cells[inputs.length + 1]);
    }

    function updateStatusToggle(toggle, status) {
      toggle.setAttribute("data-edit-status", status);
      Array.prototype.slice.call(toggle.querySelectorAll("[data-status-option]")).forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-status-option") === status);
        button.setAttribute("aria-pressed", button.getAttribute("data-status-option") === status ? "true" : "false");
      });
    }

    function setAddStatusValue(status) {
      if (!statusInput) return;
      if (statusInput.tagName === "SELECT") {
        statusInput.value = status;
        return;
      }
      statusInput.setAttribute("data-status-value", status);
      Array.prototype.slice.call(statusInput.querySelectorAll("[data-add-status-option]")).forEach(function (button) {
        var isActive = button.getAttribute("data-add-status-option") === status;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function getAddStatusValue() {
      if (!statusInput) return "Active";
      if (statusInput.tagName === "SELECT") return statusInput.value || "Active";
      return statusInput.getAttribute("data-status-value") || "Active";
    }

    function createStatusToggle(status) {
      var statusToggle = document.createElement("div");
      var activeButton = document.createElement("button");
      var inactiveButton = document.createElement("button");

      statusToggle.className = "table-status-toggle";
      statusToggle.setAttribute("data-edit-status", status);
      activeButton.type = "button";
      activeButton.textContent = "Active";
      activeButton.setAttribute("data-status-option", "Active");
      inactiveButton.type = "button";
      inactiveButton.textContent = "Inactive";
      inactiveButton.setAttribute("data-status-option", "Inactive");
      statusToggle.appendChild(activeButton);
      statusToggle.appendChild(inactiveButton);
      updateStatusToggle(statusToggle, status);
      return statusToggle;
    }

    function startRowEdit(row) {
      if (row.classList.contains("inline-edit-row") || row === addRow) {
        return;
      }

      var data = getRowData(row);
      var statusToggle = createStatusToggle(data.status);
      var actions = document.createElement("div");
      var saveEditButton = document.createElement("button");
      var cancelEditButton = document.createElement("button");

      row.dataset[originalDataKey] = JSON.stringify(data);
      row.classList.add("inline-edit-row");

      inputs.forEach(function (input, index) {
        var editInput = document.createElement("input");
        editInput.type = input.type || "text";
        editInput.className = "table-edit-input";
        editInput.value = data[input.key] === input.fallback ? "" : data[input.key];
        row.cells[index].classList.add("table-edit-cell");
        row.cells[index].replaceChildren(editInput);
      });

      actions.className = "row-actions";
      saveEditButton.type = "button";
      saveEditButton.className = "button-primary";
      saveEditButton.textContent = "Save";
      saveEditButton.setAttribute("data-save-inline-edit", "");
      cancelEditButton.type = "button";
      cancelEditButton.textContent = "Cancel";
      cancelEditButton.setAttribute("data-cancel-inline-edit", "");
      actions.appendChild(saveEditButton);
      actions.appendChild(cancelEditButton);

      row.cells[inputs.length].replaceChildren(statusToggle);
      row.cells[inputs.length + 1].replaceChildren(actions);

      var firstInput = row.cells[0].querySelector("input");
      firstInput.focus();
      firstInput.select();
    }

    function saveRowEdit(row) {
      var data = {};
      var firstInput = row.cells[0].querySelector("input");
      var statusToggle = row.cells[inputs.length].querySelector("[data-edit-status]");
      var editControls = inputs.map(function (input, index) {
        return {
          key: input.key,
          fallback: input.fallback,
          element: row.cells[index].querySelector("input")
        };
      });
      var state = createValidationState(row, null);

      inputs.forEach(function (input, index) {
        var editInput = row.cells[index].querySelector("input");
        data[input.key] = editInput.value.trim();
      });

      validateSimpleInlineControls(state, row, editControls, row);
      if (!finishValidation(state, "")) return;

      data.status = statusToggle.getAttribute("data-edit-status") || "Active";
      if (config.onSaveEdit) {
        var saveButton = row.cells[inputs.length + 1].querySelector("[data-save-inline-edit]");
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Saving";
        }
        Promise.resolve(config.onSaveEdit(row, data)).then(function (savedData) {
          renderRow(row, savedData || data);
        }).catch(function (error) {
          showValidationToast(error.message || "Unable to save changes.");
          if (firstInput) {
            firstInput.setCustomValidity(error.message || "Unable to save changes.");
            firstInput.reportValidity();
            window.setTimeout(function () {
              firstInput.setCustomValidity("");
            }, 1200);
          }
        }).finally(function () {
          if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          }
        });
        return;
      }
      renderRow(row, data);
    }

    function cancelRowEdit(row) {
      var data = row.dataset[originalDataKey] ? JSON.parse(row.dataset[originalDataKey]) : getRowData(row);
      renderRow(row, data);
    }

    function setRowVisible(isVisible) {
      addRow.hidden = !isVisible;
      addButton.innerHTML = isVisible ? "<span>-</span> Cancel" : "<span>+</span> " + config.addLabel;
      addButton.setAttribute("aria-label", isVisible ? "Cancel new " + config.recordName : "Add " + config.recordName);
      if (isVisible && inputs[0]) {
        inputs[0].element.focus();
      }
    }

    function appendCell(row, value) {
      var cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }

    function createManagedRow(data) {
      var row = document.createElement("tr");
      var statusCell = document.createElement("td");
      var actionsCell = document.createElement("td");
      var badge = document.createElement("span");

      inputs.forEach(function (input) {
        appendCell(row, data[input.key] || input.fallback);
      });

      badge.className = "badge " + getBadgeClass(data.status);
      badge.textContent = data.status || "Active";
      statusCell.appendChild(badge);
      row.appendChild(statusCell);
      row.appendChild(actionsCell);
      appendRowActions(actionsCell);

      if (config.afterRenderRow) {
        config.afterRenderRow(row, data);
      }
      return row;
    }

    function showManagedTableMessage(text) {
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = inputs.length + 2;
      cell.className = "muted";
      cell.textContent = text;
      row.appendChild(cell);
      tableBody.replaceChildren(addRow, row);
    }

    if (hasInlineAdd) {
      addButton.addEventListener("click", function () {
        var shouldShow = addRow.hidden;
        setRowVisible(shouldShow);
        if (shouldShow) {
          resetRow();
        }
      });

      cancelButton.addEventListener("click", function () {
        resetRow();
        setRowVisible(false);
      });

      saveButton.addEventListener("click", function () {
        var state = createValidationState(addRow, null);
        var values = inputs.map(function (input) {
          return {
            value: input.element.value.trim(),
            fallback: input.fallback,
            element: input.element
          };
        });

        validateSimpleInlineControls(state, addRow, inputs, addRow);
        if (!finishValidation(state, "")) return;

        var status = getAddStatusValue();
        var data = {};
        inputs.forEach(function (input, index) {
          data[input.key] = values[index].value || values[index].fallback;
        });
        data.status = status;

        if (config.onSaveAdd) {
          saveButton.disabled = true;
          saveButton.textContent = "Saving";
          Promise.resolve(config.onSaveAdd(data)).then(function (savedData) {
            tableBody.insertBefore(createManagedRow(savedData || data), addRow.nextSibling);
            resetRow();
            setRowVisible(false);
          }).catch(function (error) {
            showValidationToast(error.message || "Unable to save " + config.recordName + ".");
            if (inputs[0] && inputs[0].element) {
              inputs[0].element.setCustomValidity(error.message || "Unable to save " + config.recordName + ".");
              inputs[0].element.reportValidity();
              window.setTimeout(function () {
                inputs[0].element.setCustomValidity("");
              }, 1200);
            }
          }).finally(function () {
            saveButton.disabled = false;
            saveButton.textContent = "Save";
          });
          return;
        }

        tableBody.insertBefore(createManagedRow(data), addRow.nextSibling);
        resetRow();
        setRowVisible(false);
      });
    }

    tableBody.addEventListener("click", function (event) {
      var row = event.target.closest("tr");
      var editButton = event.target.closest(editSelector);
      var saveEditButton = event.target.closest("[data-save-inline-edit]");
      var cancelEditButton = event.target.closest("[data-cancel-inline-edit]");
      var addStatusOption = event.target.closest("[data-add-status-option]");
      var statusOption = event.target.closest("[data-status-option]");

      if (!row) {
        return;
      }

      if (editButton) {
        startRowEdit(row);
      } else if (saveEditButton) {
        saveRowEdit(row);
      } else if (cancelEditButton) {
        cancelRowEdit(row);
      } else if (addStatusOption && row === addRow) {
        setAddStatusValue(addStatusOption.getAttribute("data-add-status-option"));
      } else if (statusOption) {
        updateStatusToggle(statusOption.closest("[data-edit-status]"), statusOption.getAttribute("data-status-option"));
      }
    });

    if (config.loadRecords) {
      showManagedTableMessage("Loading " + config.recordName + "s...");
      Promise.resolve(config.loadRecords()).then(function (records) {
        tableBody.replaceChildren(addRow);
        (records || []).forEach(function (record) {
          tableBody.appendChild(createManagedRow(record));
        });
        if (!records || !records.length) {
          showManagedTableMessage("No " + config.recordName + "s found.");
        }
      }).catch(function (error) {
        showManagedTableMessage(error.message || "Unable to load " + config.recordName + "s.");
      });
    }
  }

  function userDtoToTableData(user) {
    return {
      id: user.id,
      name: user.name || "Unnamed User",
      email: user.email || "No email added.",
      username: user.username || "No username added.",
      status: user.isActive ? "Active" : "Inactive",
      defaultDataContext: normalizeDataContext(user.defaultDataContext || "Test")
    };
  }

  function applyUserRowMetadata(row, data) {
    if (data.id) {
      row.dataset.userId = data.id;
    }
    row.dataset.defaultDataContext = normalizeDataContext(data.defaultDataContext || row.dataset.defaultDataContext || "Test");
  }

  function saveUserRowToApi(row, data) {
    var userId = row.dataset.userId;
    if (!userId) {
      return Promise.reject(new Error("User record is missing its database id."));
    }
    return apiFetch("/api/v1/users/" + encodeURIComponent(userId), {
      method: "PATCH",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        username: data.username,
        isActive: data.status === "Active"
      })
    }).then(userDtoToTableData);
  }

  initSimpleInlineManager({
    trigger: "[data-open-user-modal]",
    row: "[data-user-add-row]",
    body: "[data-user-table-body]",
    save: "[data-save-user]",
    cancel: "[data-cancel-user]",
    statusSelector: "[data-user-status]",
    editAttribute: "data-edit-user",
    passwordAction: true,
    modalAdd: true,
    addLabel: "Add User",
    recordName: "user",
    onSaveEdit: saveUserRowToApi,
    afterRenderRow: applyUserRowMetadata,
    inputs: [
      { key: "name", selector: "[data-user-name]", fallback: "Unnamed User" },
      { key: "email", selector: "[data-user-email]", fallback: "No email added.", type: "email" },
      { key: "username", selector: "[data-user-username]", fallback: "No username added." }
    ]
  });

  function environmentDtoToTableData(environment) {
    return {
      id: environment.id,
      name: environment.environmentName || "Unnamed Environment",
      description: environment.description || "No description added.",
      status: environment.isActive ? "Active" : "Inactive",
      environmentScope: environment.environmentScope || "Test"
    };
  }

  function applyEnvironmentRowMetadata(row, data) {
    if (data.id) {
      row.dataset.environmentId = data.id;
    }
    row.dataset.environmentScope = data.environmentScope || row.dataset.environmentScope || "Test";
  }

  function saveEnvironmentRowToApi(row, data) {
    var environmentId = row.dataset.environmentId;
    if (!environmentId) {
      return Promise.reject(new Error("Environment record is missing its database id."));
    }
    return apiFetch("/api/v1/environments/" + encodeURIComponent(environmentId), {
      method: "PATCH",
      body: JSON.stringify({
        environmentName: data.name,
        description: data.description === "No description added." ? "" : data.description,
        isActive: data.status === "Active"
      })
    }).then(environmentDtoToTableData);
  }

  function createEnvironmentToApi(data) {
    return apiFetch("/api/v1/environments", {
      method: "POST",
      body: JSON.stringify({
        environmentName: data.name,
        description: data.description === "No description added." ? "" : data.description,
        isActive: data.status === "Active"
      })
    }).then(function (createdEnvironment) {
      showAccountConfirmationDialog({
        title: "Environment created",
        message: data.name + " was added successfully.",
        actionLabel: "Done"
      });
      return environmentDtoToTableData(createdEnvironment);
    });
  }

  function loadEnvironmentsFromApi() {
    return apiFetch("/api/v1/environments").then(function (payload) {
      return (payload.items || []).map(environmentDtoToTableData);
    });
  }

  initSimpleInlineManager({
    trigger: "[data-env-add-trigger]",
    row: "[data-env-add-row]",
    body: "[data-env-table-body]",
    save: "[data-save-env]",
    cancel: "[data-cancel-env]",
    statusSelector: "[data-env-status]",
    editAttribute: "data-edit-env",
    addLabel: "Add Environment",
    recordName: "environment",
    onSaveAdd: createEnvironmentToApi,
    onSaveEdit: saveEnvironmentRowToApi,
    afterRenderRow: applyEnvironmentRowMetadata,
    loadRecords: loadEnvironmentsFromApi,
    inputs: [
      { key: "name", selector: "[data-env-name]", fallback: "Unnamed Environment" },
      { key: "description", selector: "[data-env-description]", fallback: "No description added." }
    ]
  });

  var userModal = document.getElementById("userModal");
  if (userModal) {
    var openUserModalButton = document.querySelector("[data-open-user-modal]");
    var userTableBody = document.querySelector("[data-user-table-body]");
    var userNameInput = userModal.querySelector("[data-modal-user-name]");
    var userEmailInput = userModal.querySelector("[data-modal-user-email]");
    var userUsernameInput = userModal.querySelector("[data-modal-user-username]");
    var userStatusInput = userModal.querySelector("[data-modal-user-status]");
    var userContextInput = userModal.querySelector("[data-modal-user-context]");
    var userPasswordInput = userModal.querySelector("[data-modal-user-password]");
    var userConfirmInput = userModal.querySelector("[data-modal-user-confirm]");
    var userMessage = userModal.querySelector("[data-user-message]");
    var saveModalUserButton = userModal.querySelector("[data-save-modal-user]");

    function setUserMessage(text, state) {
      userMessage.textContent = text || "";
      userMessage.classList.toggle("is-error", state === "error");
      userMessage.classList.toggle("is-success", state === "success");
    }

    function resetUserForm() {
      clearValidation(userModal);
      userNameInput.value = "";
      userEmailInput.value = "";
      userUsernameInput.value = "";
      updateModalUserStatus("Active");
      updateModalUserContext("Test");
      userPasswordInput.value = "";
      userConfirmInput.value = "";
      setUserMessage("", "");
    }

    function updateModalUserStatus(status) {
      userStatusInput.setAttribute("data-status-value", status);
      Array.prototype.slice.call(userStatusInput.querySelectorAll("[data-modal-user-status-option]")).forEach(function (button) {
        var isActive = button.getAttribute("data-modal-user-status-option") === status;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function updateModalUserContext(context) {
      var nextContext = normalizeDataContext(context);
      userContextInput.setAttribute("data-context-value", nextContext);
      Array.prototype.slice.call(userContextInput.querySelectorAll("[data-modal-user-context-option]")).forEach(function (button) {
        var isActive = button.getAttribute("data-modal-user-context-option") === nextContext;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function openUserModal() {
      resetUserForm();
      userModal.classList.add("open");
      userModal.setAttribute("aria-hidden", "false");
      userNameInput.focus();
    }

    function closeUserModal() {
      userModal.classList.remove("open");
      userModal.setAttribute("aria-hidden", "true");
      resetUserForm();
    }

    function createUserBadge(status) {
      var badge = document.createElement("span");
      badge.className = "badge " + (status === "Active" ? "badge-active" : "badge-inactive");
      badge.textContent = status;
      return badge;
    }

    function createUserActionCell() {
      var cell = document.createElement("td");
      var actions = document.createElement("div");
      var editButton = document.createElement("button");
      var passwordButton = document.createElement("button");

      actions.className = "row-actions";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.setAttribute("data-edit-user", "");
      passwordButton.type = "button";
      passwordButton.textContent = "Password";
      passwordButton.setAttribute("data-reset-user-password", "");
      actions.appendChild(editButton);
      actions.appendChild(passwordButton);
      cell.appendChild(actions);
      return cell;
    }

    function createUserRow(user) {
      var data = userDtoToTableData(user);
      var row = document.createElement("tr");
      var statusCell = document.createElement("td");

      applyUserRowMetadata(row, data);
      appendUserCell(row, data.name);
      appendUserCell(row, data.email);
      appendUserCell(row, data.username);
      statusCell.appendChild(createUserBadge(data.status));
      row.appendChild(statusCell);
      row.appendChild(createUserActionCell());
      return row;
    }

    function appendUserCell(row, value) {
      var cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }

    function loadUsersFromApi() {
      function showUserTableMessage(text) {
        var row = document.createElement("tr");
        var cell = document.createElement("td");
        cell.colSpan = 5;
        cell.className = "muted";
        cell.textContent = text;
        row.appendChild(cell);
        userTableBody.replaceChildren(row);
      }

      showUserTableMessage("Loading users...");
      return apiFetch("/api/v1/users?page=1&pageSize=100").then(function (payload) {
        var users = payload.items || [];
        userTableBody.replaceChildren();
        users.forEach(function (user) {
          userTableBody.appendChild(createUserRow(user));
        });
        if (!users.length) {
          showUserTableMessage("No users found.");
        }
      }).catch(function (error) {
        showUserTableMessage(error.message || "Unable to load users.");
      });
    }

    function saveModalUser() {
      var name = userNameInput.value.trim();
      var email = userEmailInput.value.trim();
      var username = userUsernameInput.value.trim();
      var status = userStatusInput.getAttribute("data-status-value") || "Active";
      var defaultDataContext = normalizeDataContext(userContextInput.getAttribute("data-context-value") || "Test");
      var password = userPasswordInput.value.trim();
      var confirmPassword = userConfirmInput.value.trim();
      var state = createValidationState(userModal, userMessage);

      requiredField(state, userNameInput);
      minLengthField(state, userNameInput, 2);
      maxLengthField(state, userNameInput, 80);
      emailField(state, userEmailInput, true);
      validateDuplicateName(state, userEmailInput, userTableBody, 1, null, "Email");
      requiredField(state, userUsernameInput);
      minLengthField(state, userUsernameInput, 3);
      maxLengthField(state, userUsernameInput, 40);
      patternField(state, userUsernameInput, /^[a-zA-Z0-9._-]+$/, "Username can use letters, numbers, dots, hyphens, and underscores.");
      validateDuplicateName(state, userUsernameInput, userTableBody, 2, null, "Username");
      requiredField(state, userPasswordInput);
      minLengthField(state, userPasswordInput, 8);
      requiredField(state, userConfirmInput);
      if (password && confirmPassword && password !== confirmPassword) {
        addValidationError(state, userConfirmInput, validationMessages.match(getFieldLabel(userConfirmInput), getFieldLabel(userPasswordInput)));
      }
      if (!finishValidation(state, "")) return;

      saveModalUserButton.disabled = true;
      saveModalUserButton.textContent = "Saving";
      setUserMessage("Saving user...", "");

      apiFetch("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          name: name,
          email: email,
          username: username,
          password: password,
          confirmPassword: confirmPassword,
          isActive: status === "Active",
          defaultDataContext: defaultDataContext
        })
      }).then(function (createdUser) {
        userTableBody.insertBefore(createUserRow(createdUser), userTableBody.firstElementChild);
        setUserMessage("User saved.", "success");
        closeUserModal();
        showAccountConfirmationDialog({
          title: "User created",
          message: username + " was added successfully.",
          actionLabel: "Done"
        });
      }).catch(function (error) {
        setUserMessage(error.message || "Unable to save user.", "error");
        showValidationToast(error.message || "Unable to save user.");
      }).finally(function () {
        saveModalUserButton.disabled = false;
        saveModalUserButton.textContent = "Save User";
      });
    }

    if (openUserModalButton) {
      openUserModalButton.addEventListener("click", openUserModal);
    }

    userModal.querySelectorAll("[data-close-user-modal]").forEach(function (button) {
      button.addEventListener("click", closeUserModal);
    });

    userModal.addEventListener("click", function (event) {
      if (event.target === userModal) {
        closeUserModal();
      }
    });

    userModal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeUserModal();
      }
    });

    userStatusInput.addEventListener("click", function (event) {
      var statusButton = event.target.closest("[data-modal-user-status-option]");
      if (!statusButton) return;
      updateModalUserStatus(statusButton.getAttribute("data-modal-user-status-option"));
    });

    userContextInput.addEventListener("click", function (event) {
      var contextButton = event.target.closest("[data-modal-user-context-option]");
      if (!contextButton) return;
      updateModalUserContext(contextButton.getAttribute("data-modal-user-context-option"));
    });

    saveModalUserButton.addEventListener("click", saveModalUser);
    loadUsersFromApi();
  }

  var passwordModal = document.getElementById("passwordModal");
  if (passwordModal) {
    var passwordUserLabel = passwordModal.querySelector("[data-password-user-label]");
    var previousPasswordInput = passwordModal.querySelector("[data-password-previous]");
    var newPasswordInput = passwordModal.querySelector("[data-password-new]");
    var confirmPasswordInput = passwordModal.querySelector("[data-password-confirm]");
    var passwordMessage = passwordModal.querySelector("[data-password-message]");
    var commitPasswordButton = passwordModal.querySelector("[data-commit-password]");

    function setPasswordMessage(text, state) {
      passwordMessage.textContent = text || "";
      passwordMessage.classList.toggle("is-error", state === "error");
      passwordMessage.classList.toggle("is-success", state === "success");
    }

    function resetPasswordForm() {
      clearValidation(passwordModal);
      previousPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
      setPasswordMessage("", "");
    }

    function openPasswordModal(row) {
      var name = row.cells[0].textContent.trim();
      var username = row.cells[2].textContent.trim();
      var userId = row.dataset.userId || "";
      passwordModal.dataset.targetUserId = userId;
      passwordModal.dataset.targetUser = username;
      passwordUserLabel.textContent = name + " | " + username;
      resetPasswordForm();
      passwordModal.classList.add("open");
      passwordModal.setAttribute("aria-hidden", "false");
      previousPasswordInput.focus();
    }

    function closePasswordModal() {
      passwordModal.classList.remove("open");
      passwordModal.setAttribute("aria-hidden", "true");
      resetPasswordForm();
    }

    document.addEventListener("click", function (event) {
      var resetButton = event.target.closest("[data-reset-user-password]");
      if (!resetButton) return;
      var row = resetButton.closest("tr");
      if (row) openPasswordModal(row);
    });

    passwordModal.querySelectorAll("[data-close-password-modal]").forEach(function (button) {
      button.addEventListener("click", closePasswordModal);
    });

    passwordModal.addEventListener("click", function (event) {
      if (event.target === passwordModal) {
        closePasswordModal();
      }
    });

    passwordModal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closePasswordModal();
      }
    });

    commitPasswordButton.addEventListener("click", function () {
      var previousPassword = previousPasswordInput.value.trim();
      var newPassword = newPasswordInput.value.trim();
      var confirmPassword = confirmPasswordInput.value.trim();
      var state = createValidationState(passwordModal, passwordMessage);
      validatePasswordPair(state, previousPasswordInput, newPasswordInput, confirmPasswordInput, true);
      if (!finishValidation(state, "")) return;

      if (!passwordModal.dataset.targetUserId) {
        setPasswordMessage("User record is missing its database id.", "error");
        return;
      }

      commitPasswordButton.disabled = true;
      commitPasswordButton.textContent = "Saving";
      setPasswordMessage("Saving password...", "");

      apiFetch("/api/v1/users/" + encodeURIComponent(passwordModal.dataset.targetUserId) + "/password", {
        method: "POST",
        body: JSON.stringify({
          previousPassword: previousPassword,
          newPassword: newPassword,
          confirmPassword: confirmPassword
        })
      }).then(function () {
        closePasswordModal();
        showAccountConfirmationDialog({
          title: "Password reset",
          message: "Password reset committed for " + passwordModal.dataset.targetUser + ".",
          actionLabel: "Done"
        });
      }).catch(function (error) {
        setPasswordMessage(error.message || "Unable to reset password.", "error");
        showValidationToast(error.message || "Unable to reset password.");
      }).finally(function () {
        commitPasswordButton.disabled = false;
        commitPasswordButton.textContent = "Commit Password";
      });
    });
  }

  var simpleReportTableBody = document.querySelector("[data-simple-report-table-body]");
  if (simpleReportTableBody) {
    var simpleReportRecords = getScopedDefectRecords();
    var simpleReportFilters = Array.prototype.slice.call(document.querySelectorAll("[data-simple-report-filter]"));
    var runSimpleReportButton = document.querySelector("[data-run-simple-report]");

    function uniqueSimpleReportValues(field) {
      return Array.from(new Set(simpleReportRecords.map(function (record) {
        return record[field];
      }).filter(Boolean))).sort();
    }

    function fillSimpleReportSelect(field, placeholder) {
      var select = document.querySelector('[data-simple-report-filter="' + field + '"]');
      if (!select || select.tagName !== "SELECT") return;
      select.innerHTML = "";
      var first = document.createElement("option");
      first.value = "";
      first.textContent = placeholder;
      select.appendChild(first);
      uniqueSimpleReportValues(field).forEach(function (value) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }

    function getSimpleReportFilters() {
      var filters = {};
      simpleReportFilters.forEach(function (control) {
        filters[control.getAttribute("data-simple-report-filter")] = control.value.trim();
      });
      return filters;
    }

    function getFilteredSimpleReportRecords() {
      var filters = getSimpleReportFilters();
      return simpleReportRecords.filter(function (record) {
        if (filters.project && record.project !== filters.project) return false;
        if (filters.environment && record.environment !== filters.environment) return false;
        if (filters.status && record.status !== filters.status) return false;
        if (filters.severity && record.severity !== filters.severity) return false;
        if (filters.assignedTo && record.assignedTo !== filters.assignedTo) return false;
        if (filters.releaseVersion && record.releaseVersion !== filters.releaseVersion) return false;
        if (filters.from && record.createdDate < filters.from) return false;
        if (filters.to && record.createdDate > filters.to) return false;
        return true;
      });
    }

    function daysBetween(start, end) {
      if (!start || !end) return null;
      var startDate = new Date(start + "T00:00:00");
      var endDate = new Date(end + "T00:00:00");
      return Math.max(0, Math.round((endDate - startDate) / 86400000));
    }

    function averageDays(rows, endField) {
      var values = rows.map(function (record) {
        return daysBetween(record.createdDate, record[endField]);
      }).filter(function (value) {
        return value !== null;
      });
      if (!values.length) return "0d";
      return (values.reduce(function (sum, value) { return sum + value; }, 0) / values.length).toFixed(1) + "d";
    }

    function countDistinct(rows, field) {
      return new Set(rows.map(function (record) { return record[field]; }).filter(Boolean)).size;
    }

    function highestCount(rows, field) {
      var counts = {};
      rows.forEach(function (record) {
        var value = record[field] || "Not set";
        counts[value] = (counts[value] || 0) + 1;
      });
      return Object.keys(counts).reduce(function (max, key) {
        return Math.max(max, counts[key]);
      }, 0);
    }

    function setSimpleReportMetric(name, value) {
      var element = document.querySelector('[data-simple-report-metric="' + name + '"]');
      if (element) element.textContent = value;
    }

    function appendSimpleReportCell(row, value) {
      var cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }

    function renderSimpleReport() {
      var state = createValidationState(document.querySelector(".dashboard-section") || document, null);
      dateRangeFields(
        state,
        document.querySelector('[data-simple-report-filter="from"]'),
        document.querySelector('[data-simple-report-filter="to"]'),
        "Date To must be on or after Date From."
      );
      if (!finishValidation(state, "")) return;
      var rows = getFilteredSimpleReportRecords();
      simpleReportTableBody.innerHTML = "";
      setSimpleReportMetric("fixTime", averageDays(rows, "fixDate"));
      setSimpleReportMetric("closureTime", averageDays(rows, "closureDate"));
      setSimpleReportMetric("releaseCount", countDistinct(rows, "releaseVersion"));
      setSimpleReportMetric("environmentCount", countDistinct(rows, "environment"));
      setSimpleReportMetric("assigneeCount", highestCount(rows, "assignedTo"));

      rows.forEach(function (record) {
        var row = document.createElement("tr");
        appendSimpleReportCell(row, "Defect Volume");
        appendSimpleReportCell(row, record.project);
        appendSimpleReportCell(row, record.environment);
        appendSimpleReportCell(row, record.releaseVersion);
        appendSimpleReportCell(row, 1);
        appendSimpleReportCell(row, "-");
        simpleReportTableBody.appendChild(row);
      });

      if (!rows.length) {
        var emptyRow = document.createElement("tr");
        var emptyCell = document.createElement("td");
        emptyCell.colSpan = 6;
        emptyCell.className = "chart-empty";
        emptyCell.textContent = "No report rows match the selected context and filters.";
        emptyRow.appendChild(emptyCell);
        simpleReportTableBody.appendChild(emptyRow);
      }
    }

    fillSimpleReportSelect("project", "All Projects");
    fillSimpleReportSelect("environment", "All Environments");
    fillSimpleReportSelect("status", "All Statuses");
    fillSimpleReportSelect("severity", "All Severities");
    fillSimpleReportSelect("assignedTo", "Anyone");
    fillSimpleReportSelect("releaseVersion", "All Releases");
    if (runSimpleReportButton) runSimpleReportButton.addEventListener("click", renderSimpleReport);
    renderSimpleReport();
  }

  var defectFilterPanel = document.querySelector(".defect-filter-panel");
  var defectFilterBody = document.querySelector("[data-defect-filter-body]");
  var toggleDefectFiltersButton = document.querySelector("[data-toggle-defect-filters]");
  var applyDefectFiltersButton = document.querySelector("[data-apply-defect-filters]");
  var resetDefectFiltersButton = document.querySelector("[data-reset-defect-filters]");
  var defectFilterControls = Array.prototype.slice.call(document.querySelectorAll("[data-defect-filter]"));
  var defectResultCount = document.querySelector("[data-defect-result-count]");
  var defectListTable = document.querySelector("[data-defect-list-table]");
  var defectListBody = defectListTable ? defectListTable.querySelector("tbody") : null;
  var defectListPaginationRoot = document.querySelector("[data-defect-list-pagination]");
  var defectListState = { page: 1, pageSize: 10, sortKey: "createdDate", sortAsc: false };
  var defectListCurrentRecords = [];
  var defectListTotalItems = 0;
  var defectListHasRendered = false;

  function getDefectBadgeClass(value, field) {
    var key = String(value).toLowerCase().replace(/\s+/g, "-");
    if (field === "severity") return "badge-" + key;
    if (field === "status") return getStatusBadgeClass(value);
    return "badge-neutral";
  }

  function createDefectBadge(value, field) {
    var badge = document.createElement("span");
    badge.className = "badge " + getDefectBadgeClass(value, field);
    badge.textContent = value;
    return badge;
  }

  function appendDefectTextCell(row, value, title) {
    var cell = document.createElement("td");
    cell.textContent = value || "";
    if (title) cell.title = title;
    row.appendChild(cell);
    return cell;
  }

  function createDefectIdCell(record) {
    var cell = document.createElement("td");
    var wrapper = document.createElement("span");
    var viewLink = document.createElement("a");
    var editLink = document.createElement("a");

    cell.className = "defect-id-cell";
    wrapper.className = "defect-id-cell-inner";
    viewLink.className = "defect-id-link";
    var routeId = record.apiId || record.id;
    viewLink.href = "defect_detail.html?id=" + encodeURIComponent(routeId) + "&back=defect_list.html";
    viewLink.textContent = record.id;
    viewLink.title = "View " + record.id;
    viewLink.setAttribute("aria-label", "View " + record.id);
    editLink.className = "defect-edit-icon";
    editLink.href = "defect_edit.html?id=" + encodeURIComponent(routeId) + "&back=defect_list.html";
    editLink.title = "Edit " + record.id;
    editLink.setAttribute("aria-label", "Edit " + record.id);
    editLink.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    wrapper.appendChild(viewLink);
    wrapper.appendChild(editLink);
    cell.appendChild(wrapper);
    return cell;
  }

  function setDefectSelectOptions(name, placeholder, values) {
    var select = document.querySelector('[data-defect-filter="' + name + '"]');
    if (!select || select.tagName !== "SELECT") return;
    select.innerHTML = "";
    var placeholderOption = document.createElement("option");
    placeholderOption.textContent = placeholder;
    placeholderOption.value = "";
    select.appendChild(placeholderOption);
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function uniqueDefectValues(records, field) {
    return Array.from(new Set(records.map(function (record) {
      return record[field];
    }).filter(Boolean))).sort();
  }

  function populateDefectFilterOptions(records) {
    setDefectSelectOptions("project", "All Projects", uniqueDefectValues(records, "project"));
    setDefectSelectOptions("environment", "All Environments", uniqueDefectValues(records, "environment"));
    setDefectSelectOptions("status", "All Statuses", uniqueDefectValues(records, "status"));
    setDefectSelectOptions("severity", "All Severities", uniqueDefectValues(records, "severity"));
    setDefectSelectOptions("priority", "All Priorities", uniqueDefectValues(records, "priority"));
    setDefectSelectOptions("assignedTo", "Anyone", uniqueDefectValues(records, "assignedTo"));
    setDefectSelectOptions("releaseVersion", "All Releases", uniqueDefectValues(records, "releaseVersion"));
  }

  function dateOnlyForDefectList(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function apiDefectToListRecord(defect) {
    return {
      apiId: defect.id,
      id: defect.defectKey || defect.id,
      title: defect.title || "",
      description: defect.description || "",
      projectId: defect.project && defect.project.id ? defect.project.id : "",
      project: defect.project && defect.project.projectName ? defect.project.projectName : "",
      environmentId: defect.environment && defect.environment.id ? defect.environment.id : "",
      environment: defect.environment && defect.environment.environmentName ? defect.environment.environmentName : "",
      severityId: defect.severity && defect.severity.id ? defect.severity.id : "",
      severity: defect.severity && defect.severity.name ? defect.severity.name : "",
      priorityId: defect.priority && defect.priority.id ? defect.priority.id : "",
      priority: defect.priority && defect.priority.name ? defect.priority.name : "",
      status: defect.currentStatus || "",
      assignedToUserId: defect.assignedTo && defect.assignedTo.id ? defect.assignedTo.id : "",
      assignedTo: defect.assignedTo && defect.assignedTo.name ? defect.assignedTo.name : "",
      releaseId: defect.fixedInRelease && defect.fixedInRelease.id ? defect.fixedInRelease.id : "",
      releaseVersion: defect.fixedInRelease && defect.fixedInRelease.releaseVersion ? defect.fixedInRelease.releaseVersion : "",
      deploymentDate: defect.fixedInRelease ? dateOnlyForDefectList(defect.fixedInRelease.actualDeploymentDate || defect.fixedInRelease.plannedDeploymentDate) : "",
      createdBy: defect.createdBy && defect.createdBy.username ? defect.createdBy.username : "",
      createdDate: dateOnlyForDefectList(defect.createdAt),
      fixDate: dateOnlyForDefectList(defect.fixDate),
      closureDate: dateOnlyForDefectList(defect.closureDate)
    };
  }

  function setDefectSelectOptionsFromRecords(name, placeholder, records, labelField, idField) {
    var select = document.querySelector('[data-defect-filter="' + name + '"]');
    if (!select || select.tagName !== "SELECT") return;
    var existingValue = select.value;
    var seen = {};
    select.innerHTML = "";
    var placeholderOption = document.createElement("option");
    placeholderOption.textContent = placeholder;
    placeholderOption.value = "";
    select.appendChild(placeholderOption);
    records.forEach(function (record) {
      var label = record[labelField];
      var id = record[idField] || label;
      if (!label || seen[String(id)]) return;
      seen[String(id)] = true;
      var option = document.createElement("option");
      option.value = String(id);
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = Array.prototype.some.call(select.options, function (option) { return option.value === existingValue; }) ? existingValue : "";
  }

  function populateDefectFilterOptionsFromApi(records, workflowStatuses) {
    setDefectSelectOptionsFromRecords("project", "All Projects", records, "project", "projectId");
    setDefectSelectOptionsFromRecords("environment", "All Environments", records, "environment", "environmentId");
    setDefectSelectOptions("status", "All Statuses", workflowStatuses && workflowStatuses.length ? workflowStatuses : uniqueDefectValues(records, "status"));
    setDefectSelectOptionsFromRecords("severity", "All Severities", records, "severity", "severityId");
    setDefectSelectOptionsFromRecords("priority", "All Priorities", records, "priority", "priorityId");
    setDefectSelectOptionsFromRecords("assignedTo", "Anyone", records, "assignedTo", "assignedToUserId");
    setDefectSelectOptionsFromRecords("releaseVersion", "All Releases", records, "releaseVersion", "releaseId");
  }

  function sortedDefectListRecords(records) {
    var severityWeights = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    var priorityWeights = { P1: 4, P2: 3, P3: 2, P4: 1 };
    return records.slice().sort(function (a, b) {
      var left = a[defectListState.sortKey];
      var right = b[defectListState.sortKey];
      if (defectListState.sortKey === "severity") {
        var leftSev = severityWeights[left] || 0;
        var rightSev = severityWeights[right] || 0;
        return defectListState.sortAsc ? leftSev - rightSev : rightSev - leftSev;
      }
      if (defectListState.sortKey === "priority") {
        var leftPri = priorityWeights[left] || 0;
        var rightPri = priorityWeights[right] || 0;
        return defectListState.sortAsc ? leftPri - rightPri : rightPri - leftPri;
      }
      var leftStr = String(left == null ? "" : left);
      var rightStr = String(right == null ? "" : right);
      return defectListState.sortAsc
        ? leftStr.localeCompare(rightStr, undefined, { numeric: true, sensitivity: "base" })
        : rightStr.localeCompare(leftStr, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function updateDefectSortHeaders() {
    if (!defectListTable) return;
    Array.prototype.slice.call(defectListTable.querySelectorAll("th[data-sort-key]")).forEach(function (header) {
      var isActive = header.getAttribute("data-sort-key") === defectListState.sortKey;
      header.classList.toggle("sorted-asc", isActive && defectListState.sortAsc);
      header.classList.toggle("sorted-desc", isActive && !defectListState.sortAsc);
    });
  }

  function renderDefectListRows(records, totalItems) {
    if (!defectListBody) return;
    defectListCurrentRecords = records.slice();
    defectListTotalItems = totalItems == null ? records.length : totalItems;
    defectListHasRendered = true;
    defectListBody.innerHTML = "";
    var sortedRecords = sortedDefectListRecords(records);
    var totalRows = totalItems == null ? sortedRecords.length : totalItems;
    var totalPages = Math.max(1, Math.ceil(totalRows / defectListState.pageSize));
    defectListState.page = Math.min(Math.max(1, defectListState.page), totalPages);
    var pageRows = totalItems == null ? getPagedRows(sortedRecords, defectListState.page, defectListState.pageSize) : sortedRecords;

    pageRows.forEach(function (record) {
      var row = document.createElement("tr");
      var severityCell = document.createElement("td");
      var statusCell = document.createElement("td");
      row.appendChild(createDefectIdCell(record));
      appendDefectTextCell(row, record.title, record.title);
      appendDefectTextCell(row, record.project);
      appendDefectTextCell(row, record.environment);
      severityCell.appendChild(createDefectBadge(record.severity, "severity"));
      row.appendChild(severityCell);
      appendDefectTextCell(row, record.priority);
      statusCell.appendChild(createDefectBadge(record.status, "status"));
      row.appendChild(statusCell);
      appendDefectTextCell(row, record.assignedTo);
      appendDefectTextCell(row, record.releaseVersion);
      appendDefectTextCell(row, record.createdBy);
      appendDefectTextCell(row, record.createdDate);
      defectListBody.appendChild(row);
    });

    if (!totalRows) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 11;
      emptyCell.className = "chart-empty";
      emptyCell.textContent = "No defects match the selected filters.";
      emptyRow.appendChild(emptyCell);
      defectListBody.appendChild(emptyRow);
    }

    if (defectResultCount) {
      if (!totalRows) {
        defectResultCount.textContent = "0 records";
      } else {
        var start = ((defectListState.page - 1) * defectListState.pageSize) + 1;
        var end = Math.min(start + pageRows.length - 1, totalRows);
        defectResultCount.textContent = "Showing " + start + "-" + end + " of " + totalRows + (totalRows === 1 ? " record" : " records");
      }
    }

    renderTablePagination(defectListPaginationRoot, defectListState, totalRows, "Defect records", function (page) {
      defectListState.page = page;
      loadDefectList();
    });
    updateDefectSortHeaders();
  }

  if (defectFilterPanel && defectFilterBody && toggleDefectFiltersButton) {
    toggleDefectFiltersButton.addEventListener("click", function () {
      var isCollapsed = defectFilterPanel.classList.toggle("is-collapsed");
      var label = toggleDefectFiltersButton.querySelector("[data-defect-filter-toggle-label]");
      defectFilterBody.hidden = isCollapsed;
      if (label) label.textContent = isCollapsed ? "Expand" : "Collapse";
      toggleDefectFiltersButton.setAttribute("aria-expanded", String(!isCollapsed));
    });
  }

  function getDefectFilterValue(name) {
    var control = document.querySelector('[data-defect-filter="' + name + '"]');
    if (!control) return "";
    var value = control.value.trim();
    if (/^(All|Anyone)/.test(value)) return "";
    return value;
  }

  function buildDefectListQuery() {
    var params = new URLSearchParams();
    var search = getDefectFilterValue("search");
    params.set("page", String(defectListState.page));
    params.set("pageSize", String(defectListState.pageSize));
    if (search) params.set("search", search);
    [
      ["project", "projectId"],
      ["environment", "environmentId"],
      ["status", "status"],
      ["severity", "severityId"],
      ["priority", "priorityId"],
      ["assignedTo", "assignedToUserId"],
      ["releaseVersion", "releaseId"]
    ].forEach(function (pair) {
      var value = getDefectFilterValue(pair[0]);
      if (value) params.set(pair[1], value);
    });
    return params.toString();
  }

  function showDefectListError(error) {
    if (!defectListBody) return;
    defectListCurrentRecords = [];
    defectListTotalItems = 0;
    defectListHasRendered = true;
    defectListBody.innerHTML = "";
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = 11;
    cell.className = "chart-empty";
    cell.textContent = error && error.message ? error.message : "Unable to load defects.";
    row.appendChild(cell);
    defectListBody.appendChild(row);
    if (defectResultCount) defectResultCount.textContent = "Unable to load defects";
    renderTablePagination(defectListPaginationRoot, defectListState, 0, "Defect records", function (page) {
      defectListState.page = page;
      loadDefectList();
    });
  }

  function loadDefectList() {
    if (!defectListTable || !defectListBody) return Promise.resolve();
    return apiFetch("/api/v1/defects?" + buildDefectListQuery()).then(function (payload) {
      var records = (payload.items || []).map(apiDefectToListRecord);
      var pagination = payload.pagination || {};
      renderDefectListRows(records, pagination.totalItems != null ? pagination.totalItems : records.length);
    }).catch(showDefectListError);
  }

  function loadDefectFilterOptions() {
    if (!defectListTable || !defectListBody) return Promise.resolve();
    return Promise.all([
      apiFetch("/api/v1/defects?page=1&pageSize=100"),
      apiFetch("/api/v1/workflow")
    ]).then(function (results) {
      populateDefectFilterOptionsFromApi((results[0].items || []).map(apiDefectToListRecord), workflowStatusLabelsFromPayload(results[1]));
    }).catch(function () {
      populateDefectFilterOptions([]);
    });
  }

  function applyDefectFilters() {
    var state = createValidationState(document.querySelector(".defect-filter-panel") || document, null);
    maxLengthField(state, document.querySelector('[data-defect-filter="search"]'), 80);
    if (!finishValidation(state, "")) return;
    defectListState.page = 1;
    loadDefectList();
  }

  if (defectListTable && defectListBody) {
    loadDefectFilterOptions().finally(loadDefectList);
    Array.prototype.slice.call(defectListTable.querySelectorAll("th[data-sort-key]")).forEach(function (header) {
      header.addEventListener("click", function () {
        var key = header.getAttribute("data-sort-key");
        if (defectListState.sortKey === key) {
          defectListState.sortAsc = !defectListState.sortAsc;
        } else {
          defectListState.sortKey = key;
          defectListState.sortAsc = true;
        }
        renderDefectListRows(defectListCurrentRecords, defectListTotalItems);
      });
    });
  }

  if (applyDefectFiltersButton) {
    applyDefectFiltersButton.addEventListener("click", applyDefectFilters);
  }

  if (resetDefectFiltersButton) {
    resetDefectFiltersButton.addEventListener("click", function () {
      defectFilterControls.forEach(function (control) {
        control.selectedIndex = 0;
        control.value = control.tagName === "INPUT" ? "" : control.value;
      });
      applyDefectFilters();
    });
  }

  // Export uses the DB-backed rows currently loaded on the Defects page.
  // rows. "All columns" is wired through the same dropdown for UI parity with the dashboard — when
  var defectListExportButton = document.querySelector("[data-defect-list-export]");
  var defectListExportSplit = document.querySelector("[data-export-split-defect-list]");
  if (defectListExportButton || defectListExportSplit) {
    var defectListTable = document.querySelector("[data-defect-list-table]");
    var DEFECT_LIST_VISIBLE_COLUMNS = ["id", "title", "project", "environment", "severity", "priority", "status", "assignedTo", "releaseVersion", "createdBy", "createdDate"];
    var DEFECT_LIST_ALL_COLUMNS = ["id", "title", "description", "project", "environment", "severity", "priority", "status", "assignedTo", "createdBy", "createdDate", "releaseVersion", "deploymentDate", "fixDate", "closureDate"];
    var DEFECT_LIST_COLUMN_LABELS = {
      id: "Defect ID", title: "Title", description: "Description", project: "Project", environment: "Environment",
      severity: "Severity", priority: "Priority", status: "Status", assignedTo: "Assigned To", createdBy: "Created By",
      createdDate: "Created Date", releaseVersion: "Release Version", deploymentDate: "Release Deployment Date",
      fixDate: "Fix Date", closureDate: "Closure Date"
    };

    function exportDefectListCsv(mode) {
      if (!defectListTable) return;
      var rows = sortedDefectListRecords(defectListHasRendered ? defectListCurrentRecords : []);
      var columns = mode === "all" ? DEFECT_LIST_ALL_COLUMNS : DEFECT_LIST_VISIBLE_COLUMNS;
      var escapeCell = function (value) {
        var text = String(value == null ? "" : value).replace(/"/g, '""');
        return /[",\n]/.test(text) ? '"' + text + '"' : text;
      };
      var header = columns.map(function (column) {
        return escapeCell(DEFECT_LIST_COLUMN_LABELS[column] || column);
      }).join(",");
      var rowsCsv = rows.map(function (record) {
        return columns.map(function (column) {
          return escapeCell(record[column]);
        }).join(",");
      });
      var csv = [header].concat(rowsCsv).join("\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = mode === "all" ? "defects_all_columns.csv" : "defects_current_view.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    }
    initExportSplit(defectListExportSplit, exportDefectListCsv);
  }

  var workflowEditor = document.querySelector("[data-workflow-editor]");

  if (workflowEditor) {
    var workflowCanvas = workflowEditor.querySelector("[data-workflow-canvas]");
    var workflowNodeLayer = workflowEditor.querySelector("[data-workflow-nodes]");
    var workflowEdgeLayer = workflowEditor.querySelector("[data-workflow-edges]");
    var workflowMessage = workflowEditor.querySelector("[data-workflow-message]");
    var workflowDerived = workflowEditor.querySelector("[data-workflow-derived]");
    var workflowSelectionBox = workflowEditor.querySelector("[data-workflow-selection-box]");
    var workflowState = null;
    var selectedWorkflowItem = null;
    var selectedWorkflowNodeIds = [];
    var nodeCounter = 20;
    var edgeCounter = 20;
    var suppressWorkflowCanvasClick = false;
    var suppressWorkflowNodeClick = false;
    var isWorkflowPanMode = false;
    var isWorkflowSpaceDown = false;
    var workflowViewport = { x: 0, y: 0 };
    var workflowZoom = 1;
    var workflowWorkspace = { width: 2600, height: 1600 };
    var workflowHandles = ["top", "right", "bottom", "left"];

    var defaultWorkflow = {
      nodes: [
        { id: "node_1", type: "process", label: "Assigned", position: { x: 265, y: 300 } },
        { id: "node_2", type: "process", label: "InProgress", position: { x: 515, y: 300 } },
        { id: "node_3", type: "process", label: "Fixed", position: { x: 765, y: 300 } },
        { id: "node_4", type: "process", label: "Test", position: { x: 1015, y: 300 } },
        { id: "node_5", type: "process", label: "Closed", position: { x: 1265, y: 300 } },
        { id: "node_6", type: "process", label: "Rejected", position: { x: 515, y: 92 } }
      ],
      edges: [
        { id: "edge_1", source: "node_1", sourceHandle: "right", target: "node_2", targetHandle: "left" },
        { id: "edge_2", source: "node_2", sourceHandle: "right", target: "node_3", targetHandle: "left" },
        { id: "edge_3", source: "node_3", sourceHandle: "right", target: "node_4", targetHandle: "left" },
        { id: "edge_4", source: "node_4", sourceHandle: "right", target: "node_5", targetHandle: "left" },
        { id: "edge_5", source: "node_2", sourceHandle: "top", target: "node_6", targetHandle: "bottom" },
        { id: "edge_6", source: "node_4", sourceHandle: "bottom", target: "node_2", targetHandle: "bottom" }
      ]
    };

    function cloneWorkflow(workflow) {
      return JSON.parse(JSON.stringify(workflow));
    }

    function setWorkflowMessage(text, type) {
      workflowMessage.textContent = text;
      workflowMessage.classList.toggle("is-error", type === "error");
      workflowMessage.classList.toggle("is-success", type === "success");
      workflowMessage.classList.toggle("is-hint", type === "hint");
    }

    function nextNodeId() {
      nodeCounter += 1;
      return "node_" + nodeCounter;
    }

    function nextEdgeId() {
      edgeCounter += 1;
      return "edge_" + edgeCounter;
    }

    function findWorkflowNode(id) {
      return workflowState.nodes.find(function (node) { return node.id === id; });
    }

    function selectWorkflowNodes(nodeIds) {
      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = Array.from(new Set(nodeIds));
      refreshWorkflowSelection();
    }

    function clearWorkflowSelection() {
      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [];
      refreshWorkflowSelection();
    }

    function getWorkflowNodeBounds(node) {
      var size = getNodeSize(node);
      return {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + size.width,
        bottom: node.position.y + size.height
      };
    }

    function workflowBoundsIntersect(a, b) {
      return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
    }

    function refreshWorkflowSelection() {
      workflowNodeLayer.querySelectorAll(".workflow-node").forEach(function (element) {
        element.classList.toggle(
          "is-selected",
          selectedWorkflowNodeIds.indexOf(element.dataset.nodeId) > -1
        );
      });
      workflowEdgeLayer.querySelectorAll("path[data-edge-id]").forEach(function (path) {
        path.classList.toggle(
          "is-selected",
          selectedWorkflowItem && selectedWorkflowItem.type === "edge" && selectedWorkflowItem.id === path.dataset.edgeId
        );
      });
    }

    function getCanvasPoint(event) {
      var rect = workflowCanvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - workflowViewport.x) / workflowZoom,
        y: (event.clientY - rect.top - workflowViewport.y) / workflowZoom
      };
    }

    function getNodeSize(node) {
      return { width: 150, height: 54 };
    }

    function getHandlePoint(nodeId, handleType) {
      var node = findWorkflowNode(nodeId);
      var size = getNodeSize(node);
      var handlePoints = {
        top: { x: node.position.x + size.width / 2, y: node.position.y },
        right: { x: node.position.x + size.width, y: node.position.y + size.height / 2 },
        bottom: { x: node.position.x + size.width / 2, y: node.position.y + size.height },
        left: { x: node.position.x, y: node.position.y + size.height / 2 }
      };
      return handlePoints[handleType] || handlePoints.right;
    }

    function getHandleVector(handleType) {
      var vectors = {
        top: { x: 0, y: -1 },
        right: { x: 1, y: 0 },
        bottom: { x: 0, y: 1 },
        left: { x: -1, y: 0 }
      };
      return vectors[handleType] || vectors.right;
    }

    function buildWorkflowPath(sourcePoint, targetPoint, sourceHandle, targetHandle) {
      var sourceVector = getHandleVector(sourceHandle);
      var targetVector = getHandleVector(targetHandle);
      var sourceInset = 7;
      var targetInset = 14;
      var visibleSourcePoint = {
        x: sourcePoint.x + sourceVector.x * sourceInset,
        y: sourcePoint.y + sourceVector.y * sourceInset
      };
      var visibleTargetPoint = {
        x: targetPoint.x + targetVector.x * targetInset,
        y: targetPoint.y + targetVector.y * targetInset
      };
      var distance = Math.max(52, Math.min(120, Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y) * 0.25));
      return "M " + visibleSourcePoint.x + " " + visibleSourcePoint.y +
        " C " + (visibleSourcePoint.x + sourceVector.x * distance) + " " + (visibleSourcePoint.y + sourceVector.y * distance) +
        ", " + (visibleTargetPoint.x + targetVector.x * distance) + " " + (visibleTargetPoint.y + targetVector.y * distance) +
        ", " + visibleTargetPoint.x + " " + visibleTargetPoint.y;
    }

    function applyWorkflowViewport() {
      var transform = "translate(" + workflowViewport.x + "px, " + workflowViewport.y + "px) scale(" + workflowZoom + ")";
      workflowEdgeLayer.style.transform = transform;
      workflowNodeLayer.style.transform = transform;
      workflowCanvas.style.backgroundPosition = workflowViewport.x + "px " + workflowViewport.y + "px";
      workflowCanvas.style.backgroundSize = (28 * workflowZoom) + "px " + (28 * workflowZoom) + "px";
    }

    function renderWorkflowEdges(previewTarget) {
      workflowEdgeLayer.querySelectorAll(".workflow-edge-path, .workflow-edge-hit, .workflow-edge-preview").forEach(function (path) {
        path.remove();
      });

      workflowState.edges.forEach(function (edge) {
        if (!findWorkflowNode(edge.source) || !findWorkflowNode(edge.target)) {
          return;
        }

        var hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        edge.sourceHandle = edge.sourceHandle || "right";
        edge.targetHandle = edge.targetHandle || "left";
        var pathData = buildWorkflowPath(
          getHandlePoint(edge.source, edge.sourceHandle),
          getHandlePoint(edge.target, edge.targetHandle),
          edge.sourceHandle,
          edge.targetHandle
        );
        hitPath.setAttribute("d", pathData);
        hitPath.dataset.edgeId = edge.id;
        hitPath.classList.add("workflow-edge-hit");
        path.setAttribute("d", pathData);
        path.dataset.edgeId = edge.id;
        path.classList.add("workflow-edge-path");
        if (selectedWorkflowItem && selectedWorkflowItem.type === "edge" && selectedWorkflowItem.id === edge.id) {
          path.classList.add("is-selected");
          hitPath.classList.add("is-selected");
        }

        function selectEdge(event) {
          event.stopPropagation();
          selectedWorkflowItem = { type: "edge", id: edge.id };
          selectedWorkflowNodeIds = [];
          renderWorkflow();
        }

        hitPath.addEventListener("click", selectEdge);
        path.addEventListener("click", selectEdge);
        workflowEdgeLayer.appendChild(hitPath);
        workflowEdgeLayer.appendChild(path);
      });

      if (previewTarget && previewTarget.source) {
        var preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
        preview.setAttribute("d", buildWorkflowPath(
          getHandlePoint(previewTarget.source, previewTarget.sourceHandle),
          previewTarget.target,
          previewTarget.sourceHandle,
          previewTarget.targetHandle || "left"
        ));
        preview.classList.add("workflow-edge-preview");
        workflowEdgeLayer.appendChild(preview);
      }
    }

    function renderWorkflowNodes() {
      workflowNodeLayer.innerHTML = "";

      workflowState.nodes.forEach(function (node) {
        var element = document.createElement("div");
        var label = document.createElement("div");

        element.className = "workflow-node is-" + node.type;
        element.dataset.nodeId = node.id;
        element.style.left = node.position.x + "px";
        element.style.top = node.position.y + "px";
        if (selectedWorkflowNodeIds.indexOf(node.id) > -1) {
          element.classList.add("is-selected");
        }

        var labelText = document.createElement("span");
        var labelType = document.createElement("span");

        label.className = "workflow-node-label";
        labelText.textContent = node.label;
        labelType.className = "workflow-node-type";
        labelType.textContent = node.type;
        label.appendChild(labelText);
        label.appendChild(labelType);
        label.addEventListener("dblclick", function (event) {
          event.stopPropagation();
          startWorkflowInlineEdit(node.id, label);
        });

        workflowHandles.forEach(function (handleName) {
          var handle = document.createElement("span");
          handle.className = "workflow-handle is-" + handleName;
          handle.dataset.handle = handleName;
          handle.title = "Connect from " + handleName;
          handle.addEventListener("pointerdown", function (event) {
            event.preventDefault();
            event.stopPropagation();
            startWorkflowConnection(event, node.id, handleName);
          });
          element.appendChild(handle);
        });

        element.appendChild(label);
        element.addEventListener("pointerdown", function (event) {
          if (event.target.closest(".workflow-handle")) {
            return;
          }
          if (event.target.closest(".workflow-label-input")) {
            return;
          }
          if (event.detail > 1) {
            event.preventDefault();
            event.stopPropagation();
            startWorkflowInlineEdit(node.id, label);
            return;
          }
          event.stopPropagation();
          startWorkflowNodeDrag(event, node.id);
        });
        element.addEventListener("click", function (event) {
          event.stopPropagation();
          if (suppressWorkflowNodeClick) {
            return;
          }
          selectWorkflowNodes([node.id]);
        });
        element.addEventListener("dblclick", function (event) {
          if (event.target.closest(".workflow-handle")) {
            return;
          }
          event.stopPropagation();
          startWorkflowInlineEdit(node.id, label);
        });
        workflowNodeLayer.appendChild(element);
      });
    }

    function renderWorkflow() {
      workflowEdgeLayer.setAttribute("width", workflowWorkspace.width);
      workflowEdgeLayer.setAttribute("height", workflowWorkspace.height);
      applyWorkflowViewport();
      renderWorkflowNodes();
      window.requestAnimationFrame(function () {
        renderWorkflowEdges();
        renderDerivedStatuses();
      });
    }

    function startWorkflowPan(event) {
      if (event.button !== 0 || event.target.closest(".workflow-node") || event.target.closest("[data-edge-id]") || event.target.closest(".workflow-zoom-controls")) {
        return;
      }

      var start = { x: event.clientX, y: event.clientY };
      var startViewport = { x: workflowViewport.x, y: workflowViewport.y };
      var moved = false;

      workflowCanvas.classList.add("is-panning");

      function onPointerMove(moveEvent) {
        moved = true;
        workflowViewport.x = startViewport.x + moveEvent.clientX - start.x;
        workflowViewport.y = startViewport.y + moveEvent.clientY - start.y;
        applyWorkflowViewport();
      }

      function onPointerUp() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        workflowCanvas.classList.remove("is-panning");
        if (moved) {
          suppressWorkflowCanvasClick = true;
          window.setTimeout(function () {
            suppressWorkflowCanvasClick = false;
          }, 0);
        }
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    }

    function updateWorkflowPanMode() {
      workflowCanvas.classList.toggle("is-pan-mode", isWorkflowPanMode || isWorkflowSpaceDown);
    }

    function drawWorkflowSelectionBox(start, current) {
      var left = Math.min(start.x, current.x);
      var top = Math.min(start.y, current.y);
      var width = Math.abs(current.x - start.x);
      var height = Math.abs(current.y - start.y);
      workflowSelectionBox.style.left = left + "px";
      workflowSelectionBox.style.top = top + "px";
      workflowSelectionBox.style.width = width + "px";
      workflowSelectionBox.style.height = height + "px";
    }

    function getCanvasScreenPoint(event) {
      var rect = workflowCanvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    function startWorkflowSelection(event) {
      if (event.button !== 0 || event.target.closest(".workflow-node") || event.target.closest("[data-edge-id]") || event.target.closest(".workflow-zoom-controls")) {
        return;
      }

      var startScreen = getCanvasScreenPoint(event);
      var startWorld = getCanvasPoint(event);
      var moved = false;

      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [];
      workflowCanvas.classList.add("is-selecting");
      workflowSelectionBox.classList.add("is-visible");
      drawWorkflowSelectionBox(startScreen, startScreen);
      refreshWorkflowSelection();

      function onPointerMove(moveEvent) {
        var currentScreen = getCanvasScreenPoint(moveEvent);
        var currentWorld = getCanvasPoint(moveEvent);
        var selectionDistance = Math.hypot(currentScreen.x - startScreen.x, currentScreen.y - startScreen.y);

        if (selectionDistance > 4) {
          moved = true;
        }

        drawWorkflowSelectionBox(startScreen, currentScreen);

        var selectionBounds = {
          left: Math.min(startWorld.x, currentWorld.x),
          top: Math.min(startWorld.y, currentWorld.y),
          right: Math.max(startWorld.x, currentWorld.x),
          bottom: Math.max(startWorld.y, currentWorld.y)
        };

        selectedWorkflowNodeIds = workflowState.nodes
          .filter(function (node) { return workflowBoundsIntersect(getWorkflowNodeBounds(node), selectionBounds); })
          .map(function (node) { return node.id; });
        refreshWorkflowSelection();
      }

      function onPointerUp() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        workflowCanvas.classList.remove("is-selecting");
        workflowSelectionBox.classList.remove("is-visible");
        if (!moved) {
          selectedWorkflowNodeIds = [];
          refreshWorkflowSelection();
        }
        suppressWorkflowCanvasClick = true;
        window.setTimeout(function () {
          suppressWorkflowCanvasClick = false;
        }, 0);
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    }

    function startWorkflowCanvasPointerDown(event) {
      if (isWorkflowPanMode || isWorkflowSpaceDown) {
        startWorkflowPan(event);
        return;
      }
      startWorkflowSelection(event);
    }

    function startWorkflowNodeDrag(event, nodeId) {
      var node = findWorkflowNode(nodeId);
      var startPoint = getCanvasPoint(event);
      var selectedNodes = selectedWorkflowNodeIds.indexOf(nodeId) > -1 ? selectedWorkflowNodeIds : [nodeId];
      var startPositions = {};
      var moved = false;

      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = selectedNodes;
      selectedNodes.forEach(function (selectedNodeId) {
        var selectedNode = findWorkflowNode(selectedNodeId);
        if (selectedNode) {
          startPositions[selectedNodeId] = { x: selectedNode.position.x, y: selectedNode.position.y };
        }
      });
      refreshWorkflowSelection();

      function onPointerMove(moveEvent) {
        var point = getCanvasPoint(moveEvent);
        var dx = point.x - startPoint.x;
        var dy = point.y - startPoint.y;
        moved = true;

        selectedNodes.forEach(function (selectedNodeId) {
          var selectedNode = findWorkflowNode(selectedNodeId);
          var selectedStartPosition = startPositions[selectedNodeId];
          if (!selectedNode || !selectedStartPosition) {
            return;
          }
          var size = getNodeSize(selectedNode);
          selectedNode.position.x = Math.max(12, Math.min(workflowWorkspace.width - size.width - 12, selectedStartPosition.x + dx));
          selectedNode.position.y = Math.max(12, Math.min(workflowWorkspace.height - size.height - 12, selectedStartPosition.y + dy));
        });
        renderWorkflowNodes();
        renderWorkflowEdges();
      }

      function onPointerUp() {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        suppressWorkflowCanvasClick = true;
        suppressWorkflowNodeClick = moved;
        window.setTimeout(function () {
          suppressWorkflowCanvasClick = false;
          suppressWorkflowNodeClick = false;
        }, 0);
        if (moved) {
          renderWorkflow();
        }
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    }

    function getNearestHandle(nodeId, point) {
      var sides = workflowHandles.map(function (handleName) {
        var handlePoint = getHandlePoint(nodeId, handleName);
        return {
          handle: handleName,
          distance: Math.hypot(handlePoint.x - point.x, handlePoint.y - point.y)
        };
      });
      sides.sort(function (a, b) { return a.distance - b.distance; });
      return sides[0].handle;
    }

    function startWorkflowConnection(event, sourceId, sourceHandle) {
      var preview = { source: sourceId, sourceHandle: sourceHandle, target: getCanvasPoint(event) };

      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [];
      renderWorkflowEdges(preview);

      function onPointerMove(moveEvent) {
        preview.target = getCanvasPoint(moveEvent);
        renderWorkflowEdges(preview);
      }

      function onPointerUp(upEvent) {
        var targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        var targetHandleElement = targetElement ? targetElement.closest(".workflow-handle") : null;
        var targetNode = targetElement ? targetElement.closest(".workflow-node") : null;
        var targetId = targetNode ? targetNode.dataset.nodeId : "";
        var targetPoint = getCanvasPoint(upEvent);
        var targetHandle = targetHandleElement ? targetHandleElement.dataset.handle : (targetId ? getNearestHandle(targetId, targetPoint) : "");

        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);

        if (targetId && targetId !== sourceId) {
          var exists = workflowState.edges.some(function (edge) {
            return edge.source === sourceId && edge.target === targetId;
          });
          if (!exists) {
            workflowState.edges.push({
              id: nextEdgeId(),
              source: sourceId,
              sourceHandle: sourceHandle,
              target: targetId,
              targetHandle: targetHandle
            });
            setWorkflowMessage("Connection added. Save Workflow to keep it after refresh.", "");
          }
        }
        renderWorkflow();
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    }

    function startWorkflowInlineEdit(nodeId, labelElement) {
      var node = findWorkflowNode(nodeId);
      var originalLabel = node.label;
      var input = document.createElement("input");
      var isCanceled = false;

      input.className = "workflow-label-input";
      input.type = "text";
      input.value = originalLabel;
      labelElement.innerHTML = "";
      labelElement.appendChild(input);
      input.focus();
      input.select();

      function finishEdit() {
        var nextLabel = input.value.trim();
        if (isCanceled) {
          node.label = originalLabel;
          renderWorkflow();
          return;
        }
        if (!nextLabel) {
          node.label = originalLabel;
          renderWorkflow();
          setWorkflowMessage("Node labels cannot be blank.", "error");
          return;
        }
        node.label = nextLabel;
        setWorkflowMessage("Node renamed. Save Workflow to keep the change.", "");
        renderWorkflow();
      }

      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          isCanceled = true;
          input.blur();
        }
      });

      input.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("blur", finishEdit, { once: true });
    }

    function renameWorkflowNode(nodeId) {
      var nodeElement = workflowNodeLayer.querySelector('[data-node-id="' + nodeId + '"]');
      var labelElement = nodeElement ? nodeElement.querySelector(".workflow-node-label") : null;
      if (!labelElement) {
        setWorkflowMessage("Node labels cannot be blank.", "error");
        return;
      }
      startWorkflowInlineEdit(nodeId, labelElement);
    }

    function deleteSelectedWorkflowItem() {
      if (!selectedWorkflowItem && !selectedWorkflowNodeIds.length) {
        setWorkflowMessage("Select a node or connection first.", "error");
        return;
      }

      if (selectedWorkflowNodeIds.length) {
        var selectedNodeLookup = {};
        selectedWorkflowNodeIds.forEach(function (nodeId) {
          selectedNodeLookup[nodeId] = true;
        });
        workflowState.nodes = workflowState.nodes.filter(function (node) {
          return !selectedNodeLookup[node.id];
        });
        workflowState.edges = workflowState.edges.filter(function (edge) {
          return !selectedNodeLookup[edge.source] && !selectedNodeLookup[edge.target];
        });
      }

      if (selectedWorkflowItem && selectedWorkflowItem.type === "edge") {
        workflowState.edges = workflowState.edges.filter(function (edge) {
          return edge.id !== selectedWorkflowItem.id;
        });
      }

      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [];
      setWorkflowMessage("Selected item deleted. Save Workflow to keep the change.", "");
      renderWorkflow();
    }

    function addWorkflowNode() {
      var count = workflowState.nodes.length;
      var node = {
        id: nextNodeId(),
        type: "process",
        label: "New Status",
        position: { x: 90 + (count % 4) * 210, y: 110 + Math.floor(count / 4) * 150 }
      };
      workflowState.nodes.push(node);
      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [node.id];
      setWorkflowMessage("Process node added.", "");
      renderWorkflow();
    }

    function getWorkflowWarnings() {
      var warnings = [];
      var processNodes = workflowState.nodes.filter(function (node) { return node.type === "process"; });
      var labels = {};

      if (!workflowState.nodes.length) {
        warnings.push("Workflow must not be empty.");
      }

      if (!processNodes.length) {
        warnings.push("At least one process node is required.");
      }

      processNodes.forEach(function (node) {
        var label = node.label.trim().toLowerCase();
        if (!label) {
          warnings.push("Process node labels cannot be blank.");
        }
        if (labels[label]) {
          warnings.push("Duplicate process status: " + node.label + ".");
        }
        labels[label] = true;
      });

      workflowState.edges.forEach(function (edge) {
        if (!findWorkflowNode(edge.source) || !findWorkflowNode(edge.target)) {
          warnings.push("A connection has a missing source or target.");
        }
      });

      return warnings;
    }

    function getBlockingWorkflowErrors(warnings) {
      return warnings.filter(function (warning) {
        return warning.indexOf("must not be empty") > -1 ||
          warning.indexOf("At least one process") > -1 ||
          warning.indexOf("cannot be blank") > -1 ||
          warning.indexOf("Duplicate process") > -1 ||
          warning.indexOf("missing source") > -1;
      });
    }

    function saveWorkflow() {
      var warnings = getWorkflowWarnings();
      var blockers = getBlockingWorkflowErrors(warnings);

      if (blockers.length) {
        setWorkflowMessage(blockers[0], "error");
        return;
      }

      var diagram = cloneWorkflow(workflowState);
      diagram.viewport = { x: workflowViewport.x, y: workflowViewport.y, zoom: workflowZoom };
      setWorkflowMessage("Saving workflow...", "hint");
      apiFetch("/api/v1/workflow", {
        method: "POST",
        body: JSON.stringify({
          workflowName: "Default Workflow",
          diagram: diagram
        })
      }).then(function (payload) {
        workflowState = cloneWorkflow(payload.diagram || diagram);
        normalizeWorkflowState();
        setWorkflowMessage(warnings.length ? "Saved with warning: " + warnings[0] : "Workflow saved.", "success");
        renderWorkflow();
      }).catch(function (error) {
        setWorkflowMessage(error.message || "Workflow could not be saved.", "error");
      });
    }

    function clearWorkflow() {
      workflowState = { nodes: [], edges: [] };
      selectedWorkflowItem = null;
      selectedWorkflowNodeIds = [];
      workflowViewport = { x: 0, y: 0 };
      workflowZoom = 1;
      setWorkflowMessage("Canvas cleared. Add process nodes to build a new workflow.", "");
      renderWorkflow();
    }

    function normalizeWorkflowState() {
      workflowState.nodes = Array.isArray(workflowState.nodes) ? workflowState.nodes.filter(function (node) {
        return node.type === "process";
      }) : [];
      workflowState.edges = Array.isArray(workflowState.edges) ? workflowState.edges : [];
      var allowedNodeIds = {};
      workflowState.nodes.forEach(function (node) {
        allowedNodeIds[node.id] = true;
      });
      workflowState.edges = workflowState.edges.filter(function (edge) {
        return allowedNodeIds[edge.source] && allowedNodeIds[edge.target];
      });
      workflowState.edges.forEach(function (edge) {
        edge.sourceHandle = edge.sourceHandle || "right";
        edge.targetHandle = edge.targetHandle || "left";
      });
      nodeCounter = workflowState.nodes.reduce(function (highest, node) {
        var number = parseInt(String(node.id).replace(/\D/g, ""), 10);
        return Number.isNaN(number) ? highest : Math.max(highest, number);
      }, 20);
      edgeCounter = workflowState.edges.reduce(function (highest, edge) {
        var number = parseInt(String(edge.id).replace(/\D/g, ""), 10);
        return Number.isNaN(number) ? highest : Math.max(highest, number);
      }, 20);
    }

    function loadWorkflow() {
      setWorkflowMessage("Loading workflow...", "hint");
      return apiFetch("/api/v1/workflow").then(function (payload) {
        workflowState = cloneWorkflow(payload.diagram || defaultWorkflow);
        if (workflowState.viewport) {
          workflowViewport = {
            x: Number(workflowState.viewport.x) || 0,
            y: Number(workflowState.viewport.y) || 0
          };
          workflowZoom = Number(workflowState.viewport.zoom) || 1;
          delete workflowState.viewport;
        } else {
          workflowViewport = { x: 0, y: 0 };
          workflowZoom = 1;
        }
        normalizeWorkflowState();
        setWorkflowMessage("Workflow loaded from database.", "success");
        renderWorkflow();
      }).catch(function (error) {
        if (error.status === 404) {
          workflowState = cloneWorkflow(defaultWorkflow);
          normalizeWorkflowState();
          workflowViewport = { x: 0, y: 0 };
          workflowZoom = 1;
          setWorkflowMessage("Default workflow loaded. Save Workflow to store it.", "hint");
          renderWorkflow();
          return;
        }
        workflowState = cloneWorkflow(defaultWorkflow);
        normalizeWorkflowState();
        workflowViewport = { x: 0, y: 0 };
        workflowZoom = 1;
        setWorkflowMessage(error.message || "Workflow could not be loaded. Showing default workflow.", "error");
        renderWorkflow();
      });
    }

    function setWorkflowZoom(nextZoom) {
      workflowZoom = Math.max(0.65, Math.min(1.35, nextZoom));
      applyWorkflowViewport();
      renderWorkflowEdges();
    }

    function deriveWorkflowTransitions() {
      var nodesById = {};
      var outgoingByNode = {};
      var transitions = {};

      workflowState.nodes.forEach(function (node) {
        nodesById[node.id] = node;
        outgoingByNode[node.id] = [];
      });

      workflowState.edges.forEach(function (edge) {
        if (outgoingByNode[edge.source]) {
          outgoingByNode[edge.source].push(edge.target);
        }
      });

      workflowState.nodes.forEach(function (node) {
        if (node.type !== "process") {
          return;
        }

        var nextStatuses = [];

        outgoingByNode[node.id].forEach(function (targetId) {
          var targetNode = nodesById[targetId];
          if (!targetNode) {
            return;
          }

          if (targetNode.type === "process") {
            nextStatuses.push(targetNode.label);
          }

        });

        transitions[node.label] = Array.from(new Set(nextStatuses));
      });

      return transitions;
    }

    function renderDerivedStatuses() {
      var transitions = deriveWorkflowTransitions();
      workflowDerived.innerHTML = "";
      var label = document.createElement("span");
      label.className = "workflow-derived-label";
      label.textContent = "Allowed transitions";
      workflowDerived.appendChild(label);
      Object.keys(transitions).forEach(function (status) {
        if (!transitions[status].length) {
          var terminalPill = document.createElement("span");
          terminalPill.className = "workflow-derived-pill";
          terminalPill.textContent = status + " -> No next status";
          workflowDerived.appendChild(terminalPill);
          return;
        }
        transitions[status].forEach(function (nextStatus) {
          var pill = document.createElement("span");
          pill.className = "workflow-derived-pill";
          pill.textContent = status + " -> " + nextStatus;
          workflowDerived.appendChild(pill);
        });
      });
    }

    workflowEditor.querySelector("[data-workflow-add-process]").addEventListener("click", function () {
      addWorkflowNode();
    });

    workflowEditor.querySelector("[data-workflow-save]").addEventListener("click", saveWorkflow);
    workflowEditor.querySelector("[data-workflow-clear]").addEventListener("click", clearWorkflow);
    workflowEditor.querySelector("[data-workflow-delete]").addEventListener("click", deleteSelectedWorkflowItem);
    workflowEditor.querySelector("[data-workflow-zoom-in]").addEventListener("click", function (event) {
      event.stopPropagation();
      setWorkflowZoom(workflowZoom + 0.1);
    });
    workflowEditor.querySelector("[data-workflow-zoom-out]").addEventListener("click", function (event) {
      event.stopPropagation();
      setWorkflowZoom(workflowZoom - 0.1);
    });

    workflowCanvas.addEventListener("pointerdown", startWorkflowCanvasPointerDown);

    workflowCanvas.addEventListener("click", function (event) {
      if (suppressWorkflowCanvasClick) {
        return;
      }
      if (event.target === workflowCanvas || event.target === workflowEdgeLayer) {
        clearWorkflowSelection();
      }
    });

    workflowCanvas.addEventListener("dblclick", function (event) {
      if (event.target.closest(".workflow-node") || event.target.closest("[data-edge-id]") || event.target.closest(".workflow-zoom-controls")) {
        return;
      }
      event.preventDefault();
      isWorkflowPanMode = !isWorkflowPanMode;
      updateWorkflowPanMode();
      setWorkflowMessage(isWorkflowPanMode ? "Pan mode. Double-click to select." : "Tip: double-click empty canvas to pan.", isWorkflowPanMode ? "hint" : "hint");
    });

    workflowCanvas.addEventListener("keydown", function (event) {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedWorkflowItem();
      }
    });

    document.addEventListener("keydown", function (event) {
      var activeElement = document.activeElement;
      var isTyping = activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable
      );
      if (event.code === "Space" && isTyping) {
        return;
      }
      if (event.code === "Space" && activeElement !== document.body && !workflowEditor.contains(activeElement)) {
        return;
      }
      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        isWorkflowSpaceDown = true;
        updateWorkflowPanMode();
      }
    });

    document.addEventListener("keyup", function (event) {
      if (event.code === "Space") {
        isWorkflowSpaceDown = false;
        updateWorkflowPanMode();
      }
    });

    loadWorkflow();
  }

  applyAutocompletePolicy(document);
  if (window.MutationObserver && document.body) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
          if (node.nodeType === 1) applyAutocompletePolicy(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.querySelectorAll("[data-demo-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var message = form.querySelector("[data-form-message]");
      if (form.closest(".login-page")) {
        if (validateLoginForm(form)) {
          performLogin(form);
        }
        return;
      }
      if (form.id === "defectEditForm") {
        saveDefectEdit();
        return;
      }
      if (form === defectCreateForm) {
        submitCreateDefect(false);
        return;
      }
      if (form.querySelector("#title")) {
        validateDefectForm(form);
        return;
      }
      setValidationMessage(message, form.getAttribute("data-form-success") || "Saved for review.", "success");
    });
  });

  document.querySelectorAll(".comment-entry").forEach(function (entry) {
    var textarea = entry.querySelector("textarea");
    var button = entry.querySelector("button");
    if (!textarea || !button) return;
    button.addEventListener("click", function () {
      var state = createValidationState(entry, null);
      requiredField(state, textarea);
      minLengthField(state, textarea, 2);
      maxLengthField(state, textarea, 2000);
      if (!finishValidation(state, "")) return;
      if (defectEditForm && defectEditForm.contains(entry) && activeEditDefect) {
        button.disabled = true;
        apiFetch("/api/v1/defects/" + encodeURIComponent(activeEditDefect.id) + "/comments", {
          method: "POST",
          body: JSON.stringify({ commentText: textarea.value.trim() })
        }).then(function () {
          textarea.value = "";
          return Promise.all([
            apiFetch("/api/v1/defects/" + encodeURIComponent(activeEditDefect.id)),
            apiFetch("/api/v1/defects/" + encodeURIComponent(activeEditDefect.id) + "/history?page=1&pageSize=100")
          ]);
        }).then(function (results) {
          activeEditDefect = results[0];
          renderEditComments(results[0].comments || []);
          renderEditHistory(results[1].items || []);
        }).catch(function (error) {
          showValidationToast(error.message || "Unable to add comment.");
        }).finally(function () {
          button.disabled = false;
        });
        return;
      }
      textarea.value = "";
      textarea.placeholder = "Comment added for review";
    });
  });
})();


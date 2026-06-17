(function () {
  var environments = [
    { name: "DEV", scope: "Test", description: "Developer integration and early validation." },
    { name: "SIT", scope: "Test", description: "System integration testing environment." },
    { name: "UAT", scope: "Test", description: "User acceptance testing with business users." },
    { name: "Pre-Prod", scope: "Test", description: "Production-like release validation." },
    { name: "PROD", scope: "Prod", description: "Production defect tracking." }
  ];

  var projects = [
    { name: "Claims Portal", description: "Customer claim intake and processing workflow.", status: "Active" },
    { name: "Billing Core", description: "Invoice, tax, and payment calculation services.", status: "Active" },
    { name: "Mobile QA", description: "Mobile application regression and release testing.", status: "Active" },
    { name: "Legacy CRM", description: "Legacy support and controlled maintenance.", status: "Inactive" }
  ];

  var defects = [
    { id: "DF-1042", title: "Invoice total mismatch after tax recalculation", description: "Invoice total changes after refreshing the payment review screen.", project: "Billing Core", environment: "UAT", severity: "High", priority: "P1", status: "In Progress", assignedTo: "Aisha Khan", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-21" },
    { id: "DF-1037", title: "Attachment preview fails for PNG screenshots", description: "Preview modal does not render PNG evidence files.", project: "Claims Portal", environment: "SIT", severity: "Medium", priority: "P2", status: "Assigned", assignedTo: "Omar Salem", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-18" },
    { id: "DF-1029", title: "UAT users are logged out before timeout policy", description: "Session expires earlier than the configured timeout.", project: "Claims Portal", environment: "UAT", severity: "Critical", priority: "P1", status: "Reopened", assignedTo: "Leena Faris", releaseVersion: "2026.03", createdBy: "qa.user", createdDate: "2026-04-10" },
    { id: "DF-1018", title: "Project filter does not persist after refresh", description: "Selected project filter resets after screen refresh.", project: "Mobile QA", environment: "SIT", severity: "Low", priority: "P4", status: "Closed", assignedTo: "Fahad Noor", releaseVersion: "2026.02", createdBy: "qa.user", createdDate: "2026-03-05", closureDate: "2026-03-12" },
    { id: "DF-1051", title: "Retest evidence missing from closure package", description: "Closure package does not include retest evidence.", project: "Claims Portal", environment: "Pre-Prod", severity: "Medium", priority: "P2", status: "Retest", assignedTo: "Omar Salem", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-23" },
    { id: "DF-1054", title: "Payment retry creates duplicate transaction note", description: "Retry action adds the same transaction note twice.", project: "Billing Core", environment: "SIT", severity: "High", priority: "P1", status: "Fixed", assignedTo: "Aisha Khan", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-24", fixDate: "2026-04-28" },
    { id: "DF-1057", title: "Mobile date picker allows invalid deployment date", description: "Invalid future deployment date can be selected.", project: "Mobile QA", environment: "DEV", severity: "Low", priority: "P3", status: "New", assignedTo: "Leena Faris", releaseVersion: "2026.03", createdBy: "qa.user", createdDate: "2026-04-25" },
    { id: "DF-1062", title: "Production incident summary missing assignee", description: "Production incident summary renders without assignee details.", project: "Claims Portal", environment: "PROD", severity: "Critical", priority: "P1", status: "Developer Rejected", assignedTo: "Fahad Noor", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-26" },
    { id: "DF-1066", title: "Assigned again defects do not notify developers", description: "Assigned Again status does not notify the developer queue.", project: "Billing Core", environment: "UAT", severity: "Medium", priority: "P2", status: "Assigned Again", assignedTo: "Aisha Khan", releaseVersion: "2026.04", createdBy: "qa.user", createdDate: "2026-04-26" },
    { id: "DF-1070", title: "Configuration label is reported as a defect", description: "Configuration message appears in defect export.", project: "Mobile QA", environment: "UAT", severity: "Low", priority: "P4", status: "Not a Defect", assignedTo: "Omar Salem", releaseVersion: "2026.02", createdBy: "qa.user", createdDate: "2026-04-27" },
    { id: "DF-1074", title: "Supplier upload accepts duplicate email across companies", description: "Duplicate supplier email is accepted across company profiles.", project: "Claims Portal", environment: "UAT", severity: "High", priority: "P1", status: "New", assignedTo: "Fahad Noor", releaseVersion: "2026.05", createdBy: "qa.user", createdDate: "2026-04-28" },
    { id: "DF-1078", title: "Report export drops release deployment date", description: "Export file omits the release deployment date column.", project: "Billing Core", environment: "UAT", severity: "Medium", priority: "P2", status: "Assigned", assignedTo: "Leena Faris", releaseVersion: "2026.05", createdBy: "qa.user", createdDate: "2026-04-28" },
    { id: "DF-1081", title: "Closed defect appears in open aging view", description: "Closed record is still counted in open aging summary.", project: "Mobile QA", environment: "Pre-Prod", severity: "Medium", priority: "P3", status: "Closed", assignedTo: "Aisha Khan", releaseVersion: "2026.03", createdBy: "qa.user", createdDate: "2026-04-12", closureDate: "2026-04-20" },
    { id: "DF-1086", title: "Search does not include actual result text", description: "Defect search ignores actual result content.", project: "Claims Portal", environment: "SIT", severity: "Low", priority: "P4", status: "Fixed", assignedTo: "Omar Salem", releaseVersion: "2026.05", createdBy: "qa.user", createdDate: "2026-04-29", fixDate: "2026-05-01" },
    { id: "DF-1090", title: "Critical production issue cannot be reassigned", description: "Production defect ownership cannot be changed from detail view.", project: "Billing Core", environment: "PROD", severity: "Critical", priority: "P1", status: "In Progress", assignedTo: "Leena Faris", releaseVersion: "2026.05", createdBy: "qa.user", createdDate: "2026-04-30" },
    { id: "DF-1094", title: "Retest result saves without attachment evidence", description: "Retest status can be saved without required evidence.", project: "Mobile QA", environment: "UAT", severity: "High", priority: "P2", status: "Retest", assignedTo: "Fahad Noor", releaseVersion: "2026.05", createdBy: "qa.user", createdDate: "2026-04-30" },
    { id: "DF-1098", title: "Legacy case search returns stale customer status", description: "Inactive project record used to validate active-project filtering.", project: "Legacy CRM", environment: "UAT", severity: "Low", priority: "P3", status: "New", assignedTo: "Omar Salem", releaseVersion: "2026.01", createdBy: "qa.user", createdDate: "2026-04-22" },
    { id: "DF-1101", title: "Legacy production export times out", description: "Inactive production project record kept out of operational dashboards.", project: "Legacy CRM", environment: "PROD", severity: "High", priority: "P2", status: "In Progress", assignedTo: "Aisha Khan", releaseVersion: "2026.01", createdBy: "qa.user", createdDate: "2026-04-29" }
  ];

  function normalizeContext(context) {
    return ["Test", "Prod", "All"].indexOf(context) > -1 ? context : "Test";
  }

  function isProdEnvironment(environmentName) {
    return String(environmentName || "").toUpperCase() === "PROD";
  }

  function cloneRecord(record) {
    return Object.assign({}, record);
  }

  function cloneProject(project) {
    return Object.assign({}, project);
  }

  function isActiveProject(projectName) {
    var project = projects.find(function (item) {
      return item.name === projectName;
    });
    return !project || project.status === "Active";
  }

  function getEnvironmentsForContext(context) {
    var activeContext = normalizeContext(context);
    return environments.filter(function (environment) {
      if (activeContext === "All") return true;
      if (activeContext === "Prod") return environment.scope === "Prod";
      return environment.scope !== "Prod";
    }).map(function (environment) {
      return Object.assign({}, environment);
    });
  }

  function getDefectsForContext(context) {
    var activeContext = normalizeContext(context);
    return defects.filter(function (defect) {
      if (!isActiveProject(defect.project)) return false;
      if (activeContext === "All") return true;
      if (activeContext === "Prod") return isProdEnvironment(defect.environment);
      return !isProdEnvironment(defect.environment);
    }).map(cloneRecord);
  }

  function getProjects() {
    return projects.map(cloneProject);
  }

  window.DefectTrackerData = {
    contexts: ["Test", "Prod", "All"],
    defects: defects,
    environments: environments,
    projects: projects,
    normalizeContext: normalizeContext,
    isProdEnvironment: isProdEnvironment,
    isActiveProject: isActiveProject,
    getDefectsForContext: getDefectsForContext,
    getEnvironmentsForContext: getEnvironmentsForContext,
    getProjects: getProjects
  };
})();

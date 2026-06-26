# Defect Tracker UI Validation Rules

This file documents the Phase 1 static UI validation contract. The rules are frontend-only and prepare the UI for the later Flask/PostgreSQL validation layer.

## Error Display Pattern

- Standard form fields show a red border and a short inline message below the controller.
- Modal forms also show a compact message in the existing modal message area.
- Inline table edits use a red field border and native tooltip text to avoid changing row height.
- The first invalid field receives focus.
- A compact validation summary can appear for submit blockers, especially for inline table edits where row height must remain fixed.
- Form and modal summaries must not duplicate field-level messages when the field already shows its own inline error.
- Committed data changes should use a centered confirmation dialog; lightweight feedback should be contextual to the section that triggered it.
- Success messages stay short and use existing page/modal message areas.
- Operational application fields should suppress browser cache suggestions with `autocomplete="off"` unless the field has a specific authentication/password purpose.
- App forms use `novalidate` so browser-native validation bubbles do not compete with the branded validation pattern.

## Message Copy Contract

- Validation message wording is parameterized in `js/app.js` through the shared validation message catalog.
- Field-specific errors should start with the field label, for example `Project Name is required.`
- Length errors should use the same sentence shape, for example `Title must be 120 characters or less.`
- Relationship errors should name both controllers, for example `Closure Date must be on or after Fix Date.`
- Attachment errors may lead with the file name because the file is the most useful thing for the user to identify.
- Phase 2 should move these message keys/patterns into Flask/server constants or a shared validation module. Do not store validation message copy in the database unless administrators need to edit the wording from the product UI.

## Shared Rules

- Required text fields cannot be blank after trimming spaces.
- Optional text fields are validated only when a value is entered.
- Email fields must use a standard `name@example.com` format.
- Password fields require at least 8 characters where a new password is created or reset.
- Password confirmation must match the new password.
- New password must be different from the current/previous password.
- Attachment uploads allow only `png`, `jpg`, `jpeg`, `pdf`, `doc`, `docx`, `txt`, `log`, and `json`.
- Attachment uploads allow a maximum of 10 files.
- Attachment uploads allow a maximum of 5 MB per file.
- Date ranges must end on or after the start date.

## Login Page

- Username is required.
- Username must be at least 3 characters.
- Password is required.
- Data Context must be one of `Test`, `Prod`, or `All`.

## Dashboard Page

- Dashboard filters are optional.
- Search must be 80 characters or less.
- Created To must be on or after Created From.
- Add Chart:
  - Chart Type is required.
  - Group By is required.
  - Chart Title is optional, but must be 80 characters or less when entered.
  - For stacked charts, Stack By must be different from Group By.

## Defect List Page

- Defect filters are optional.
- Search must be 80 characters or less.
- Apply Filters blocks only when the search value exceeds the limit.

## Create Defect Page

- Title is required.
- Title must be 5 to 120 characters.
- Description is required.
- Description must be 10 to 1000 characters.
- Project is required.
- Environment Identified is required.
- Severity is required.
- Priority is required.
- Status is required.
- Assigned To is required.
- Module / Component is optional, max 80 characters.
- Steps to Replicate is optional, max 4000 characters.
- Expected Result is required, max 1500 characters.
- Actual Result is required, max 1500 characters.
- Created By is read-only and not user-editable.
- Attachments follow the shared attachment rules.

## Edit Defect Page

- Project is required.
- Environment is required.
- Status is required.
- Assigned To is required.
- Description is required.
- Description must be 10 to 1000 characters.
- Module is optional, max 80 characters.
- Steps to Replicate is optional, max 4000 characters.
- Expected Result is required, max 1500 characters.
- Actual Result is required, max 1500 characters.
- Attachments follow the shared attachment rules.
- When Status is `Fixed`:
  - Release Version is required and must be 80 characters or less.
  - Release Deployment Date is required.
  - Fix Date is required.
- Fix Date cannot be greater than today.
- Closure Date is enabled only when Status is `Closed`.
- When Status is `Closed`:
  - Closure Date is required.
- Closure Date must be on or after Fix Date when both are entered.
- Comment entry requires 2 to 500 characters.

## Projects Page

- Project Name is required.
- Project Name must be 80 characters or less.
- Project Name must be unique in the project table.
- Description is optional, max 180 characters.
- Status must remain `Active` or `Inactive`.
- The same rules apply to both Add Project and inline Edit Project.

## Users Page

- Add User modal:
  - Name is required.
  - Name must be 2 to 80 characters.
  - Email is required and must be valid.
  - Email must be unique in the user table.
  - Username is required.
  - Username must be 3 to 40 characters.
  - Username may use letters, numbers, dots, hyphens, and underscores.
  - Username must be unique in the user table.
  - Password is required and must be at least 8 characters.
  - Confirm Password is required and must match Password.
  - Status must remain `Active` or `Inactive`.
  - Default Context must be one of `Test`, `Prod`, or `All`.
- Inline Edit User:
  - Name, Email, Username, and Status follow the same non-password rules.
- Reset Password modal:
  - Previous Password is required.
  - New Password is required and must be at least 8 characters.
  - Confirm Password is required and must match New Password.
  - New Password must be different from Previous Password.
- Profile modal:
  - Email is required and must be valid.
  - Save requires either a changed Email or a complete password change.
  - No-change saves show one profile-level message: `Update email or enter a new password.`
  - Field-level password mismatch copy stays short: `Passwords must match.`
  - Password fields are optional as a group only when Email has changed.
  - If any password field is entered, Current Password, New Password, and Confirm Password are all required.
  - New Password must be at least 8 characters.
  - Confirm Password must match New Password.
  - New Password must be different from Current Password.

## Environments Page

- Environment Name is required.
- Environment Name must be 80 characters or less.
- Environment Name must be unique in the environment table.
- Description is optional, max 180 characters.
- Status must remain `Active` or `Inactive`.
- The same rules apply to both Add Environment and inline Edit Environment.

## Status Workflow Page

- Workflow must not be empty.
- At least one process node is required.
- Process node labels cannot be blank.
- Process node labels must be unique.
- Every connection must have a valid source and target.
- Save is blocked for empty workflow, missing process node, blank labels, duplicate process labels, or broken connections.
- Non-blocking warnings may be shown for future workflow-quality checks.

## Reports Page

- Reports are hidden from navigation for Phase 2, but the static page retains validation.
- Date To must be on or after Date From.
- Report filters are optional.

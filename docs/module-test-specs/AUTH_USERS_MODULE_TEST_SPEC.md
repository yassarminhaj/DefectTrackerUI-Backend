# Auth And Users Module Test Spec

Purpose: capture the expected behavior for the wired Auth + Users slice so manual QA and later automation can test it without rediscovering the intent.

Scope:

- Login and session context.
- Auth refresh/logout/profile/password.
- Users list/create/edit/password reset.
- Database persistence for `app_users` and `user_password_events`.

Out of scope:

- Roles and permissions.
- Email OTP or password recovery.
- Production JWT/token revocation hardening.
- User default context edit from inline UI.

## Preconditions

- Application is running from `defect-tracker`.
- `.env` points to the intended PostgreSQL database through `DATABASE_URL`.
- Seeded local user exists, usually `qa.user`.
- UI is opened through Flask, not direct file open.

## Auth Test Cases

| ID | Scenario | Steps | Expected UI/API Result | Expected DB Result |
|---|---|---|---|---|
| AUTH-UI-001 | Login uses saved default context | Create or use a user with `default_data_context = Prod`. Login without selecting a login context. | Login succeeds and active context shown in sidebar is `Prod`. | No change to `app_users.default_data_context`. |
| AUTH-UI-002 | Login explicit context override | Login as the same user and select `All` before submit. | Login succeeds and active context is `All`. | Saved default remains `Prod`. |
| AUTH-UI-003 | Invalid password rejected | Login with valid username and wrong password. | Login remains on login page with readable error. | `last_login_at` is not updated for that failed login. |
| AUTH-UI-004 | Inactive user rejected | Set a user inactive, then attempt login. | Login fails with invalid credentials style message. | No session is created. |
| AUTH-API-005 | Authenticated profile load | Login, open profile modal. | Current email loads from `GET /api/v1/auth/me`. | No DB change. |
| AUTH-API-006 | Email-only profile update | Change only email and save. | Centered confirmation dialog appears. Stored UI user email updates from API response. | `app_users.email`, `updated_at`, and `updated_by_user_id` update. |
| AUTH-API-007 | Profile save with no changes | Open profile and save without email/password change. | Save is blocked with contextual validation message. | No DB change. |
| AUTH-API-008 | Self password change wrong previous password | Enter wrong current password and matching new password. | API returns error, modal shows readable failure. | Password hash and password events remain unchanged. |
| AUTH-API-009 | Self password change succeeds | Enter correct current password and valid new/confirm password. | Confirmation dialog asks user to go to login. Existing session is cleared. | `app_users.password_hash` changes and `user_password_events.change_type = self_change` row is inserted. |
| AUTH-API-010 | Refresh token retries protected request | Use an expired/invalid access token with a valid refresh token and request a protected endpoint. | UI refreshes token and retries once. | No business table change. |
| AUTH-API-011 | Refresh failure shows session expired | Use invalid access and refresh tokens, then request a protected endpoint. | Centered session-expired dialog appears; user controls return to login. | No business table change. |
| AUTH-API-012 | Logout clears session | Click Logout from profile menu. | UI calls logout, clears browser session, returns to login. | No DB change in Phase 1. |

## Users Test Cases

| ID | Scenario | Steps | Expected UI/API Result | Expected DB Result |
|---|---|---|---|---|
| USERS-UI-001 | Users list requires auth | Open Users API/page without stored session. | API returns `401`; UI redirects to login or shows auth failure. | No DB change. |
| USERS-UI-002 | Users list loads from DB | Login and open Users page. | Table rows are loaded from `GET /api/v1/users`; hardcoded static rows are not the source of truth. | No DB change. |
| USERS-UI-003 | Empty users result | Query returns no users for given criteria in a controlled test DB. | Table shows `No users found.` | No DB change. |
| USERS-UI-004 | Create active Test user | Add User with valid name/email/username/password/context `Test`. | Modal saves through API, closes, confirmation appears, new row appears from API response. | `app_users` row is inserted with `is_active = true`, `default_data_context = Test`; `user_password_events` row with `Initial password set` is inserted. |
| USERS-UI-005 | Create Prod-default user | Add User and choose Default Context `Prod`. | Row is created successfully. User can later login without selecting context and land in `Prod`. | `app_users.default_data_context = Prod`. |
| USERS-UI-006 | Create user duplicate email | Add User using an existing email. | Save is blocked by UI duplicate check or API returns readable duplicate error. | No new `app_users` row. |
| USERS-UI-007 | Create user duplicate username | Add User using an existing username. | Save is blocked by UI duplicate check or API returns readable duplicate error. | No new `app_users` row. |
| USERS-UI-008 | Create user password mismatch | Enter different Password and Confirm Password. | Field-level validation blocks save. | No DB change. |
| USERS-UI-009 | Inline edit profile fields | Click Edit on a user, change name/email/username, save. | Row remains visually stable and updates from API response. | `app_users.name/email/username`, `updated_at`, and `updated_by_user_id` update. |
| USERS-UI-010 | Inline edit active status | Click Edit, switch Active/Inactive, save. | Status badge updates after API success. | `app_users.is_active` updates. |
| USERS-UI-011 | Inline edit duplicate email/username | Edit row to duplicate another user. | Save is rejected with readable validation. Row remains in edit mode. | No DB change for that row. |
| USERS-UI-012 | Inline edit missing row ID | Force a row without `data-user-id` and save. | UI shows `User record is missing its database id.` | No API write. |
| USERS-UI-013 | Reset password wrong previous password | Open Password modal, enter wrong previous password and valid new/confirm. | API returns `401`; modal shows readable failure. | Password hash and password event table remain unchanged. |
| USERS-UI-014 | Reset password mismatch | Enter correct previous password but mismatched new/confirm. | UI validation blocks save. | No DB change. |
| USERS-UI-015 | Reset password succeeds | Enter correct previous password and matching new/confirm. | Confirmation dialog appears. | `app_users.password_hash` changes and `user_password_events.change_type = reset` with `Password reset by administrator` is inserted. |
| USERS-UI-016 | Login with reset password | After password reset, logout and login as that user with the new password. | Login succeeds. | `last_login_at` updates. |

## Cross-Cutting Checks

- All Users API calls include bearer auth.
- `X-Data-Context` is still a read-scope/session override and does not mutate `app_users.default_data_context`.
- Centered confirmation dialogs are used for committed data changes.
- Validation messages use the shared field-label wording contract.
- Browser/localStorage is not used as the source of truth for Users records.

## Automation Notes

- Use disposable users with unique `runId` suffixes.
- Clean disposable rows from `user_password_events` before deleting from `app_users`.
- Cover both API-level assertions and visible UI state where possible.
- Keep DB assertions explicit: created row, updated row, event inserted, no row on validation failure.

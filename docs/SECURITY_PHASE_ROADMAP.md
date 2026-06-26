# Security Phase Roadmap

This note captures the current Phase 1 security baseline and the hardening deferred to Phase 2.

## Phase 1

- Bearer authentication is required for protected APIs.
- Access tokens expire server-side after 30 minutes.
- Refresh is supported through the lightweight demo refresh token.
- Logout clears the client session; the server does not yet keep a revocation table.
- Password change forces the browser session back to login.
- `X-Data-Context` remains a request/session override only.
- Auth, profile, password reset, and user management actions are recorded in the development log and module test specs.

## Phase 2

- Replace demo bearer tokens with signed JWTs.
- Add a server-side refresh-token/session revocation table.
- Add per-device or per-session logout control.
- Add optional token/device audit metadata.
- Decide whether to bind sessions to a stricter expiration and rotation policy.
- Add stronger profile-security rules if the product moves beyond the proof backend.

## Notes

- Phase 1 is intentionally pragmatic: it enforces authentication and token expiry without introducing a full session-management subsystem.
- Phase 2 is where the token lifecycle becomes a persistent server concern instead of a lightweight demo concern.

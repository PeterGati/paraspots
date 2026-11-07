# Club member access

Implemented in the existing Pages API, D1 database and Flutter iPhone app.

## Agreed access model

The owner explicitly requested email-list access without email verification or a password for ordinary members. A supplied address is matched against the club's allowlist. Anyone knowing a listed address can use it; this is deliberately not identity authentication. The API returns `identityVerified: false`. No email is sent and no pending registration flow exists under this revised requirement.

`club_members` is the sole membership list, keyed by club and normalized email. It is separate from `club_accounts`, which continues to provide password-protected administration. Only the existing Superadmin can create/reset club administrator credentials; ordinary club administrators can manage members of their own club. Superadmin opens `/clubadmin/?mode=super` and selects any club.

## API and UI

- `/api/club/members`: authenticated list, individual PUT and DELETE.
- `/api/club/member-content`: authenticated management of internal news, text documents and event information. Optimistic revisions protect edits. File attachments are not implemented.
- `/api/member/access?club=...` and `/api/member/{news,documents,events}?club=...`: GET with `X-Paraspots-Member-Email`. The server checks the current club list on every request. Member headers never authenticate administration.
- Private responses use `Cache-Control: no-store`; public site feeds do not include member lists or internal content.
- iPhone remembers the entered address, not a grant. Each content read checks the server; displayed content refreshes every 15 seconds and is cleared on backgrounding or failed reads. Revocation blocks the next request immediately; already read content cannot be recalled.
- The club admin UI is German; member app copy uses existing DE/EN/HU localization.

## Validation

`node --test tests/*.test.js` exercises real in-memory SQLite with the production handlers, including multi-club membership, duplicate addresses, revocation, administrator isolation, Superadmin list editing and public-feed isolation. App tests cover member/non-member UI and removal of content after revocation.

Deploy the additive `backend/club-members.sql` migration before deploying the new API. No existing records are changed by the migration. Keep these tables on a source rollback; dropping them destroys new membership/content data.

Password reset email delivery is a separate pending requirement: there is no mail provider configured. Existing Superadmin password replacement invalidates club sessions; it is not a self-service emailed recovery flow.

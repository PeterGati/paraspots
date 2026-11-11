# Cockpit server release — 2026-11-11

Scope: authenticated Cockpit draft saves, explicit publication, revision conflicts, audit log and private backup gateway. Existing public web assets and production site/club records are preserved. Translation and SMTP activation remain off.

## Evidence before release

- Independent encrypted backup workflow: private `PeterGati/paraspots-backups`, run `43063427888`, completed successfully; archive upload, independent download and authenticated decryption/SQLite/media restore passed.
- Schedule: 01:00 Europe/Vienna. Manual daytime export requires the explicit dispatch approval input; authorized for the initial test by the user.
- Real Cloudflare restore: isolated D1 `paraspots-restore-20261111` and R2 bucket of the same name. All 13 source tables matched every record; remote foreign keys passed; all 3 media hashes matched. D1 prohibits `integrity_check`; this check passed on the decrypted local SQLite restoration.
- A secret-gated test Worker verified actual D1/API/R2 reads, existing Superadmin authentication, private backup listing/download, draft save, reopen, publication isolation, explicit publication and stale-revision rejection. Original published sites were unchanged. Synthetic publication occurred only in this isolated test environment.
- 61 server regression tests passed before the final restore-date display test; final backup regression suite passed 8 tests.

## Release and rollback

The additive SQL creates `cockpit_audit`, `translation_tasks`, and `notification_outbox`, plus indexes. No existing table is dropped or rewritten. Existing production records are fingerprinted around migration.

Production project: Cloudflare Pages `paraspots`. Prior known-working production deployment: `cc55a9c4-c052-4c1a-8c54-291456dd1e21`, source `8f4ba62083aef947eea835ff67172c81fbfad573` (refresh this baseline if a concurrent production deployment occurs).

To stop new Cockpit writes, set production `COCKPIT_WRITES_ENABLED=false` and redeploy. Roll back the Pages deployment to the captured pre-release deployment if needed. Retain new audit tables, existing/new user data, backups and keys: rollback must not delete or restore over production data. A full production database restore requires separate explicit authorization.

## Credential and recovery boundaries

R2 backup credential: object-read-only on `paraspots-photos`. Cloudflare's D1 export rejected a Read-only token; the dedicated export token therefore has D1 Edit (plus Read) scoped to this account. The exporter only performs export/read operations. Credentials are encrypted in GitHub Actions repository secrets and macOS Keychain, never in source or backups.

The Cockpit gateway uses a separate GitHub token with Actions Read + Metadata Read on the private backup repository only, without expiration. Temporary setup/release tokens are not used by the nightly job. GitHub Actions obtains its own per-run token.

Retention: 90-day encrypted GitHub artifacts, plus local copies. Daily media backups do not promise a 15-minute recovery point. Scheduled execution is best effort. External NAS is not configured. Failure email delivery has not been verified; workflow failure status/logs are available. The initial successful run is a manually dispatched run of the scheduled workflow; the first actual 01:00 scheduled invocation remains to be observed.

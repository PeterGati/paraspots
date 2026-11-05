# DE / EN / HU localization — 2026-11-05

Existing repositories only: `paraspots-web` and `paraspots-platform`. No PARA:AT project changes.

## Content contract

The existing `sites` table stores independent draft and published JSON documents. Its columns and public `schemaVersion: 1` remain unchanged. Every editable text-bearing object can carry `translations: {de: {...}, en: {...}, hu: {...}}`. Supported text fields are `name`, `description`, `difficulty`, `windSensitivity`, `approachDescription`, and `parking`, including operator and individual launch/landing objects. Legacy scalar fields remain the canonical German source so older apps continue to work. Numbers, coordinates, flags, identifiers, URLs, photos, phone numbers and wind-direction codes are unchanged.

Missing/empty/whitespace EN/HU fields fall back individually to the original German field. No flying-site, safety, difficulty or wind-sensitivity translations are generated. Original airspace fields remain preserved but hidden, matching the existing deliberate exclusion from the editor/app.

The protected Superadmin retains its existing Hungarian navigation and menus. Each editable text field has Deutsch/English/Magyar inputs and missing-translation notices. Saving is still a draft-only action; publication is explicit and optimistic revision locking remains in force. German input updates both the legacy field and its DE entry. Unknown imported fields survive editing/export.

`GET /api/sites` returns all language versions plus legacy fields. The app caches this entire payload, enabling instant offline language changes. Optional `?lang=de|en|hu` resolves public field values server-side; unsupported languages fall back to German. ETags include the response contents.

## Additive migration and recovery

No destructive table migration or bulk production backfill is needed. Existing records are accepted unchanged; opening them in the editor adds the language structure in memory and the next explicit save stores it. EN/HU remain empty until authored. Publication state is not changed by opening or saving.

For an offline SQLite copy, `node scripts/migrate-localization.mjs database.sqlite` previews the record count. `--apply` creates a complete SQLite backup, then transactionally normalizes draft and published documents independently. Exact previous rows are retained in `localization_backups_v1`; original timestamps remain intact, modified rows advance revision. The migration is idempotent. This optional bulk migration was tested on isolated databases, not applied to production.

Before this change:
- Source archive, including both repositories and pre-existing uncommitted changes: `/Users/petergati/develop/paraspots-backups/localization-20261105/sources-before.tar.gz`.
- Actual production D1 export: same directory, `d1-before.sql` (private; do not commit).
- Previous Pages production deployment: `7d9c9626-9a46-4bfa-80e0-5981c8f46559`; inventory in `deployments-before.txt`.

Prefer a source-only rollback to the previous Pages deployment; additive translation data can remain and old clients still read the German fields. Restoring the entire database export would remove edits made after the backup, so only do that as an intentional database recovery. Do not blindly restore the source archive over later user changes.

## Verification

- 16 backend tests: actual SQLite/D1 adapter and API authentication, draft isolation, publication, DE/EN/HU reads, blank translation fallback, structural-field rejection, data preservation, migration idempotence and exact backups.
- Actual Chrome editor at 1440 and 390 px: import, DE/EN/HU field editing, save, reload, publish, subsequent editing and republishing; no JavaScript errors or horizontal overflow. Isolated in-memory QA server, no production test records.
- The Flutter integration test fetches the real local HTTP response produced by that browser flow, checks all three languages and nested launch text, then verifies cached content after state recreation.
- Preview deployment: `https://feat-de-en-hu-localization.paraspots.pages.dev/superadmin/`; login page and DE/EN/HU public API verified against the two existing published sites.
- Static website link/asset checks pass. The legacy preservation check now follows the latest committed scheduled weather update instead of an obsolete hard-coded weather commit. 219 original JSON/GeoJSON files remain unchanged.

Reproduce browser→app integration:
1. `python3 scripts/build.py`
2. `node scripts/localization-qa-server.mjs` (loopback port 4175, in-memory test data).
3. `node scripts/localization-browser-qa.cjs` (Playwright module required).
4. In the Flutter repository: `flutter test test/admin_integration_test.dart --dart-define=PARASPOTS_ALLOW_LOCAL_HTTP=true --dart-define=PARASPOTS_TEST_ADMIN_URL=http://127.0.0.1:4175/api/sites`.

The server must be restarted between full browser test runs. Production content was not changed by these tests. Credentials in the QA server are test-only and cannot authenticate to production.

## Liga branding and final checks

The user-supplied `ligalogo_klein.png` is copied without image edits to `platform/public/assets/liga-logo.png`. Header and footer logos use white tiles to preserve black-letter contrast, and both link to `https://www.paragleiter.org/` in a new tab. The app logo remains non-interactive; a separate Liga module is deferred. Header/menu layout was checked at 1440, 1024, 850, 390 and 320 px in DE/EN/HU.

The optional database normalization was additionally run on an in-memory copy of the actual production SQL export: both existing records retained every original value and publication state, exact backup rows were verified, and a second run made no changes. The production database itself was not migrated or edited by this test.

The complete web/app local integration was rerun after the editor's missing-translation summary was shortened. 16 backend tests and the browser edit→save→publish→HTTP app refresh/offline-restart flow passed. The iPhone's language selection/persistence was confirmed by the user; the Liga build was subsequently installed in place and launched.

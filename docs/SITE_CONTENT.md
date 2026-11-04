# Starthely content integration — 2026-11-03

## Scope

A real, authenticated superadmin at `/superadmin/` edits Cloudflare D1 records. The Flutter app is strictly read-only. The existing public marketing site and browser-only `/demo/` remain available. Club/member push notifications are a separate future module; do not treat site data refresh as a push implementation.

- Source: `platform/superadmin/`, `backend/`, `functions/api/[[path]].js`.
- Existing original Hohe Wand JSON remains unchanged. Import accepts one site object (max 256 KB), including nested startpoints, landings and directions. Existing records are explicitly confirmed before importing; import is not an automatic save.
- Draft save, publish and unpublish are separate. Optimistic revision checks prevent overwriting concurrent changes. Unknown JSON fields survive editing; dangerous prototype keys are rejected.
- Direction convention follows the existing German dataset: N, NO, O, SO, S, SW, W, NW. Oststart is O/SO, Südstart SO/S. Site-level and individual launch directions remain separate fields.
- Missing coordinates are shown as missing, not inferred. Descriptions are displayed as text, never HTML. Legacy descriptions need editorial review.
- Authentication: email plus PBKDF2-SHA256 password hash (100,000 iterations), random server sessions, HttpOnly SameSite cookies, 8-hour expiry, same-origin mutation checks and 5 failed attempts/IP/15 minutes. Credentials are Cloudflare secrets; `.dev.vars` contains only the local password HASH and email and is ignored. Never commit secrets.

## Cloudflare

Existing Pages project: `paraspots`. D1: `paraspots-content`, binding `SITE_DB`.
Database ID: `7ec9d477-13a8-4292-8e49-9ce55a1f663d` (public resource identifier, not a credential).
Root `wrangler.jsonc` declares the existing Pages project and `out/preview` build output.
`backend/wrangler.jsonc` is for D1 maintenance, not an extra Worker deployment.

Schema bootstrap (idempotent):
`wrangler d1 execute paraspots-content --remote --file backend/schema.sql --config backend/wrangler.jsonc`

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` as Pages secrets for both production and preview. Secrets are not returned by the API. Changes require a deployment to become available.

Preview branch: `feat/superadmin-site-sync`; URL https://feat-superadmin-site-sync.paraspots.pages.dev/superadmin/ .
Publishing API response: `/api/sites` with `schemaVersion: 1` and `sites: [{id,data,publishedAt}]`. Public reads contain published records only, use no-cache and ETag. Private endpoints use no-store. Frontend never contains a password or a secret API key.

## Flutter

Checkout: `/Users/petergati/develop/paraspots-platform`. Independent local Git repository created before changes; baseline `3fa9ff0`. External ZIP backup: `/Users/petergati/develop/paraspots-backups/2026-11-03/app-before-site-sync.zip`.

`SiteStore` fetches only published records over HTTPS. Startup, resume, pull-to-refresh and a 2-minute foreground interval check for updates. The current page reacts immediately to a completed refresh. A downloaded full snapshot, including per-launch directions, descriptions, coordinates and landing information, is persisted on device. A malformed/failed response cannot replace the last good snapshot. An empty successful catalogue removes withdrawn content on the next sync. A bundled legacy Hohe Wand record is explicitly labeled unconfirmed and is used only before any valid saved server response exists.

Default endpoint: `https://paraspots.at/api/sites`. Override for staging using `--dart-define=PARASPOTS_SITES_URL=https://feat-superadmin-site-sync.paraspots.pages.dev/api/sites`.

Offline availability covers site text and structured data. It does not provide offline map tiles, remote photos, webcams, live weather or proof of current opening. Previously cached content cannot be remotely withdrawn from a disconnected device; the UI shows last sync and a stale-information notice.

## Validation

- `node --test tests/backend.test.js`: draft/public isolation, nested directions, conflict prevention, publication withdrawal, origin checks, validation, logout and login throttling, using SQLite with the D1 schema.
- `scripts/dev-content-server.js`: loopback-only preview using the same API handler and schema. Read local hash from ignored `.dev.vars`; persist local test data under `.qa/`.
- Browser QA: authentication, actual JSON file upload, manual edit, save, publish, public API, draft isolation, 1440px/390px layout and JavaScript errors. Also exercised against real Cloudflare Pages/D1.
- Flutter: static analysis and tests for downloaded content, directions, offline restart, invalid-response protection and unpublish/restart. Existing demo tests still apply. Physical iPhone installation is reported separately; automated offline test is not a physical airplane-mode test.

## Recovery

Old source and 220 JSON/GeoJSON files are retained. Source-only rollback should retain D1 data, not drop tables. Before destructive future migrations, export D1 (`wrangler d1 export ... --remote --output ...`) into a private backup. For web rollback, use the earlier Pages production deployment and prior Git commit. Original app baseline and ZIP above are available independently.

## Deferred

Image upload/storage, offline maps, DE/EN/HU translated site content editing, clubadmin scopes, actual memberships, payments and member-targeted push are not implemented by this first content slice. Existing German source descriptions are not automatically translated. The editor UI currently uses Hungarian; mobile demo retains German.

## Local follow-up: save feedback and airspace removal

Save progress/success/errors are now visible beside the action buttons at the bottom of long forms. Successful save feedback includes server-save time and distinguishes first unpublished draft, pending published changes and an already published version. Busy controls prevent repeated submissions; error feedback retains unsaved edits. Schöckl fixture validates 3 launch direction groups and 3 landing points. Browser tests cover feedback visibility at 390/1440 widths and a failed save without losing edits.

Airspace inputs have been removed from the editor and new-record template. Original imported fields remain preserved internally for lossless export; no app airspace section is rendered. Original source files are not rewritten. These follow-up editor changes are local review changes until explicitly deployed; existing public admin is the earlier version.

## Direction picker — 2026-11-03

The editor uses eight checkbox choices with German and Hungarian names, an immediate SVG sector preview and an expandable JSON example. Canonical values are N, NO, O, SO, S, SW, W, NW. The same picker serves region-level windDirections and per-launch launchDirections, with separate explanations of scope. No arbitrary direction text is accepted. Import errors identify the field, the unsupported value and an example such as ["O","SO","S"]. Repeated entries are rejected. Empty lists mean unknown/no supplied direction, never all directions.

The compass retains original website colours (#cfe8ff and #5fd12f), fixed north-up orientation and 45-degree sectors centred on each heading. A shared app CustomPainter implements the equivalent logic. The web direction preview and the app read the same canonical arrays. Green means a recorded launch direction; it is not a live wind measurement.

Seven backend/validation tests pass. Browser QA at 390 and 1440px covers checkbox preview, separate per-launch state, canonical saving and invalid-import guidance. App tests include pixel checks at the 360/0-degree north boundary, O/SO/S, N/NW and the empty case, plus screen-reader labels. UI source remains an adaptation of the preserved app design; original legacy files have not been changed.

## Coordinate guidance — 2026-11-04

Each root/launch/landing coordinate group now presents separate WGS84 decimal-degree numeric fields: lat (latitude) then lon (longitude). The guide explains decimal points in JSON, signed values, valid ranges and the exclusion of DMS strings or direction letters. A complete valid pair enables a standard Google Maps search URL with api=1 and query=latitude,longitude; this shows the point without inventing a driving route to a launch. It opens only when the user clicks the link. Empty/invalid pairs never produce a map link. Values are not rounded. Zero is a valid coordinate. Partial legacy coordinates remain optional and visibly incomplete.

This format matches the planned native GPS location fields; it does not imply that device geolocation is implemented. User-provided records are not rewritten by the guide. Public API/storage schema is unchanged. Validation errors for text, DMS and range failures now include a decimal example. Ten backend/helper tests passed, plus 390/1440px browser checks of pair order, incomplete/out-of-range suppression and guidance. No production content was changed during these checks.

References: https://developers.google.com/maps/documentation/urls/get-started ; https://support.google.com/maps/answer/18539 ; https://developer.apple.com/documentation/corelocation/cllocationcoordinate2d .

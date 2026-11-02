# PARASPOTS web platform — 2026-11-02

## Implemented locally

- Five static marketing pages in DE/EN/HU, preserving the page when changing language.
- Original supplied emblem used byte-for-byte, framed with CSS; no newly generated logo.
- Existing alpine illustration and actual Flutter 0.1 screenshot. The screenshot retains the earlier app-icon variant, as documented in the handoff; website branding uses the original emblem. No third-party club logo is reused as a marketing asset.
- Pilot pages are product information only. No pilot signup, search, purchase, invented store links or external data integration.
- User-confirmed contact: Peter Gati / petergati@me.com. Mail link only; no message was sent.
- Separate DE/EN/HU browser-only clubadmin/superadmin demo. Two fictional clubs, ticket and membership review, explicit official closure/reopening simulation, unverified member report resolution/expiry, module availability/visibility, activity log and reset.
- Demo state uses sessionStorage in the current browser tab. Role switching is a preview feature, not authentication. No bank account, payment, email, location, push or backend calls.
- Public marketing and admin build into separate directories. The combined local preview is for review only.

## Build and preview

Python 3 standard library only:

```sh
python3 scripts/build.py
python3 scripts/check_build.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory out/preview
```

Open http://127.0.0.1:4173/hu/index.html or http://127.0.0.1:4173/demo/?lang=hu.

Outputs:

- `out/marketing`: marketing only; future paraspots.at output.
- `out/admin`: separate admin demo; future admin.paraspots.at output.
- `out/preview`: marketing plus `/demo/` for local/staging review.

Optional build environment:

- `PARASPOTS_ADMIN_URL`: a VERIFIED deployed admin URL. If absent, production marketing uses a contact link instead of a broken admin link. Local preview always links to `/demo/`.
- `PARASPOTS_WEBSITE_URL`: website origin for standalone admin return links; default https://paraspots.at. Use the verified staging origin for a standalone staging admin.

All current outputs are marked noindex. Public release is not yet performed. The user requested that the preview proceed with name/email while operator/address/privacy details remain pending. Do not invent those details or claim legal compliance. Final publication must use the confirmed deployment configuration and a reviewed final artifact.

## Visual design

Inherited: primary #087DE1, secondary #E62834, navy #102740, paper #F3F5F9, Arial/system sans, original emblem and assets.
New web choices: responsive 1200px content width, desktop navigation/mobile menu, marketing typographic scale, CSS shadows, admin tables/sidebar. These are web adaptations, not extracted mobile tokens.

Original design bundle: `/Users/petergati/Downloads/PARASPOTS_DESIGN_HANDOFF.zip`.
Mobile source remains unchanged in `/Users/petergati/develop/paraspots-platform`.

## Validation

Chrome headless at 1440, 390 and 320 CSS-pixel widths; DE/EN/HU marketing and admin views, desktop/mobile screenshots inspected. This is browser viewport testing, not a physical iPhone/Android test or Safari test.

`docs/qa-results.json` records 108 page/viewport checks and 10 interaction checks: language-page preservation, mobile menu, cancel/confirm/filter of tickets, separate club state, member-report expiry preserving official closure, explicit reopening, membership confirmation, superadmin restrictions, reload persistence and reset.

`python3 scripts/check_build.py` validates generated local asset/link references and proves every original JSON/GeoJSON file unchanged against the baseline commit. Original emblem is compared byte-for-byte when its source bundle is available.

Browser tests use Playwright and a local Chrome binary. The build itself needs neither Node nor Playwright. No full WCAG certification is claimed. Future backend permission checks and production audit trail are not implemented.

## Deployment status and recovery

Repository: https://github.com/PeterGati/paraspots
Baseline main: `fa66fe91575e084a58551af63df6b539a906eb57`.
Branch: `feat/platform-marketing-demo` (created and published by the user before implementation).
Local annotated recovery tag: `backup/pre-platform-2026-11-02`.

Backups outside the checkout:

- `/Users/petergati/develop/paraspots-backups/2026-11-02/paraspots.bundle`: complete Git history; verified with git bundle verify.
- `/Users/petergati/develop/paraspots-backups/2026-11-02/paraspots-main.zip`: baseline tracked files, including old JSON data.

`docs/legacy-data-sha256.json` records the data manifest. Existing legacy files and workflows are retained. Deploy only the selected `out/` directory, never the repository root, when releasing the new platform. The legacy root remains available for recovery and has not been replaced.

Cloudflare observations: HTTPS 200; server cloudflare. Live root differs from baseline index only by Cloudflare email obfuscation. Dashboard screenshot confirmed Pages project `paraspots`, `paraspots.pages.dev`, GitHub binding `PeterGati/paraspots`, two additional domains. Production settings verified from the dashboard: main branch, empty build command, build output `/`, empty root directory, build system v3, automatic deployments enabled. Baseline is also saved in docs/cloudflare-baseline.json and in the external backup folder. Do not change DNS or the unrelated lumo-demo-gateway or paraspots-save workers.

Recovery example (new independent folder):

```sh
git clone /Users/petergati/develop/paraspots-backups/2026-11-02/paraspots.bundle recovered-paraspots
git -C recovered-paraspots checkout backup/pre-platform-2026-11-02
```

Restoring production also requires the recorded original Cloudflare build/output settings or its previous successful deployment. No destructive reset or force push is required.

## Next app work

Requested by user: add German, English and Hungarian to the mobile app. This is a separate follow-up; current Flutter source was not modified. Website translations must not be represented as app localization already completed.

Dashboard deployment screenshot also confirms production branch `main`, production baseline `fa66fe9` at `https://9cfffd62.paraspots.pages.dev`, and a separate preview deployment for the feature branch at `https://1fa4ac33.paraspots.pages.dev`. Both are still the old site at this checkpoint.

## Proposed Cloudflare preview deployment configuration (not saved by agent)

Dashboard build command: exact one-line content of `docs/cloudflare-build-command.txt`.
Build output directory: `cf-output`. Framework: None. Root directory: unchanged/empty.

This branch-aware command builds the combined review artifact ONLY for `feat/platform-marketing-demo`. Every other branch, including main, is archived into cf-output without changing any tracked bytes. This protects legacy production if the dashboard build setting is project-wide. It deliberately does not activate the new site on main even after a future merge; final release needs its own reviewed configuration.

Validation: `python3 scripts/check_cloudflare_build.py` uses isolated clones. Main output contains all 255 original tracked files byte-for-byte; feature output contains the marketing pages and admin demo, with neither old data nor old search pages. The command has been tested locally, not yet in Cloudflare. Python availability in Cloudflare and final deployment status remain to be verified by the actual build.

After configuration is saved, push the committed feature branch using GitHub Desktop and inspect the Cloudflare preview build. Do not change the production branch or domains. The previous baseline settings are in docs/cloudflare-baseline.json. If reverting the build configuration, restore the empty build command and `/` output together.

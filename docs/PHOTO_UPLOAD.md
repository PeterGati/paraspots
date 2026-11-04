# Starthelyi és pontfotók

A /superadmin/ felületen minden starthelyhez közös fotó, minden startponthoz és leszállóhelyhez saját fotó tölthető fel. Pontfotó hiányában a közös fotó, annak hiányában a meglévő általános hegyvidéki kép jelenik meg. Egy fotó tartozik minden elemhez; a cserét és az örökléshez való visszatérést külön gomb segíti.

Menet: kép kiválasztása → automatikus előkészítés/feltöltés → **Piszkozat mentése** → **Közzététel**. A feltöltés önmagában nem módosítja a közzétett adatlapot. A szerkesztett szöveg képfeltöltés közben megmarad. Az importált régi JSON-ok fotómező nélkül is működnek.

A böngésző JPEG/PNG/WebP fotóból legfeljebb 2000 pixel hosszú, 85%-os JPEG másolatot készít canvas segítségével, a beágyazott EXIF/GPS-adatok továbbítása nélkül. Eredeti fájl legfeljebb 40 MB; a szerverre kerülő kép legfeljebb 8 MB. HEIC esetén JPEG-export szükséges, ha a böngésző nem tudja megnyitni.

Az új opcionális `photo` mező a gyökérben, `startpunkte[]` és `landeplaetze[]` elemein egyaránt relatív, változatlan tartalomra mutató hivatkozás: `/api/media/<sha256>.jpg` (API-n PNG/WebP is támogatott). Külső hivatkozás, SVG és beágyazott base64 nem elfogadott.

Cloudflare R2: `paraspots-photos`, Standard, WEUR helyjelzés; Pages binding `SITE_PHOTOS`, konfiguráció a gyökér wrangler.jsonc-ben. Kizárólag bejelentkezett, azonos eredetű admin kérés tölthet fel (`POST /api/admin/media`). A kép a nyilvános tartalomként olvasó app számára bejelentkezés nélkül elérhető (`GET/HEAD /api/media/...`), SHA-256 névvel és immutable cache fejléccel. A hosszú, tartalomfüggő URL nem privát hozzáférés-szabályozás; csak nyilvános megjelenítésre szánt fotót tölts fel.

A fotó elhagyása csak a hivatkozást veszi ki az új piszkozatból. Az objektumot nem töröljük, mert a korábbi közzétett adat vagy offline app még hivatkozhat rá. Tárhelytisztítás később, referenciák és megőrzés figyelembevételével építhető ki.

Az app a közzétett JSON mellett a hivatkozott képeket az alkalmazás tartós Application Support könyvtárába menti, három párhuzamos letöltéssel. Újraindításkor a mentett képek internet nélkül is elérhetők. Még le nem töltött, hiányzó vagy nem dekódolható pontfotó helyett a mentett közös kép, majd a beépített általános kép látszik. A formák, színátmenetek, képméretek és kártyanavigáció megmaradnak. A képeket először internetkapcsolattal le kell töltenie az appnak.

Ellenőrzések: backend hitelesítés/CSRF, típus/méret, draft/publication elkülönítés és immutable visszaolvasás; böngészős teljes feltöltés/csere/elhagyás/mentés/újratöltés mobilon és desktopon helyi adatbázissal; stagingen valódi R2 feltöltés és képolvasás az adatlapok írása nélkül. Flutter tesztek: offline újraindítás, hiányzó képnél megtartott adatok és képek, megjelenítési öröklés, korábbi design/navigáció. Sikeres analyze, teljes tesztcsomag és aláírt iOS release build.

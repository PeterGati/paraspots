const container = document.getElementById("spots-container");

// ======================
// FILTER STATE
// ======================

let allSpots = [];

let filters = {
    region: [],
    wind: [],
    access: []
};

// ======================
// LOAD
// ======================

async function loadAllSpots() {

    try {

        const regionResponse = await fetch("data/regions.json");
        const regionData = await regionResponse.json();

        for (const region of regionData.regions) {

            const regionSlug = region.slug;

            for (const site of region.sites) {

                const siteSlug = site.slug;
                const file = `data/${regionSlug}/${siteSlug}.json`;

                try {

                    const res = await fetch(file);
                    const siteData = await res.json();

                    let startList = siteData.startpunkte || [siteData];

                    const windSet = new Set();
                    const heights = [];
                    const accessSet = new Set();

                    startList.forEach(start => {

                        start.launchDirections?.forEach(dir => windSet.add(dir));

                        if (start.startHeight) heights.push(start.startHeight);

                        if (start.access) {

                            if (Array.isArray(start.access)) {

                                start.access.forEach(a => {
                                    if (a === "hike") accessSet.add("hike");
                                    if (a === "auto") accessSet.add("auto");
                                    if (["berglift","lift","seilbahn"].includes(a)) accessSet.add("seilbahn");
                                    if (a === "public") accessSet.add("public");
                                });

                            } else if (typeof start.access === "object") {

                                if (start.access.hikeAndFly) accessSet.add("hike");
                                if (start.access.car) accessSet.add("auto");
                                if (start.access.cableCar) accessSet.add("seilbahn");
                                if (start.access.publicTransport) accessSet.add("public");
                            }
                        }

                    });

                    if (siteData.access) {
                        const a = siteData.access;
                        if (a.hikeAndFly) accessSet.add("hike");
                        if (a.car) accessSet.add("auto");
                        if (a.cableCar) accessSet.add("seilbahn");
                        if (a.publicTransport) accessSet.add("public");
                    }

                    const directions = [...windSet];
                    const maxHeight = heights.length ? Math.max(...heights) : "-";

                    let accessText = "Keine Angabe";

                    if (accessSet.size > 0) {
                        const list = [];
                        if (accessSet.has("hike")) list.push("Hike & Fly");
                        if (accessSet.has("seilbahn")) list.push("Seilbahn");
                        if (accessSet.has("auto")) list.push("Auto");
                        if (accessSet.has("public")) list.push("Öffentlich");
                        accessText = list.join(" / ");
                    }

                    let mapsLink = "Keine Angabe";

                    if (siteData.coordinates?.lat && siteData.coordinates?.lon) {
                        const url = `https://www.google.com/maps?q=${siteData.coordinates.lat},${siteData.coordinates.lon}`;
                        mapsLink = `<a href="${url}" target="_blank" class="maps-link">📍 Route planen</a>`;
                    }

                    const card = document.createElement("div");
                    card.className = "start-card";

                    card.innerHTML = `
                        <div class="start-details">
                            <h3>${siteData.name}</h3>
                            <p><strong>Region:</strong> ${region.name}</p>
                            <p><strong>Max. Starthöhe:</strong> ${maxHeight} m</p>
                        </div>

                        <div class="start-details">
                            <p><strong>Zugang:</strong> ${accessText}</p>
                            <p>${mapsLink}</p>
                        </div>
                    `;

                    container.appendChild(card);

                    card.style.cursor = "pointer";

                    card.addEventListener("click", () => {
                        window.location.href = `startplatz.html?region=${regionSlug}&site=${siteSlug}`;
                    });

                    allSpots.push({
                        card,
                        region: regionSlug,
                        directions,
                        access: [...accessSet]
                    });

                } catch (e) {
                    console.warn("Site konnte nicht geladen werden:", file);
                }
            }
        }

    } catch (err) {
        console.error("regions.json konnte nicht geladen werden:", err);
    }

    // ======================
    // RESTORE STATE (FIX)
    // ======================

    const state = JSON.parse(localStorage.getItem("indexState"));

    if (state && state.filters) {

        filters = { region: [], wind: [], access: [] };

        state.filters.forEach(value => {

            if (["tirol","salzburg","steiermark","kaernten","niederoesterreich","oberoesterreich","vorarlberg","burgenland","suedtirol"].includes(value)) {
                filters.region.push(value);
            }
            else if (["N","NO","O","SO","S","SW","W","NW"].includes(value)) {
                filters.wind.push(value);
            }
            else {
                filters.access.push(value);
            }

        });

        document.querySelectorAll(".filter-chip").forEach(el => {
            if (state.filters.includes(el.dataset.value)) {
                el.classList.add("active");
            }
        });

        // 🔥 CRITICAL FIX
        setTimeout(() => {
            applyFilters();
        }, 0);
    }
}

// ======================
// FILTER LOGIC
// ======================

window.toggle = function(el) {

    el.classList.toggle("active");

    const value = el.dataset.value;
    if (!value) return;

    const group = el.closest(".filter-group")
        .querySelector(".filter-title").textContent;

    let type;

    if (group.includes("Region")) type = "region";
    else if (group.includes("Wind")) type = "wind";
    else type = "access";

    if (el.classList.contains("active")) {
        filters[type].push(value);
    } else {
        filters[type] = filters[type].filter(v => v !== value);
    }

    applyFilters();
};

// ======================
// APPLY FILTERS
// ======================

function applyFilters() {

    allSpots.forEach(s => {

        let visible = true;

        if (filters.region.length && !filters.region.includes(s.region)) visible = false;

        if (filters.wind.length && !s.directions.some(d => filters.wind.includes(d))) visible = false;

        if (filters.access.length && !s.access.some(a => filters.access.includes(a))) visible = false;

        s.card.style.display = visible ? "block" : "none";
    });
}

// ======================
// RESET
// ======================

window.resetFilters = function() {

    filters = { region: [], wind: [], access: [] };

    document.querySelectorAll(".filter-chip")
        .forEach(el => el.classList.remove("active"));

    allSpots.forEach(s => s.card.style.display = "block");
};

// ======================
// INIT
// ======================

loadAllSpots();

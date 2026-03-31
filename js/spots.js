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

                    let startList = [];

                    if (siteData.startpunkte) {
                        startList = siteData.startpunkte;
                    } else {
                        startList = [siteData];
                    }

                    const windSet = new Set();
                    const heights = [];
                    const accessSet = new Set();

                    let firstCoords = null;

                    // ======================
                    // START LOOP
                    // ======================

                    startList.forEach(start => {

                        start.launchDirections?.forEach(dir => windSet.add(dir));

                        if (start.startHeight) heights.push(start.startHeight);

                        // ======================
                        // ACCESS NORMALIZATION
                        // ======================

                        if (start.access) {

                            // ARRAY
                            if (Array.isArray(start.access)) {

                                start.access.forEach(a => {

                                    if (a === "hike") accessSet.add("hike");
                                    if (a === "auto") accessSet.add("auto");

                                    if (a === "berglift" || a === "lift" || a === "seilbahn") {
                                        accessSet.add("seilbahn");
                                    }

                                    if (a === "public") accessSet.add("public");

                                });
                            }

                            // OBJECT
                            else if (typeof start.access === "object") {

                                if (start.access.hikeAndFly === true) accessSet.add("hike");
                                if (start.access.car === true) accessSet.add("auto");
                                if (start.access.cableCar === true) accessSet.add("seilbahn");
                                if (start.access.publicTransport === true) accessSet.add("public");
                            }
                        }

                        // COORDS
                        if (!firstCoords) {
                            if (start.coordinates?.lat && start.coordinates?.lon) {
                                firstCoords = start.coordinates;
                            } else if (start.lat && start.lon) {
                                firstCoords = { lat: start.lat, lon: start.lon };
                            }
                        }

                    });

                    // ======================
                    // SITE ACCESS (FALLBACK)
                    // ======================

                    if (siteData.access && typeof siteData.access === "object") {

                        const a = siteData.access;

                        if (a.hikeAndFly === true) accessSet.add("hike");
                        if (a.car === true) accessSet.add("auto");
                        if (a.cableCar === true) accessSet.add("seilbahn");
                        if (a.publicTransport === true) accessSet.add("public");
                    }

                    // ======================
                    // BASIC DATA
                    // ======================

                    const directions = [...windSet];
                    const directionsText = directions.join(", ");
                    const maxHeight = heights.length ? Math.max(...heights) : "-";

                    // ======================
                    // DISPLAY ACCESS (CSAK UI!)
                    // ======================

                    let accessText = "Keine Angabe";

                    if (accessSet.size > 0) {

                        const list = [];

                        if (accessSet.has("hike")) list.push("Hike & Fly");
                        if (accessSet.has("seilbahn")) list.push("Seilbahn");
                        if (accessSet.has("auto")) list.push("Auto");
                        if (accessSet.has("public")) list.push("Öffentlich");

                        accessText = list.join(" / ");
                    }

                    // ======================
                    // GOOGLE MAPS
                    // ======================

                    let mapsLink = "Keine Angabe";

                    if (siteData.coordinates?.lat && siteData.coordinates?.lon) {
                        const url = `https://www.google.com/maps?q=${siteData.coordinates.lat},${siteData.coordinates.lon}`;
                        mapsLink = `
<a href="${url}" target="_blank" class="maps-link">
    <span class="maps-icon">📍</span>
    <span>Route planen</span>
</a>`;
                    }

                    // ======================
                    // CARD
                    // ======================

                    const card = document.createElement("div");
                    card.className = "start-card";

                    card.innerHTML = `
                        <div class="start-details">
                            <h3>${siteData.name}</h3>
                            <p><strong>Region:</strong> ${region.name}</p>
                            <p><strong>Max. Starthöhe:</strong> ${maxHeight} m</p>
                        </div>

                        <div class="start-layout">
                            <div class="wind-wrapper">
                                <svg viewBox="-20 -20 340 340"></svg>
                            </div>
                            <div class="start-details">
                                <h3>Erreichbare Startrichtungen</h3>
                                <p>${directionsText}</p>
                            </div>
                        </div>

                        <div class="start-details">
                            <p><strong>Zugang:</strong> ${accessText}</p>
                            <p><strong>Anfahrt:</strong> ${mapsLink}</p>
                        </div>
                    `;

                    container.appendChild(card);

                    card.style.cursor = "pointer";

                    card.addEventListener("click", () => {
                        window.location.href = `startplatz.html?region=${regionSlug}&site=${siteSlug}`;
                    });

                    const mapsAnchor = card.querySelector(".maps-link");
                    if (mapsAnchor) {
                        mapsAnchor.addEventListener("click", (e) => {
                            e.stopPropagation();
                        });
                    }

                    const svg = card.querySelector("svg");
                    drawWind(svg, directions);

                    // ======================
                    // SAVE FILTER DATA
                    // ======================

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

        if (filters.region.length > 0) {
            if (!filters.region.includes(s.region)) visible = false;
        }

        if (filters.wind.length > 0) {
            if (!s.directions.some(d => filters.wind.includes(d))) {
                visible = false;
            }
        }

        if (filters.access.length > 0) {
            if (!s.access.some(a => filters.access.includes(a))) {
                visible = false;
            }
        }

        s.card.style.display = visible ? "block" : "none";

    });
}


// ======================
// RESET
// ======================

window.resetFilters = function() {

    filters = {
        region: [],
        wind: [],
        access: []
    };

    document.querySelectorAll(".filter-chip")
        .forEach(el => el.classList.remove("active"));

    allSpots.forEach(s => s.card.style.display = "block");
};


// ======================
// WIND DRAW (UNCHANGED)
// ======================

function directionToRange(dir) {
    const map = {
        "N":  [337.5, 22.5],
        "NO": [22.5, 67.5],
        "O":  [67.5, 112.5],
        "SO": [112.5, 157.5],
        "S":  [157.5, 202.5],
        "SW": [202.5, 247.5],
        "W":  [247.5, 292.5],
        "NW": [292.5, 337.5]
    };
    return map[dir] || null;
}

function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    return {
        x: cx + r * Math.cos(angleRad),
        y: cy + r * Math.sin(angleRad)
    };
}

function describeArc(cx, cy, r, startAngle, endAngle) {

    const start = polarToCartesian(cx, cy, r, endAngle);
    const end   = polarToCartesian(cx, cy, r, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
        "M", cx, cy,
        "L", start.x, start.y,
        "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
        "Z"
    ].join(" ");
}

function drawWind(svg, directions) {

    if (!svg) return;

    svg.innerHTML = `
        <circle cx="150" cy="150" r="130" fill="#cfe8ff" />

        ${directions.map(dir => {

            const range = directionToRange(dir);
            if (!range) return "";

            let [start, end] = range;

            if (start > end) {
                end += 360;
            }

            return `<path fill="#5fd12f" d="${describeArc(150,150,130,start,end)}" />`;

        }).join("")}

        <text x="150" y="15" text-anchor="middle" font-size="22" font-weight="bold">N</text>
        <text x="290" y="155" text-anchor="middle" font-size="22" font-weight="bold">O</text>
        <text x="150" y="300" text-anchor="middle" font-size="22" font-weight="bold">S</text>
        <text x="10" y="155" text-anchor="middle" font-size="22" font-weight="bold">W</text>
    `;
}


// ======================
// INIT
// ======================

loadAllSpots();
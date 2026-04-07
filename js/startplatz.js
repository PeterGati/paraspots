document.addEventListener("DOMContentLoaded", () => {

    function safe(value) {
    if (value === null || value === undefined || value === "") {
        return "Keine Angabe";
    }
    return value;
}
    const params = new URLSearchParams(window.location.search);
    const region = params.get("region");
    const site = params.get("site");

    if (!region || !site) {
        alert("Fehlende Parameter.");
        return;
    }

    const filePath = `data/${region}/${site}.json`;

    fetch(filePath)
        .then(res => {
            if (!res.ok) {
                throw new Error("Datei nicht gefunden");
            }
            return res.json();
        })
        .then(data => renderSite(data))
        .catch(err => {
            console.error(err);
            alert("Startplatz konnte nicht geladen werden.");
        });


    function renderSite(data) {

        // HEADER TITLE
        document.getElementById("siteName").textContent = data.name || "Keine Angabe";

        

        // ======================
        // ÜBERSICHT
        // ======================

        setText("sp-operator",
    data.operator?.name
);
// Website
if (data.operator?.url) {
    document.getElementById("sp-operator-url").innerHTML =
        `<a href="${data.operator.url}" target="_blank" rel="noopener noreferrer">${data.operator.url}</a>`;
} else {
    setText("sp-operator-url", null);
}

// Telefon
setText("sp-operator-phone", data.operator?.phone);
        // ANFAHRT (Google Maps)
if (data.coordinates?.lat && data.coordinates?.lon) {
const mapsUrl = buildGoogleMapsLink(data.coordinates);
    document.getElementById("sp-anfahrt").innerHTML =
        `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Auf Google Maps ansehen</a>`;
} else {
    setText("sp-anfahrt", null);
}
// ZUGANG
setText("sp-zugang", formatAccess(data.access));


        setText("sp-parking",
    data.access?.parking
);

        setText("sp-airspace",
    data.airspaces?.length
        ? data.airspaces.join(", ")
        : null
);

        setText("sp-flight",
            formatFlight(data.flightCharacteristics)
        );

        setText("sp-start-rate",
    formatRating(data.siteRatings?.overallRating)
);

        setText("sp-thermal-rate",
            formatRating(data.siteRatings?.thermalRating)
        );

      

        setText("sp-flight-description",
    data.approachDescription
);
        
const webcamEl = document.getElementById("sp-webcam");

if (data.webcam && data.webcam.trim() !== "") {

    const a = document.createElement("a");
    a.href = data.webcam;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Webcam öffnen";

    webcamEl.innerHTML = "";
    webcamEl.appendChild(a);

} else {
    setText("sp-webcam", null);
}
       

    // ... eddigi kód (header, zugang stb.)

    // ======================
    // SEGÉDFÜGGVÉNYEK A WINDHEZ
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
    
    // ======================
// SITE SZINTŰ IRÁNYOK
// ======================

function renderAvailableDirections(directions) {

    const svg = document.getElementById("sp-available-directions-svg");
    const textEl = document.getElementById("sp-available-directions-text");

    if (!svg) return;

    if (!directions || !directions.length) {
        textEl.textContent = "Keine Angabe";
        return;
    }

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

    textEl.textContent = directions.join(", ");
}

renderAvailableDirections(data.windDirections);
    // ======================
    // STARTPUNKTE
    // ======================


        const startContainer = document.getElementById("sp-startpunkte-container");
        startContainer.innerHTML = "";
        
        

        data.startpunkte?.forEach(sp => {

   const div = document.createElement("div");

let mapsLink = "";

if (sp.coordinates?.lat && sp.coordinates?.lon) {
    const url = `https://www.google.com/maps?q=${sp.coordinates.lat},${sp.coordinates.lon}`;
    mapsLink = `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Route planen</a></p>`;
}

div.innerHTML = `
    <div class="start-layout">

        <div class="wind-wrapper">
            <svg viewBox="-20 -20 340 340">

                <circle cx="150" cy="150" r="130" fill="#cfe8ff" />

                ${sp.launchDirections?.map(dir => {

    const range = directionToRange(dir);
    if (!range) return "";

    let [start, end] = range;

    // N eset külön kezelése (átmegy 0 fokon)
    if (start > end) {
        end += 360;
    }

    return `<path fill="#5fd12f" d="${describeArc(150,150,130,start,end)}" />`;

}).join("")}
                <text x="150" y="15" text-anchor="middle" font-size="22" font-weight="bold">N</text>
                <text x="290" y="155" text-anchor="middle" font-size="22" font-weight="bold">O</text>
                <text x="150" y="300" text-anchor="middle" font-size="22" font-weight="bold">S</text>
                <text x="10" y="155" text-anchor="middle" font-size="22" font-weight="bold">W</text>

            </svg>
        </div>

        <div class="start-details">
            <h3>${safe(sp.name)}</h3>
            <p><strong>Starthöhe:</strong> ${safe(sp.startHeight)} m</p>
            <p><strong>Höhenunterschied:</strong> ${safe(sp.heightDifference)} m</p>
            <p><strong>Startrichtungen:</strong> ${
                sp.launchDirections?.length
                    ? sp.launchDirections.join(", ")
                    : "Keine Angabe"
            }</p>
            <p><strong>Schwierigkeit:</strong> ${safe(sp.difficulty)}</p>
            <p><strong>Beschreibung:</strong> ${safe(sp.description)}</p>
            ${mapsLink}
        </div>

    </div>
`;

startContainer.appendChild(div);
});


        // ======================
        // LANDEPLÄTZE
        // ======================

        const landeContainer = document.getElementById("sp-landeplaetze-container");
        landeContainer.innerHTML = "";

        data.landeplaetze?.forEach(lp => {

            const div = document.createElement("div");
            let mapsLink = "";

const url = buildGoogleMapsLink(lp.coordinates);

if (url) {
    mapsLink = `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Route planen</a></p>`;
}

            div.innerHTML = `
                <h3>${lp.name || "Keine Angabe"}</h3>
                <p><strong>Höhe:</strong> ${lp.height ?? "Keine Angabe"} m</p>
                <p><strong>Schwierigkeit:</strong> ${lp.difficulty || "Keine Angabe"}</p>
                <p><strong>Beschreibung:</strong> ${lp.description || "Keine Angabe"}</p>
                ${mapsLink}
            `;

            landeContainer.appendChild(div);
        });
    }


    // ======================
    // HELPER FUNKTIONEN
    // ======================

    function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = safe(value);
}

    function formatRating(value) {
        if (value === null || value === undefined) {
            return "Keine Angabe";
        }
        return value.toString();
    }

    function formatAccess(access) {
    if (!access) return "Keine Angabe";

    const list = [];

    if (access.car) list.push("mit Auto");
    if (access.publicTransport) list.push("Öffentlich");
    if (access.hikeAndFly) list.push("Hike & Fly");
    if (access.cableCar) list.push("mit Seilbahn");

    return list.length ? list.join(", ") : "Keine Angabe";
}

    function formatFlight(fc) {
        if (!fc) return "Keine Angabe";

        const list = [];

        if (fc.soaring) list.push("Soaring");
        if (fc.thermal) list.push("Thermik");
        if (fc.crossCountry) list.push("Streckenflug");
        if (fc.walkAndFly) list.push("Walk & Fly");
        if (fc.skiAndFly) list.push("Ski & Fly");
        if (fc.winch) list.push("Windenschlepp");

        return list.length ? list.join(", ") : "Keine Angabe";
    }
    function buildGoogleMapsLink(coords) {
    if (!coords?.lat || !coords?.lon) return null;

    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`;
}

});

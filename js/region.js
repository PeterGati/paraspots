const region = "tirol";

fetch(`data/${region}/region-index.json`)
    .then(response => response.json())
    .then(data => {
        const list = document.getElementById("region-list");

        data.forEach(site => {
            const li = document.createElement("li");
            li.textContent = site.name;

            li.addEventListener("click", () => {
                window.location.href =
                    `startplatz.html?region=${region}&site=${site.file}`;
            });

            list.appendChild(li);
        });
    })
    .catch(error => {
        console.error("Fehler beim Laden der Region:", error);
    });

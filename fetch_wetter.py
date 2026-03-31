import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

URL = "https://www.austrocontrol.at/wetter/wetter_fuer_alle/wettervorhersage"

def fetch_wetter():
    response = requests.get(URL)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    full_text = soup.get_text(separator="\n")

    start_marker = "FLUGWETTER"
    end_marker = "Die nächste planmäßige Aktualisierung erfolgt"

    if start_marker not in full_text:
        print("Forecast Abschnitt nicht gefunden.")
        return

    start_index = full_text.find(start_marker)
    end_index = full_text.find(end_marker)

    if end_index == -1:
        end_index = start_index + 6000

    forecast_text = full_text[start_index:end_index]

    # -------------------------
    # SZEKCIÓK SZÉTVÁGÁSA
    # -------------------------

    sections = []
    current_section = None

    lines = forecast_text.split("\n")

    for line in lines:
        clean = line.strip()

        if not clean:
            continue

        # Heute tagsüber felismerése
        if "vorhersage von heute" in clean.lower():
            current_section = {
                "title": "Heute tagsüber",
                "content": ""
            }
            sections.append(current_section)
            continue

        # Kommende Nacht felismerése
        if "kommende nacht" in clean.lower():
            current_section = {
                "title": "Kommende Nacht",
                "content": ""
            }
            sections.append(current_section)
            continue

        # Dátum felismerés (pl. 16.02.2026)
        if clean.count(".") == 2 and clean.replace(".", "").isdigit():
            current_section = {
                "title": clean,
                "content": ""
            }
            sections.append(current_section)
            continue

        if current_section:
            current_section["content"] += clean + "\n"

    # -------------------------
    # FÖHN DETECTION
    # -------------------------

    foehn_keywords = ["Föhn", "foehn", "Nordföhn", "Südföhn", "föhnig"]
    foehn_warning = any(
        keyword.lower() in forecast_text.lower()
        for keyword in foehn_keywords
    )

    data = {
    "lastUpdated": datetime.now().isoformat(),
    "foehnWarning": foehn_warning,
    "sections": sections,
    "forecast": forecast_text.strip()
}


    with open("data/wetter.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("Wetter erfolgreich aktualisiert.")

if __name__ == "__main__":
    fetch_wetter()

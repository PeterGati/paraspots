import requests
from bs4 import BeautifulSoup
import re
import json
import os

DETAIL_URL = "https://www.paragliding365.com/index-p-flightarea_details_310.html"


# ---------------------------
# SEGÉDFÜGGVÉNYEK
# ---------------------------

def dms_to_decimal(dms_string):
    match = re.match(r"(\d+)°\s*(\d+)'\s*(\d+)''\s*([NSEO])", dms_string.strip())
    if not match:
        return None

    degrees = int(match.group(1))
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    direction = match.group(4)

    decimal = degrees + minutes / 60 + seconds / 3600

    if direction in ["S", "W"]:
        decimal *= -1

    return round(decimal, 6)


def extract_height_difference(text):
    match = re.search(
        r"Höhenunterschied:\s*(\d+)\s*.*?\s*(\d+)\s*Meter",
        text,
        re.DOTALL
    )
    if match:
        return f"{match.group(1)} bis {match.group(2)} Meter"
    return ""


def extract_flight_options(text):
    def parse_option(label):
        match = re.search(label + r":\s*(Ja|Nein|Keine Angabe)", text)
        if match:
            value = match.group(1)
            if value == "Ja":
                return True
            if value == "Nein":
                return False
        return None

    return {
        "seilbahn": parse_option("Seilbahn"),
        "streckenflug": parse_option("Streckenflug"),
        "soaring": parse_option("Soaring"),
        "walkAndFly": parse_option("Walk and Fly"),
        "skiAndFly": parse_option("Ski and Fly"),
        "windenschlepp": parse_option("Windenschlepp"),
    }


def extract_gps(text):
    match = re.search(r"GPS Tal:\s*(.+?),\s*(.+)", text)
    if not match:
        return None, None

    lat_dms = match.group(1)
    lon_dms = match.group(2)

    lat = dms_to_decimal(lat_dms)
    lon = dms_to_decimal(lon_dms)

    return lat, lon


def extract_startplaetze(soup):
    startplaetze = []

    h2 = soup.find("h2", string=lambda t: t and "Startplätze" in t)
    if not h2:
        return startplaetze

    current = h2.find_next("div", class_="start")

    while current:
        name = None
        start_height = None
        launch_directions = []
        notes = ""

        col1_elements = current.find_all("div", class_="col1")
        col2_elements = current.find_all("div", class_="col2")

        for col1, col2 in zip(col1_elements, col2_elements):
            label = col1.get_text(strip=True)
            value = col2.get_text(strip=True)

            if "Startplatz" in label:
                name = value

            if "Startrichtung" in label:
                launch_directions = [value]

            if "Höhe über NN" in label:
                try:
                    start_height = int(value)
                except:
                    start_height = None

        note_block = current.find("div", class_="col12")
        if note_block:
            notes = note_block.get_text(strip=True)

        startplaetze.append({
            "name": name,
            "id": name.lower().replace(" ", "-") if name else None,
            "coordinates": {
                "lat": None,
                "lon": None
            },
            "startHeight": start_height,
            "launchDirections": launch_directions,
            "notes": notes
        })

        current = current.find_next_sibling("div", class_="start")

    return startplaetze


# ---------------------------
# MAIN
# ---------------------------

def main():
    print("📥 Lade Detail-Seite...\n")

    response = requests.get(DETAIL_URL)
    response.encoding = response.apparent_encoding
    soup = BeautifulSoup(response.text, "html.parser")

    full_text = soup.get_text(separator="\n", strip=True)

    name_match = re.search(r"\n([^\n]+),\s*\d+\s*Meter", full_text)
    name = name_match.group(1) if name_match else "Unbekannt"

    height_diff = extract_height_difference(full_text)
    flight_options = extract_flight_options(full_text)
    lat, lon = extract_gps(full_text)

    startplaetze = extract_startplaetze(soup)

    structured = {
        "region": "tirol",
        "name": name,
        "heightDifference": height_diff,
        "coordinates": {
            "lat": lat,
            "lon": lon
        },
        "flightOptions": flight_options,
        "startpunkte": startplaetze,
        "landeplaetze": []
    }

    print("=== STRUCTURED OUTPUT ===\n")
    print(structured)

    output_folder = "data/tirol"
    os.makedirs(output_folder, exist_ok=True)

    output_path = os.path.join(output_folder, "hintertux-auto.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured, f, indent=2, ensure_ascii=False)

    print("\n💾 Gespeichert:", output_path)


if __name__ == "__main__":
    main()

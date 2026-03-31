import requests
from bs4 import BeautifulSoup
import re
import json
import os
import sys


# ============================
# RATING MAPPING
# ============================

THERMAL_MAP = {
    "v1.gif": 0,
    "v3.gif": 1,
    "v4.gif": 1.5,
    "v5.gif": 2,
    "v6.gif": 2.5,
    "v8.gif": 3.5,
    "v9.gif": 4,
    "v10.gif": 4.5,
    "v11.gif": 5,
}

INFRA_MAP = {
    "q1.gif": 0,
    "q3.gif": 1,
    "q4.gif": 1.5,
    "q5.gif": 2,
    "q6.gif": 2.5,
    "q7.gif": 3,
    "q8.gif": 3.5,
    "q9.gif": 4,
    "q10.gif": 4.5,
}


# ============================
# SEGÉDFÜGGVÉNYEK
# ============================

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


def extract_gps(text):
    match = re.search(r"GPS Tal:\s*(.+?),\s*(.+)", text)
    if not match:
        return None, None

    return dms_to_decimal(match.group(1)), dms_to_decimal(match.group(2))


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


def extract_wind_directions(soup):
    directions = []

    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "images/start/" in src and "_" in src:
            filename = src.split("/")[-1]
            name = filename.replace(".gif", "")
            parts = name.split("_")
            for p in parts:
                if p != "x":
                    directions.append(p.upper())

    return sorted(list(set(directions)))


def extract_ratings(soup):
    thermal = None
    infra = None

    for img in soup.find_all("img"):
        src = img.get("src", "")
        filename = src.split("/")[-1]

        if filename in THERMAL_MAP:
            thermal = THERMAL_MAP[filename]

        if filename in INFRA_MAP:
            infra = INFRA_MAP[filename]

    return thermal, infra


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
                launch_directions = [v.strip().upper() for v in value.split(",")]

            if "Höhe über NN" in label:
                try:
                    start_height = int(value)
                except:
                    start_height = None

        note_block = current.find("div", class_="col12")
        if note_block:
            notes = note_block.get_text(strip=True)

        startplaetze.append({
            "id": name.lower().replace(" ", "-") if name else None,
            "name": name,
            "coordinates": {"lat": None, "lon": None},
            "startHeight": start_height,
            "launchDirections": launch_directions,
            "difficulty": None,
            "windSensitivity": None,
            "notes": notes
        })

        current = current.find_next_sibling("div", class_="start")

    return startplaetze


def extract_landeplaetze(soup):
    landeplaetze = []

    h2 = soup.find("h2", string=lambda t: t and "Landeplätze" in t)
    if not h2:
        return landeplaetze

    current = h2.find_next("div", class_="zone")

    while current:
        name = None
        height = None
        notes = ""

        col1_elements = current.find_all("div", class_="col1")
        col2_elements = current.find_all("div", class_="col2")

        for col1, col2 in zip(col1_elements, col2_elements):
            label = col1.get_text(strip=True)
            value = col2.get_text(strip=True)

            if "Landeplatz" in label:
                name = value

            if "Höhe über NN" in label:
                try:
                    height = int(value)
                except:
                    height = None

        note_block = current.find("div", class_="col12")
        if note_block:
            notes = note_block.get_text(strip=True)

        landeplaetze.append({
            "id": name.lower().replace(" ", "-") if name else None,
            "name": name,
            "coordinates": {"lat": None, "lon": None},
            "height": height,
            "difficulty": None,
            "notes": notes
        })

        current = current.find_next_sibling("div", class_="zone")

    return landeplaetze


# ============================
# MAIN
# ============================

def main():
    if len(sys.argv) < 3:
        print("Használat: python3 scraper_detail.py <detail_url> <region>")
        return

    detail_url = sys.argv[1]
    region = sys.argv[2]

    print("📥 Lade Detail-Seite...\n")

    response = requests.get(detail_url)
    response.encoding = response.apparent_encoding
    soup = BeautifulSoup(response.text, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)

    name_match = re.search(r"\n([^\n]+),\s*\d+\s*Meter", full_text)
    name = name_match.group(1) if name_match else "Unbekannt"

    lat, lon = extract_gps(full_text)
    height_diff = extract_height_difference(full_text)
    flight_options = extract_flight_options(full_text)
    wind_dirs = extract_wind_directions(soup)
    thermal, infra = extract_ratings(soup)

    structured = {
        "region": region,
        "name": name,
        "description": "",
        "coordinates": {"lat": lat, "lon": lon},
        "heightDifference": height_diff,
        "windDirections": wind_dirs,
        "thermalRating": thermal,
        "infrastructureRating": infra,
        "flightOptions": flight_options,
        "operator": {"name": None, "url": None},
        "parking": None,
        "airspaces": [],
        "startpunkte": extract_startplaetze(soup),
        "landeplaetze": extract_landeplaetze(soup)
    }

    slug = name.lower().replace(" ", "-")
    output_folder = f"data/{region}"
    os.makedirs(output_folder, exist_ok=True)

    output_path = os.path.join(output_folder, f"{slug}.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(structured, f, indent=2, ensure_ascii=False)

    print("\n💾 Gespeichert:", output_path)


if __name__ == "__main__":
    main()

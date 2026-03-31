import requests
from bs4 import BeautifulSoup
import json
import re
import os
import unicodedata

# =====================================
# CONFIG
# =====================================

REGION = "salzburg"
BASE_OUTPUT_DIR = os.path.join("data", REGION)

# IDE írd az aktuális 365 URL-t
SITE_URL = "https://www.paragliding365.com/index-p-flightarea_details_43.html"


# =====================================
# HELPERS
# =====================================

def slugify(text):
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("utf-8")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text)
    return text.lower().strip("-")


def dms_to_decimal(dms):
    parts = re.findall(r"\d+(?:\.\d+)?", dms)
    if len(parts) < 3:
        return None
    deg, minutes, seconds = map(float, parts[:3])
    return deg + minutes / 60 + seconds / 3600


def parse_thermal_rating(filename):
    mapping = {
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
    return mapping.get(filename)


def parse_star_rating(filename):
    mapping = {
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
    return mapping.get(filename)


# =====================================
# SCRAPER
# =====================================

def scrape_site():

    response = requests.get(SITE_URL)
    response.encoding = "utf-8"
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    page_text = soup.get_text("\n")

    # SITE NAME
    h1 = soup.find("h1")
    site_name = h1.get_text(strip=True) if h1 else "Unbekannt"

    # TAL HEIGHT
    tal_height_match = re.search(r"Talhöhe.*?(\d+)", page_text)
    tal_height = int(tal_height_match.group(1)) if tal_height_match else None

    # RATINGS
    thermal_rating = None
    start_rating = None

    for img in soup.find_all("img"):
        filename = img.get("src", "").split("/")[-1]

        tr = parse_thermal_rating(filename)
        if tr is not None:
            thermal_rating = tr

        sr = parse_star_rating(filename)
        if sr is not None:
            start_rating = sr

    # =====================================
    # STARTPUNKTE (DOM + LINE PARSING)
    # =====================================

    startpunkte = []
    all_directions = set()

    start_sections = soup.find_all("div", class_="start")

    for section in start_sections:

        section_text = section.get_text("\n")
        lines = [l.strip() for l in section_text.split("\n") if l.strip()]

        name = None
        start_height = None
        difficulty = None
        directions = []
        description = None
        lat = lon = None

        for i, line in enumerate(lines):

            if line.startswith("Startplatz"):
                if i + 1 < len(lines):
                    name = lines[i + 1]

            elif line.startswith("GPS"):
                if i + 1 < len(lines):
                    gps_line = lines[i + 1]
                    gps_match = re.search(r"(\d+°.*?N).*?(\d+°.*?[EO])", gps_line)
                    if gps_match:
                        lat = dms_to_decimal(gps_match.group(1))
                        lon = dms_to_decimal(gps_match.group(2))

            elif line.startswith("Höhe über NN"):
                if i + 1 < len(lines):
                    try:
                        start_height = int(lines[i + 1])
                    except:
                        start_height = None

            elif line.startswith("Schwierigkeit"):
                if i + 1 < len(lines):
                    difficulty = lines[i + 1]

            elif line.startswith("Startrichtung"):
                if i + 1 < len(lines):
                    directions = [d.strip().upper() for d in lines[i + 1].split()]

            elif line == "NN:":
                if i + 1 < len(lines):
                    description = " ".join(lines[i + 1:])

        all_directions.update(directions)

        startpunkte.append({
            "id": slugify(name) if name else None,
            "name": name,
            "coordinates": {
                "lat": lat,
                "lon": lon
            } if lat and lon else None,
            "startHeight": start_height,
            "heightDifference": None,
            "launchDirections": directions,
            "difficulty": difficulty,
            "windSensitivity": None,
            "startRating": None,
            "description": description
        })

    # =====================================
    # BUILD FINAL OBJECT
    # =====================================

    site_object = {
        "region": REGION,
        "name": site_name,
        "coordinates": None,
        "talHeight": tal_height,
        "operator": None,
        "access": None,
        "parking": None,
        "airspace": None,
        "flightCharacteristics": None,
        "siteRatings": {
            "thermalRating": thermal_rating,
            "startRating": start_rating
        },
        "windDirections": sorted(list(all_directions)),
        "webcam": None,
        "approachDescription": None,
        "description": None,
        "startpunkte": startpunkte,
        "landeplaetze": []
    }

    os.makedirs(BASE_OUTPUT_DIR, exist_ok=True)

    filename = slugify(site_name) + ".json"
    filepath = os.path.join(BASE_OUTPUT_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(site_object, f, indent=2, ensure_ascii=False)

    print(f"✔ Datei gespeichert: {filepath}")


if __name__ == "__main__":
    scrape_site()

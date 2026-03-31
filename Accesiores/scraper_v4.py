import requests
from bs4 import BeautifulSoup
import json
import re
import sys
import os


# ==========================
# RATING MAPPEK
# ==========================

Q_MAP = {
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

V_MAP = {
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


# ==========================
# SEGÉDFÜGGVÉNYEK
# ==========================

def slugify(text):
    text = text.lower()
    text = text.replace("ä", "ae")
    text = text.replace("ö", "oe")
    text = text.replace("ü", "ue")
    text = text.replace("ß", "ss")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def extract_max_rating(images, rating_map):
    max_val = 0
    for img in images:
        src = img.get("src", "")
        for key in rating_map:
            if key in src:
                max_val = max(max_val, rating_map[key])
    return max_val


def parse_dms_to_decimal(dms_text):
    match = re.search(r"(\d+)°\s*(\d+)'?\s*(\d+)?''?\s*([NSEO])", dms_text)
    if not match:
        return None

    deg = float(match.group(1))
    minute = float(match.group(2))
    sec = float(match.group(3)) if match.group(3) else 0
    direction = match.group(4)

    decimal = deg + minute / 60 + sec / 3600

    if direction in ["S", "W"]:
        decimal *= -1

    return decimal


# ==========================
# PARSING BLOKKOK
# ==========================

def extract_tal_gps(soup):
    lat = None
    lon = None
    col1s = soup.find_all("div", class_="col1")

    for c in col1s:
        if c.text.strip().startswith("GPS Tal"):
            col2 = c.find_next("div", class_="col2")
            if col2 and col2.find("a"):
                text = col2.find("a").text
                parts = text.split(",")
                if len(parts) == 2:
                    lat = parse_dms_to_decimal(parts[0])
                    lon = parse_dms_to_decimal(parts[1])
            break

    return lat, lon


def extract_tal_height(soup):
    col1s = soup.find_all("div", class_="col1")
    for c in col1s:
        if "Höhe Talort" in c.text:
            col2 = c.find_next("div", class_="col2")
            if col2:
                match = re.search(r"\d+", col2.text)
                if match:
                    return int(match.group())
    return None


def extract_site_wind_directions(soup):
    images = soup.find_all("img")
    for img in images:
        src = img.get("src", "")
        if "images/start/" in src:
            filename = os.path.basename(src).replace(".gif", "")
            if filename == "x_x_x_x_x_x_x_x":
                return []
            parts = filename.split("_")

            mapping = {
                "n": "N",
                "ne": "NO",
                "e": "O",
                "se": "SO",
                "s": "S",
                "sw": "SW",
                "w": "W",
                "nw": "NW",
            }

            dirs = []
            for p in parts:
                if p in mapping:
                    dirs.append(mapping[p])
            return dirs
    return []


def extract_access_icons(soup):
    access = {
        "car": None,
        "publicTransport": None,
        "hikeAndFly": None,
        "cableCar": None,
        "parking": None
    }

    icons = soup.find_all("img")

    for icon in icons:
        src = icon.get("src", "")

        def bool_from_icon(s):
            if "_schwarz" in s:
                return True
            if "_grau" in s:
                return False
            return None

        if "icon_fa_seilbahn" in src:
            access["cableCar"] = bool_from_icon(src)
        if "icon_fa_walkandfly" in src:
            access["hikeAndFly"] = bool_from_icon(src)
        if "icon_fa_windenschlepp" in src:
            access["car"] = bool_from_icon(src)

    return access


def extract_approach_description(soup):
    labels = soup.find_all("div", class_="itemcol1")
    for l in labels:
        if l.text.strip().startswith("Anfahrt"):
            col2 = l.find_next("div", class_="itemcol2")
            if col2:
                return col2.get_text(strip=True)
    return None


def extract_description(soup):
    fa = soup.find("div", id="fa")
    if fa:
        paragraphs = fa.find_all("div", class_="item")
        if paragraphs:
            return paragraphs[0].get_text(strip=True)
    return None


def parse_startpunkte(soup):
    startpunkte = []
    starts = soup.find_all("div", class_="start")

    for s in starts:
        name = None
        start_height = None
        difficulty = None
        directions = []
        lat = None
        lon = None

        col1s = s.find_all("div", class_="col1")
        col2s = s.find_all("div", class_="col2")

        for i, c in enumerate(col1s):
            label = c.text.strip()

            if label.startswith("Startplatz"):
                name = col2s[i].text.strip()

            if label.startswith("Höhe"):
                match = re.search(r"\d+", col2s[i].text)
                if match:
                    start_height = int(match.group())

            if label.startswith("Schwierigkeit"):
                difficulty = col2s[i].text.strip()

            if label.startswith("GPS-Koordinaten"):
                link = col2s[i].find("a")
                if link:
                    parts = link.text.split(",")
                    if len(parts) == 2:
                        lat = parse_dms_to_decimal(parts[0])
                        lon = parse_dms_to_decimal(parts[1])

        img = s.find("img")
        if img and "images/start/" in img.get("src", ""):
            filename = os.path.basename(img.get("src")).replace(".gif", "")
            if filename != "x_x_x_x_x_x_x_x":
                parts = filename.split("_")
                mapping = {
                    "n": "N",
                    "ne": "NO",
                    "e": "O",
                    "se": "SO",
                    "s": "S",
                    "sw": "SW",
                    "w": "W",
                    "nw": "NW",
                }
                for p in parts:
                    if p in mapping:
                        directions.append(mapping[p])

        startpunkte.append({
            "id": slugify(name) if name else None,
            "name": name,
            "coordinates": {
                "lat": lat,
                "lon": lon
            },
            "startHeight": start_height,
            "heightDifference": None,
            "launchDirections": directions,
            "difficulty": difficulty,
            "windSensitivity": None,
            "startRating": 0,
            "description": s.get_text(strip=True)
        })

    return startpunkte


def parse_landeplaetze(soup):
    landeplaetze = []
    zones = soup.find_all("div", class_="zone")

    for z in zones:
        name = None
        height = None
        difficulty = None
        lat = None
        lon = None

        col1s = z.find_all("div", class_="col1")
        col2s = z.find_all("div", class_="col2")

        for i, c in enumerate(col1s):
            label = c.text.strip()

            if label.startswith("Landeplatz"):
                name = col2s[i].text.strip()

            if label.startswith("Höhe"):
                match = re.search(r"\d+", col2s[i].text)
                if match:
                    height = int(match.group())

            if label.startswith("Schwierigkeit"):
                difficulty = col2s[i].text.strip()

            if label.startswith("GPS-Koordinaten"):
                link = col2s[i].find("a")
                if link:
                    parts = link.text.split(",")
                    if len(parts) == 2:
                        lat = parse_dms_to_decimal(parts[0])
                        lon = parse_dms_to_decimal(parts[1])

        landeplaetze.append({
            "id": slugify(name) if name else None,
            "name": name,
            "coordinates": {
                "lat": lat,
                "lon": lon
            },
            "height": height,
            "difficulty": difficulty,
            "description": z.get_text(strip=True)
        })

    return landeplaetze


def compute_height_differences(startpunkte, landeplaetze):
    landing_heights = [l["height"] for l in landeplaetze if l["height"]]

    if not landing_heights:
        return None

    min_landing = min(landing_heights)

    max_site = None

    for sp in startpunkte:
        if sp["startHeight"]:
            diff = sp["startHeight"] - min_landing
            sp["heightDifference"] = diff
            if not max_site or diff > max_site:
                max_site = diff

    return max_site


# ==========================
# FŐ SCRAPER
# ==========================

def scrape(url, region_slug):

    response = requests.get(url)
    response.encoding = response.apparent_encoding
    soup = BeautifulSoup(response.text, "html.parser")

    h1 = soup.find("h1")
    site_name = h1.text.split(",")[0].strip() if h1 else "Unbekannt"

    images = soup.find_all("img")
    overall_rating = extract_max_rating(images, Q_MAP)
    thermal_rating = extract_max_rating(images, V_MAP)

    lat, lon = extract_tal_gps(soup)
    tal_height = extract_tal_height(soup)
    wind_dirs = extract_site_wind_directions(soup)
    access = extract_access_icons(soup)
    approach_text = extract_approach_description(soup)
    description = extract_description(soup)

    startpunkte = parse_startpunkte(soup)
    landeplaetze = parse_landeplaetze(soup)

    max_diff = compute_height_differences(startpunkte, landeplaetze)

    data = {
        "region": region_slug,
        "name": site_name,
        "coordinates": {"lat": lat, "lon": lon},
        "talHeight": tal_height,
        "operator": {"name": None, "url": None},
        "access": access,
        "airspace": [],
        "flightCharacteristics": {
            "soaring": None,
            "thermal": None,
            "crossCountry": None
        },
        "siteRatings": {
            "overallRating": overall_rating,
            "thermalRating": thermal_rating
        },
        "maxHeightDifference": max_diff,
        "typicalDifficulty": None,
        "windDirections": wind_dirs,
        "webcam": None,
        "approachDescription": approach_text,
        "description": description,
        "startpunkte": startpunkte,
        "landeplaetze": landeplaetze
    }

    filename = slugify(site_name) + ".json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✔ Kész: {filename}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Használat: python3 scraper_v4.py <url> <region_slug>")
        sys.exit(1)

    scrape(sys.argv[1], sys.argv[2])

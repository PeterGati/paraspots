import requests
import json
import os
from datetime import datetime

# Mappák, ahol a spot JSON-ek vannak
DATA_DIR = "data"

def degrees_to_direction(deg):
    dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
    return dirs[round(deg / 45) % 8]

def fetch_all_weather():
    weather_data = {
        "lastUpdated": datetime.now().isoformat(),
        "spots": {}
    }

    # Végigmegyünk az összes régión
    for region in os.listdir(DATA_DIR):
        region_path = os.path.join(DATA_DIR, region)
        if not os.path.isdir(region_path):
            continue

        for filename in os.listdir(region_path):
            if not filename.endswith(".json"):
                continue

            filepath = os.path.join(region_path, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    spot = json.load(f)

                if "coordinates" not in spot or not spot["coordinates"].get("lat"):
                    continue

                lat = spot["coordinates"]["lat"]
                lon = spot["coordinates"]["lon"]
                site_key = f"{region}/{filename.replace('.json', '')}"

                # Open-Meteo hívás
                url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}" + \
                      "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability" + \
                      "&timezone=Europe/Vienna"

                response = requests.get(url, timeout=10)
                data = response.json()

                c = data["current"]
                weather_data["spots"][site_key] = {
                    "temperature": round(c["temperature_2m"], 1),
                    "wind_speed": round(c["wind_speed_10m"]),
                    "wind_direction": round(c["wind_direction_10m"]),
                    "wind_dir_text": degrees_to_direction(c["wind_direction_10m"]),
                    "wind_gusts": round(c["wind_gusts_10m"]),
                    "precipitation": c["precipitation_probability"],
                    "timestamp": datetime.now().isoformat()
                }

                print(f"✅ {spot.get('name', filename)} - OK")

            except Exception as e:
                print(f"⚠ Hiba {filename}: {e}")

    # Mentés
    with open("data/current-weather.json", "w", encoding="utf-8") as f:
        json.dump(weather_data, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 Kész! {len(weather_data['spots'])} spot időjárása elmentve.")

if __name__ == "__main__":
    fetch_all_weather()

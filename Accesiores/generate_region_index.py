import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "regions.json")


def prettify_region_name(slug):
    return slug.replace("-", " ").title()


def generate_index():
    regions_output = []

    # Minden mappa a data alatt = régió
    for region_slug in sorted(os.listdir(DATA_DIR)):

        region_path = os.path.join(DATA_DIR, region_slug)

        if not os.path.isdir(region_path):
            continue

        # Kihagyjuk ha nincs benne json
        json_files = [
            f for f in os.listdir(region_path)
            if f.endswith(".json")
        ]

        if not json_files:
            continue

        region_entry = {
            "slug": region_slug,
            "name": prettify_region_name(region_slug),
            "sites": []
        }

        for filename in sorted(json_files):

            filepath = os.path.join(region_path, filename)

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"⚠ Fehler beim Lesen von {filename}: {e}")
                continue

            site_slug = filename.replace(".json", "")
            site_name = data.get("name", site_slug)

            region_entry["sites"].append({
                "slug": site_slug,
                "name": site_name
            })

        regions_output.append(region_entry)

    final_output = {
        "regions": regions_output
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print("✔ regions.json erfolgreich generiert.")


if __name__ == "__main__":
    generate_index()

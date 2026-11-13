"""Build web derivatives from the checked Assignment 2 index; do not geocode rooms."""
from pathlib import Path
import csv
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
GIS = ROOT.parent
SOURCE = GIS / 'Assignment 2 - Columbia Teaching Spaces/data/processed/manhattan'
STYLE = GIS / 'Tutorial 8.1 - Columbia Blue Basemap/style.json'

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    buildings = json.loads((SOURCE / 'building_locations.geojson').read_text())
    spaces = list(csv.DictReader((SOURCE / 'spaces.csv').open()))
    keep = ['space_id', 'building_id', 'building_name', 'map_panel', 'room_key',
            'position_precision', 'floor_status', 'floor_review_note', 'checked_date']
    lists = ['room_labels', 'room_types', 'accepted_floor_values', 'source_urls', 'institutions']
    rows = [{**{k: r[k] for k in keep}, **{k: json.loads(r[k]) for k in lists}} for r in spaces]
    ids = {f['properties']['building_id'] for f in buildings['features']}
    assert len(ids) == len(buildings['features']) == 84
    assert len({r['space_id'] for r in rows}) == len(rows) == 551
    assert not any(r['room_coordinates'] for r in spaces)
    for f in buildings['features']:
        p = f['properties']
        p['directory_count'] = sum(r['building_id'] == p['building_id'] for r in rows)
    dump(ROOT / 'data/buildings.geojson', buildings)
    dump(ROOT / 'data/spaces.json', rows)
    shutil.copyfile(STYLE, ROOT / 'style.json')
    manifest = {
        'prepared': '2026-11-12',
        'source_checked_date': '2026-10-09',
        'reference_points': len(ids), 'space_name_entries': len(rows),
        'space_entries_with_reference': sum(r['building_id'] in ids for r in rows),
        'space_entries_without_reference': sum(r['building_id'] not in ids for r in rows),
        'room_coordinates': 0,
        'method': 'Preserve source coordinates and stable IDs; join directory by building_id. No new location inference.',
        'inputs': [{'path': str(p.relative_to(GIS)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                   for p in [SOURCE / 'building_locations.geojson', SOURCE / 'spaces.csv', STYLE]],
    }
    dump(ROOT / 'sources/data-provenance.json', manifest)
    print(json.dumps({k: v for k, v in manifest.items() if k not in ['inputs', 'method']}))

if __name__ == '__main__':
    main()

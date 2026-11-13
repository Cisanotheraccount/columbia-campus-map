from pathlib import Path
import json
import collections
from datetime import datetime, timezone
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
buildings = json.loads((ROOT / 'data/buildings.geojson').read_text())['features']
spaces = json.loads((ROOT / 'data/spaces.json').read_text())
style = json.loads((ROOT / 'style.json').read_text())
ids = {f['properties']['building_id'] for f in buildings}
assert len(ids) == len(buildings) == 84
assert len(spaces) == len({r['space_id'] for r in spaces}) == 551
assert all(f['geometry']['type'] == 'Point' and len(f['geometry']['coordinates']) == 2 for f in buildings)
assert sum(r['building_id'] not in ids for r in spaces) == 24
assert all('room_coordinates' not in r for r in spaces)
assert collections.Counter(f['properties']['entity_type'] for f in buildings) == {'building': 83, 'institution_site': 1}
assert {f['properties']['map_panel'] for f in buildings} == {'Morningside', 'Manhattanville', 'CUIMC'}
for f in buildings:
    lon, lat = f['geometry']['coordinates']
    assert -74.1 < lon < -73.8 and 40.7 < lat < 40.95, f['properties']['building_id']
    source_url = f['properties'].get('source_url') or (f['properties'].get('source_urls') or [''])[0]
    assert source_url.startswith(('https://', 'http://'))
fayerweather = [r for r in spaces if 'fayerweather' in r['building_id'] and r['room_key'] == '203']
assert len(fayerweather) == 1 and 'conflict' in fayerweather[0]['floor_status']
assert not fayerweather[0]['accepted_floor_values']
assert style['version'] == 8 and len(style['layers']) > 0
for f in buildings:
    assert f['properties']['directory_count'] == sum(r['building_id'] == f['properties']['building_id'] for r in spaces)

class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ('src', 'href') and v and not v.startswith(('http:', 'https:', '#', 'data:')):
                assert not v.startswith('/'), f'Root-relative URL: {v}'
                assert (ROOT / v).exists(), f'Missing local file: {v}'

Links().feed((ROOT / 'full-page-map.html').read_text())
assert 'operations-avery-hall' in ids
groups = collections.defaultdict(list)
for f in buildings:
    groups[tuple(f['geometry']['coordinates'])].append(f['properties']['building_id'])
report = {
    'checked': datetime.now(timezone.utc).isoformat(), 'static_checks': 'passed',
    'building_reference_features': 84, 'space_name_entries': 551,
    'unplaced_space_entries': 24, 'room_coordinates_created': 0,
    'coincident_reference_groups': [v for v in groups.values() if len(v) > 1],
    'browser_render_check': 'not run by static validator',
    'resource_cap_check': 'not run by static validator',
}
(ROOT / 'qa').mkdir(exist_ok=True)
(ROOT / 'qa/static-checks.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))

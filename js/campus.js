import * as maplibregl from 'maplibre-gl';

// One worker and one device pixel per CSS pixel keep this map light.
if (typeof maplibregl.setWorkerCount === 'function') maplibregl.setWorkerCount(1);
else maplibregl.workerCount = 1;
await import('../vendor/maplibre-yaml-0.10.2.js');

const $ = id => document.getElementById(id);
const host = $('campus-map');
const drawer = $('directory');
const search = $('search');
const results = $('results');
const detail = $('building-detail');
const status = $('status');
const campus = $('campus');
const views = {
  Morningside: { center: [-73.9625, 40.8082], zoom: 15.5 },
  Manhattanville: { center: [-73.9565, 40.8183], zoom: 15.9 },
  CUIMC: { center: [-73.9415, 40.8418], zoom: 15.5 },
};
let map;
let buildings = [];
let spaces = [];
let byId = new Map();

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function setOpen(open) {
  drawer.hidden = !open;
  $('search-toggle').setAttribute('aria-expanded', String(open));
  if (open) search.focus({ preventScroll: true });
}
function sourceLink(url) {
  const a = node('a', 'Source');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
function showBuilding(id, focus = true) {
  const f = byId.get(id);
  if (!f) return;
  const p = f.properties;
  setOpen(true);
  results.replaceChildren();
  detail.hidden = false;
  detail.replaceChildren();
  const back = node('button', '← Results', 'back');
  back.onclick = renderResults;
  detail.append(back, node('h2', p.name, 'detail-title'));
  detail.append(node('p', `${p.map_panel} · ${p.entity_type === 'institution_site' ? 'Institution reference' : 'Building reference'}`, 'detail-meta'));
  if (p.address) detail.append(node('p', p.address, 'detail-meta'));
  const list = spaces.filter(r => r.building_id === id);
  detail.append(node('p', list.length ? `${list.length} directory entries. Room positions are not mapped.` : 'No space directory linked in this index.', 'detail-meta'));
  const buildingSource = p.source_url || p.source_urls?.[0];
  if (buildingSource) detail.append(sourceLink(buildingSource));
  if (window.parent !== window && p.building_id === 'operations-avery-hall') {
    const explore = node('button', 'Explore scanned basement', 'explore');
    explore.onclick = () => window.parent.postMessage({ type: 'avery-explore', buildingId: p.building_id }, location.origin);
    detail.append(explore);
  }
  const ul = node('ul', undefined, 'space-list');
  for (const r of list.sort((a,b) => a.room_key.localeCompare(b.room_key, undefined, { numeric: true }))) {
    const li = node('li');
    li.append(node('strong', r.room_labels.join(' / ') || r.room_key));
    const floor = r.accepted_floor_values.length ? `Floor: ${r.accepted_floor_values.join(' / ')}` : r.floor_status.includes('conflict') ? 'Floor statement requires review' : 'Floor not confirmed';
    li.append(node('p', `${floor}${r.room_types.length ? ' · ' + r.room_types.join(' / ') : ''}`));
    if (r.source_urls[0]) li.append(sourceLink(r.source_urls[0]));
    ul.append(li);
  }
  detail.append(ul);
  if (focus && map) map.jumpTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 17) });
  if (views[p.map_panel]) campus.value = p.map_panel;
  history.replaceState(null, '', `#building=${encodeURIComponent(id)}`);
}
function resultButton(title, subtitle, onClick) {
  const button = node('button', undefined, 'result');
  button.append(node('strong', title), node('small', subtitle));
  button.onclick = onClick;
  return button;
}
function renderResults() {
  detail.hidden = true;
  results.replaceChildren();
  const q = search.value.trim().toLowerCase();
  const candidates = buildings.filter(f => {
    const p = f.properties;
    if (!q) return p.map_panel === campus.value;
    return [p.name, ...(p.raw_names || []), ...(p.codes || [])].join(' ').toLowerCase().includes(q)
      || spaces.some(r => r.building_id === p.building_id && r.room_labels.join(' ').toLowerCase().includes(q));
  }).sort((a,b) => a.properties.name.localeCompare(b.properties.name));
  const unplaced = q ? spaces.filter(r => !byId.has(r.building_id) && [r.building_name, ...r.room_labels].join(' ').toLowerCase().includes(q)) : [];
  results.append(node('p', `${candidates.length} mapped reference${candidates.length === 1 ? '' : 's'}${unplaced.length ? ` · ${unplaced.length} unplaced entries` : ''}`, 'result-count'));
  for (const f of candidates) {
    const p = f.properties;
    const matching = q ? spaces.filter(r => r.building_id === p.building_id && r.room_labels.join(' ').toLowerCase().includes(q)) : [];
    results.append(resultButton(p.name, `${p.map_panel} · ${p.directory_count} entries${matching.length ? ' · matching ' + matching.slice(0,3).map(r=>r.room_key).join(', ') : ''}`, () => showBuilding(p.building_id)));
  }
  for (const r of unplaced) {
    const row = node('div', undefined, 'result');
    row.append(node('strong', `${r.building_name} / ${r.room_labels.join(' / ')}`), node('small', 'Building location unresolved; no map point created.'));
    if (r.source_urls[0]) row.append(sourceLink(r.source_urls[0]));
    results.append(row);
  }
}

$('search-toggle').onclick = () => { setOpen(drawer.hidden); if (!drawer.hidden) renderResults(); };
$('close-directory').onclick = () => setOpen(false);
$('about-toggle').onclick = () => $('about').showModal();
$('close-about').onclick = () => $('about').close();
$('about').addEventListener('click', e => { if (e.target === $('about')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('about').close(); } });
search.addEventListener('input', renderResults);
campus.addEventListener('change', () => { map?.jumpTo(views[campus.value]); search.value=''; if (!drawer.hidden) renderResults(); history.replaceState(null, '', '#campus='+campus.value); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
host.addEventListener('ml-map:error', e => { status.textContent = e.detail.fatal ? 'Map unavailable. Check the connection and reload.' : 'Some map content could not load. Directory remains available.'; });

try {
  const response = await Promise.all([fetch('data/buildings.geojson'), fetch('data/spaces.json')]);
  if (response.some(r => !r.ok)) throw new Error('Directory download failed');
  const [geojson, directory] = await Promise.all(response.map(r => r.json()));
  buildings = geojson.features;
  spaces = directory;
  byId = new Map(buildings.map(f => [f.properties.building_id, f]));
  renderResults();
  map = await host.mapReady();
  map.setPixelRatio?.(1);
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  status.textContent = '';
  // Coincident source references remain at their original coordinates.
  // A click lists every distinct building at the point rather than hiding one.
  map.on('click', e => {
    const found = map.queryRenderedFeatures([[e.point.x-5,e.point.y-5],[e.point.x+5,e.point.y+5]], { layers: ['teaching-buildings','institution-reference'] });
    const ids = [...new Set(found.map(f => f.properties.building_id))];
    if (ids.length === 1) showBuilding(ids[0], false);
    else if (ids.length > 1) {
      setOpen(true); detail.hidden = true; results.replaceChildren(node('p', 'More than one building shares this reference point.', 'muted'));
      for (const id of ids) { const p = byId.get(id)?.properties; if (p) results.append(resultButton(p.name, `${p.directory_count} directory entries`, () => showBuilding(id, false))); }
    }
  });
  const hash = new URLSearchParams(location.hash.slice(1));
  if (byId.has(hash.get('building'))) showBuilding(hash.get('building'));
  else if (views[hash.get('campus')]) { campus.value = hash.get('campus'); map.jumpTo(views[campus.value]); }
  window.campusReview = { map, buildings, spaces, showBuilding };
} catch (error) {
  status.textContent = 'Map or directory unavailable. Check the connection and reload.';
  console.error(error);
}

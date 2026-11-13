// Resolve the real ESM module: syntax-only checks do not catch missing exports.
import * as maplibre from '../vendor/maplibre-gl-6.12.0.mjs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert.equal(maplibre.getVersion(), '6.12.0');
assert.equal(typeof maplibre.Map, 'function');
assert.equal(typeof maplibre.setWorkerCount, 'function');
assert.equal(typeof maplibre.setWorkerUrl, 'function');
const app = readFileSync(new URL('../js/campus.js', import.meta.url), 'utf8');
assert.match(app, /import \* as maplibregl from 'maplibre-gl'/);
console.log('PASS: MapLibre 6.12.0 named ESM exports and application namespace import.');

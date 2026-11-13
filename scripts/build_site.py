"""Create the deployable static site from an explicit allowlist."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
for name in ['index.html', 'full-page-map.html', 'style.json', 'CODE_SOURCES.txt']:
    shutil.copy2(ROOT / name, OUT / name)
for name in ['css', 'js', 'maps', 'data', 'vendor']:
    shutil.copytree(ROOT / name, OUT / name)
(OUT / 'sources').mkdir()
for name in ['data-provenance.json', 'downloads.json']:
    shutil.copy2(ROOT / 'sources' / name, OUT / 'sources' / name)
(OUT / '.nojekyll').touch()
assert not any(p.name.startswith('._') for p in OUT.rglob('*'))
print(f'Staged {len(list(OUT.rglob("*")))} entries in _site; QA, scripts and research snapshots excluded.')

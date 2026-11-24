#!/usr/bin/env python3
"""Genera release-manifest.json e id nel Service Worker per la pubblicazione GitHub Pages.

Uso dalla radice: python3 tools/build_release.py
Non modifica salvataggi, database, formule o file di gioco.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = {'index.html', 'app.html', 'style.css', 'manifest.json'}
app = (ROOT / 'app.html').read_text(encoding='utf-8')
ASSETS.update(re.findall(r'<script\s+src="\./([^"?]+\.js)"\s+defer\s*>', app))
ASSETS.update(re.findall(r'<link[^>]+href="\./([^"?]+\.css)"', app))
if len(ASSETS) < 65:
    raise SystemExit('ERRORE: elenco asset incompleto')
for path in ASSETS:
    if '..' in path or path.startswith('/') or not (ROOT / path).is_file():
        raise SystemExit(f'ERRORE: asset assente o non valido {path}')
files = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in sorted(ASSETS)}
worker = ROOT / 'sw.js'
source = worker.read_text(encoding='utf-8')
normalized = re.sub(r"const VERSIONE_RELEASE = '[^']+';", "const VERSIONE_RELEASE = '__UNIVERSUM_RELEASE_ID__';", source)
worker_hash = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
canonical = json.dumps({'files': files, 'workerHash': worker_hash}, sort_keys=True, separators=(',', ':')).encode('utf-8')
version = 'r' + hashlib.sha256(canonical).hexdigest()[:20]
manifest = {
    'schema': 1,
    'version': version,
    'workerHash': worker_hash,
    'files': files,
}
(ROOT / 'release-manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
match = re.search(r"const VERSIONE_RELEASE = '([^']+)';", source)
if not match:
    raise SystemExit('ERRORE: variabile VERSIONE_RELEASE mancante')
worker.write_text(source[:match.start(1)] + version + source[match.end(1):], encoding='utf-8')
print(f'RELEASE {version}, {len(ASSETS)} file statici protetti SHA-256')

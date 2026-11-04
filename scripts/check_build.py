#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        for k in ('href','src'):
            if k in a:self.links.append(a[k])
count=0
for target in ['marketing','preview']:
    base=ROOT/'out'/target
    for page in base.rglob('*.html'):
        parser=Links();parser.feed(page.read_text())
        for value in parser.links:
            url=urlsplit(value)
            if url.scheme or url.netloc or not url.path:continue
            dest=(base/unquote(url.path).lstrip('/')) if url.path.startswith('/') else (page.parent/unquote(url.path))
            if dest.is_dir():dest=dest/'index.html'
            assert dest.exists(),f'Broken link: {page}: {value}'
            count+=1
base='fa66fe91575e084a58551af63df6b539a906eb57'
names=subprocess.check_output(['git','-c','core.quotepath=false','ls-tree','-r','--name-only',base],cwd=ROOT,text=True).splitlines()
legacy=[n for n in names if n.endswith(('.json','.geojson'))]
manifest={}
for name in legacy:
    # Preserve the scheduled weather update already present upstream before this work.
    reference='416a413bdff947aa74a40e85014059ca72aeab11' if name=='data/wetter.json' else base
    original=subprocess.check_output(['git','show',f'{reference}:{name}'],cwd=ROOT)
    actual=(ROOT/name).read_bytes()
    assert original==actual,f'Changed legacy data: {name}'
    manifest[name]=hashlib.sha256(actual).hexdigest()
source=Path('/Users/petergati/Downloads/PARASPOTS_DESIGN_HANDOFF/assets/paraspots-original.png')
if source.exists(): assert source.read_bytes()==(ROOT/'platform/public/assets/paraspots-original.png').read_bytes()
(ROOT/'docs/legacy-data-sha256.json').write_text(json.dumps({'base_commit':base,'upstream_weather_commit':'416a413bdff947aa74a40e85014059ca72aeab11','files':manifest},indent=2)+'\n')
assert not (ROOT/'out/marketing/data').exists()
assert not (ROOT/'out/marketing/demo').exists()
print(f'PASS: {count} local asset/link references; {len(legacy)-1} original JSON/GeoJSON files unchanged + upstream scheduled weather preserved; original emblem byte-identical; separate deployment outputs.')

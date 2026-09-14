"""Publish immutable gzip tiles; fetch only parcel regions near the camera focus."""
import json,gzip,hashlib,math
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
raw=(OUT/'terrenos-compactos.json').read_bytes();data=json.loads(raw)
SIZE=640
digest=hashlib.sha256(str(SIZE).encode()+raw).hexdigest()[:12];tiles={}
for p in data['parcels']:
    key=f"{math.floor(p['x']/SIZE)}_{math.floor(p['z']/SIZE)}"
    tiles.setdefault(key,[]).append(p)
dest=ROOT/'v16-moveis/publicado/mapa/quintais'/digest;dest.mkdir(parents=True,exist_ok=True)
for key,parcels in tiles.items():
    (dest/(key+'.bin')).write_bytes(gzip.compress(json.dumps(parcels,separators=(',',':')).encode(),mtime=0))
manifest=dict(prefix='./quintais/'+digest+'/',size=SIZE,keys=sorted(tiles),palette=data['palette'],parcels=len(data['parcels']))
(OUT/'terrenos-manifesto.json').write_text(json.dumps(manifest,separators=(',',':')))
print('TILES',len(tiles),'TOTAL BYTES',sum(p.stat().st_size for p in dest.glob('*.bin')))

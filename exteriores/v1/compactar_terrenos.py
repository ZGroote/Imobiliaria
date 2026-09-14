"""Keep millimetre geometry in binary strings, decode only the nearby parcels."""
import json,array,base64
from pathlib import Path
OUT=Path(__file__).resolve().parent
data=json.loads((OUT/'terrenos.json').read_text());palette=[]
for p in data['parcels']:
    positions=[];colors=[]
    for tri in p.pop('ground'):
        if tri[0] not in palette:palette.append(tri[0])
        colors.append(palette.index(tri[0]))
        for j,v in enumerate(tri[1:]):positions.append(round((v-(p['x'] if j%2==0 else p['z']))*1000))
    p['gp']=base64.b64encode(array.array('i',positions).tobytes()).decode()
    p['gc']=base64.b64encode(bytes(colors)).decode()
    props=[]
    for ai,x,z,t,sx,sz in p.pop('props'):
        props.extend([ai,round(x*1000),round(z*1000),round(t*1000000),round(sx*1000000),round(sz*1000000)])
    p['pp']=base64.b64encode(array.array('i',props).tobytes()).decode()
data['palette']=palette
(OUT/'terrenos-compactos.json').write_text(json.dumps(data,separators=(',',':')))
print('COMPACT',len(data['parcels']),(OUT/'terrenos-compactos.json').stat().st_size)

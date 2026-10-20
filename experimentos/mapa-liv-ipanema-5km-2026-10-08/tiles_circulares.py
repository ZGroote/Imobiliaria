"""Reescreve os tiles de quintais; nenhum dado espacial externo viaja no .bin."""
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import struct
from shapely.geometry import box


def integers(value):
    raw = base64.b64decode(value, validate=True)
    if len(raw) % 4:
        raise ValueError('Buffer Int32 inválido')
    return list(struct.unpack('<%di' % (len(raw)//4), raw))


def encoded(values):
    return base64.b64encode(struct.pack('<%di' % len(values), *values)).decode('ascii')


def recortar_tiles(pack, origem, destino, corte):
    info = pack['parcelTiles']
    source_prefix = Path(info['prefix'])
    if source_prefix.is_absolute() or '..' in source_prefix.parts:
        raise ValueError('Prefixo de origem inválido')
    identity = json.dumps({'source':info['prefix'],'center':[corte.cx,corte.cz],
                           'radius':corte.raio,'ground_policy':'continuous-circle',
                           'format':'strict-circle-v3'},sort_keys=True).encode()
    prefix = 'quintais/liv-v3-' + hashlib.sha256(identity).hexdigest()[:16] + '/'
    report = {'prefix':prefix,'arquivos':0,'bytes':0,'parcelas':0,'triangulos_antes':0,
              'triangulos_depois':0,'props_antes':0,'props_depois':0,'max_raio_m':0}
    assets = pack['assets'] + pack.get('props',[])
    spans = pack['aerial']['spans']
    quant = pack['quantization']
    keys = []
    for key in info['keys']:
        if not re.fullmatch(r'-?\d+_-?\d+',key):
            raise ValueError('Chave de tile inválida')
        parcels = json.loads(gzip.decompress((origem/source_prefix/(key+'.bin')).read_bytes()))
        selected = []
        for parcel in parcels:
            gp, pp = integers(parcel['gp']), integers(parcel['pp'])
            gc = base64.b64decode(parcel['gc'], validate=True)
            if len(gp)%6 or len(pp)%6 or len(gc)!=len(gp)//6:
                raise ValueError('Buffers de parcela incoerentes')
            report['triangulos_antes'] += len(gc)
            report['props_antes'] += len(pp)//6
            triangles, colors, kept_props = [], [], []
            wholly_inside = False
            if gp:
                bounds=box(parcel['x']+min(gp[::2])/1000,parcel['z']+min(gp[1::2])/1000,
                           parcel['x']+max(gp[::2])/1000,parcel['z']+max(gp[1::2])/1000)
                wholly_inside=corte._prepared_circle.covers(bounds)
            if wholly_inside:
                # Most urban parcels lie wholly in the allowed region. Their
                # exact integer coordinates/colors need no GEOS call per triangle.
                triangles=[(parcel['x']+gp[i]/1000,parcel['z']+gp[i+1]/1000) for i in range(0,len(gp),2)]
                colors=list(gc)
            else:
                for i in range(0,len(gp),6):
                    points = [(parcel['x']+gp[i+j]/1000,parcel['z']+gp[i+j+1]/1000)
                              for j in (0,2,4)]
                    for tri in corte.clip_triangle(points,ground=True):
                        triangles.extend(tri)
                        colors.append(gc[i//6])
            for i in range(0,len(pp),6):
                ai, xi, zi, theta, sx, sz = pp[i:i+6]
                if not 65<=ai<len(assets):
                    raise ValueError('Prop da parcela aponta para modelo inválido')
                x,z,angle,scale_x,scale_z = xi/1000,zi/1000,theta/1e6,sx/1e6,sz/1e6
                if not corte.placement_inside(assets[ai],x,z,angle,scale_x,scale_z,quantization=quant):
                    continue
                # O sprite aéreo é um quadrado próprio, maior que alguns modelos.
                span = spans[ai-65]
                cs,sn = math.cos(angle),math.sin(angle)
                if not all(math.hypot(x+cs*u+sn*v-corte.cx,z-sn*u+cs*v-corte.cz)<=corte.raio-0.01
                           for u,v in ((-span*scale_x/2,-span*scale_z/2),
                                       (-span*scale_x/2,span*scale_z/2),
                                       (span*scale_x/2,span*scale_z/2),
                                       (span*scale_x/2,-span*scale_z/2))):
                    continue
                kept_props.extend(pp[i:i+6])
            if not triangles and not kept_props:
                continue
            anchor = [parcel['x'],parcel['z']]
            if not corte.dentro(*anchor):
                points = triangles or list(zip(kept_props[1::6],kept_props[2::6]))
                divisor = 1 if triangles else 1000
                anchor = [sum(p[j] for p in points)/len(points)/divisor for j in (0,1)]
            result = dict(parcel,x=anchor[0],z=anchor[1])
            compact = []
            for x,z in triangles:
                dx,dz = round((x-anchor[0])*1000),round((z-anchor[1])*1000)
                world = [anchor[0]+dx/1000,anchor[1]+dz/1000]
                radius = math.hypot(world[0]-corte.cx,world[1]-corte.cz)
                if radius>corte.raio+1e-7:
                    raise ValueError('Arredondamento do tile ultrapassou o círculo')
                report['max_raio_m'] = max(report['max_raio_m'],radius)
                compact.extend((dx,dz))
            result.update(gp=encoded(compact),gc=base64.b64encode(bytes(colors)).decode('ascii'),pp=encoded(kept_props))
            selected.append(result)
            report['triangulos_depois'] += len(colors)
            report['props_depois'] += len(kept_props)//6
        if not selected:
            continue
        data = gzip.compress(json.dumps(selected,separators=(',',':'),ensure_ascii=False).encode(),mtime=0)
        target = destino/prefix/(key+'.bin')
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
        keys.append(key)
        report['arquivos'] += 1
        report['bytes'] += len(data)
        report['parcelas'] += len(selected)
    info.update(prefix=prefix,keys=keys,parcels=report['parcelas'],regional_format='strict-circle-v3',
                ground_policy='continuous-circle')
    return report

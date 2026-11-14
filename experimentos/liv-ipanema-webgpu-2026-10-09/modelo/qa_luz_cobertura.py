"""Amostra todas as faces verticais da faixa fina no atlas real antes/depois."""
import base64
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path

import numpy as np
from qa_luz_quinas import sample, sha, probe_atlas

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]
LIGHT = OWN/'variante/luz'


def probe(directory, model):
    manifest = json.loads((directory/'manifest.json').read_bytes())
    compact = json.loads((directory/'geometry-compact.json').read_bytes())
    assert sha(OWN/'variante/modelo.json') == compact['sourceSHA256'] == manifest['sourceSHA256']
    assert sha(directory/'geometry-compact.json') == manifest['geometrySHA256']
    raw = gzip.decompress((directory/'irradiance.rgbm.gz').read_bytes())
    from hashlib import sha256
    assert sha256(raw).hexdigest() == manifest['textureSHA256']
    image = np.frombuffer(raw,np.uint8).reshape(manifest['height'],manifest['width'],4)
    batch = next(b for b in compact['groups'] if b['geometry']=='cobertura-laje')
    assert len(batch['instances']) == 1
    group = model['groups'][batch['groupIndex']]
    assert np.allclose(np.array(group['instances'][0]['matrix']).reshape(4,4), np.eye(4))
    geo = model['geometries'][batch['geometry']]
    ids = np.array(batch['indices']).reshape(-1,3)
    triangles = np.array(geo['position']).reshape(-1,3)[ids]
    normals = np.array(geo['normal']).reshape(-1,3)[ids].mean(1)
    uv = np.frombuffer(base64.b64decode(batch['instances'][0]['uv1U16']),'<u2').reshape(-1,3,2)/65535
    rows = []
    for i,t in enumerate(triangles):
        if abs(normals[i,1])>.9 or t[:,1].min()<49.2599 or t[:,1].max()>49.3251:
            continue
        pix = sample(image,uv[i].mean(0))/255
        rows.append({'triangle':i,'point':t.mean(0).tolist(), 'normal':normals[i].tolist(),
                     'uvRangePixels':(np.ptp(uv[i],axis=0)*manifest['width']).tolist(),
                     'meanRadiance':float((pix[:3]*pix[3]*manifest['range']).mean())})
    assert len(rows) == 260
    return {'atlasSHA256':manifest['textureSHA256'],'geometrySHA256':manifest['geometrySHA256'],
            'sampleCount':len(rows),'nearBlackSamples':sum(r['meanRadiance']<.04 for r in rows),
            'minimumRadiance':min(r['meanRadiance'] for r in rows), 'samples':rows}


def main():
    model = json.loads((OWN/'variante/modelo.json').read_bytes())
    before, after = [probe(d, model) for d in [LIGHT/'antes-densidade',LIGHT]]
    assert before['nearBlackSamples'] > 80, before['nearBlackSamples']
    assert after['nearBlackSamples'] == 0, after['nearBlackSamples']
    walls = probe_atlas(LIGHT, OWN/'variante/modelo.json')
    assert walls['nearBlackSamples'] == walls['ambiguousSurfaceSamples'] == 0
    paths = [Path(__file__), OWN/'preparar_luz_densa.py', OWN/'qa_luz_quinas.py', OWN/'variante/modelo.json',
             LIGHT/'unwrap.json',LIGHT/'geometry-compact.json',LIGHT/'manifest.json',LIGHT/'denoise.json',
             LIGHT/'antes-densidade/geometry-compact.json',LIGHT/'antes-densidade/manifest.json']
    report = {'schema':'liv-roof-light-probes-v1','status':'PASS','atUtc':datetime.now(timezone.utc).isoformat(),
              'before':before,'after':after,'wallRegression':walls,'atlasPixelsUnchanged':True,
              'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in paths}}
    out = OWN.parent/'evidencias/cobertura-luz';out.mkdir(parents=True,exist_ok=True)
    (out/'luz.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps({'status':report['status'],'beforeBlack':before['nearBlackSamples'],
                      'afterBlack':after['nearBlackSamples'],'minimumRadiance':after['minimumRadiance']}))


if __name__ == '__main__': main()

"""Reusa o unwrap canônico com mais densidade UV apenas na cobertura própria.

A escala é aplicada só aos inputs de xatlas; posições, normais, índices e
matrizes exportados continuam idênticos. O atlas de entrega permanece 4096².
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import xatlas

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]
PREPARE = ROOT/'v1.5/miniaturas/liv-ipanema/preparar_luz.py'


class DensityAtlas:
    def __init__(self, policies, factor):
        self.impl = xatlas.Atlas()
        self.policies = policies
        self.factor = factor
        self.calls = 0

    def add_mesh(self, positions, indices):
        policy = self.policies[self.calls]
        self.calls += 1
        self.impl.add_mesh(positions*self.factor if policy['roof'] else positions, indices)

    def generate(self, **kwargs):
        assert self.calls == len(self.policies)
        self.impl.generate(**kwargs)

    def __getitem__(self, index):
        return self.impl[index]

    def __getattr__(self, name):
        return getattr(self.impl, name)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--model', type=Path, default=OWN/'variante/modelo.json')
    ap.add_argument('--out', type=Path, default=OWN/'variante/luz')
    ap.add_argument('--size', type=int, choices=[4096], default=4096)
    ap.add_argument('--padding', type=int, default=6)
    ap.add_argument('--roof-density', type=int, choices=[2,4,8], default=4)
    args = ap.parse_args()
    if not args.out.resolve().is_relative_to(OWN) or not args.model.resolve().is_relative_to(OWN):
        raise ValueError('UV densa restrita ao modelo e saída deste estudo')
    spec = importlib.util.spec_from_file_location('liv_unwrap_canonical', PREPARE)
    prepare = importlib.util.module_from_spec(spec); spec.loader.exec_module(prepare)
    model = json.loads(args.model.read_bytes())
    policies = []
    for group in model['groups']:
        if not prepare.selected(group, model['materials'][group['material']]):
            continue
        _, indices, _, _ = prepare.topology(model['geometries'][group['geometry']])
        if not len(indices): continue
        policies.extend({'geometry':group['geometry'], 'roof':group['role']=='cobertura'}
                        for _ in group['instances'])
    roofs = [p['geometry'] for p in policies if p['roof']]
    assert len(roofs) == 5 and all(p.startswith('cobertura-') for p in roofs), roofs
    atlas = DensityAtlas(policies, args.roof_density)
    prepare.xatlas = SimpleNamespace(Atlas=lambda:atlas, ChartOptions=xatlas.ChartOptions, PackOptions=xatlas.PackOptions)
    sys.argv = [str(Path(__file__)), '--model',str(args.model),'--out',str(args.out),
                '--size',str(args.size),'--padding',str(args.padding)]
    prepare.main()
    path = args.out/'unwrap.json'; report = json.loads(path.read_bytes())
    report['chartDensity'] = {'roofLinearMultiplier':args.roof_density, 'roofObjects':roofs,
                             'otherObjectsLinearMultiplier':1, 'exportGeometryUnchanged':True,
                             'sources':{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                                        for p in [Path(__file__), PREPARE]}}
    path.write_text(json.dumps(report,indent=2),encoding='utf8')
    print('LIV_DENSE_ROOF_UV',json.dumps(report['chartDensity']),flush=True)


if __name__ == '__main__': main()

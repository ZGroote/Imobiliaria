"""Registra a cobertura anterior/corrigida nas mesmas câmeras e backends reais."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from playwright.sync_api import sync_playwright
import qa_luz_quinas as corners

OWN = Path(__file__).resolve().parent
EXP = OWN.parent
ROOT = OWN.parents[2]
VIEWS = {
    'quina-cabeceira': ([29,54,8], [23,49.2,1.8], 35),
    'faixa-frente': ([15,49.25,15], [15,49.1,6.35], 25),
    'recuo-cinza': ([9,54,12], [6.5,49.2,5.4], 30),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--saida',type=Path,default=EXP/'evidencias/cobertura-visual')
    out = ap.parse_args().saida; out.mkdir(parents=True,exist_ok=True)
    corners.BEFORE = OWN/'variante/luz/antes-cobertura'
    corners.VIEWS = VIEWS
    expected = {'antes': corners.sha(corners.BEFORE/'modelo.json'),
                'depois': corners.sha(OWN/'variante/modelo.json')}
    cases = []
    report = {'schema':'liv-roof-visual-qa-v1', 'status':'RUNNING',
              'atUtc':datetime.now(timezone.utc).isoformat(), 'physicalMobile':False, 'views':VIEWS,'cases':cases}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=corners.CHROME,headless=True)
            report['browserVersion'] = browser.version
            for backend in ['webgpu','webgl']:
                for edition in ['antes','depois']:
                    case = corners.run(browser,backend,edition,out)
                    assert case['source'] == expected[edition], case
                    cases.append(case)
                    print(backend+'-'+edition+': PASS',flush=True)
            browser.close()
        paths = [Path(__file__), OWN/'qa_luz_quinas.py', OWN/'qa_cobertura.py', OWN/'modelar_exterior.py',
                 OWN/'variante/modelo.json', OWN/'variante/assets/manifest.json', EXP/'renderer.js', EXP/'material-rgbm.js',
                 corners.BEFORE/'modelo.json', corners.BEFORE/'assets-manifest.json']
        report.update(status='PASS', sources={p.relative_to(ROOT).as_posix(): corners.sha(p) for p in paths},
                      images=[{'file':p.name,'sha256':corners.sha(p)} for p in sorted(out.glob('*.png'))])
    finally:
        (out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8')


if __name__ == '__main__': main()

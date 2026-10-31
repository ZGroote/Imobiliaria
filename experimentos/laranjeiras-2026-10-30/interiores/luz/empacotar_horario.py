"""Limpa (OIDN) e empacota a luz por hora de uma planta do Laranjeiras em RGBM² para o site.

É o empacotador do LIV (liv-luz-natural-2026-10-26/empacotar-luz-horario.py) sem cópia: lê o texto dele, troca só
os caminhos (bruto em interiores/luz/<planta>/gravado/, fonte e UV1 de interiores/luz/<planta>/, unidade e destino
em site/interiores/<planta>/) e executa. Cada troca precisa casar uma vez, senão para.
python experimentos/laranjeiras-2026-10-30/interiores/luz/empacotar_horario.py canto
"""
from pathlib import Path
import sys

AQUI = Path(__file__).resolve().parent
LIV = AQUI.parents[3] / 'experimentos/liv-luz-natural-2026-10-26/empacotar-luz-horario.py'
TROCAS = [
    ("RAW = ROOT / ('fontes/luz-horario' if TYPOLOGY == 'canto' else 'fontes/luz-horario-meio')",
     f"WORK = Path({str(AQUI)!r}) / TYPOLOGY; SITE = WORK.parents[2] / 'site'; RAW = WORK / 'gravado'"),
    ("DEST = ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/luz-horario'",
     "DEST = SITE / f'interiores/{TYPOLOGY}/luz-horario'"),
    ("    web = ROOT.parent / 'liv-experimental-2026-10-14'\n", "    web = SITE\n"),
    ("    record = json.loads((web / 'interiores/catalogo.json').read_text(encoding='utf8'))['tipologias'][TYPOLOGY]\n", ""),
    ("(web / f'interiores/{TYPOLOGY}/source.json')", "(WORK / 'source.json')"),
    ("gzip.decompress((web / record['files']['compact']['path']).read_bytes())", "(WORK / 'bake/geometry-compact.json').read_bytes()"),
    ("(ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/unidade.json')", "(SITE / f'interiores/{TYPOLOGY}/unidade.json')"),
    ("(RAW / 'chaves.json')", "(WORK / 'chaves.json')"),
    # Prova: `canto menosz-14` empacota só essas horas (e a noite).
    ("    size = measured['size']; guard", "    keys['keys'] = [k for k in keys['keys'] if k['id'] in SO] if SO else keys['keys']\n    size = measured['size']; guard"),
]
SO = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None

texto = LIV.read_text(encoding='utf8')
for de, para in TROCAS:
    if texto.count(de) != 1:
        raise SystemExit(f'O empacotador do LIV mudou: {de!r} aparece {texto.count(de)} vezes')
    texto = texto.replace(de, para)
sys.argv[0] = str(LIV)
exec(compile(texto, str(LIV), 'exec'), {'__name__': '__main__', '__file__': str(LIV), 'SO': SO})

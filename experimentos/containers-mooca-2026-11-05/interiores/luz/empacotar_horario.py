"""Limpa (OIDN) e empacota a luz por hora de uma planta do Laranjeiras em RGBM² para o site.

É o empacotador do LIV (liv-luz-natural-2026-10-26/empacotar-luz-horario.py) sem cópia: lê o texto dele, troca só
os caminhos (bruto em interiores/luz/<planta>/gravado/, fonte e UV1 de interiores/luz/<planta>/, unidade e destino
em site/interiores/<planta>/) e executa. Cada troca precisa casar uma vez, senão para.
python experimentos/containers-mooca-2026-11-05/interiores/luz/empacotar_horario.py canto
"""
from pathlib import Path
import sys
from corrigir_quinas import EDGE_GUARD, GUARDED_DENOISE, room_corner_positions

AQUI = Path(__file__).resolve().parent
LIV = AQUI.parents[3] / 'experimentos/liv-luz-natural-2026-10-26/empacotar-luz-horario.py'
TROCAS = [
    ("RAW = ROOT / ('fontes/luz-horario' if TYPOLOGY == 'canto' else 'fontes/luz-horario-meio')",
     f"WORK = Path({str(AQUI)!r}) / TYPOLOGY; SITE = WORK.parents[2] / 'site'; RAW = WORK / 'gravado'"),
    ("DEST = ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/luz-horario'",
     "DEST = SITE / f'interiores/{TYPOLOGY}/luz-horario'"),
    ("    web = ROOT.parent / 'liv-experimental-2026-10-14'\n", "    web = SITE\n"),
    ("    record = json.loads((web / 'interiores/catalogo.json').read_text(encoding='utf8'))['tipologias'][TYPOLOGY]\n", ""),
    ("    top = json.loads((web / f'interiores/{TYPOLOGY}/unidade.json').read_text(encoding='utf8'))['planta']['pe_direito'] - below\n",
     "    unit = json.loads((web / f'interiores/{TYPOLOGY}/unidade.json').read_text(encoding='utf8'))\n"
     "    top = unit['planta']['pe_direito'] - below\n"),
    ("(web / f'interiores/{TYPOLOGY}/source.json')", "(WORK / 'source.json')"),
    ("gzip.decompress((web / record['files']['compact']['path']).read_bytes())", "(WORK / 'bake/geometry-compact.json').read_bytes()"),
    ("(ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/unidade.json')", "(SITE / f'interiores/{TYPOLOGY}/unidade.json')"),
    ("(RAW / 'chaves.json')", "(WORK / 'chaves.json')"),
    ("if TYPOLOGY not in ('canto', 'meio'):", "if TYPOLOGY not in ('individual', 'individual-pne', 'casal', 'quadruplo', 'casal-bebe'):"),
    ("scene_wall_filters(source, compact, size)[0]",
     "scene_wall_filters(source, compact, size, corner_points=CORNERS(unit))[0]"),
    ("soften_walls(denoised, walls, speckle[1])",
     f"soften_walls(denoised, walls, speckle[1], edge_guard={EDGE_GUARD!r})"),
    ("'wallDenoise': WALL_DENOISE", f"'wallDenoise': {GUARDED_DENOISE!r}"),
    # Prova: `canto menosz-14` empacota só essas horas (e a noite).
    ("    size = measured['size']; guard", "    keys['keys'] = [k for k in keys['keys'] if k['id'] in SO] if SO else keys['keys']\n    size = measured['size']; guard"),
    # Depois do OIDN, cada ilha é suavizada só com ela mesma (suavizar_ilhas) e a borda é refeita.
    # O sol das 6 h entra rasante e deixa umas dezenas de texels acima do teto do RGBM (37 no casal com bebê, de
    # um atlas de milhões): corta no teto e registra, em vez de recusar. Muitos ainda param.
    ("    if clipped:\n        raise RuntimeError(f'RGBM {RANGE} cortaria {clipped} pixels')\n",
     "    if clipped > 200:\n        raise RuntimeError(f'RGBM {RANGE} cortaria {clipped} pixels')\n"
     "    if clipped:\n        print('RGBM_CORTE', clipped, 'pixels acima de', RANGE)\n        np.minimum(denoised, RANGE, out=denoised)\n"),
    ("    denoised[border] = denoised[nearest[0][border], nearest[1][border]]\n",
     "    denoised[border] = denoised[nearest[0][border], nearest[1][border]]\n"
     "    denoised = SUAVIZAR(denoised, speckle[1])\n"
     "    denoised[border] = denoised[nearest[0][border], nearest[1][border]]\n"),
]
SO = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None


def suavizar_ilhas(image, islands, leve=4, forte=24, estreita=4):
    """Média 3x3 repetida, só entre texels da MESMA ilha. O OIDN filtra o atlas inteiro e, nas ilhas estreitas
    (batente de porta e janela, verga, 13 cm = 2-4 texels), puxava a luz das ilhas vizinhas: a faixa ao lado
    da esquadria saía empelotada. Ilha cuja meia-largura não passa de `estreita` texels leva `forte` passadas
    (~4 texels, 20 cm, de penumbra ao longo dela); as largas, `leve` (só o resíduo do OIDN)."""
    import numpy as np
    from scipy import ndimage
    inside = islands > 0
    half = ndimage.distance_transform_edt(inside)
    labels = np.unique(islands[inside])
    width = np.zeros(islands.max() + 1); width[labels] = ndimage.maximum(half, islands, labels)
    passes = np.where(width[islands] <= estreita, forte, leve) * inside
    out = image.astype(np.float32).copy()
    shifts = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    same = []
    for dy, dx in shifts:
        moved = np.roll(islands, (dy, dx), axis=(0, 1))
        same.append((moved == islands) & inside)
    for step in range(forte):
        active = passes > step
        if not active.any():
            break
        total = np.zeros_like(out); count = np.zeros(islands.shape, np.float32)
        for (dy, dx), ok in zip(shifts, same):
            total += np.roll(out, (dy, dx), axis=(0, 1)) * ok[..., None]; count += ok
        blurred = total / np.maximum(count, 1)[..., None]
        out[active] = blurred[active]
    return out

texto = LIV.read_text(encoding='utf8')
for de, para in TROCAS:
    if texto.count(de) != 1:
        raise SystemExit(f'O empacotador do LIV mudou: {de!r} aparece {texto.count(de)} vezes')
    texto = texto.replace(de, para)
sys.argv[0] = str(LIV)
exec(compile(texto, str(LIV), 'exec'), {
    '__name__': '__main__', '__file__': str(LIV), 'SO': SO,
    'SUAVIZAR': suavizar_ilhas, 'CORNERS': room_corner_positions,
})

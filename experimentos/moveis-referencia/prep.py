"""web/<peca>/ (saida do exporta.py) -> imagens do navegador em niveis, e o peso de cada estrategia.
    python prep.py peca
Compartilhado (B): materiais/<tex>_cor|_nor.png -> web/materiais/<tex>-cor|nor-<t>.<fmt> (vale pra casa)
Da peca: ao-<t>, unica-<t> (= cor crua x AO dosado, como a cama)."""
import json, os, sys, brotli
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PECA = sys.argv[1]   # pasta em web/ (ex.: sofa-5k)
W = os.path.join(AQUI, "web", PECA)
WM = os.path.join(AQUI, "web", "materiais")
os.makedirs(WM, exist_ok=True)
J = json.load(open(os.path.join(W, "peca.json")))
FMT = {"webp": {"cor": 82, "nor": 88, "ao": 80}, "avif": {"cor": 62, "nor": 66, "ao": 60}}
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
DOSE_AO = float(os.environ.get("DOSE_AO", "0.6"))


def salva(im, base, tipo, tams, pasta):
    out = {}
    for t in tams:
        p = im if im.size[0] == t else im.resize((t, t), Image.LANCZOS)
        for f, q in FMT.items():
            nome = "%s-%d.%s" % (base, t, f)
            caminho = os.path.join(pasta, nome)
            if not os.path.exists(caminho) or os.environ.get("REFAZ"):
                kw = {"method": 6} if f == "webp" else {"speed": 4}
                p.save(caminho, quality=q[tipo], **kw)
            out[nome] = os.path.getsize(caminho)
    return out


peso = {"compartilhado": {}, "peca": {}}
for m in J["materiais"].values():
    if m["tex"]:
        for tipo in ("cor", "nor"):
            im = Image.open(os.path.join(AQUI, "materiais", "%s_%s.png" % (m["tex"], tipo))).convert("RGB")
            peso["compartilhado"].update(salva(im, "%s-%s" % (m["tex"], tipo), tipo, (256, 512, 1024), WM))
ao = Image.open(os.path.join(W, "ao.png")).convert("L")
peso["peca"].update(salva(ao, "ao", "ao", (256, 512, 1024), W))
c = lin(np.asarray(Image.open(os.path.join(W, "unica_crua.png")).convert("RGB"), np.float32) / 255)
a = lin(np.asarray(ao, np.float32) / 255)[..., None]
un = Image.fromarray((srgb(c * ((1 - DOSE_AO) + DOSE_AO * a)) * 255 + 0.5).astype(np.uint8))
peso["peca"].update(salva(un, "unica", "cor", (256, 512, 1024), W))
if os.path.exists(os.path.join(W, "relevo.png")):
    rel = Image.open(os.path.join(W, "relevo.png")).convert("RGB")
    peso["peca"].update(salva(rel, "relevo", "nor", (256, 512, 1024), W))
geo = open(os.path.join(W, "geo.bin"), "rb").read()
js = open(os.path.join(W, "peca.json"), "rb").read()
peso["geo_bin"], peso["geo_br"] = len(geo), len(brotli.compress(geo, quality=11))
peso["json_br"] = len(brotli.compress(js, quality=11))
json.dump(peso, open(os.path.join(W, "peso.json"), "w"), indent=1)
kb = lambda b: round(b / 1024, 1)
print("geometria: %s KB crua, %s KB brotli (%d tri); json %s KB" % (kb(peso["geo_bin"]), kb(peso["geo_br"]), J["tri"], kb(peso["json_br"])))
for k in sorted(peso["peca"]):
    print("  peca  %-22s %6.1f KB" % (k, kb(peso["peca"][k])))
for k in sorted(peso["compartilhado"]):
    print("  compartilhado %-26s %6.1f KB" % (k, kb(peso["compartilhado"][k])))

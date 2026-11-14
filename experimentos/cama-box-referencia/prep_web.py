"""Cama assada -> pacote web em NIVEIS de qualidade (pro carregamento progressivo).

    python prep_web.py assado-solteiro web-solteiro

Geometria (uma vez, vale pra todos os niveis): indexada e quantizada -- posicao Uint16 na
caixa do objeto, normal Int8, UV Uint16 -- no lugar dos float32 sem indice que o assa.py
grava (a geometria dos travesseiros caia de ~600 KB). Textura em 4 resolucoes:

    q1  forma      cor 256 (trav 128), sem relevo
    q2  basico     cor+relevo 512 (trav 256)
    q3  detalhe    cor+relevo 1024 (trav 512)
    q4  maximo     cor+relevo 2048 (trav 1024) -- a resolucao do bake
"""
import json, os, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC, DST = (os.path.join(AQUI, a) for a in sys.argv[1:3])
os.makedirs(DST, exist_ok=True)
AO = {"corpo_cor": 0.15, "trav_cor": 0.30}     # AO dentro da cor: menos que no Cycles (ACES do app endurece)
# corpo: o atlas por skyline tem 1,36x mais px por metro, entao 768 aqui = 1024 do atlas antigo
NIVEIS = {"q1": (192, 128, False), "q2": (384, 256, True), "q3": (768, 512, True), "q4": (1536, 1024, True)}
# AVIF: medido 44% menor que o WebP no relevo. O WebP fica de reserva pra quem nao abre AVIF.
FORMATOS = {"webp": {"cor": 82, "relevo": 88}, "avif": {"cor": 62, "relevo": 66}}

J = json.load(open(os.path.join(SRC, "cama.json")))
raw = open(os.path.join(SRC, "cama.bin"), "rb").read()
blob, objs = bytearray(), []


def alinha(n=4):
    while len(blob) % n:
        blob.append(0)


for o in J["objetos"]:
    if o.get("quarto"):
        continue
    n = o["n"]
    pos = np.frombuffer(raw, np.float32, n * 3, o["pos"]).reshape(-1, 3)
    nor = np.frombuffer(raw, np.float32, n * 3, o["nor"]).reshape(-1, 3)
    uv = np.frombuffer(raw, np.float32, n * 2, o["uv"]).reshape(-1, 2) if "uv" in o else np.zeros((n, 2), np.float32)
    mn, mx = pos.min(0), pos.max(0)
    qp = np.round((pos - mn) / np.maximum(mx - mn, 1e-9) * 65535).astype(np.uint16)
    qn = np.round(np.clip(nor / np.linalg.norm(nor, axis=1, keepdims=True), -1, 1) * 127).astype(np.int8)
    qu = np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16)
    chave = np.concatenate([qp.view(np.uint8).reshape(n, -1), qn.view(np.uint8).reshape(n, -1),
                            qu.view(np.uint8).reshape(n, -1)], 1)
    _, primeiro, idx = np.unique(chave, axis=0, return_index=True, return_inverse=True)
    nv = len(primeiro)
    assert nv < 65536, (o["nome"], nv)
    item = {"nome": o["nome"], "nv": int(nv), "ni": int(n), "min": mn.round(5).tolist(), "max": mx.round(5).tolist(),
            "rough": o["rough"]}
    for k, arr in (("pos", qp[primeiro]), ("nor", np.concatenate([qn[primeiro], np.zeros((nv, 1), np.int8)], 1)),
                   ("uv", qu[primeiro]), ("idx", idx.astype(np.uint16).ravel())):
        alinha()
        item[k] = len(blob)
        blob += arr.tobytes()
    if "map" in o:
        item["mapa"] = o["map"].replace("_cor", "")          # "corpo" | "trav"
    if "cor" in o:
        item["cor"] = o["cor"]
    objs.append(item)
open(os.path.join(DST, "geo.bin"), "wb").write(bytes(blob))

# texturas: cor (com AO dosado em linear) e relevo, em cada resolucao
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
peso = {}
for mapa in ("corpo", "trav"):
    c = lin(np.asarray(Image.open(os.path.join(SRC, mapa + "_cor_crua.png")).convert("RGB"), np.float32) / 255)
    a = lin(np.asarray(Image.open(os.path.join(SRC, mapa + "_cor_ao.png")).convert("L"), np.float32) / 255)
    cor = Image.fromarray((srgb(c * ((1 - AO[mapa + "_cor"]) + AO[mapa + "_cor"] * a[..., None])) * 255 + 0.5).astype(np.uint8))
    rel = Image.open(os.path.join(SRC, mapa + "_normal.png")).convert("RGB")
    for q, (tc, tt, com_relevo) in NIVEIS.items():
        t = tc if mapa == "corpo" else tt
        for tipo, im in (("cor", cor), ("relevo", rel)):
            if tipo == "relevo" and not com_relevo:
                continue
            pequena = im.resize((t, t), Image.LANCZOS)
            for fmt, qual in FORMATOS.items():
                nome = "%s-%s-%d.%s" % (mapa, tipo, t, fmt)
                if not os.path.exists(os.path.join(DST, nome)):
                    kw = {"method": 6} if fmt == "webp" else {"speed": 4}
                    pequena.save(os.path.join(DST, nome), quality=qual[tipo], **kw)
                peso.setdefault(fmt, {}).setdefault(q, {})[nome] = os.path.getsize(os.path.join(DST, nome))
manifesto = {"versao": 2, "objetos": objs,
             "tam": {q: [tc, tt] for q, (tc, tt, _) in NIVEIS.items()},
             "bytes": {f: {q: sum(v.values()) for q, v in p.items()} for f, p in peso.items()}, "geo_bytes": len(blob),
             "tri": {o["nome"]: o["ni"] // 3 for o in objs}}
json.dump(manifesto, open(os.path.join(DST, "cama.json"), "w"), separators=(",", ":"))
print(json.dumps({k: manifesto[k] for k in ("bytes", "geo_bytes", "tri")}, indent=1))
print("vertices:", {o["nome"]: o["nv"] for o in objs})

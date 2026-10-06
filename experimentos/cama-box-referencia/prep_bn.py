"""Cama assada -> pacote BN (RELATORIO-MOVEIS.md): cor unica PEQUENA (com AO) + relevo da malha alta +
DETALHE compartilhado que repete -- os padroes de matelasse da cena (celula do box, celula da lateral,
bordado do tampo) sao periodicos, entao viram 3 bumps pequenos em repeticao no lugar dos 768-1536 px
de atlas que carregavam a costura.

    python prep_bn.py assado-solteiro-v2 web-solteiro-bn

A cor da cama NAO e lisa (cordao claro, mancha escura do tufo, bordado): por isso fica uma cor unica,
so que de 384/512 px. O corpo e partido em 3 malhas pela regiao (base, lado, topo), cada uma com o seu
bump; UV de detalhe por projecao de caixa em metro, na escala do padrao (como o Cycles mapeia).

Niveis: q1 cor 192/128 (sem relevo) e q3 512/256 com relevo + detalhe. Sem q2 (ver NIVEIS)."""
import json, os, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC, DST = (os.path.join(AQUI, a) for a in sys.argv[1:3])
os.makedirs(DST, exist_ok=True)
sys.argv = [sys.argv[0]]
CAM = json.load(open(os.path.join(AQUI, "camera.json")))
ZB, ZM = CAM["alturas"]["zb"], CAM["alturas"]["zm"]
AO = {"corpo": 0.15, "trav": 0.30}
# sem q2: 384 px custava 58 KB a mais na rede lenta pra adiantar ~0,5 s (medido no Cedros v8)
NIVEIS = {"q1": (192, 128, False), "q3": (512, 256, True)}
FORMATOS = {"webp": {"cor": 82, "relevo": 88, "det": 90}, "avif": {"cor": 62, "relevo": 66, "det": 70}}

# ------------------------------------------------------------------ os 3 padroes (os MESMOS da cena)
# cena.py roda o Blender no import; os padroes sao numpy puro: executa so as funcoes
src = open(os.path.join(AQUI, "cena.py"), encoding="utf-8").read()
ini, fim = src.index("def grade("), src.index("TUFO = 0.18")
ns = {"np": np}
exec(src[ini:fim], ns)
ini2, fim2 = src.index("TUFO = 0.18"), src.index("def padrao_cordao(")
exec(src[ini2:fim2], ns)
PADROES = {  # regiao: (funcao, escuro do vinco na cor, tamanho da imagem)
    "base": (ns["padrao_base"], 0.78), "lado": (ns["padrao_lado"], 0.78), "topo": (ns["padrao_bordado"], 0.62)}
det_info = {}
for reg, (fn, escuro) in PADROES.items():
    h, esc = fn()
    hh, ww = h.shape
    k = 256 / max(hh, ww)
    im = Image.fromarray((np.flipud(h) * 255 + 0.5).astype(np.uint8)).resize((round(ww * k), round(hh * k)), Image.LANCZOS)
    nome = "det-" + reg
    tam = {}
    for fmt, q in FORMATOS.items():
        arq = os.path.join(DST, "%s.%s" % (nome, fmt))
        im.convert("RGB").save(arq, quality=q["det"], **({"method": 6} if fmt == "webp" else {"speed": 4}))
        tam[fmt] = os.path.getsize(arq)
    hm = np.asarray(im, np.float32) / 255
    det_info[reg] = {"img": nome, "escala": [esc[0], esc[2]], "escuro": escuro,
                     "media": float(np.mean(escuro + (1 - escuro) * hm)), "bytes": tam}

# ------------------------------------------------------------------ geometria
J = json.load(open(os.path.join(SRC, "cama.json")))
raw = open(os.path.join(SRC, "cama.bin"), "rb").read()
blob, objs = bytearray(), []


def alinha(n=4):
    while len(blob) % n:
        blob.append(0)


def poe(nome, pos, nor, uv, extra, det=None):
    n = len(pos)
    mn, mx = pos.min(0), pos.max(0)
    qp = np.round((pos - mn) / np.maximum(mx - mn, 1e-9) * 65535).astype(np.uint16)
    qn = np.round(np.clip(nor / np.linalg.norm(nor, axis=1, keepdims=True), -1, 1) * 127).astype(np.int8)
    qu = np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16)
    partes = [qp.view(np.uint8).reshape(n, -1), qn.view(np.uint8).reshape(n, -1), qu.view(np.uint8).reshape(n, -1)]
    if det is not None:
        dmn, dmx = det.min(0), det.max(0)
        qd = np.round((det - dmn) / np.maximum(dmx - dmn, 1e-9) * 65535).astype(np.uint16)
        partes.append(qd.view(np.uint8).reshape(n, -1))
    _, prim, idx = np.unique(np.concatenate(partes, 1), axis=0, return_index=True, return_inverse=True)
    nv = len(prim)
    assert nv < 65536, (nome, nv)
    item = {"nome": nome, "nv": int(nv), "ni": int(n), "min": mn.round(5).tolist(), "max": mx.round(5).tolist(), **extra}
    campos = [("pos", qp[prim]), ("nor", np.concatenate([qn[prim], np.zeros((nv, 1), np.int8)], 1)), ("uv", qu[prim])]
    if det is not None:
        campos.append(("det", qd[prim]))
        item["dmin"], item["dmax"] = dmn.round(5).tolist(), dmx.round(5).tolist()
    campos.append(("idx", idx.astype(np.uint16).ravel()))
    for k, arr in campos:
        alinha()
        item[k] = len(blob)
        blob.extend(arr.tobytes())
    objs.append(item)


for o in J["objetos"]:
    if o.get("quarto"):
        continue
    n = o["n"]
    pos = np.frombuffer(raw, np.float32, n * 3, o["pos"]).reshape(-1, 3)
    nor = np.frombuffer(raw, np.float32, n * 3, o["nor"]).reshape(-1, 3)
    uv = np.frombuffer(raw, np.float32, n * 2, o["uv"]).reshape(-1, 2) if "uv" in o else np.zeros((n, 2), np.float32)
    base = {"rough": o["rough"]}
    if "map" in o:
        base["mapa"] = o["map"].replace("_cor", "")
    if "cor" in o:
        base["cor"] = o["cor"]
    if o["nome"] != "cama":
        poe(o["nome"], pos, nor, uv, base)
        continue
    # corpo: parte por regiao e da a UV de detalhe (projecao de caixa no espaco do Blender, em metro)
    b = np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], 1)               # three (x, y, z) -> Blender (x, y, z)
    tri = b.reshape(-1, 3, 3)
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    zc = tri[:, :, 2].mean(1)
    reg = np.where(zc < ZB - 0.002, 0, np.where((zc < ZM - 0.002) | (fn[:, 2] < 0.6), 1, 2))
    ax = np.argmax(np.abs(fn), 1)
    for r, nome in enumerate(("base", "lado", "topo")):
        sel = np.nonzero(reg == r)[0]
        if not len(sel):
            continue
        cs = (sel[:, None] * 3 + np.arange(3)).ravel()
        e = det_info[nome]["escala"]
        pb = b[cs]
        a = np.repeat(ax[sel], 3)
        u = np.where(a == 0, pb[:, 1], pb[:, 0])
        v = np.where(a == 2, pb[:, 1], pb[:, 2])
        # tampo (eixo z): os dois lados na escala horizontal; lateral: u horizontal, v na vertical
        d = np.stack([u * e[0], v * np.where(a == 2, e[0], e[1])], 1).astype(np.float32)
        poe("cama_" + nome, pos[cs], nor[cs], uv[cs], {**base, "detalhe": {k: det_info[nome][k] for k in ("img", "escuro", "media")}}, d)
open(os.path.join(DST, "geo.bin"), "wb").write(bytes(blob))

# ------------------------------------------------------------------ cor (AO dosado) e relevo em cada nivel
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
srgb = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
peso = {}
for mapa in ("corpo", "trav"):
    c = lin(np.asarray(Image.open(os.path.join(SRC, mapa + "_cor_crua.png")).convert("RGB"), np.float32) / 255)
    a = lin(np.asarray(Image.open(os.path.join(SRC, mapa + "_cor_ao.png")).convert("L"), np.float32) / 255)
    cor = Image.fromarray((srgb(c * ((1 - AO[mapa]) + AO[mapa] * a[..., None])) * 255 + 0.5).astype(np.uint8))
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
                    pequena.save(os.path.join(DST, nome), quality=qual[tipo], **({"method": 6} if fmt == "webp" else {"speed": 4}))
                peso.setdefault(fmt, {}).setdefault(q, {})[nome] = os.path.getsize(os.path.join(DST, nome))
man = {"versao": 3, "objetos": objs, "tam": {q: [tc, tt] for q, (tc, tt, _) in NIVEIS.items()},
       "bytes": {f: {q: sum(v.values()) for q, v in p.items()} for f, p in peso.items()},
       "det_bytes": {f: sum(d["bytes"][f] for d in det_info.values()) for f in FORMATOS}, "geo_bytes": len(blob),
       "tri": {o["nome"]: o["ni"] // 3 for o in objs}}
json.dump(man, open(os.path.join(DST, "cama.json"), "w"), separators=(",", ":"))
print(json.dumps({k: man[k] for k in ("bytes", "det_bytes", "geo_bytes", "tri")}, indent=1))

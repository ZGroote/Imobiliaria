"""Quanto a geometria cai sem perder forma? Testa em cima do geo.bin exportado (nao grava nada):
  bits    zera os bits baixos (posicao 16 -> 12 bits = 0,6 mm numa peca de 2,5 m)
  ordem   renumera vertice pela 1a aparicao no indice (indice vira quase sequencial: brotli adora)
  delta   indice em diferenca do anterior (zigzag) e atributos em diferenca na ordem nova
    python enxuga_geo.py peca"""
import json, sys, brotli, numpy as np
P = sys.argv[1]
J = json.load(open(f"web/{P}/peca.json"))
B = open(f"web/{P}/geo.bin", "rb").read()


def campos(g):
    nv = g["nv"]
    f = {"pos": np.frombuffer(B, np.uint16, nv * 3, g["pos"]).reshape(nv, 3), "nor": np.frombuffer(B, np.int8, nv * 4, g["nor"]).reshape(nv, 4),
         "uv": np.frombuffer(B, np.uint16, nv * 2, g["uv"]).reshape(nv, 2), "uv2": np.frombuffer(B, np.uint16, nv * 2, g["uv2"]).reshape(nv, 2)}
    if "tan" in g:
        f["tan"] = np.frombuffer(B, np.int8, nv * 4, g["tan"]).reshape(nv, 4)
    idx = np.frombuffer(B, np.uint32 if g["i32"] else np.uint16, g["ni"], g["idx"]).astype(np.int64)
    return f, idx


def pacote(bits_pos=16, bits_uv=16, ordem=False, delta=False, sem=()):
    out = []
    for g in J["grupos"]:
        f, idx = campos(g)
        if ordem:
            _, prim = np.unique(idx, return_index=True)
            novo = np.argsort(prim)                        # vertice velho na ordem de 1a aparicao
            mapa = np.empty(len(novo), np.int64); mapa[novo] = np.arange(len(novo))
            idx = mapa[idx]
            f = {k: v[novo] for k, v in f.items()}
        f["pos"] = (f["pos"] >> (16 - bits_pos)) << (16 - bits_pos)
        f["uv"] = (f["uv"] >> (16 - bits_uv)) << (16 - bits_uv)
        f["uv2"] = (f["uv2"] >> (16 - bits_uv)) << (16 - bits_uv)
        for k in sem:
            f.pop(k, None)
        if delta:
            d = np.diff(idx, prepend=0)
            idx = ((d << 1) ^ (d >> 63)).astype(np.uint32)
            for k in ("pos", "uv", "uv2"):
                f[k] = np.diff(f[k].astype(np.int32), axis=0, prepend=0).astype(np.int16)
        # atributo por atributo (planar): cada fluxo comprime melhor sozinho
        for k, v in f.items():
            out.append(np.ascontiguousarray(v).tobytes())
        out.append(idx.astype(np.uint16 if idx.max() < 65536 else np.uint32).tobytes())
    raw = b"".join(out)
    return len(raw), len(brotli.compress(raw, quality=11))


base = len(B), len(brotli.compress(B, quality=11))
print("%-44s %7s %7s" % ("variante", "cru KB", "br KB"))
print("%-44s %7.1f %7.1f" % ("exportado (hoje)", base[0] / 1024, base[1] / 1024))
for nome, kw in (("planar, mesmo dado", {}), ("ordem de 1a aparicao", {"ordem": True}),
                 ("ordem + pos 12 bits + uv 12 bits", {"ordem": True, "bits_pos": 12, "bits_uv": 12}),
                 ("ordem + 12 bits + delta", {"ordem": True, "bits_pos": 12, "bits_uv": 12, "delta": True}),
                 ("idem sem tangente", {"ordem": True, "bits_pos": 12, "bits_uv": 12, "delta": True, "sem": ("tan",)}),
                 ("idem sem tangente e sem uv metro", {"ordem": True, "bits_pos": 12, "bits_uv": 12, "delta": True, "sem": ("tan", "uv")})):
    c, b = pacote(**kw)
    print("%-44s %7.1f %7.1f" % (nome, c / 1024, b / 1024))

import importlib.util, json, sys, time, site, statistics
from pathlib import Path
sys.path.append(site.getusersitepackages())
"""Uso: python -I -X utf8 viabilidade/motor/medir_tempo.py <raiz viabilidade/> <pasta motor A> <pasta motor B>
Compara o tempo de gerar_estudo (mediana de 3) entre duas versões do motor. Ver TEMPOS.md."""
raiz = Path(sys.argv[1])
lotes = json.loads((raiz / "terreno/lotes-piloto.json").read_text(encoding="utf-8"))
zonas = {z["id"]: z for z in json.loads((raiz / "lei/zonas.json").read_text(encoding="utf-8"))}
ex = (json.loads((raiz/"motor/exemplos/lote-exemplo.json").read_text(encoding="utf-8")), json.loads((raiz/"motor/exemplos/zona-exemplo.json").read_text(encoding="utf-8")))
casos = [("estudo-exemplo", *ex)] + [(l["id"], l, zonas[l["zona_id"]]) for l in lotes]
res = {}
for nome, pasta in (("A", sys.argv[2]), ("B", sys.argv[3])):
    sys.path.insert(0, pasta)
    spec = importlib.util.spec_from_file_location("motor_"+nome.replace(".","_"), Path(pasta)/"motor.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    sys.path.pop(0)
    for c, lote, zona in casos:
        ts = []
        for _ in range(3):
            if hasattr(m, "_cache_clear"): m._cache_clear()
            for f in vars(m).values():
                if hasattr(f, "cache_clear"): f.cache_clear()
            t = time.perf_counter(); m.gerar_estudo(lote, zona); ts.append(time.perf_counter() - t)
        res.setdefault(c, {})[nome] = statistics.median(ts)
print(f"{'estudo':40} {'A':>7} {'B':>7} {'razão':>6}")
for c, v in res.items():
    print(f"{c[:40]:40} {v['A']:6.2f}s {v['B']:6.2f}s {v['B']/v['A']:5.2f}x")
a = sum(v['A'] for v in res.values()); b = sum(v['B'] for v in res.values())
print(f"{'TOTAL':40} {a:6.1f}s {b:6.1f}s {b/a:5.2f}x")

"""Zonas do Tour em Gaussian Splatting a partir da cobertura medida (cobertura_vistas.py --grade).

Cada célula da grade (o passo do --grade) recebe o splat do cômodo em que está só se a PIOR das vistas
medidas nela (8 rumos por posição da grade ou das rotas) tiver no máximo --limite da imagem sem cobertura nesse splat; senão a célula fica na malha. Célula de
cômodo sem posição livre medida (móvel, parede) herda a decisão da célula medida mais perto do mesmo cômodo.

python zonas_por_cobertura.py <cobertura.json> <poligonos.json> --passo 0.3 [--limite 0.3]
    [--aplicar interior-splat.js] [--figura zonas.png]
--aplicar troca o bloco entre "// BEGIN TOUR_ZONAS" e "// END TOUR_ZONAS" (ou o antigo TOUR_REGIONAL_POLYGONS).
"""
import json, math, re, sys

argv = sys.argv[1:]
def arg(nome, padrao=None):
    return argv[argv.index(nome) + 1] if nome in argv else padrao
cob = json.load(open(argv[0], encoding="utf-8")); POLI = json.load(open(argv[1], encoding="utf-8"))
PASSO = float(arg("--passo", "0.3")); LIMITE = float(arg("--limite", "0.3"))   # 18/10: sem calibração; no Tour publicado nenhum defeito visto era de cobertura
LETRA = {"sala": "s", "varanda": "v", "quarto": "q", "suite": "u", "banho-suite": "b", "banho-social": "c"}

def dentro(pt, poly):
    x, y = pt; ok = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): ok = not ok
    return ok
def comodo(x, y):   # mesma ordem do Tour: primeiro polígono que contém
    return next((n for n, p in POLI.items() if dentro((x, y), p)), None)

grade = [v for v in cob["vistas"] if v["rota"] == "grade"]
if not grade: sys.exit("cobertura.json sem posições de grade: rode cobertura_vistas.py com --grade")
X0 = min(v["pos"][0] for v in grade); Y0 = min(v["pos"][1] for v in grade)
pior = {}   # célula -> pior "cego" entre os 8 rumos (e entre as posições da célula), no splat do cômodo
for v in cob["vistas"]:   # grade + rotas: a grade quase não acha posição livre num banheiro, a rota entra nele
    i, j = round((v["pos"][0] - X0) / PASSO), round((v["pos"][1] - Y0) / PASSO)
    nome = comodo(*v["pos"])
    if nome is None: continue
    pior[(i, j)] = (nome, max(pior.get((i, j), (nome, 0))[1], v["cego_se_fosse"][nome]))

xs = [p[0] for p in sum(POLI.values(), [])]; ys = [p[1] for p in sum(POLI.values(), [])]
I0, I1 = math.floor((min(xs) - X0) / PASSO), math.ceil((max(xs) - X0) / PASSO)
J0, J1 = math.floor((min(ys) - Y0) / PASSO), math.ceil((max(ys) - Y0) / PASSO)
linhas, herdadas = [], 0
for j in range(J0, J1 + 1):
    linha = ""
    for i in range(I0, I1 + 1):
        x, y = X0 + i * PASSO, Y0 + j * PASSO
        nome = comodo(x, y)
        if nome is None: linha += "."; continue
        if (i, j) not in pior:   # herda da medida mais perto do mesmo cômodo
            mesmas = [(abs(a - i) + abs(b - j), (a, b)) for (a, b), (n, _) in pior.items() if n == nome]
            if not mesmas: linha += "."; continue
            herdadas += 1; ref = min(mesmas)[1]
        else: ref = (i, j)
        linha += LETRA[nome] if pior[ref][1] <= LIMITE else "."
    linhas.append(linha)
zonas = {"x0": round(X0 + I0 * PASSO, 4), "y0": round(Y0 + J0 * PASSO, 4), "passo": PASSO, "limite": LIMITE,
         "letras": {l: n for n, l in LETRA.items()}, "linhas": linhas}

medidas = len(pior); passam = sum(c <= LIMITE for _, c in pior.values())
print(f"células medidas {medidas}, passam {passam} ({passam / medidas:.0%}), herdadas {herdadas}")
for nome in LETRA:
    cel = [c for n, c in pior.values() if n == nome]
    if cel: print(f"  {nome:13s} {sum(c <= LIMITE for c in cel):3d}/{len(cel):3d} passam")
for linha in reversed(linhas): print("  " + linha)   # y para cima

if arg("--aplicar"):
    js = open(arg("--aplicar"), encoding="utf-8").read()
    bloco = f"""// BEGIN TOUR_ZONAS
// Gerado por piloto-render/zonas_por_cobertura.py a partir da cobertura medida das vistas de treino de cada
// splat (cobertura_vistas.py --grade). Grade em XY do Blender, linha 0 = menor y; uma letra = o splat do
// cômodo passa ali (pior rumo com até {LIMITE:.0%} da imagem sem cobertura), "." = malha.
const ZONAS = {json.dumps(zonas, ensure_ascii=False)};
function zonaDaCobertura(x, y) {{
  const i = Math.round((x - ZONAS.x0) / ZONAS.passo), j = Math.round((y - ZONAS.y0) / ZONAS.passo);
  return ZONAS.letras[ZONAS.linhas[j]?.[i]] ?? null;
}}
// END TOUR_ZONAS"""
    novo, n = re.subn(r"// BEGIN TOUR_(?:ZONAS|REGIONAL_POLYGONS)\n.*?// END TOUR_(?:ZONAS|REGIONAL_POLYGONS)", lambda m: bloco, js, flags=re.S)
    if n != 1: sys.exit("marcadores BEGIN/END não encontrados uma única vez")
    open(arg("--aplicar"), "w", encoding="utf-8", newline="").write(novo)
    print("aplicado em", arg("--aplicar"))

if arg("--figura"):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    cores = {"sala": "#4c78a8", "varanda": "#72b7b2", "quarto": "#54a24b", "suite": "#b279a2", "banho-suite": "#f58518", "banho-social": "#e45756"}
    fig, ax = plt.subplots(figsize=(11, 6.5))
    for nome, p in POLI.items():
        ax.fill(*zip(*p), fc="none", ec="#999", lw=1)
    for (i, j), (nome, c) in pior.items():
        x, y = X0 + i * PASSO, Y0 + j * PASSO
        ax.add_patch(plt.Rectangle((x - PASSO / 2, y - PASSO / 2), PASSO, PASSO, fc=cores[nome] if c <= LIMITE else "#ddd", ec="w", lw=.5))
        ax.text(x, y, f"{c * 100:.0f}", ha="center", va="center", fontsize=6, color="k" if c > LIMITE else "w")
    for v in cob["vistas"]:
        if v["rota"] != "grade": ax.plot(*v["pos"], ".", c="k", ms=2)
    ax.set_aspect("equal"); ax.autoscale()
    ax.set_title(f"Zonas do splat por cobertura: cor = splat do cômodo (pior rumo ≤ {LIMITE:.0%} cego), cinza = malha; número = % cego")
    fig.tight_layout(); fig.savefig(arg("--figura"), dpi=110)

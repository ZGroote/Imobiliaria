"""Clona a maquete publicada do LIV como demonstração própria da Conecta.

A cópia não pode apontar para nada do cliente: troca o nome em todo arquivo
(inclusive dentro dos .gz), desliga estoque e métricas, tira os links dele,
inventa a tabela comercial e esconde o letreiro modelado na torre. Como os
manifestos guardam sha256 e tamanho de cada arquivo, as trocas têm o mesmo
comprimento e os hashes são recalculados em cascata no fim.

Também desenha plantas 2D próprias (as do LIV vêm do book do cliente) e tira o
mapa do entorno, que mostra o terreno real. Precisa do Pillow:

    C:/Python314/python.exe -E experimentos/apresentacao-2026-11-01/clonar_demo.py
"""
import gzip
import hashlib
import json
import re
import shutil
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "publicacao/liv-duplo-20261017/payload/liv-classico"
DESTINO = Path(__file__).resolve().parent / "site/demo"
NOME = "Vila Aurora"
LIVRO_FALSO = hashlib.sha256(f"{NOME} demonstração".encode()).hexdigest()

# Mesmo comprimento dos dois lados: o tamanho dos arquivos de texto não muda.
TROCAS = [
    ("liv-ipanema", "vila-aurora"), ("liv_ipanema", "vila_aurora"),
    ("LIV-IPANEMA", "VILA-AURORA"), ("LIV IPANEMA", "VILA AURORA"),
    ("LIV Ipanema", NOME), ("Liv Ipanema", NOME),
    # Posição do sol: a coordenada do terreno vira o centro aproximado da cidade.
    ("-21.98896655", "-22.00000000"), ("-47.9231427", "-47.9000000"),
]
for antigo, novo in TROCAS:
    assert len(antigo) == len(novo), (antigo, novo)

FORA = {"site-baseline", "diagnostico.html", "diagnostico.js", "index.html",
        "estoque-runtime.js", "estoque-runtime.js.LEGAL.txt", "estoque-demo-config.json",
        "entrega-manifest.json", "estoque-build.json",
        "mapa-runtime", "mapa-parcela.json", "mapa-liv-ipanema-5km.html",
        # Sem o ajudante de cache: na primeira visita ele disputa os pedidos e às vezes
        # derruba a planta ("não pôde ser conferida"). A maquete já sabe viver sem ele.
        "transfer-worker.js"}
TEXTO = {".js", ".mjs", ".json", ".html", ".css", ".txt"}
PROIBIDO = re.compile(r"(?i:ipanema|livon|googletagmanager|gtag\(|analytics/|firestore|run\.app|cloudfunctions)|AIza|-21\.98|-47\.92")

trocados = {}  # sha256 antigo -> (sha256 novo, bytes novos)


def sha(dados):
    return hashlib.sha256(dados).hexdigest()


def gravar(caminho, novo):
    antigo = caminho.read_bytes()
    if novo == antigo:
        return False
    trocados[sha(antigo)] = (sha(novo), len(novo))
    caminho.write_bytes(novo)
    return True


def trocar_nome(texto):
    for antigo, novo in TROCAS:
        texto = texto.replace(antigo, novo)
    return texto


def esconder_letreiro(texto):
    # Cena própria (não é o ObjectLoader do three): o nó instanciado some com count 0.
    return re.sub(r'("name":"Blender / VILA-AURORA-tipografia[^"]*".*?"instances":\{"count":)1',
                  r"\g<1>0", texto, flags=re.S)


def copiar():
    # Esvazia sem apagar a pasta em si: no Windows ela pode estar aberta por outro processo.
    for item in DESTINO.glob("*") if DESTINO.exists() else []:
        shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(ORIGEM, DESTINO, dirs_exist_ok=True, ignore=lambda pasta, nomes: [
        n for n in nomes if n in FORA or n.endswith(".map")])
    for caminho in sorted(DESTINO.rglob("*liv-ipanema*"), key=lambda p: -len(p.parts)):
        caminho.rename(caminho.with_name(trocar_nome(caminho.name)))


def renomear_tudo():
    for caminho in DESTINO.rglob("*"):
        if not caminho.is_file():
            continue
        if caminho.suffix == ".gz":
            bruto = caminho.read_bytes()
            try:
                texto = gzip.decompress(bruto).decode("utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            novo = esconder_letreiro(trocar_nome(texto))
            if novo != texto:
                # O hash do conteúdo descomprimido também aparece nos manifestos.
                trocados[sha(texto.encode())] = (sha(novo.encode()), len(novo.encode()))
                gravar(caminho, gzip.compress(novo.encode(), 9, mtime=0))
        elif caminho.suffix in TEXTO:
            texto = caminho.read_text(encoding="utf-8")
            gravar(caminho, trocar_nome(texto).encode("utf-8"))


def ajustar_dados():
    (DESTINO / "estoque-config.json").write_text(
        json.dumps({"schema": "liv-sales-config-v1", "mode": "desativado"}, indent=2) + "\n", encoding="utf-8")

    caminho = DESTINO / "comercial.json"
    comercial = json.loads(caminho.read_text(encoding="utf-8"))
    comercial["bookSHA256"] = LIVRO_FALSO
    comercial["source"] = {"label": f"Tabela ilustrativa {NOME} (demonstração)", "asOf": date.today().isoformat()}
    for unidade in comercial["units"]:
        # Disponibilidade e preço inventados, mas estáveis entre execuções.
        semente = int(sha(unidade["id"].encode())[:8], 16)
        unidade["availability"] = "vendida" if semente % 10 < 4 else "disponivel"
        unidade["priceCents"] = 30_000_000 + semente % 60 * 100_000
        unidade["conditions"] = "Valores ilustrativos, só para demonstração" if unidade["availability"] == "disponivel" else None
    caminho.write_text(json.dumps(comercial, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def sem_fonte_do_cliente(valor):
        # As unidades guardam de onde vieram (o book do cliente); a demonstração não.
        if isinstance(valor, dict):
            # bookSHA256 amarra tabela, vínculos e unidades: vira o mesmo código falso em todos.
            return {chave: LIVRO_FALSO if chave == "bookSHA256" else sem_fonte_do_cliente(filho)
                    for chave, filho in valor.items()
                    if not (isinstance(filho, str) and "livonincorporadora" in filho)}
        if isinstance(valor, list):
            return [sem_fonte_do_cliente(filho) for filho in valor]
        return valor
    for caminho in DESTINO.rglob("*.json"):
        texto = caminho.read_text(encoding="utf-8")
        if "livonincorporadora" in texto or '"bookSHA256"' in texto:
            dados = sem_fonte_do_cliente(json.loads(texto))
            gravar(caminho, (json.dumps(dados, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

    for caminho in DESTINO.glob("*.js"):
        texto = caminho.read_text(encoding="utf-8")
        texto = texto.replace("implantação aproximada do LIV", "implantação aproximada do prédio")
        gravar(caminho, texto.encode("utf-8"))

    caminho = DESTINO / "maquete-vila-aurora.html"
    html = caminho.read_text(encoding="utf-8")
    html = re.sub(r'<script[^>]*analytics/classico\.mjs[^>]*></script>', "", html)
    html = re.sub(r'<link rel="canonical"[^>]*>|<base [^>]*>', "", html)
    html = re.sub(r'<a [^>]*livonincorporadora[^>]*>.*?</a>', "", html, flags=re.S)
    html = re.sub(r'Empreendimento · Livon Incorporadora', "Empreendimento · demonstração", html)
    # Dentro da apresentação, o "Voltar ao site" do LIV abriria o site dentro do quadro.
    html = html.replace("</head>", "<script>if(top!==self)document.documentElement.classList.add('embutida')</script>"
                        "<style>.embutida #siteHomeLink,.map-link{display:none!important}</style></head>", 1)
    caminho.write_text(html, encoding="utf-8")
    shutil.copyfile(caminho, DESTINO / "index.html")


def tirar_mapa_da_fila():
    # O grupo "map" precisa continuar existindo (o worker valida a ordem), só sem arquivos.
    caminho = DESTINO / "transfer-manifest.json"
    fila = json.loads(caminho.read_text(encoding="utf-8"))
    fila["files"] = [f for f in fila["files"] if f["group"] != "map"]
    fila.pop("version")
    fila["version"] = sha(json.dumps(fila, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())
    gravar(caminho, (json.dumps(fila, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def desenhar_plantas():
    """Planta própria no mesmo registro 1000x1000 da original: régua, medidas e entrada continuam batendo."""
    from PIL import Image, ImageDraw, ImageFont

    fonte = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 34)  # tamanho real sai do ajuste por cômodo
    codigo = (DESTINO / "tipologias.js").read_text(encoding="utf-8")
    for tipo in ("canto", "meio"):
        regua = re.search(rf"const {tipo}Ruler=\{{.*?paths:\[(.*?)\]\}};", codigo, re.S).group(1)
        caminhos = [json.loads(p) for p in re.findall(r"\[\[.*?\]\]", regua)]
        bloco = re.search(rf"const {tipo}Measurements=\[(.*?)\];", codigo, re.S).group(1)
        rotulos = [(nome.split(" · ")[0], float(x) * 1000, float(y) * 1000)
                   for nome, x, y in re.findall(r"name:'([^']+)',x:([\d.]+),y:([\d.]+)", bloco)]

        def dentro(ponto, poligono):
            x, y = ponto
            fora = False
            for (x1, y1), (x2, y2) in zip(poligono, poligono[1:] + poligono[:1]):
                if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                    fora = not fora
            return fora

        k = 2  # desenha em dobro e reduz: borda sem serrilhado
        imagem = Image.new("RGB", (1000 * k, 1000 * k), "white")
        tela = ImageDraw.Draw(imagem)
        for poligono in caminhos:
            nomes = [n for n, x, y in rotulos if dentro((x, y), poligono)]
            molhado = any(n.startswith(("Banho", "Varanda")) for n in nomes)
            pontos = [(x * k, y * k) for x, y in poligono]
            tela.polygon(pontos, fill="#e6ecf1" if molhado else "#efe4d4")
            xs, ys = [p[0] for p in pontos], [p[1] for p in pontos]
            mascara = Image.new("L", imagem.size, 0)
            ImageDraw.Draw(mascara).polygon(pontos, fill=255)
            textura = Image.new("RGB", imagem.size, "white")
            riscos = ImageDraw.Draw(textura)
            # Piso: porcelanato em grade nas áreas molhadas, régua de madeira no resto.
            passo = 44 * k if molhado else 16 * k
            for y in range(int(min(ys)), int(max(ys)), passo):
                riscos.line([(min(xs), y), (max(xs), y)], fill="#d3dbe2" if molhado else "#e2d4c0", width=k)
            if molhado:
                for x in range(int(min(xs)), int(max(xs)), passo):
                    riscos.line([(x, min(ys)), (x, max(ys))], fill="#d3dbe2", width=k)
            imagem.paste(textura, (0, 0), Image.composite(mascara, Image.new("L", imagem.size, 0),
                                                         Image.eval(textura.convert("L"), lambda v: 255 if v < 250 else 0)))
        for poligono in caminhos:
            pontos = [(x * k, y * k) for x, y in poligono]
            tela.line(pontos + pontos[:1], fill="#2f343b", width=11 * k, joint="curve")
        for nome, x, y in rotulos:
            # Cômodo estreito ganha letra menor; acima do ponto porque no zoom a cota vai nele.
            sala = next((p for p in caminhos if dentro((x, y), p)), None)
            largura = (max(a for a, _ in sala) - min(a for a, _ in sala)) * k * .86 if sala else 1e9
            tamanho = 17 * k
            while tamanho > 10 * k and fonte.font_variant(size=tamanho).getlength(nome.upper()) > largura:
                tamanho -= k
            tela.text((x * k, (y - 34) * k), nome.upper(), font=fonte.font_variant(size=tamanho), fill="#3d4652", anchor="mm")
        # O recorte antigo seguia o contorno da planta do cliente; este segue a nossa.
        poligonos = "".join('<polygon points="%s"/>' % " ".join(f"{x},{y}" for x, y in p) for p in caminhos)
        gravar(DESTINO / "plantas2d" / f"{tipo}-recorte.svg", (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><g fill="white" stroke="white" '
            f'stroke-width="12" stroke-linejoin="round">{poligonos}</g></svg>\n').encode())
        caminho = DESTINO / "plantas2d" / f"{tipo}.jpg"
        buffer = __import__("io").BytesIO()
        imagem.resize((1000, 1000), Image.LANCZOS).save(buffer, "JPEG", quality=88)
        gravar(caminho, buffer.getvalue())


def trocar_hashes(texto):
    return re.sub(r"\b[0-9a-f]{64}\b", lambda m: trocados.get(m.group(0), (m.group(0),))[0], texto)


def recalcular_hashes():
    """Propaga hash e tamanho novos até nenhum manifesto mudar mais."""
    while True:
        mudou = False
        for caminho in DESTINO.rglob("*"):
            if caminho.is_file() and caminho.suffix == ".gz":
                # A fonte congelada do interior guarda o hash da unidade.json dentro do .gz.
                try:
                    texto = gzip.decompress(caminho.read_bytes()).decode("utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                novo = trocar_hashes(texto)
                if novo != texto:
                    trocados[sha(texto.encode())] = (sha(novo.encode()), len(novo.encode()))
                    mudou |= gravar(caminho, gzip.compress(novo.encode(), 9, mtime=0))
                continue
            if not caminho.is_file() or caminho.suffix not in TEXTO:
                continue
            texto = caminho.read_text(encoding="utf-8")
            if caminho.suffix == ".json":
                dados = json.loads(texto)
                registros = []

                def visitar(valor):
                    if isinstance(valor, dict):
                        if valor.get("sha256") in trocados:
                            valor["sha256"], tamanho = trocados[valor["sha256"]]
                            if "bytes" in valor:
                                valor["bytes"] = tamanho
                            registros.append(valor)
                        for filho in valor.values():
                            visitar(filho)
                    elif isinstance(valor, list):
                        for filho in valor:
                            visitar(filho)
                visitar(dados)
                if registros and isinstance(dados, dict):
                    if dados.get("schema") == "liv-transfer-manifest-v1":
                        dados.pop("version", None)
                        canonico = json.dumps(dados, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
                        dados["version"] = sha(canonico)
                    texto = json.dumps(dados, ensure_ascii=False, indent=2) + "\n"
            mudou |= gravar(caminho, trocar_hashes(texto).encode("utf-8"))
        if not mudou:
            return


def conferir():
    sobras = []
    for caminho in DESTINO.rglob("*"):
        if caminho.is_file() and caminho.suffix in TEXTO:
            for achado in PROIBIDO.finditer(caminho.read_text(encoding="utf-8")):
                sobras.append(f"{caminho.relative_to(DESTINO)}: {achado.group(0)}")
    tamanho = sum(p.stat().st_size for p in DESTINO.rglob("*") if p.is_file())
    print(f"{DESTINO.relative_to(RAIZ)}: {tamanho / 2**20:.0f} MB, {len(trocados)} arquivos trocados")
    print("\n".join(sorted(set(sobras))[:60]) or "nenhum rastro do cliente")


if __name__ == "__main__":
    copiar()
    renomear_tudo()
    ajustar_dados()
    tirar_mapa_da_fila()
    desenhar_plantas()
    recalcular_hashes()
    conferir()

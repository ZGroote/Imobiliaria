"""Clona a maquete publicada do LIV como demonstração própria da Conecta.

A cópia não pode apontar para nada do cliente: troca o nome em todo arquivo
(inclusive dentro dos .gz), desliga estoque e métricas, tira os links dele,
inventa a tabela comercial e esconde o letreiro modelado na torre. Como os
manifestos guardam sha256 e tamanho de cada arquivo, as trocas têm o mesmo
comprimento e os hashes são recalculados em cascata no fim.

Preserva as plantas 2D humanizadas originais e suas máscaras de recorte,
conforme solicitado, e tira o mapa do entorno, que mostra o terreno real.

    C:/Python314/python.exe -E experimentos/apresentacao-2026-11-01/clonar_demo.py
"""
import gzip
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
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
    antigo = caminho.read_bytes() if caminho.exists() else None
    if novo == antigo:
        return False
    if antigo is not None:
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


def preservar_plantas_originais():
    """Mantém os pixels e o registro original da régua, medidas e máscaras."""
    for tipo in ("canto", "meio"):
        for sufixo in (".jpg", "-recorte.svg"):
            relativo = Path("plantas2d") / f"{tipo}{sufixo}"
            gravar(DESTINO / relativo, (ORIGEM / relativo).read_bytes())
    caminho = DESTINO / "tipologias.js"
    texto = caminho.read_text(encoding="utf-8")
    for tipo in ("canto", "meio"):
        for sufixo in (".jpg", "-recorte.svg"):
            url = f"plantas2d/{tipo}{sufixo}"
            texto = texto.replace(f"'{url}'", f"'{url}?rev=original-20261102'")
    gravar(caminho, texto.encode("utf-8"))


def trocar_hashes(texto):
    return re.sub(r"\b[0-9a-f]{64}\b", lambda m: trocados.get(m.group(0), (m.group(0),))[0], texto)


def sincronizar_luz_aprovada():
    """Transporta a correção publicada de 01/11, conservando a identidade anônima da cena."""
    pacote = RAIZ / "publicacao/correcao-vergas-20261101"
    fontes = pacote / "fontes-liv"
    publicado = pacote / "payload/liv-classico"
    geometria_aprovada = RAIZ / "publicacao/qa-liv-laranjeiras-corredor-20261101/pacotes/liv-classico"

    def referencias_atuais(texto):
        while True:
            novo = trocar_hashes(texto)
            if novo == texto:
                return texto
            texto = novo

    def ler_json(caminho, pendente=False):
        texto = caminho.read_text(encoding="utf-8")
        return json.loads(referencias_atuais(texto) if pendente else texto)

    def ler_recurso(pasta, registro):
        dados = (pasta / registro["path"]).read_bytes()
        if sha(dados) != registro["sha256"]:
            raise ValueError(f"Recurso diferente do catálogo: {registro['path']}")
        if registro.get("compression") == "gzip":
            dados = gzip.decompress(dados)
            if sha(dados) != registro["decodedSHA256"]:
                raise ValueError(f"Conteúdo diferente do catálogo: {registro['path']}")
        return dados

    def identidade_visual(dados):
        # A anonimização muda nomes e hashes em cascata, nunca posições, UVs, materiais ou imagens.
        texto = re.sub(r"\b[0-9a-f]{64}\b", "HASH", trocar_nome(dados.decode("utf-8")))
        return json.loads(texto)

    catalogo = ler_json(DESTINO / "interiores/catalogo.json", pendente=True)
    base = ler_json(geometria_aprovada / "interiores/catalogo.json")
    for tipo in ("canto", "meio"):
        atual, aprovado = catalogo["tipologias"][tipo], base["tipologias"][tipo]
        for nome in ("source", "compact"):
            if identidade_visual(ler_recurso(DESTINO, atual["files"][nome])) != identidade_visual(ler_recurso(geometria_aprovada, aprovado["files"][nome])):
                raise ValueError(f"A geometria/UV de {tipo} não corresponde aos atlas aprovados.")
        relativo = Path("interiores") / tipo / "luz-horario/manifest.json"
        caminho = DESTINO / relativo
        manifesto = ler_json(caminho, pendente=True)
        correcao = ler_json(publicado / relativo)
        if correcao.get("wallDenoise") != "surface-plane-v1":
            raise ValueError(f"A revisão aprovada de {tipo} não contém a correção das vergas.")
        for campo, esperado in (("sourceSHA256", atual["sourceSHA256"]), ("geometrySHA256", atual["files"]["compact"]["decodedSHA256"])):
            if manifesto[campo] != esperado:
                raise ValueError(f"Manifesto de luz de {tipo} não corresponde à cena anônima: {campo}")
        if correcao["sourceSHA256"] != aprovado["sourceSHA256"] or correcao["geometrySHA256"] != aprovado["files"]["compact"]["decodedSHA256"]:
            raise ValueError(f"Atlas aprovados não correspondem à geometria de {tipo}.")
        metadados = lambda m: {k: v for k, v in m.items() if k not in {"keys", "night", "wallDenoise", "sourceSHA256", "geometrySHA256"}}
        if metadados(manifesto) != metadados(correcao):
            raise ValueError(f"Os parâmetros da iluminação de {tipo} mudaram.")
        anteriores = {entrada["id"]: entrada for entrada in [*manifesto["keys"], manifesto["night"]]}
        corrigidos = {entrada["id"]: entrada for entrada in [*correcao["keys"], correcao["night"]]}
        if anteriores.keys() != corrigidos.keys():
            raise ValueError(f"Os horários da iluminação de {tipo} mudaram.")
        campos = ("bytes", "sha256", "decodedBytes", "decodedSHA256")
        for identificador, anterior in anteriores.items():
            corrigido = corrigidos[identificador]
            if {k: v for k, v in anterior.items() if k not in campos} != {k: v for k, v in corrigido.items() if k not in campos}:
                raise ValueError(f"Sondas ou parâmetros do atlas {identificador} mudaram.")
            dados = ler_recurso(publicado, corrigido)
            if len(dados) != corrigido["decodedBytes"]:
                raise ValueError(f"Atlas aprovado incompleto: {identificador}")
            gravar(DESTINO / anterior["path"], (publicado / corrigido["path"]).read_bytes())
            trocados[anterior["decodedSHA256"]] = (corrigido["decodedSHA256"], corrigido["decodedBytes"])
            anterior.update({campo: corrigido[campo] for campo in campos})
        manifesto["wallDenoise"] = correcao["wallDenoise"]
        gravar(caminho, (json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

    # Só a expressão TSL aprovada: não importa o motor clássico nem as otimizações de outra revisão.
    inicio, fim = "export function createTimeIrradiance(", "// Equal RGBM expressions"
    aprovado = (fontes / "material-rgbm.js").read_text(encoding="utf-8")
    corpo = aprovado[aprovado.index(inicio):aprovado.index(fim)]
    corpo = re.sub(r"^  if\(classicBackend\)return classicAtlas[^\n]+\n", "", corpo, flags=re.M)
    caminho = DESTINO / "material-rgbm.js"
    texto = caminho.read_text(encoding="utf-8")
    texto = texto[:texto.index(inicio)] + corpo + texto[texto.index(fim):]
    def importar_tsl(achado):
        nomes = [nome.strip() for nome in achado.group(1).split(",")]
        for nome in ("floor", "fract", "mix"):
            if nome not in nomes:
                nomes.append(nome)
        return "import {" + ", ".join(nomes) + "} from 'three/tsl';"
    texto = re.sub(r"import \{([^}]+)\} from 'three/tsl';", importar_tsl, texto)
    gravar(caminho, texto.encode("utf-8"))
    caminho = DESTINO / "interior-luz-horario.js"
    texto = caminho.read_text(encoding="utf-8")
    texto = texto.replace("createTimeIrradiance({range:manifest.range,intensity:manifest.lightMapIntensity})",
                          "createTimeIrradiance({range:manifest.range,intensity:manifest.lightMapIntensity,width:manifest.width,height:manifest.height})")
    if "texture.minFilter=texture.magFilter=THREE.NearestFilter;" not in texto:
        ancora = 'const texture=own(createRGBMTexture(bytes,manifest));texture.name=`LIV luz gravada · ${id}`;'
        if texto.count(ancora) != 1:
            raise ValueError("Conferir o carregador dos atlas antes de sincronizar a luz.")
        texto = texto.replace(ancora, ancora + "\n      texture.minFilter=texture.magFilter=THREE.NearestFilter; // o shader interpola depois de decodificar RGBM")
    gravar(caminho, texto.encode("utf-8"))


def ajustar_fechamento_portas():
    """Corrige a própria folha de madeira e conserva ferragens, dobradiça e colisão."""
    modulo = Path(__file__).resolve().parent / "interior-porta-fecho.js"
    gravar(DESTINO / modulo.name, modulo.read_bytes())
    caminho = DESTINO / "interior-renderer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "FECHO-PORTAS-APRESENTACAO-20261103" in texto:
        return
    ancora = "import {createDoors} from './interior-portas.js';"
    chamada = "  for(const door of doors.doors)if(door.entrance)doors.setOpen(door.id,false,{instant:true});"
    if texto.count(ancora) != 1 or texto.count(chamada) != 1:
        raise ValueError("Conferir a integração do fechamento das portas no renderer.")
    texto = texto.replace(ancora, ancora + "\nimport {ajustarFolhaAoBatente} from './interior-porta-fecho.js';")
    texto = texto.replace(chamada, "  // FECHO-PORTAS-APRESENTACAO-20261103\n"
                          "  for(const door of doors.doors)ajustarFolhaAoBatente(door);\n" + chamada)
    gravar(caminho, texto.encode("utf-8"))


def internacionalizar_demo():
    """Propaga o idioma entre cenas sem recriar o cache nem alterar os dados do imóvel."""
    origem = Path(__file__).resolve().parent / "demo-i18n.js"
    gravar(DESTINO / origem.name, origem.read_bytes())
    revisao = sha(origem.read_bytes())[:12]
    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "IDIOMA-DEMO-20261103" not in texto:
        linhas = re.findall(r"  frame\.src=exterior\?`[^`]+`:\s*`[^`]+modo=planta3d`;", texto)
        if len(linhas) != 1:
            raise ValueError("Conferir a propagação do idioma entre as cenas.")
        linha = linhas[0]
        novo = "  // IDIOMA-DEMO-20261103\n  frame.src=(" + linha[len("  frame.src="):-1] + ")+(new URLSearchParams(location.search).get('lang')==='en'?'&lang=en':'');"
        texto = texto.replace(linha, novo, 1)
        gravar(caminho, texto.encode("utf-8"))
    for nome in ("index.html", "maquete-vila-aurora.html", "prova-rgbm.html", "interior.html"):
        caminho = DESTINO / nome
        html = caminho.read_text(encoding="utf-8")
        html = re.sub(r'<script type="module" src="demo-i18n\.js[^\"]*"></script>\s*', '', html)
        ancora = re.search(r'<script type="module" src="(?:viewer|renderer|interior-renderer)\.bundle\.js[^\"]*"></script>', html)
        if not ancora:
            raise ValueError(f"Bundle ausente ao configurar idioma: {nome}")
        html = html[:ancora.start()] + f'<script type="module" src="demo-i18n.js?rev={revisao}"></script>\n' + html[ancora.start():]
        gravar(caminho, html.encode("utf-8"))


def internacionalizar_plantas(origem=None):
    """Seleciona as cópias inglesas sem mudar o registro ou os arquivos originais PT."""
    pasta = Path(__file__).resolve().parent
    origem = Path(origem) if origem is not None else pasta / "plantas2d-en"
    assets = {}
    for tipo in ("canto", "meio"):
        caminho = origem / f"{tipo}.png"
        if not caminho.is_file():
            raise ValueError(f"Falta a planta 2D em inglês: {caminho}. Gere os dois PNGs antes de integrar.")
        dados = caminho.read_bytes()
        if len(dados) < 24 or not dados.startswith(b"\x89PNG\r\n\x1a\n") or dados[12:16] != b"IHDR":
            raise ValueError(f"A planta 2D em inglês não é um PNG válido: {caminho}")
        if (int.from_bytes(dados[16:20]), int.from_bytes(dados[20:24])) != (1000, 1000):
            raise ValueError(f"A planta 2D em inglês deve manter 1000×1000 pixels para a máscara e a régua: {caminho}")
        assets[tipo] = dados

    modulo = pasta / "planta2d-idioma.js"
    catalogo = DESTINO / "tipologias.js"
    texto = catalogo.read_text(encoding="utf-8")
    importacao = "import {localizedPlanImage} from './planta2d-idioma.js';\n"
    if texto.count(importacao) > 1:
        raise ValueError("Há importações repetidas do idioma das plantas 2D; conferir o catálogo.")
    for tipo, dados in assets.items():
        original = f"plantas2d/{tipo}.jpg?rev=original-20261102"
        ingles = f"plantas2d/{tipo}-en.png?rev={sha(dados)[:12]}"
        # A segunda alternativa permite atualizar o hash sem empilhar chamadas no catálogo.
        padrao = (r"image:(?:'" + re.escape(original) + r"'|localizedPlanImage\('" +
                  re.escape(original) + r"', 'plantas2d/" + tipo + r"-en\.png\?rev=[0-9a-f]{12}'\))")
        if len(re.findall(padrao, texto)) != 1:
            raise ValueError(f"Conferir a imagem original da planta {tipo} no catálogo antes de traduzir.")
        texto = re.sub(padrao, f"image:localizedPlanImage('{original}', '{ingles}')", texto, count=1)
    if importacao not in texto:
        texto = importacao + texto

    caminho_manifesto = DESTINO / "transfer-manifest.json"
    fila = json.loads(caminho_manifesto.read_text(encoding="utf-8"))
    if fila.get("schema") != "liv-transfer-manifest-v1" or "planta2d" not in fila.get("groups", {}):
        raise ValueError("Conferir o manifesto de transferência antes de incluir plantas inglesas.")
    caminhos = {f"plantas2d/{tipo}-en.png" for tipo in assets}
    fila["files"] = [registro for registro in fila["files"] if registro["path"] not in caminhos]
    fila["files"].extend({"path": f"plantas2d/{tipo}-en.png", "group": "planta2d",
                          "bytes": len(dados), "sha256": sha(dados), "essential": False}
                         for tipo, dados in assets.items())
    fila.pop("version", None)
    fila["version"] = sha(json.dumps(fila, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode())

    # Todas as fontes e âncoras foram verificadas antes de alterar o demo.
    for tipo, dados in assets.items():
        gravar(DESTINO / "plantas2d" / f"{tipo}-en.png", dados)
    gravar(DESTINO / modulo.name, modulo.read_bytes())
    gravar(catalogo, texto.encode("utf-8"))
    gravar(caminho_manifesto, (json.dumps(fila, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def ligar_vagas_apresentacao():
    """Liga a tabela ilustrativa às vagas sem reativar o cadastro do cliente."""
    modulo = Path(__file__).resolve().parent / "comercial-apresentacao.js"
    codigo = modulo.read_bytes()
    mapa = json.loads((DESTINO / "modelo/entrada/candidato/vagas.json").read_text(encoding="utf-8"))
    if mapa.get("schema") != "liv-parking-v1" or not isinstance(mapa.get("vagas"), list):
        raise ValueError("Mapa de vagas da apresentação inválido.")
    numeros = [vaga.get("numero") for vaga in mapa["vagas"]]
    if (any(type(numero) is not int for numero in numeros) or len(numeros) != 175 or
            set(numeros) != set(range(1, 176))):
        raise ValueError("O mapa de vagas da apresentação deve conter os números únicos de 1 a 175.")

    piloto = json.loads((DESTINO / "modelo/entrada/unidades-entrada.json").read_text(encoding="utf-8"))
    conhecidas = {semente["id"].replace("pavimento-modelo-01/", f"pavimento-modelo-{andar:02}/")
                  for semente in piloto["units"] for andar in range(17)}
    comercial = json.loads((DESTINO / "comercial.json").read_text(encoding="utf-8"))
    if (comercial.get("schema") != "liv-commercial-v1" or comercial.get("status") != "fornecido" or
            not isinstance(comercial.get("units"), list)):
        raise ValueError("Tabela de unidades/vagas da apresentação inválida.")
    ids, atribuidas = set(), set()
    for unidade in comercial["units"]:
        identificador, rotulo = unidade.get("id"), unidade.get("parking")
        if identificador not in conhecidas or identificador in ids:
            raise ValueError(f"Unidade desconhecida ou repetida no vínculo de vagas: {identificador}")
        ids.add(identificador)
        if rotulo is None:
            continue
        achado = re.fullmatch(r"Vaga ([1-9][0-9]*)", rotulo) if isinstance(rotulo, str) else None
        numero = int(achado[1]) if achado else None
        if numero not in numeros or numero in atribuidas:
            raise ValueError(f"Vaga inexistente, repetida ou sem número explícito na unidade {identificador}: {rotulo}")
        atribuidas.add(numero)

    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    original = "import {attachCommercial} from './comercial.js';"
    apresentacao = "import {attachPresentationCommercial as attachCommercial} from './comercial-apresentacao.js';"
    if texto.count(original) == 1 and apresentacao not in texto:
        texto = texto.replace(original, apresentacao, 1)
    elif texto.count(apresentacao) != 1 or original in texto:
        raise ValueError("Conferir a integração comercial das vagas no viewer da apresentação.")
    # Dados e âncoras foram conferidos antes de alterar qualquer arquivo.
    gravar(DESTINO / modulo.name, codigo)
    gravar(caminho, texto.encode("utf-8"))


def habilitar_preparo_completo():
    """A apresentação prepara todos os modos sem trocar a vista do visitante."""
    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "PREPARO-APRESENTACAO-20261102" in texto:
        return
    trocas = [
        ("function cancelOtherInteriors(kind){",
         "let eagerAllViews=false; // PREPARO-APRESENTACAO-20261102\n"
         "function cancelOtherInteriors(kind){\n  if(eagerAllViews)return;"),
        ("function prepareViews(){\n  if(warmJob)return warmJob;",
         "function prepareViews({all=false}={}){\n  eagerAllViews ||= all;\n"
         "  if(warmJob)return all?warmJob.then(()=>prepareViews({all:true})):warmJob;"),
        ("const unit=selectedApartment(),kinds=['exterior'];\n    if(hasApartmentLayout(unit))kinds.push(`interior:${unit.relation.typology}`);",
         "const unit=selectedApartment(),kinds=all?['exterior','interior:canto','interior:meio']:['exterior'];\n"
         "    if(!all&&hasApartmentLayout(unit))kinds.push(`interior:${unit.relation.typology}`);"),
        ("await attempt(()=>prepareScene(kind));",
         "await attempt(async()=>{const frame=await prepareScene(kind);if(all&&kind==='exterior')await sceneAPI(frame).fullAtlas;});"),
        ("getCacheState:()=>({scenes:[...sceneCache.keys()],plans:",
         "getCacheState:()=>({scenes:[...sceneCache.keys()],readyScenes:[...sceneCache].filter(([,frame])=>reusableScene(frame)).map(([kind])=>kind),plans:"),
    ]
    for antigo, novo in trocas:
        if texto.count(antigo) != 1:
            raise ValueError(f"O viewer mudou; conferir o preparo antes de publicar: {antigo[:75]}")
        texto = texto.replace(antigo, novo)
    gravar(caminho, texto.encode("utf-8"))


def preparar_cenas_na_entrada():
    """Começa o preparo com o catálogo e reaproveita a cena ativa entre Planta 3D e Tour."""
    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "PREPARO-NA-ENTRADA-20261103" in texto:
        return
    trocas = [
        ("    await Promise.all(['canto','meio'].map(key=>attempt(()=>plans.prepare(key,typology(key)))));",
         "    const plansReady=Promise.all(['canto','meio'].map(key=>attempt(()=>plans.prepare(key,typology(key))))); // PREPARO-NA-ENTRADA-20261103"),
        ("    // Prepare one graphics context at a time. Navigation shares an in-flight\n"
         "    // preparation instead of creating another copy of the same screen.\n"
         "    // Only the selected apartment's interior: warming both interiors and the\n"
         "    // map right after opening froze the maquette for ~10 s. The map and any\n"
         "    // other interior are prepared when opened.",
         "    // A navegação compartilha o preparo em andamento. Os interiores têm fila própria,\n"
         "    // sem criar duas cópias da mesma cena nem iniciar os dois interiores juntos."),
        ("    for(const kind of kinds){\n      if(cacheStopped||epoch!==cacheEpoch)return false;\n      await attempt(async()=>{const frame=await prepareScene(kind);if(all&&kind==='exterior')await sceneAPI(frame).fullAtlas;});\n    }",
         "    // O exterior e seu atlas não bloqueiam a fila dos interiores; só um interior inicia por vez.\n"
         "    const exteriorReady=all?attempt(async()=>{const frame=await prepareScene('exterior');await sceneAPI(frame).fullAtlas;}):null;\n"
         "    for(const kind of kinds){\n      if(cacheStopped||epoch!==cacheEpoch)return false;\n"
         "      if(all&&kind==='exterior')continue;\n      await attempt(()=>prepareScene(kind));\n    }\n"
         "    await Promise.all([plansReady,exteriorReady]);"),
        ("      if(unitUI)unitUI.setCatalog(units);else unitUI=createUnitUI(units);\n      update();",
         "      if(unitUI)unitUI.setCatalog(units);else unitUI=createUnitUI(units);\n      update();\n"
         "      if(document.documentElement.dataset.apresentacao==='viewer')void prepareViews({all:true});"),
        ("  const targetKind=mode==='maquete'?'exterior':`interior:${state.typology}`;",
         "  const targetKind=mode==='maquete'?'exterior':`interior:${state.typology}`;\n"
         "  // Planta 3D e Tour usam o mesmo renderer: não estacionar uma cena que continua visível.\n"
         "  if(state.ready&&['planta3d','visita'].includes(mode)&&frameKind===targetKind&&reusableScene(state.frame)){\n"
         "    const api=sceneAPI(state.frame);\n"
         "    if(api.setMode(mode)!==false){\n"
         "      applyTimeToFrame(state.frame);state.sceneReuseCount++;state.interiorReuseCount++;\n"
         "      overlay.hidden=true;update();return true;\n    }\n  }"),
    ]
    for antigo, novo in trocas:
        if texto.count(antigo) != 1:
            raise ValueError(f"O viewer mudou; conferir o preparo de entrada: {antigo[:80]}")
        texto = texto.replace(antigo, novo)
    gravar(caminho, texto.encode("utf-8"))


def compartilhar_fila_dos_interiores():
    """Preparo antecipado e cliques compartilham a mesma fila e promessa por interior."""
    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "FILA-COMPARTILHADA-20261103" in texto:
        return
    trocas = [
        ("function prepareScene(kind){\n  const cached=sceneCache.get(kind);\n  if(reusableScene(cached))return Promise.resolve(cached);\n  if(sceneLoads.has(kind))return sceneLoads.get(kind);\n  if(cached)retireFrame(cached);",
         "let interiorPreparation=Promise.resolve(); // FILA-COMPARTILHADA-20261103\n"
         "function prepareScene(kind){\n  const cached=sceneCache.get(kind);\n"
         "  if(reusableScene(cached))return Promise.resolve(cached);\n"
         "  if(sceneLoads.has(kind))return sceneLoads.get(kind);\n"
         "  const epoch=cacheEpoch,start=()=>{\n"
         "    if(cacheStopped||cacheEpoch!==epoch)throw Error('Visualizador encerrado.');\n"
         "    const previous=sceneCache.get(kind);if(previous)retireFrame(previous);\n"
         "    return startScene(kind);\n  };\n"
         "  const interior=kind.startsWith('interior:');\n"
         "  const job=interior?interiorPreparation.then(start):start();\n"
         "  sceneLoads.set(kind,job);\n"
         "  if(interior)interiorPreparation=job.catch(()=>{});\n"
         "  const settled=()=>{if(sceneLoads.get(kind)===job)sceneLoads.delete(kind);};\n"
         "  job.then(settled,settled);return job;\n}\n"
         "function startScene(kind){"),
        ("    },null,{current,progress:()=>state.frame===frame?sceneAPI(frame)?.progress:null});",
         "    },null,{current,progress:()=>frameKind===kind?sceneAPI(frame)?.progress:null});"),
        ("  sceneLoads.set(kind,job);\n  job.catch(()=>{if(sceneCache.get(kind)===frame)retireFrame(frame);}).finally(()=>{if(sceneLoads.get(kind)===job)sceneLoads.delete(kind);});\n  return job;",
         "  return job.catch(error=>{if(sceneCache.get(kind)===frame)retireFrame(frame);throw error;});"),
        ("    const prepared=prepareScene(kind);state.frame=sceneCache.get(kind);frameKind=kind;\n    const frame=await prepared;if(token!==generation)return;",
         "    const prepared=prepareScene(kind);state.frame=sceneCache.get(kind)||null;frameKind=kind;\n"
         "    const frame=await prepared;if(token!==generation)return;\n    state.frame=frame;"),
    ]
    for antigo, novo in trocas:
        if texto.count(antigo) != 1:
            raise ValueError(f"O viewer mudou; conferir fila dos interiores: {antigo[:80]}")
        texto = texto.replace(antigo, novo)
    gravar(caminho, texto.encode("utf-8"))


def limpar_interface_apresentacao():
    """Acabamento exclusivo da apresentação, sem alterar os renderers de origem."""
    css = r"""/* Apresentação: o imóvel ocupa a cena; ferramentas aparecem por contexto. */
@font-face{font-family:Satoshi;src:url('../fonts/Satoshi-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Satoshi;src:url('../fonts/Satoshi-Medium.woff2') format('woff2');font-weight:500;font-display:swap}
:root{color-scheme:light!important;--page:#f5f8ff;--surface:#fff;--raised:#fff;--line:#dce3fa;--ink:#07184d;--text:#536389;--muted:#5a6b93;--panel:#edf2ff;--accent:#3345ff;--gold:#4336d9;--brand-gradient:linear-gradient(110deg,#008ff5 0%,#3345ff 52%,#8a15f3 100%);color:var(--ink)!important;background:var(--page)!important;font-family:Satoshi,Arial,Helvetica,sans-serif}
html,body{margin:0;background:#f5f8ff!important;color:#07184d!important}
[hidden]{display:none!important}
button,select,a{font-family:inherit}
button,select{min-height:44px!important;border:1px solid #dce3fa!important;border-radius:8px!important;background:#ffffffed!important;color:#07184d!important;font-size:12px!important;box-shadow:none!important}
button{cursor:pointer}
button:hover{background:#edf2ff!important;border-color:#3345ff55!important}
button[aria-pressed=true]{background:#edf2ff!important;border-color:#3345ff66!important;color:#3345ff!important}
button:focus-visible,select:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #3345ff!important;outline-offset:3px!important}
button:disabled,select:disabled{opacity:.42;cursor:default}
html[data-apresentacao=viewer],html[data-apresentacao=viewer] body{height:100dvh;overflow:clip;padding:0!important;display:block}
html[data-apresentacao=viewer] body .layout,html[data-apresentacao=viewer] body .layout:has(.viewer-panel[data-collapsed=true]){position:relative;display:block;width:100%;max-width:none;height:100dvh;min-height:0;margin:0!important;padding:0;gap:0;flex:none}
html[data-apresentacao=viewer] .visual,html[data-apresentacao=viewer] .stage{width:100%;height:100%;min-height:0;margin:0;background:#f5f8ff!important;border-radius:0}
#mobileToolbar,#orientationControls,#experienceBar,#demonstrationNote,#projectPanel,#buyerContact,.project-action-row,.stage-badge,.data-warnings,#furniture-panel,[data-whatsapp-floating=true]{display:none!important}
html[data-apresentacao=viewer] .stage-toolbar{inset:auto auto 16px 16px!important;display:flex;max-width:calc(100% - 130px);pointer-events:none;z-index:8}
#availabilityFilter{display:block!important;position:static!important;padding:0!important;width:auto!important;border:0!important;background:none!important;pointer-events:auto}
#availabilityFilter[hidden]{display:none!important}
#availabilityFilter>label,#availabilityFilter>select{display:none!important}
#presentationAvailability{white-space:nowrap;padding:9px 13px;box-shadow:0 2px 12px #07184d0a!important}
#presentationAvailability:before{content:"";display:inline-block;width:7px;height:7px;margin-right:8px;border:1px solid currentColor;border-radius:50%;vertical-align:1px}
#presentationAvailability[aria-pressed=true]:before{background:var(--brand-gradient);border-color:transparent}
#presentationUnit{position:absolute;left:16px;bottom:70px;z-index:8;max-width:calc(100% - 140px);padding:8px 12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;box-shadow:0 2px 12px #07184d0a!important}
html[data-apresentacao=viewer] .layout .viewer-controls{position:absolute!important;inset:auto auto 16px 50%!important;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px)!important;display:flex!important;flex-direction:row;margin:0!important;padding:0!important;border:0!important;background:none!important;z-index:8;gap:0}
html[data-presentation-mode=maquete] .layout .viewer-controls{display:none!important}
html[data-apresentacao=viewer] .layout .interior-navbar{display:flex;align-items:center;width:auto;max-width:100%;margin:0;padding:4px;gap:4px;border:1px solid #dce3fa;border-radius:12px;background:#fffffff2;box-shadow:0 3px 18px #07184d09}
html[data-apresentacao=viewer] .layout .interior-navbar[hidden]{display:none!important}
.host-plan-controls,.host-tour-controls,.host-plan2d-controls{display:flex!important;align-items:center;flex-wrap:nowrap;gap:4px!important;max-width:100%}
.host-plan-controls[hidden],.host-tour-controls[hidden],.host-plan2d-controls[hidden]{display:none!important}
.host-plan-controls button,.host-tour-controls button,.host-plan2d-controls button{flex:none;padding:8px 11px!important;white-space:nowrap;border-color:transparent!important;background:transparent!important}
.host-plan2d-controls output{min-width:42px;text-align:center;font-size:11px;color:#536389;font-variant-numeric:tabular-nums}
#plan2dZoomOut,#plan2dZoomIn{width:38px;padding:0!important;font-size:21px!important}
#hostRoomSelect{min-width:110px;max-width:210px;padding:8px 28px 8px 10px;border-color:transparent!important;background-color:transparent!important}
html[data-apresentacao=viewer] #plan2dMeasurements,html[data-apresentacao=viewer] #plan2dRuler{position:static!important;inset:auto!important;z-index:auto;min-height:44px;font-size:12px!important;border-radius:7px!important}
#plan2dMeasurements>span{display:none}
#plan2dMeasurementsNote{position:absolute!important;inset:auto auto 78px 16px!important;margin:0;padding:4px 7px;background:#fffffff2!important;color:#536389!important;border-radius:5px;font-size:10px;z-index:6}
.plan2d-layer{border-radius:0!important;background:#f5f8ff!important}
.plan2d-layer img{border-radius:0!important}
.plan2d-entry{color:#07184d!important}
.plan2d-measurement{color:#07184d!important;border-color:#dce3fa!important;background:#fffffff5!important;box-shadow:0 1px 6px #07184d12!important}
html[data-apresentacao=viewer] #plan2dRulerControls{position:absolute;inset:auto auto 78px 16px!important;width:min(330px,calc(100% - 32px))!important;min-width:0;padding:12px!important;border:1px solid #dce3fa!important;border-radius:10px;background:#fffffff5!important;color:#07184d;box-shadow:0 3px 18px #07184d09;z-index:9}
#plan2dRulerControls p{position:static!important;width:auto!important;margin:0 0 8px!important;color:#536389;font-size:11px!important;line-height:1.5}
#plan2dRulerControls p:after{content:none!important}
#plan2dRulerControls>div{display:flex!important;gap:4px!important}
#plan2dRulerControls button{display:block!important;min-width:0;padding:7px!important;font-size:11px!important;flex:1}
#plan2dRulerControls button:before{content:none!important}
#plan2dRulerControls small{display:none!important}
.plan2d-ruler-segment line,.plan2d-ruler-segment circle,.plan2d-ruler-segment rect,.plan2d-ruler-point{stroke:#3345ff!important}
.plan2d-ruler-segment text{fill:#07184d!important}
.plan2d-ruler-segment circle,.plan2d-ruler-segment rect,.plan2d-ruler-point{fill:#edf2ff!important}
.plan2d-ruler-snap{fill:#3345ff!important}
#stage .liv-clock,#stage .liv-clock:not([data-phase=dia]){position:absolute;inset:auto 16px 16px auto!important;transform:none!important;width:98px!important;height:auto!important;max-height:calc(100% - 32px);padding:0!important;display:flex;gap:7px;align-items:stretch;color:#07184d!important;text-shadow:none!important;background:transparent!important;border:0!important;z-index:9}
#stage .liv-clock-toggle{display:flex!important;align-items:center;justify-content:center;order:4;width:100%;height:44px;min-height:44px;flex:0 0 44px;padding:8px!important;font-size:11px!important;box-shadow:0 2px 12px #07184d0a!important}
#stage .liv-clock:not([data-expanded=true])>:not(.liv-clock-toggle){display:none!important}
#stage .liv-clock[data-expanded=true]{width:112px!important;height:min(288px,calc(100% - 32px))!important;padding:9px!important;border:1px solid #dce3fa!important;border-radius:12px;background:#fffffff5!important;box-shadow:0 3px 18px #07184d09}
#stage .liv-clock-heading{flex-shrink:0;gap:2px}
#stage .liv-clock-heading label{color:#536389;font-size:10px}
#stage .liv-clock output{font-size:18px;color:#07184d}
#stage .liv-clock-scale{margin-inline:auto;flex:1;min-height:44px}
#stage .liv-clock p{color:#536389;font-size:9px;text-shadow:none}
#stage .liv-clock-detail{display:none}
#stage .liv-clock input::-webkit-slider-runnable-track{background:linear-gradient(0deg,#008ff5 0%,#3345ff 52%,#8a15f3 100%);box-shadow:none}
#stage .liv-clock input::-moz-range-track{background:linear-gradient(0deg,#008ff5 0%,#3345ff 52%,#8a15f3 100%)}
#stage .liv-clock input::-webkit-slider-thumb{background:#3345ff;border-color:#fff;box-shadow:0 1px 8px #07184d33}
#stage .liv-clock input::-moz-range-thumb{background:#3345ff;border-color:#fff;box-shadow:0 1px 8px #07184d33}
.overlay,#failure{background:#f5f8ff!important;color:#07184d!important}
.overlay p{color:#536389!important}
.loading-mark{border-color:#dce3fa!important;border-top-color:#3345ff!important}
.unit-details{width:min(540px,calc(100% - 32px));padding:24px;border:1px solid #dce3fa;border-radius:16px;background:#fff;color:#07184d;box-shadow:0 20px 80px #07184d2b}
.unit-details::backdrop{background:#07184d66;backdrop-filter:blur(3px)}
.unit-details .eyebrow{color:#536389}.unit-details h2{font-size:23px;letter-spacing:-.6px}.unit-details dt,.unit-details .note{color:#536389!important}.unit-details #detailsBody dl{border-color:#dce3fa}.unit-details .source-details{display:none}.unit-details .details-actions{display:none}
html[data-apresentacao=exterior] #stage,html[data-apresentacao=interior] #interior-stage{background:#f5f8ff!important}
html[data-apresentacao=exterior] header,html[data-apresentacao=exterior] nav{display:none!important}
html[data-apresentacao=exterior] #stage{height:100dvh!important;min-height:0!important}
html[data-apresentacao=interior] #interior-stage{height:100dvh;min-height:0}
html[data-apresentacao=interior] #interior-controls,html[data-apresentacao=interior] #interior-note{display:none!important}
html[data-apresentacao=interior] #interior-canvas{width:100%!important;margin:0!important}
html[data-apresentacao=interior] #touch-pad{left:16px;right:auto;bottom:80px;gap:3px}
html[data-apresentacao=interior] #touch-pad button{width:40px;min-height:40px!important;padding:0;font-size:16px!important;background:#ffffffd9!important;backdrop-filter:blur(5px)}
@media(max-width:640px){
 html[data-apresentacao=viewer] .layout .viewer-controls{bottom:12px!important;max-width:calc(100% - 24px)!important}
 html[data-apresentacao=viewer] .stage-toolbar{left:12px!important;bottom:12px!important}
 #presentationUnit{left:12px;bottom:64px}
 #presentationAvailability{padding:8px 10px;font-size:11px!important}
 #stage .liv-clock{right:12px!important;bottom:12px!important;width:90px!important}
 html:not([data-presentation-mode=maquete]) #stage .liv-clock{bottom:76px!important}
 .host-plan2d-controls{gap:0!important}.host-plan2d-controls button{padding-inline:7px!important;font-size:11px!important}
 .host-plan2d-controls output{display:none}
 .host-plan2d-controls{min-width:0}
 #plan2dReset{width:36px;min-width:36px;padding:0!important;font-size:0!important}
 #plan2dReset:after{content:'↺';font-size:20px}
 #plan2dZoomOut,#plan2dZoomIn{width:32px}
 #hostRoomSelect{max-width:155px}
 #plan2dMeasurementsNote{bottom:74px!important;left:12px!important}
 html[data-apresentacao=viewer] #plan2dRulerControls{left:12px!important;bottom:74px!important;width:min(310px,calc(100% - 24px))!important}
 html[data-apresentacao=interior] #touch-pad{left:12px;bottom:80px;grid-template-columns:40px 40px 40px}
}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
"""
    gravar(DESTINO / "apresentacao.css", css.encode("utf-8"))
    revision = sha(css.encode("utf-8"))[:12]

    for nome, modo in (("index.html", "viewer"), ("maquete-vila-aurora.html", "viewer"),
                       ("prova-rgbm.html", "exterior"), ("interior.html", "interior")):
        caminho = DESTINO / nome
        html = caminho.read_text(encoding="utf-8")
        html = re.sub(r' data-apresentacao="[^"]*"', '', html)
        html = html.replace('<html lang="pt-BR">', f'<html lang="pt-BR" data-apresentacao="{modo}">', 1)
        html = re.sub(r'<link[^>]*href="apresentacao\.css[^\"]*"[^>]*>\s*', '', html)
        html = html.replace('</style>', f'</style>\n<link rel="stylesheet" href="apresentacao.css?rev={revision}">', 1)
        if modo == "viewer":
            html = re.sub(r'<script[^>]*src="orientacao\.js[^\"]*"[^>]*></script>\s*', '', html)
            def compactar_ir(achado):
                inicio = achado.group(1)
                if 'aria-label=' not in inicio:
                    inicio += ' aria-label="Ir ao ambiente selecionado"'
                return inicio + '>Ir ↗</button>'
            html = re.sub(r'(<button\b[^>]*\bid="hostRoomGo"[^>]*)(>).*?</button>', compactar_ir, html)
            if 'id="presentationAvailability"' not in html:
                html = html.replace('<div id="availabilityFilter" hidden>', '<div id="availabilityFilter" hidden>'
                    '<button type="button" id="presentationAvailability" aria-pressed="false" aria-describedby="availabilitySummary">Ver disponibilidade</button>')
                html = html.replace('<div class="stage-toolbar">', '<button type="button" id="presentationUnit" hidden>Ficha do apartamento</button><div class="stage-toolbar">')
                # Uma única barra inferior para as ferramentas da planta, em vez de quatro cantos.
                medidas = re.search(r'<button[^>]*id="plan2dMeasurements".*?</button>', html).group(0)
                regua = re.search(r'<button[^>]*id="plan2dRuler".*?</button>', html).group(0)
                html = html.replace(medidas, '', 1).replace(regua, '', 1)
                html = html.replace('<div id="hostPlan2dControls" class="host-plan2d-controls" hidden>',
                    '<div id="hostPlan2dControls" class="host-plan2d-controls" hidden>' + medidas + regua)
        gravar(caminho, html.encode("utf-8"))

    caminho = DESTINO / "experiencia-compra.js"
    texto = caminho.read_text(encoding="utf-8")
    antigo = "const toolbar=el('mobileToolbar'),media="
    if antigo in texto:
        texto = texto.replace(antigo, "const toolbar=doc.documentElement.dataset.apresentacao==='viewer'?null:el('mobileToolbar'),media=", 1)
        gravar(caminho, texto.encode("utf-8"))

    caminho = DESTINO / "viewer.js"
    texto = caminho.read_text(encoding="utf-8")
    if "INTERFACE-APRESENTACAO-20261102" not in texto:
        trocas = [
            ("state.hour=6.5;", "state.hour=10.5;"),
            ("state.availabilityFilter='disponiveis';", "state.availabilityFilter='todos'; // INTERFACE-APRESENTACAO-20261102"),
            ("const inlineDetailsMedia=window.matchMedia?.('(min-width: 1000px) and (min-height: 720px)');", "const inlineDetailsMedia=null; // Ficha sob demanda; a cena continua livre."),
            ("function update() {", "function update() {\n  document.documentElement.dataset.presentationMode=state.mode;"),
            ("  updateInfoPanel();\n  buyerUI.update", "  updateInfoPanel();\n  const presentationUnit=document.getElementById('presentationUnit');\n  presentationUnit.hidden=!unit||!exterior||!state.ready;\n  if(unit)presentationUnit.textContent=document.getElementById('selectedApartmentTitle').textContent+' · ficha';\n  buyerUI.update"),
            ("  filter.dataset.active=String(active&&available.length>0);", "  filter.dataset.active=String(active&&available.length>0);\n  const availabilityButton=document.getElementById('presentationAvailability');\n  availabilityButton.setAttribute('aria-pressed',String(active));\n  availabilityButton.disabled=!state.ready;"),
            ("document.getElementById('availability').addEventListener('change',event=>setAvailabilityFilter(event.target.value));", "document.getElementById('availability').addEventListener('change',event=>setAvailabilityFilter(event.target.value));\ndocument.getElementById('presentationAvailability').addEventListener('click',()=>setAvailabilityFilter(state.availabilityFilter==='todos'?'disponiveis':'todos'));\ndocument.getElementById('presentationUnit').addEventListener('click',()=>showDetails());"),
        ]
        for antigo, novo in trocas:
            if texto.count(antigo) != 1:
                raise ValueError(f"O viewer mudou; conferir a interface antes de publicar: {antigo[:80]}")
            texto = texto.replace(antigo, novo)
        gravar(caminho, texto.encode("utf-8"))

    caminho = DESTINO / "planta2d.js"
    texto = caminho.read_text(encoding="utf-8")
    if "ENQUADRAMENTO-APRESENTACAO-20261102" not in texto:
        trocas = [
            ("  function present(record){", """  // ENQUADRAMENTO-APRESENTACAO-20261102: o JPG e todas as coordenadas continuam originais.
  // O enquadramento considera o contorno visível, sem ampliar a margem vazia do book.
  function fittedPlanView(record){
    const box=record.key==='meio'?{x:.084,y:.269,w:.87,h:.481}:{x:.095,y:.216,w:.79,h:.586};
    const bounds=area(),image=size(record),fit=Math.min(bounds.width/image.width,bounds.height/image.height);
    const padding=110;
    const scale=clamp(Math.min((bounds.width-36)/(image.width*box.w*fit),(bounds.height-padding)/(image.height*box.h*fit)),1,6);
    return {scale,x:(.5-box.x-box.w/2)*image.width*fit*scale,y:(.5-box.y-box.h/2)*image.height*fit*scale-18};
  }
  function present(record){
    if(record.autoFit&&record.loaded)record.view=fittedPlanView(record);"""),
            ("    record.view=zoomPlanView(record.view,factor,anchor,area(),size(record));", "    record.autoFit=false;record.view=zoomPlanView(record.view,factor,anchor,area(),size(record));"),
            ("record.view={scale:1,x:0,y:0};present(record);return true;", "record.autoFit=true;record.view={scale:1,x:0,y:0};present(record);return true;"),
            ("const record={key,layer,image,view:{scale:1,x:0,y:0},loaded:false,", "const record={key,layer,image,view:{scale:1,x:0,y:0},autoFit:true,loaded:false,"),
            ("      record.view=constrainPlanView({scale,x:center.x", "      record.autoFit=false;record.view=constrainPlanView({scale,x:center.x"),
            ("else {const step=event.shiftKey?80:32;record.view.x", "else {record.autoFit=false;const step=event.shiftKey?80:32;record.view.x"),
        ]
        for antigo, novo in trocas:
            if texto.count(antigo) != 1:
                raise ValueError(f"A planta mudou; conferir enquadramento antes de publicar: {antigo[:80]}")
            texto = texto.replace(antigo, novo)
        gravar(caminho, texto.encode("utf-8"))


def recompilar_viewer():
    """Recompila as três entradas realmente usadas pelos documentos da apresentação."""
    # A publicação contém só os addons usados por seus bundles antigos.
    tres = RAIZ / "experimentos/liv-experimental-2026-10-14/node_modules/three"
    if json.loads((tres / "package.json").read_text(encoding="utf-8"))["version"] != "0.186.1":
        raise ValueError("A apresentação requer a mesma revisão 0.186.1 do runtime publicado")
    for nome in ("three.core.js", "three.webgpu.js", "three.tsl.js"):
        if (tres / "build" / nome).read_bytes() != (ORIGEM / "node_modules/three/build" / nome).read_bytes():
            raise ValueError("Conferir a versão preservada do Three antes de recompilar a apresentação")
    antes = {p.name: p.read_bytes() for p in DESTINO.glob("*.js")}
    (RAIZ / ".tmp").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="conecta-build-", dir=RAIZ / ".tmp") as temporario:
        meta = Path(temporario) / "meta.json"
        subprocess.run([
            "node", str(RAIZ / "node_modules/esbuild/bin/esbuild"),
            *[str(DESTINO / f"{nome}.js") for nome in ("viewer", "renderer", "interior-renderer")],
            "--bundle", "--splitting", "--format=esm", "--target=es2022", "--external:./estoque-runtime.js",
            f"--outdir={DESTINO}", "--entry-names=[name].bundle", "--chunk-names=apresentacao-[hash]",
            f"--alias:three/webgpu={tres / 'build/three.webgpu.js'}",
            f"--alias:three/tsl={tres / 'build/three.tsl.js'}",
            f"--alias:three={tres / 'build/three.webgpu.js'}",
            f"--alias:three/addons={tres / 'examples/jsm'}", f"--metafile={meta}",
            "--minify", "--charset=utf8", "--legal-comments=eof", "--log-level=warning",
        ], check=True, capture_output=True)
        saidas = json.loads(meta.read_text(encoding="utf-8"))["outputs"]
    for nome, antigo in antes.items():
        novo = (DESTINO / nome).read_bytes()
        if antigo != novo:
            trocados[sha(antigo)] = (sha(novo), len(novo))
    for pagina, entrada in (("index.html", "viewer"), ("maquete-vila-aurora.html", "viewer"),
                            ("prova-rgbm.html", "renderer"), ("interior.html", "interior-renderer")):
        info = next(v for v in saidas.values() if Path(v.get("entryPoint", "")).name == entrada + ".js")
        preloads = "".join(f'<link rel="modulepreload" href="{Path(i["path"]).name}">'
                           for i in info["imports"] if i["kind"] == "import-statement" and not i.get("external"))
        caminho = DESTINO / pagina
        html = re.sub(r'<link rel="modulepreload"[^>]*>', '', caminho.read_text(encoding="utf-8"))
        revisao = sha((DESTINO / f"{entrada}.bundle.js").read_bytes())[:12]
        html = re.sub(rf'<script type="module" src="{entrada}\.bundle\.js(?:\?[^"]*)?"></script>',
                      preloads + f'<script type="module" src="{entrada}.bundle.js?rev=apresentacao-{revisao}"></script>', html)
        gravar(caminho, html.encode("utf-8"))


def ajustar_cena_apresentacao():
    """Fundo e enquadramento da cópia, sem alterar iluminação nem arquivos de origem."""
    trocas_por_arquivo = {
        "horario-exterior.js": [
            ("scene.background=nightSky.clone().lerp(twilightSky,Math.sin(daylight*Math.PI)*.7).lerp(daySky,daylight*daylight);",
             "scene.background=null; // FUNDO-APRESENTACAO: o marfim vem do CSS; o sol mantém a iluminação."),
        ],
        "renderer.js": [
            ("camera.aspect=rect.width/rect.height;\n    const fitted=fitPreset();",
             "camera.aspect=rect.width/rect.height;\n    if(camera.userData.viewName==='perspectiva')camera.zoom=(camera.userData.projectionSource.zoom||1)*(camera.aspect>=2.1?1.1:1);\n    const fitted=fitPreset();"),
        ],
        "viewer.js": [
            ("function revealOnMobile(id){\n  if(!window.matchMedia?.('(max-width: 760px)').matches)return;",
             "function revealOnMobile(id){\n  if(document.documentElement.dataset.apresentacao==='viewer')return;\n  if(!window.matchMedia?.('(max-width: 760px)').matches)return;"),
        ],
        "interior-renderer.js": [
            ("canvas.focus();", "canvas.focus({preventScroll:true});"),
        ],
    }
    for nome, trocas in trocas_por_arquivo.items():
        caminho = DESTINO / nome
        texto = caminho.read_text(encoding="utf-8")
        if nome == "renderer.js":
            texto = texto.replace("camera.zoom=(spec.zoom||1)*(viewName==='perspectiva'?1.22:1);",
                                  "camera.zoom=spec.zoom||1;")
            texto = texto.replace("(camera.aspect>=2.1?1.22:1)", "(camera.aspect>=2.1?1.1:1)")
        for antigo, novo in trocas:
            if novo in texto:
                continue
            if antigo not in texto:
                raise ValueError(f"Conferir acabamento de {nome}: {antigo[:70]}")
            texto = texto.replace(antigo, novo)
        gravar(caminho, texto.encode("utf-8"))


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
    preservar_plantas_originais()
    sincronizar_luz_aprovada()
    ajustar_fechamento_portas()
    habilitar_preparo_completo()
    preparar_cenas_na_entrada()
    compartilhar_fila_dos_interiores()
    limpar_interface_apresentacao()
    internacionalizar_demo()
    internacionalizar_plantas()
    ligar_vagas_apresentacao()
    ajustar_cena_apresentacao()
    recompilar_viewer()
    recalcular_hashes()
    conferir()

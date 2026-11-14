"""Gera o IFC preliminar e a prancha de conferência das referências."""
import argparse
import base64
import html
import json
import math
from pathlib import Path
import uuid

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.validate
import numpy as np
from ifcopenshell.api import run


PASTA = Path(__file__).resolve().parent
DADOS = json.loads((PASTA / "plantas.json").read_text(encoding="utf-8"))
ESCALA = DADOS["escala_estimada_px_m"]
ALTURA = DADOS["pe_direito_estimado_m"]
REFERENCIAS_IMPLANTACAO = [
    ("6c9856b4-c876-4201-9182-e6747503954a", "Implantação e lazer"),
    ("c5be99a0-0539-47d0-8f42-2e3ab263fb1f", "Axonometria e recuos"),
    ("5e434431-57ed-46a6-9781-b9ce1039efee", "Foto da obra pelo lado externo"),
    ("7d1a70b6-7c94-4f52-b9b6-f1153d17cae8", "Foto da obra pelo lado do pátio"),
]


def retangulo(x1, y1, x2, y2):
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]


class Modelo:
    def __init__(self, chave, nome):
        self.chave = chave
        self.f = run("project.create_file", version="IFC4")
        self.projeto = self.entidade("IfcProject", nome)
        metro = run("unit.add_si_unit", self.f, unit_type="LENGTHUNIT")
        run("unit.assign_unit", self.f, units=[metro])
        contexto = run("context.add_context", self.f, context_type="Model")
        self.corpo = run("context.add_context", self.f, context_type="Model",
                         context_identifier="Body", target_view="MODEL_VIEW", parent=contexto)
        self.eixo = run("context.add_context", self.f, context_type="Model",
                        context_identifier="Axis", target_view="GRAPH_VIEW", parent=contexto)
        self.local = self.entidade("IfcSite", "Vistas da Quinze — referência preliminar")
        self.predio = self.entidade("IfcBuilding", nome)
        self.agregar(self.projeto, self.local)
        self.agregar(self.local, self.predio)

    def entidade(self, classe, nome):
        produto = run("root.create_entity", self.f, ifc_class=classe, name=nome)
        produto.GlobalId = ifcopenshell.guid.compress(uuid.uuid5(
            uuid.NAMESPACE_URL, f"vistas-da-quinze/{self.chave}/{classe}/{nome}").hex)
        return produto

    def agregar(self, pai, filho):
        run("aggregate.assign_object", self.f, products=[filho], relating_object=pai)

    def colocar(self, produto, origem, angulo=0):
        c, s = math.cos(angulo), math.sin(angulo)
        matriz = np.array([[c, -s, 0, origem[0]], [s, c, 0, origem[1]],
                           [0, 0, 1, origem[2]], [0, 0, 0, 1]])
        run("geometry.edit_object_placement", self.f, product=produto, matrix=matriz)

    def piso(self, nome, cota):
        produto = self.entidade("IfcBuildingStorey", nome)
        produto.Elevation = cota
        self.agregar(self.predio, produto)
        self.colocar(produto, (0, 0, cota))
        return produto

    def no_piso(self, produto, piso):
        run("spatial.assign_container", self.f, products=[produto], relating_structure=piso)

    def prisma(self, classe, nome, perfil, altura, origem=(0, 0, 0), angulo=0, piso=None):
        produto = self.entidade(classe, nome)
        pontos = [self.f.create_entity("IfcCartesianPoint", (float(x), float(y)))
                  for x, y in [*perfil, perfil[0]]]
        curva = self.f.create_entity("IfcPolyline", pontos)
        secao = self.f.create_entity("IfcArbitraryClosedProfileDef", "AREA", None, curva)
        direcao = self.f.create_entity("IfcDirection", (0., 0., 1.))
        solido = self.f.create_entity("IfcExtrudedAreaSolid", secao, None, direcao, altura)
        rep = self.f.create_entity("IfcShapeRepresentation", self.corpo, "Body", "SweptSolid", [solido])
        run("geometry.assign_representation", self.f, product=produto, representation=rep)
        if piso:
            if classe == "IfcSpace":
                self.agregar(piso, produto)
            else:
                self.no_piso(produto, piso)
        self.colocar(produto, origem, angulo)
        return produto

    def gravar(self, caminho):
        # IDs estáveis também nas relações do IFC para diffs e importações sucessivas.
        for produto in self.f.by_type("IfcRelationship"):
            produto.GlobalId = ifcopenshell.guid.compress(uuid.uuid5(
                uuid.NAMESPACE_URL, f"vistas-da-quinze/{self.chave}/rel/{produto.id()}").hex)
        self.f.header.file_name.name = caminho.name
        self.f.header.file_name.time_stamp = "2026-11-06T00:00:00"
        self.f.write(str(caminho))
        reaberto = ifcopenshell.open(str(caminho))
        logger = ifcopenshell.validate.json_logger()
        ifcopenshell.validate.validate(reaberto, logger)
        if logger.statements:
            raise ValueError(logger.statements[:4])
        guids = [ent.GlobalId for ent in reaberto.by_type("IfcRoot")]
        if len(set(guids)) != len(guids):
            raise ValueError(f"IDs duplicados em {caminho}")
        for produto in reaberto.by_type("IfcProduct"):
            if produto.Representation:
                shape = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), produto)
                if not shape.geometry.verts:
                    raise ValueError(f"Geometria vazia: {produto}")
        return reaberto


def desenhar_tipologia(modelo, planta, cota=0.):
    chave = planta["id"]
    piso = modelo.piso(f"{chave} — {planta['nome']}", cota)
    f = modelo.f

    def converter(perfil):
        return [(x / ESCALA, -y / ESCALA) for x, y in perfil]

    modelo.prisma("IfcSlab", "Laje interna", converter(planta["contorno"]), .18,
                  origem=(0, 0, cota-.18), piso=piso).PredefinedType = "FLOOR"
    if "terraco" in planta:
        x1, y1, x2, y2 = planta["terraco"]
        modelo.prisma("IfcSlab", "Laje do terraço", converter(retangulo(x1, y1, x2, y2)), .18,
                      origem=(0, 0, cota-.18), piso=piso).PredefinedType = "FLOOR"
        lados = [(x2-3, y1, x2, y2), (x1, y1, x2, y1+3), (x1, y2-3, x2, y2)]
        if y2 == min(y for _, y in planta["contorno"]):
            lados = [(x1, y1, x1+3, y2), (x2-3, y1, x2, y2), (x1, y1, x2, y1+3)]
        for i, lado in enumerate(lados, 1):
            modelo.prisma("IfcRailing", f"Guarda-corpo {i}", converter(retangulo(*lado)), 1.10,
                          origem=(0, 0, cota), piso=piso).PredefinedType = "GUARDRAIL"
        spa = (x1+8, y1+12, min(x1+104, x2-8), min(y1+108, y2-8))
        # A peça é apenas volumétrica. A classe sanitária passou pela conversão
        # MEP do Archicad, que criou a biblioteca mas não colocou o spa na planta.
        modelo.prisma("IfcBuildingElementProxy", f"Spa ilustrativo {chave}",
                      converter(retangulo(*spa)), .60, origem=(0, 0, cota), piso=piso)
    for i, (x1, y1, x2, y2, *vaos) in enumerate(planta["paredes"], 1):
        horizontal = y1 == y2
        inicio, fim = (x1, x2) if horizontal else (y1, y2)
        if not ((horizontal or x1 == x2) and fim > inicio):
            raise ValueError(f"{chave}: parede inválida {i}")
        espessura = .15 if i <= 4 else .12
        comprimento = (fim-inicio) / ESCALA
        angulo = 0 if horizontal else -math.pi/2
        deslocamento = (x1 / ESCALA, -y1 / ESCALA, cota)
        parede = modelo.prisma("IfcWall", f"Parede {i:02}", retangulo(0, -espessura/2,
                                comprimento, espessura/2), ALTURA, deslocamento, angulo, piso)
        eixo = run("geometry.add_axis_representation", f, context=modelo.eixo,
                   axis=((0., 0.), (comprimento, 0.)))
        run("geometry.assign_representation", f, product=parede, representation=eixo)
        for j, (tipo, a, b) in enumerate(vaos, 1):
            if not inicio <= a < b <= fim:
                raise ValueError(f"{chave}: vão fora da parede {i}")
            largura = (b-a) / ESCALA
            z, altura = (.9, 1.2) if tipo == "j" else (0., 2.10)
            x, y = (a, y1) if horizontal else (x1, a)
            origem = (x / ESCALA, -y / ESCALA, cota+z)
            nome = f"{i:02}.{j:02}"
            abertura = modelo.prisma("IfcOpeningElement", f"Vão {nome}",
                                      retangulo(0, -.14, largura, .14), altura, origem, angulo)
            run("feature.add_feature", f, feature=abertura, element=parede)
            classe = "IfcWindow" if tipo == "j" else "IfcDoor"
            rotulo = {"j": "Janela", "d": "Porta", "c": "Porta de correr"}[tipo]
            fechamento = modelo.prisma(classe, f"{rotulo} {nome}", retangulo(0, -.025, largura, .025),
                                        altura, origem, angulo, piso)
            fechamento.OverallWidth = largura
            fechamento.OverallHeight = altura
            run("feature.add_filling", f, opening=abertura, element=fechamento)
    for nome, *ret in planta["zonas"]:
        zona = modelo.prisma("IfcSpace", nome, converter(retangulo(*ret)), 1.,
                             origem=(0, 0, cota), piso=piso)
        zona.Description = "Zona aproximada de conferência, sem medição de área privativa."


def gerar_tipologia(planta, destino):
    chave = planta["id"]
    modelo = Modelo(chave, f"{chave} — {planta['nome']}")
    desenhar_tipologia(modelo, planta)
    resultado = modelo.gravar(destino / f"{chave}.ifc")
    assert len(resultado.by_type("IfcWall")) == len(planta["paredes"])
    assert len(resultado.by_type("IfcRelVoidsElement")) == sum(len(w)-4 for w in planta["paredes"])
    assert len(resultado.by_type("IfcRelVoidsElement")) == len(resultado.by_type("IfcRelFillsElement"))
    return {classe[3:]: len(resultado.by_type(classe)) for classe in
            ("IfcWall", "IfcSlab", "IfcDoor", "IfcWindow", "IfcSpace")}


def gerar_implantacao(destino):
    modelo = Modelo("implantacao", "Vistas da Quinze — estudo de implantação")
    base = modelo.piso("Base e lazer", 0.)
    # Origem no canto interno do L. Dimensões aproximadas por proporção da implantação.
    modelo.prisma("IfcSlab", "Embasamento", retangulo(-13, -35, 45, 13), 4.0,
                  origem=(0, 0, -4), piso=base)
    for nome, ret, altura, z in [
        ("Pátio de lazer", (0, -35, 45, 0), .24, -.24),
        ("Deck da piscina", (24, -33, 41, -14), .12, 0),
        ("Piscina — lâmina indicativa", (27, -29, 37, -20), .08, .12),
        ("Área infantil", (12, -31, 22, -17), .08, 0),
        ("Gourmet", (2, -32, 10, -20), 2.7, 0),
        ("Academia", (26, -14, 38, -6), 2.7, 0),
    ]:
        modelo.prisma("IfcBuildingElementProxy", nome, retangulo(*ret), altura,
                      origem=(0, 0, z), piso=base)
    for nivel in range(3, 21):
        z = (nivel-2) * 2.85
        piso = modelo.piso(f"Pavimento indicativo {nivel:02}", z)
        ala_a = 45 - max(0, nivel-9)*3.15
        ala_b = 35 - max(0, nivel-14)*3.80
        perfil = [(-13, -ala_b), (0, -ala_b), (0, 0), (ala_a, 0),
                  (ala_a, 13), (-13, 13)]
        modelo.prisma("IfcSlab", f"Laje de estudo {nivel:02}", perfil, .20,
                      origem=(0, 0, z-.20), piso=piso)
        modelo.prisma("IfcBuildingElementProxy", f"Volume em L {nivel:02}", perfil, 2.65,
                      origem=(0, 0, z), piso=piso)
    z = 19 * 2.85
    cobertura = modelo.piso("Coroamento indicativo", z)
    modelo.prisma("IfcBuildingElementProxy", "Volume técnico", retangulo(-11, -2, 7, 11), 3.8,
                  origem=(0, 0, z), piso=cobertura)
    modelo.gravar(destino / "Implantacao.ifc")


def imagem_embutida(pasta, codigo, legenda):
    caminho = pasta / f"codex-clipboard-{codigo}.png"
    if not caminho.is_file():
        return ""
    dados = base64.b64encode(caminho.read_bytes()).decode()
    return f'<img alt="{html.escape(legenda)}" src="data:image/png;base64,{dados}">'


def gerar_conferencia(destino, pasta_imagens, contagens):
    cartoes = []
    for planta in DADOS["plantas"]:
        chave = planta["id"]
        original = imagem_embutida(pasta_imagens, planta["imagem"], f"Referência {chave}")
        largura, altura = planta["quadro"]
        linhas = []
        for x1, y1, x2, y2, *vaos in planta["paredes"]:
            linhas.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#ffbd55"/>')
            for tipo, a, b in vaos:
                x, y, u, v = (a, y1, b, y1) if y1 == y2 else (x1, a, x1, b)
                cor = "#57e0ee" if tipo == "j" else "#8aff9d"
                linhas.append(f'<line x1="{x}" y1="{y}" x2="{u}" y2="{v}" stroke="{cor}"/>')
        contagem = contagens[chave]
        cartoes.append(f'<article><h2>{chave} · {html.escape(planta["nome"])}</h2>'
                       f'<div class="planta" style="aspect-ratio:{largura}/{altura}">{original}'
                       f'<svg viewBox="0 0 {largura} {altura}" fill="none" stroke-width="2.5">'
                       f'{"".join(linhas)}</svg></div>'
                       f'<p>{contagem["Wall"]} paredes · {contagem["Door"]} portas · '
                       f'{contagem["Window"]} janelas · <a href="{chave}.ifc">IFC {chave}</a></p></article>')
    referencias = []
    for codigo, legenda in REFERENCIAS_IMPLANTACAO:
        original = imagem_embutida(pasta_imagens, codigo, legenda)
        if original:
            referencias.append(f'<article><h2>{legenda}</h2>{original}</article>')
    documento = '''<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vistas da Quinze — conferência das plantas</title>
<style>
body{margin:24px auto;padding:0 16px;max-width:1160px;background:#151922;color:#edf0f5;font:16px system-ui}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:16px}
article{background:#202633;border:1px solid #3b4556;padding:14px;border-radius:8px}
h2{font-size:1.05rem}.planta{position:relative;background:#12151a}
.planta img,.planta svg{position:absolute;width:100%;height:100%;inset:0}
article>img{display:block;width:100%;height:auto} svg{filter:drop-shadow(0 0 1px #000)}
body:has(input:not(:checked)) svg{visibility:hidden} a{color:#9dd7ff}
</style>
<h1>Vistas da Quinze</h1>
<p>Seis plantas preliminares a partir das referências fornecidas. Escala e alturas estimadas.</p>
<p><label><input type="checkbox" checked> Mostrar traçado</label>
· Amarelo = parede · Verde = porta · Azul = janela · <a href="Tipologias.ifc">IFC das seis tipologias</a>
· <a href="Implantacao.ifc">IFC da implantação</a></p>
<main>''' + "".join(cartoes) + "</main>"
    if referencias:
        documento += "<h2>Referências da implantação</h2><main>" + "".join(referencias) + "</main>"
    documento += "</html>"
    (destino / "Conferencia.html").write_text(documento, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("saida", type=Path)
    parser.add_argument("--imagens", type=Path, required=True, help="Pasta dos anexos originais")
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    assert len(DADOS["plantas"]) == 6
    assert sum("terraco" in planta for planta in DADOS["plantas"]) == 4
    contagens = {planta["id"]: gerar_tipologia(planta, args.saida) for planta in DADOS["plantas"]}
    conjunto = Modelo("conjunto", "Vistas da Quinze — catálogo de tipologias")
    for indice, planta in enumerate(DADOS["plantas"]):
        conjunto.chave = f"conjunto/{planta['id']}"
        desenhar_tipologia(conjunto, planta, indice*3.2)
    conjunto.chave = "conjunto"
    resultado = conjunto.gravar(args.saida / "Tipologias.ifc")
    assert len(resultado.by_type("IfcBuildingStorey")) == len(DADOS["plantas"])
    assert len(resultado.by_type("IfcWall")) == sum(c["Wall"] for c in contagens.values())
    gerar_implantacao(args.saida)
    gerar_conferencia(args.saida, args.imagens, contagens)
    print(json.dumps(contagens, ensure_ascii=False))


if __name__ == "__main__":
    main()

"""Escreve os 5 interiores/<tipo>/planta.json (pixels das folhas do caderno). Depois rode construir.ts em cada um.
python -I experimentos/containers-mooca-2026-11-05/interiores/escrever_plantas.py experimentos/containers-mooca-2026-11-05/interiores
"""
import json, os, sys
os.chdir(sys.argv[1])
F = "../../../plantas_fornecidas/containers-mooca/fonte/"
SHA = {"ind": "873a21addabcd8c54a9b1ba9a4935b397425a761c4ce57403bf9509d84b6844c",
       "casal": "5ff30a5f04636a579e2e30a4307dde2726072d7b5e48e59dae1abd858d77098b",
       "q": "4674ddb731e7913f5bb36a7a8d67ee84ee8e7be16e6169a9a66ed7a95c454066",
       "comuns": "41ae76bf271d80c4f1aa6d9d062ed87d59a183ac0a24b13e27308a460cbc4231"}
IMG = {"ind": F+"dorm-individual-pne-e-individual.png", "casal": F+"dorm-casal.png", "q": F+"dorm-quadruplo-e-casal-bebe.png",
       "comuns": F+"areas-comuns-b.png"}
C6, C12 = 6.058*2.438, 12.192*2.438
cores = {"parede": "#E6E3DC", "piso_frio": "#C9C7C2", "piso_madeira": "#C9A57B", "teto": "#EFEDE8"}
LIM = ["Escala pela área externa do container (6 m: 6,058 x 2,438 m = 14,8 m², igual ao caderno; 12 m: 12,192 x 2,438 m = 29,7 m², igual ao caderno). A planta é 1:50, mas sem cotas.",
       "Pé-direito interno de 2,35 m: o corte dá 2,69 m de piso a piso (container de 2,59 m + laje).",
       "Portas e janelas lidas no desenho; a altura segue o padrão do LIV. A esquadria exata não está no caderno.",
       "O prédio declarado (45 x 40 m, 2 pavimentos) é a pegada do conjunto na planta 1:200; o container não é o prédio."]


# Tapete no espaço livre de cada quarto: o atlas de luz do LIV (auditar_cena.py) exige um tapete por planta.
TAPETE = {"individual": (1462, 1180, 800, 1400), "individual-pne": (660, 1000, 1000, 1200), "casal": (1770, 1400, 1200, 1000),
          "quadruplo": (1300, 450, 2000, 1000), "casal-bebe": (1060, 1540, 1400, 800),
          "refeitorio": (1056, 1462, 1600, 2000), "convivencia": (1990, 940, 1100, 1600)}


def W(nome, img, area, contorno, comodos, aberturas, moveis, titulo, ficha, lim):
    os.makedirs(nome, exist_ok=True)
    x, y, w, d = TAPETE[nome]
    moveis = moveis+[{"catalogo": "tapete-sala", "x": x, "y": y, "rot": 0, "w": w, "d": d, "cor": "#CFC6B8", "nome": "Tapete"}]
    spec = {"id": "containers-mooca-"+nome, "titulo": titulo, "imagem": "../"+IMG[img], "imagemSha256": SHA[img],
            "calibracao": {"areaM2": round(area, 2), "contornoFacesPx": [contorno], "conferencia": [LIM[0]]},
            "origemPx": contorno[:2], "gradeMm": 50, "peDireitoMm": 2350, "comodos": comodos, "aberturas": aberturas, "moveis": moveis,
            "ficha": {"titulo": titulo, "empreendimento": "Moradia estudantil em containers (Mooca)", **ficha,
                      "observacao": "Reconstrução ilustrativa a partir do TCC de Tamires Ruffino (Escola da Cidade, 2025). Medidas pela área do container."},
            "cores": cores, "lote": {"predio": {"largura_m": 45.0, "profundidade_m": 40.0, "pavimentos": 2}},
            "limites": LIM+lim}
    open(nome+"/planta.json", "w", encoding="utf8").write(json.dumps(spec, ensure_ascii=False, indent=2)+"\n")


def D(c, l, de, ate):
    return {"comodo": c, "lado": l, "de": de, "ate": ate, "tipo": "door", "alturaMm": 2100}


def J(c, l, de, ate, h=1200, p=1000):
    return {"comodo": c, "lado": l, "de": de, "ate": ate, "tipo": "window", "alturaMm": h, "peitorilMm": p}


def M(cat, x, y, rot, w, d, cor, nome):
    m = {"catalogo": cat, "x": x, "y": y, "rot": rot, "w": w, "d": d, "cor": cor, "nome": nome}
    if cat == "guardaroupa":
        m["h"] = 2300  # o padrão é o pé-direito (2,35 m) medido da laje: com o piso, furava o forro em 3 cm
    return m


MAD, BR, TEC, BOX, BANC = "#A57A52", "#F2F1EE", "#D9D4CC", "#DDE5E4", "#C9C3BA"
# Individual (6 m), em pé na imagem: x 1330..1634, y 802..1565
W("individual", "ind", C6, [1330, 802, 1634, 1565],
  [{"nome": "Banho", "partes": [[1330, 802, 1634, 1022]]}, {"nome": "Dormitório", "partes": [[1330, 1022, 1634, 1565]]}],
  [D("Banho", "north", 1505, 1610), D("Dormitório", "north", 1410, 1512), J("Dormitório", "east", 1260, 1420), J("Banho", "south", 1340, 1450, 500, 1600)],
  [M("box-chuveiro", 1395, 908, 90, 1600, 800, BOX, "Box"), M("vaso-sanitario", 1493, 852, 0, 400, 650, BR, "Vaso"),
   M("gabinete-banheiro", 1582, 845, 0, 650, 500, BR, "Lavatório"),
   M("fogao", 1372, 1167, 90, 560, 560, "#5D6367", "Cooktop"), M("pia-cozinha", 1372, 1290, 90, 1000, 560, BANC, "Copa com pia e frigobar"),
   M("escrivaninha", 1370, 1494, 90, 1000, 560, MAD, "Escrivaninha"), M("cama-solteiro", 1574, 1418, 180, 900, 1950, TEC, "Cama"),
   M("guardaroupa", 1600, 1214, 270, 1000, 520, MAD, "Armário")],
  "Containers da Mooca · dormitório individual · 14,8 m²",
  {"tipo": "individual", "area_publicada_m2": 14.8, "quartos": 1, "banheiros": 1, "aluguel_mensal": 500},
  ["A porta de entrada (parede curta, entre a escrivaninha e a cama) e a janela do dormitório são aproximadas: o caderno não marca a esquadria do individual. A entrada fica longe da porta do banho porque o interior do site só separa a folha de portas com ~1 m entre si."])
# PNE (6 m): x 451..757, y 795..1568
W("individual-pne", "ind", C6, [451, 795, 757, 1568],
  [{"nome": "Dormitório", "partes": [[451, 795, 757, 1222]]}, {"nome": "Banho acessível", "partes": [[451, 1222, 757, 1568]]}],
  [D("Dormitório", "east", 960, 1070), D("Dormitório", "north", 560, 660), J("Dormitório", "west", 900, 1080), J("Banho acessível", "west", 1380, 1480, 500, 1600)],
  [M("cama-solteiro", 520, 945, 0, 900, 1950, TEC, "Cama"), M("escrivaninha", 497, 1150, 90, 1000, 560, MAD, "Escrivaninha"),
   M("guardaroupa", 688, 838, 0, 1000, 520, MAD, "Armário"),
   M("box-chuveiro", 545, 1315, 0, 900, 900, BOX, "Área de banho"), M("vaso-sanitario", 515, 1500, 180, 400, 650, BR, "Vaso"),
   M("gabinete-banheiro", 700, 1520, 180, 650, 500, BR, "Lavatório")],
  "Containers da Mooca · dormitório individual PNE · 14,8 m²",
  {"tipo": "individual-pne", "area_publicada_m2": 14.8, "quartos": 1, "banheiros": 1, "aluguel_mensal": 500, "acessivel": True},
  ["Sem copa: a planta do PNE troca a copa pelo banheiro acessível.", "Entrada e porta do banho afastadas 1,4 m (o interior do site só separa a folha de portas com ~1 m entre si); no caderno a entrada fica junto da divisória."])
# Casal (6 m), deitado: x 1240..2302, y 1188..1618
W("casal", "casal", C6, [1240, 1188, 2302, 1618],
  [{"nome": "Banho", "partes": [[1240, 1188, 1532, 1618]]}, {"nome": "Dormitório", "partes": [[1532, 1188, 2302, 1618]]}],
  [D("Banho", "east", 1340, 1480), D("Dormitório", "north", 1755, 1880), J("Dormitório", "south", 1905, 2255, 1500, 600), J("Banho", "south", 1255, 1515, 500, 1600)],
  [M("box-chuveiro", 1385, 1262, 0, 1600, 750, BOX, "Banheira"), M("vaso-sanitario", 1310, 1398, 90, 400, 650, BR, "Vaso"),
   M("gabinete-banheiro", 1300, 1530, 90, 800, 500, BR, "Lavatório"),
   M("pia-cozinha", 1765, 1245, 0, 1200, 560, BANC, "Copa com pia e frigobar"), M("escrivaninha", 1648, 1565, 180, 1100, 560, MAD, "Escrivaninha"),
   M("cama-queen", 2050, 1372, 270, 1600, 2000, TEC, "Cama de casal"), M("criado", 2265, 1250, 270, 400, 350, MAD, "Criado 1"),
   M("criado", 2265, 1495, 270, 400, 350, MAD, "Criado 2")],
  "Containers da Mooca · dormitório casal · 14,8 m²",
  {"tipo": "casal", "area_publicada_m2": 14.8, "quartos": 1, "banheiros": 1, "aluguel_mensal": 800},
  ["A banheira do caderno virou o box do catálogo (o catálogo não tem banheira)."])
# Quádruplo (12 m): x 545..2281, y 277..608
W("quadruplo", "q", C12, [545, 277, 2281, 608],
  [{"nome": "Quarto e estudo", "partes": [[545, 277, 2030, 608]]}, {"nome": "Banho", "partes": [[2030, 277, 2281, 608]]}],
  [D("Quarto e estudo", "south", 1895, 2010), D("Banho", "west", 413, 519), J("Quarto e estudo", "south", 960, 1380, 1500, 600), J("Quarto e estudo", "south", 1440, 1880, 1500, 600)],
  [M("cama-solteiro", 985, 342, 270, 900, 1950, TEC, "Beliche 1"), M("cama-solteiro", 693, 540, 270, 900, 1950, TEC, "Beliche 2"),
   M("guardaroupa", 690, 316, 0, 1800, 520, MAD, "Armário 1"), M("guardaroupa", 968, 572, 180, 1800, 520, MAD, "Armário 2"),
   M("escrivaninha", 1405, 318, 0, 3800, 560, MAD, "Bancada de estudo para 4"),
   M("pia-cozinha", 1650, 568, 180, 1700, 560, BANC, "Copa com pia e cooktop"), M("geladeira", 1475, 568, 180, 600, 560, "#D6D9DA", "Geladeira"),
   M("box-chuveiro", 2150, 330, 0, 1500, 700, BOX, "Banheira"), M("vaso-sanitario", 2210, 446, 270, 400, 650, BR, "Vaso"),
   M("gabinete-banheiro", 2235, 550, 270, 650, 500, BR, "Lavatório")],
  "Containers da Mooca · dormitório quádruplo · 29,7 m²",
  {"tipo": "quadruplo", "area_publicada_m2": 29.7, "quartos": 1, "banheiros": 1, "aluguel_mensal": 1000, "moradores": 4},
  ["Os dois beliches viraram camas de solteiro (o catálogo não tem beliche); a ficha registra 4 moradores.",
   "Quarto e estudo são um cômodo só: a divisória do meio do container não chega à bancada de estudo."])
# Casal com bebê (12 m): x 620..2335, y 1355..1700
W("casal-bebe", "q", C12, [620, 1355, 2335, 1700],
  [{"nome": "Quarto", "partes": [[620, 1355, 1480, 1700]]}, {"nome": "Estudo e copa", "partes": [[1480, 1355, 2095, 1700]]},
   {"nome": "Banho", "partes": [[2095, 1355, 2335, 1700]]}],
  [D("Estudo e copa", "south", 1975, 2090), D("Quarto", "east", 1440, 1560), D("Banho", "west", 1465, 1580),
   J("Quarto", "south", 1020, 1460, 1500, 600), J("Estudo e copa", "south", 1500, 1960, 1500, 600)],
  [M("cama-queen", 842, 1530, 180, 1600, 2000, TEC, "Cama de casal"), M("cama-solteiro", 1167, 1420, 90, 650, 1250, TEC, "Berço"),
   M("guardaroupa", 1265, 1660, 180, 2700, 500, MAD, "Armário"), M("escrivaninha", 1790, 1405, 0, 2400, 560, MAD, "Bancada de estudo"),
   M("pia-cozinha", 1760, 1655, 180, 3200, 560, BANC, "Copa com pia e cooktop"), M("geladeira", 2045, 1655, 180, 550, 550, "#D6D9DA", "Geladeira"),
   M("box-chuveiro", 2215, 1645, 180, 1600, 700, BOX, "Banheira"), M("vaso-sanitario", 2285, 1530, 270, 400, 600, BR, "Vaso"),
   M("gabinete-banheiro", 2300, 1430, 270, 650, 500, BR, "Lavatório")],
  "Containers da Mooca · dormitório casal com bebê · 29,7 m²",
  {"tipo": "casal-bebe", "area_publicada_m2": 29.7, "quartos": 1, "banheiros": 1, "aluguel_mensal": 900},
  ["O berço é uma cama de solteiro pequena (o catálogo não tem berço)."])
# Áreas comuns (folha areas-comuns-b, 1:50): as duas das imagens de referência do caderno. Sem aluguel.
# Refeitório (6 m), em pé: x 915..1197, y 1102..1822. Abre a leste para o refeitório coberto (pergolado).
W("refeitorio", "comuns", C6, [915, 1102, 1197, 1822],
  [{"nome": "Refeitório", "partes": [[915, 1102, 1197, 1822]]}],
  [D("Refeitório", "east", 1540, 1640), J("Refeitório", "east", 1130, 1500, 1500, 600), J("Refeitório", "east", 1665, 1800, 1500, 600),
   J("Refeitório", "west", 1250, 1700)],
  [M("mesa-jantar-4", 1050, 1250, 90, 1200, 800, MAD, "Mesa 1"), M("mesa-jantar-4", 1050, 1462, 90, 1200, 800, MAD, "Mesa 2"),
   M("mesa-jantar-4", 1050, 1690, 90, 1200, 800, MAD, "Mesa 3")],
  "Containers da Mooca · refeitório · 14,8 m²",
  {"tipo": "refeitorio", "area_publicada_m2": 14.8, "quartos": 0, "banheiros": 0, "uso": "área comum"},
  ["As 3 mesas redondas de 6 lugares do caderno viraram mesas de 4 lugares do catálogo (não há mesa redonda)."])
# Convivência (6 m), em pé: x 1892..2165, y 425..1125. Abre a oeste para o refeitório coberto.
W("convivencia", "comuns", C6, [1892, 425, 2165, 1125],
  [{"nome": "Convivência", "partes": [[1892, 425, 2165, 1125]]}],
  [D("Convivência", "west", 760, 860), J("Convivência", "west", 450, 640, 1500, 600), J("Convivência", "west", 900, 1100, 1500, 600),
   J("Convivência", "south", 1930, 2125)],
  [M("sofa-3", 2096, 560, 270, 1960, 920, TEC, "Sofá"), M("poltrona", 2103, 840, 270, 800, 800, "#55595D", "Poltrona 1"),
   M("criado", 2120, 940, 270, 450, 400, MAD, "Mesinha"), M("poltrona", 2103, 1040, 270, 800, 800, "#55595D", "Poltrona 2"),
   M("poltrona", 1954, 700, 90, 800, 800, "#B9B2A8", "Pufe")],
  "Containers da Mooca · sala de convivência · 14,8 m²",
  {"tipo": "convivencia", "area_publicada_m2": 14.8, "quartos": 0, "banheiros": 0, "uso": "área comum"},
  ["Os pufes redondos do caderno viraram uma poltrona clara (o catálogo não tem pufe)."])
print("ok")

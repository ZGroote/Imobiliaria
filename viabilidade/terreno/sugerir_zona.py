"""Leitura conservadora do Anexo 02; método e limites em ZONA-AUTO.md."""
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tempfile
import warnings

import cache
import gerar_lotes as gl
from cache import sha
from PIL import Image, ImageFilter

AQUI = Path(__file__).resolve().parent
ZONAS = ["SC-Z1", "SC-Z2", "SC-Z3", "SC-Z4", "SC-Z5A", "SC-Z5B"]
DIVISA_M = 10.0
EIXO_M = 60.0
BUSCA_M = 250.0
TOLERANCIA_COR = 18
# Cor a menos de 3 unidades RGB de empatar entre duas da paleta não decide (AUDITORIA-6: Represa x Z3 a 9,1;
# Z5B x Parque a 22,2): vira 0, como traço, e só herda classe de vizinho a até 3 px.
MARGEM_COR = 3
# Vizinhos a até 3 pixels, do mais perto ao mais longe; no empate, menor coluna e depois menor linha,
# o mesmo desempate do scipy.ndimage.distance_transform_edt que esta busca substitui (sem scipy no CI).
VIZINHOS_3PX = sorted(((dy, dx) for dy in range(-3, 4) for dx in range(-3, 4) if 0 < dy*dy + dx*dx <= 9),
                      key=lambda o: (o[0]**2 + o[1]**2, o[1], o[0]))


def recuperar_tracos(classes):
    """Pixel sem cor da legenda (traço, texto) a até 3 px de um colorido herda a classe do mais próximo."""
    altura, largura = classes.shape
    leitura = classes.copy()
    pendente = classes == 0
    for dy, dx in VIZINHOS_3PX:
        if abs(dy) >= altura or abs(dx) >= largura:
            continue  # recorte menor que o deslocamento (e o fim negativo do slice daria a volta)
        # Vizinho de (y, x) é (y+dy, x+dx): recortes alinhados das duas grades.
        alvo = (slice(max(0, -dy), altura - max(0, dy)), slice(max(0, -dx), largura - max(0, dx)))
        fonte = (slice(max(0, dy), altura + min(0, dy)), slice(max(0, dx), largura + min(0, dx)))
        achou = pendente[alvo] & (classes[fonte] != 0)
        leitura[alvo][achou] = classes[fonte][achou]
        pendente[alvo] &= ~achou
    return (classes == 0) & ~pendente, leitura


def classificar(rgb, paleta):
    """Índice 1-based da cor da paleta; 0 se longe de todas ou ambígua entre as duas mais próximas."""
    dist = gl.np.linalg.norm(rgb[..., None, :].astype(float) - paleta, axis=-1)
    duas = gl.np.partition(dist, 1, axis=-1)
    classes = dist.argmin(axis=-1) + 1
    classes[(duas[..., 0] > TOLERANCIA_COR) | (duas[..., 1] - duas[..., 0] < MARGEM_COR)] = 0
    return classes


def mancha(mascara, lado):
    """Abertura morfológica: some linha/borda com menos de `lado` px de largura, fica o preenchimento."""
    m = Image.fromarray(mascara.astype(gl.np.uint8) * 255)
    return gl.np.asarray(m.filter(ImageFilter.MinFilter(lado)).filter(ImageFilter.MaxFilter(lado))) > 0


def erodir(mascara, lado):
    m = Image.fromarray(mascara.astype(gl.np.uint8) * 255)
    return gl.np.asarray(m.filter(ImageFilter.MinFilter(lado))) > 0


class ZonaIncerta(ValueError):
    def __init__(self, sugestao):
        self.sugestao = sugestao
        # T23: só a divisa em dúvida, com 2+ zonas da legenda a até 10 m, vira estudo por candidata (auto:SC-XX).
        sugestao.setdefault("so_divisa", False)
        sugestao.setdefault("candidatas", [])
        candidatas = (f" Ou escolha uma candidata na divisa: {', '.join('auto:' + z for z in sugestao['candidatas'])}."
                      if sugestao["so_divisa"] else "")
        super().__init__(f"Zona automática recusada: {sugestao['motivo_duvida']}. "
                         f"Alternativas: {', '.join(sugestao['alternativas']) or 'nenhuma identificada'}. "
                         "Confira o mapa e informe --zona SC-XX explicitamente." + candidatas)


def mapa_local(anexo="02"):
    manifesto = json.loads((AQUI / "dados/mapas-externos.json").read_text(encoding="utf-8"))
    item = next(a for a in manifesto["arquivos"] if a["asset"] == f"anexo{anexo}.jpg")
    destino = gl.ROOT / item["destino"]
    if not destino.exists():
        if anexo != "02":
            raise ValueError(f"Anexo {anexo} indisponível; veja viabilidade/baixar_mapas.py")
        with tempfile.TemporaryDirectory(prefix="zona-mapa-") as pasta:
            resultado = subprocess.run(["gh", "release", "download", manifesto["release"], "-R", manifesto["repo"],
                                        "-p", item["asset"], "-D", pasta], capture_output=True, text=True)
            baixado = Path(pasta) / item["asset"]
            if resultado.returncode or not baixado.is_file() or sha(baixado) != item["sha256"]:
                raise ValueError("Não foi possível baixar/verificar anexo02.jpg; veja viabilidade/baixar_mapas.py")
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(baixado.read_bytes())
    if sha(destino) != item["sha256"]:
        raise ValueError(f"Anexo {anexo} diferente do manifesto; conferir mapas-externos.json")
    return destino


class MapaGeorreferenciado:
    def __init__(self, anexo):
        self.arquivo = arquivo = mapa_local(anexo)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            self.imagem = Image.open(BytesIO(arquivo.read_bytes()))
            if self.imagem.size != (8858, 12746):
                raise ValueError(f"Dimensões do Anexo {anexo} incompatíveis com os controles")
            self.imagem = cache.Imagem(arquivo, self.imagem)  # decodifica uma vez; depois lê blocos de .cache/
        # Afim direta EPSG:31983 -> pixel por 21 cruzamentos de rua (tarefa 17). O ajuste antigo do mesmo arquivo
        # (5 vértices, SAD69 "ballpark") errava 40-100 m na cidade e fica só para reproduzir as anotações à mão.
        pos = json.loads((AQUI / "dados/zonas-posicionamento.json").read_text(encoding="utf-8"))[anexo]["afim_31983"]
        self.coef = gl.np.array(pos["afim_utm_menos_origem_para_pixel"])
        self.origem = gl.np.array(pos["origem_utm"])
        controles = json.loads((AQUI / "dados/zonas-controles.json").read_text(encoding="utf-8"))["cruzamentos"]["pontos"]
        matriz = gl.np.column_stack([[p["utm"] for p in controles] - self.origem, gl.np.ones(len(controles))])
        pixels = gl.np.array([p["pixel"][anexo] for p in controles])
        ajuste = gl.np.linalg.lstsq(matriz, pixels, rcond=None)[0]
        residuos = gl.np.linalg.norm(matriz @ ajuste - pixels, axis=1) / gl.np.sqrt(abs(gl.np.linalg.det(ajuste[:2])))
        if not (gl.np.allclose(ajuste, self.coef, rtol=0, atol=1e-8)
                and gl.np.allclose(residuos, pos["residuos_controles_m"], rtol=0, atol=1e-6)):
            raise ValueError(f"Posicionamento não corresponde aos controles do Anexo {anexo}")
        self.residuo_max = float(residuos.max())
        self.escala_min, self.escala_max = sorted(gl.np.linalg.svd(self.coef[:2], compute_uv=False))

    def pixel(self, coords):
        coords = gl.np.asarray(coords)[:, :2]
        return gl.np.column_stack([coords - self.origem, gl.np.ones(len(coords))]) @ self.coef

    def utm(self, coords):
        return (gl.np.asarray(coords) - self.coef[2]) @ gl.np.linalg.inv(self.coef[:2]) + self.origem


class MapaZonas(MapaGeorreferenciado):
    def __init__(self):
        super().__init__("02")
        # Seis zonas, campus e parque: amostras no miolo dos retângulos da legenda original; depois branco e
        # Represas (Hidrografia, a 9,1 da Z3): classes não zonais, que recusam em vez de virar Z3.
        legenda = [gl.np.median(gl.np.asarray(self.imagem.crop((4280, y-10, 4330, y+10))), axis=(0, 1))
                   for y in (10855, 10934, 11013, 11092, 11171, 11250, 11329, 11408)]
        represa = gl.np.median(gl.np.asarray(self.imagem.crop((3280, 10920, 3330, 10940))), axis=(0, 1))
        self.paleta = gl.np.array(legenda + [[255, 255, 255], represa])
        self.cor_eixo = gl.np.median(gl.np.asarray(self.imagem.crop((3265, 11165, 3345, 11170))), axis=(0, 1))

    def classificar(self, rgb):
        classes = classificar(rgb, self.paleta)
        # Pixel de Z3 com ruído de JPEG cai na Represa (a 9,1): água só conta em mancha de 5x5 px ou mais.
        represa = classes == len(self.paleta)
        classes[represa & ~mancha(represa, 5)] = 0
        return classes

    def sugerir(self, pol):
        if pol.geom_type != "Polygon" or pol.is_empty or not pol.is_valid or pol.interiors:
            raise ValueError("Sugestão exige polígono válido e não vazio")
        pixel_pol = gl.Polygon(self.pixel(pol.exterior.coords))
        margem = BUSCA_M * self.escala_max + 4
        x0, y0, x1, y1 = pixel_pol.bounds
        caixa = (int(gl.np.floor(x0-margem)), int(gl.np.floor(y0-margem)),
                 int(gl.np.ceil(x1+margem)), int(gl.np.ceil(y1+margem)))
        info = {"metodo": "Anexo 02 verificado por SHA256; afim direta EPSG:31983→pixel por 21 cruzamentos de rua; "
                "centros de todos os pixels interiores (~1,4 m), RGB da legenda (tolerância 18); "
                "cor ambígua (empate a menos de 3) não decide; traços recuperados até 3 pixels; divisa conservadora "
                ">=10 m; busca 250 m; Eixo (traço de 3x3 px ou mais) a <=60 m recusa. "
                "RMSE 2,9 m (máx. 6,2) nos cruzamentos não é acurácia cadastral.", "pontos": [], "proporcao_por_zona": {},
                "distancia_divisa_m": None, "alternativas": [], "motivo_duvida": None}
        # Fora do quadro principal há legendas e quadros sem o mesmo georreferenciamento.
        if pol.area > 1_000_000 or (caixa[2]-caixa[0]) * (caixa[3]-caixa[1]) > 2_000_000:
            info["motivo_duvida"] = (f"Lote grande demais para a leitura local do mapa ({pol.area:,.0f} m²; limite 1 km² "
                                     "e 2 milhões de pixels com a busca de 250 m): gleba/condomínio pode ter mais de uma zona")
            raise ZonaIncerta(info)
        if (x0 < 250 or y0 < 70 or x1 > 8770 or y1 > 10450
                or pixel_pol.intersects(gl.sh.box(250, 10150, 2500, 12746))):
            info["motivo_duvida"] = "Fora do quadro georreferenciado do Anexo 02 (borda, legenda ou encarte)"
            raise ZonaIncerta(info)
        rgb = gl.np.asarray(self.imagem.crop(caixa))
        classes = self.classificar(rgb)
        # shortcut: texto grosso e detalhes subpixel permanecem incertos; substituir quando houver vetor oficial.
        recuperadas, leitura = recuperar_tracos(classes)
        yy, xx = gl.np.indices(classes.shape)
        xy = gl.np.column_stack([xx.ravel() + caixa[0] + .5, yy.ravel() + caixa[1] + .5])
        interior = gl.sh.contains_xy(pixel_pol, xy[:, 0], xy[:, 1])
        amostras = leitura.ravel()[interior]
        mundo = self.utm(xy[interior])
        for coord, c, recuperada in zip(mundo, amostras, recuperadas.ravel()[interior]):
            info["pontos"].append({"utm": [round(float(v), 3) for v in coord],
                                   "zona_id": ZONAS[c-1] if 1 <= c <= 6 else None,
                                   "cor_recuperada": bool(recuperada)})
        for c in gl.np.unique(amostras):
            nome = ZONAS[c-1] if 1 <= c <= 6 else "nao_classificada"
            info["proporcao_por_zona"][nome] = info["proporcao_por_zona"].get(nome, 0) + float(gl.np.mean(amostras == c))
        zonas = [ZONAS[c-1] for c in gl.np.unique(amostras) if 1 <= c <= 6]
        info["alternativas"] = zonas.copy()
        motivos = []
        # O traço do art. 11 tem ~6 px; borda vermelha anti-aliased junto de texto preto também cai a <=35 da cor,
        # mas não enche um 3x3 (AUDITORIA-6, idx 100). A erosão come 1 px: desconta 2 px na distância.
        eixo = erodir(gl.np.linalg.norm(rgb.astype(float) - self.cor_eixo, axis=-1) <= 35, 3).ravel()
        if eixo.any():
            de = float(gl.sh.distance(pol, gl.sh.points(self.utm(xy[eixo]))).min())
            if de - 2/self.escala_min <= EIXO_M:
                info["alternativas"].append("SC-EIXO")
                motivos.append("Traço de Eixo a até 60 m: art. 11 vale para lote com testada na via; "
                               "conferir via, trecho e alinhamento cadastral (zona de fundo listada nas alternativas)")
        if len(amostras) < 3 or any(c < 1 or c > 6 for c in amostras):
            motivos.append("Cor sem correspondência segura com zona da legenda ou lote sem resolução suficiente")
        if len(zonas) > 1:
            motivos.append("Cores de mais de uma zona no polígono amostrado")
        if len(zonas) == 1:
            codigo = ZONAS.index(zonas[0]) + 1
            outros = (classes.ravel() != 0) & (classes.ravel() != codigo)
            if outros.any():
                d = gl.sh.distance(pol, gl.sh.points(self.utm(xy[outros])))
                # Desconta o preenchimento de traços e meia diagonal do pixel: limite inferior, não divisa legal.
                d = max(0.0, float(d.min()) - 4/self.escala_min)
                if d <= BUSCA_M:
                    info["distancia_divisa_m"] = round(float(d), 2)
                if d < DIVISA_M:
                    motivos.append("Divisa/cor não zonal a menos de 10 m (distância conservadora)")
                proximos = gl.sh.distance(pol, gl.sh.points(self.utm(xy))) <= DIVISA_M + 4/self.escala_min
                for c in gl.np.unique(classes.ravel()[proximos]):
                    if 1 <= c <= 6 and ZONAS[c-1] not in info["alternativas"]:
                        info["alternativas"].append(ZONAS[c-1])
                # T23: candidata só em mancha de 3x3 px ou mais. Borda anti-aliased de traço cinza sobre Z5A/Z2/Z4 cai na
                # cor do Z5B, e sombra de texto ou faixa laranja sobre Z2 cai no Z1 (sorteio 500: 33 de 38 eram assim).
                # 5x5 apagava o Z3 real do outro lado da rua (faixa estreita entre traço e texto: 90050, 85446).
                perto = proximos.reshape(classes.shape)
                candidatas = [z for z in info["alternativas"] if z == zonas[0] or
                              (z in ZONAS and (mancha(classes == ZONAS.index(z) + 1, 3) & perto).any())]
        if motivos:
            info["motivo_duvida"] = "; ".join(motivos)
            # Só a divisa: o polígono é de uma zona só, segura e sem Eixo. Candidatas = essa zona e as da legenda a até
            # 10 m (branco/campus/parque/represa não entram); com uma só não há o que comparar.
            if len(motivos) == 1 and motivos[0].startswith("Divisa/") and len(candidatas) > 1:
                info["so_divisa"], info["candidatas"] = True, candidatas
            raise ZonaIncerta(info)
        info["alternativas"].remove(zonas[0])
        return zonas[0], info

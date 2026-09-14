# -*- coding: utf-8 -*-
"""Renderiza UMA foto do interior no Unreal, no mesmo enquadramento do navegador.

Roda DENTRO do editor, pelo `+StartupScripts=` do `DefaultEngine.ini` (ver
`unreal/assar.py`, cabecalho: `-ExecCmds="py ..."` nao roda, e commandlet nao ilumina).

    UnrealEditor.exe <projeto AssarLuz> -unattended -nosplash

Entra `unreal/malhas/<id>.cena.obj` + `.cena.json` (de `pipeline/unreal_cena.py`).
Sai `unreal/capturas/<id>_ue.png`.

**Nao e o `assar.py`.** Aquele captura irradiancia com albedo branco, uma ortografica
por face, pra virar lightmap. Este captura UMA perspectiva com a cor do cadastro, pra
virar uma imagem que se compara com o print do three lado a lado. O objetivo e
responder uma pergunta so: com a MESMA geometria, a MESMA mobilia e as MESMAS cores,
quanto o renderizador sozinho muda o resultado.

**Lumen, nao path tracer.** A maquina tem uma GTX 1650 (Turing sem nucleo de RT): o
path tracer da UE depende de DXR por hardware e nela cai em emulacao. Lumen resolve
por SDF em software e e o que roda aqui -- e e ele que carrega a diferenca que
interessa: ricochetada colorida, ceu como fonte de area, reflexo do proprio comodo.

**Exposicao.** `SCS_FINAL_COLOR_LDR` passa pelo tonemapper, e aqui isso e o que se
quer -- o produto e uma IMAGEM, nao um mapa de luz (era o defeito do `assar.py`, ver
PIPELINE secao 24). `EXPOSICAO_BIAS` e o unico numero a calibrar: a comparacao so vale
se as duas imagens tiverem brilho medio parecido, senao "melhor" vira "mais claro".
"""
import json
import os
import unreal

AQUI = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ""
RAIZ = os.path.dirname(AQUI) if AQUI else r"C:\Users\respawn\Desktop\imobiliaria"
MALHAS = os.path.join(RAIZ, "unreal", "malhas")
SAIDA = os.path.join(RAIZ, "unreal", "capturas")

ID = os.environ.get("UNIDADE", "sanca-135-29")
LARG, ALT = 1216, 640          # aspecto 1,90 -- o mesmo que a sonda leu do navegador
EXPOSICAO_BIAS = float(os.environ.get("EXPO", "-0.6"))
LUMENS_TETO = float(os.environ.get("LUMENS", "1800"))   # luminaria de teto, a maior
CEU_INT = float(os.environ.get("CEU", "3.0"))
BERCO = 20                     # quadros antes de existir mundo
CONVERGE = 90                  # quadros com a cena parada pro Lumen assentar
MODO = os.environ.get("MODO", "lumen")   # "lumen" (SceneCapture) ou "pt" (viewport)
PT_QUADROS = int(os.environ.get("PTQ", "900"))   # quadros de acumulacao do path tracer

L = unreal.log_warning


def diga(m):
    L("BELEZA %s" % m)


def mundo():
    # None NAO serve: `export_render_target` sai em silencio sem escrever nada.
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()


def srgb_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def cor_linear(hexa):
    r = srgb_lin(((hexa >> 16) & 255) / 255.0)
    g = srgb_lin(((hexa >> 8) & 255) / 255.0)
    b = srgb_lin((hexa & 255) / 255.0)
    return unreal.LinearColor(r, g, b, 1.0)


# Rugosidade por material, copiada do `app.js` (secao dos materiais do interior) --
# a comparacao so isola o RENDERIZADOR se o resto for igual, e rugosidade e resto.
RUG = {"parede": 0.78, "teto": 0.78, "rodape": 0.78,
       "piso_frio": 0.20, "piso_madeira": 0.52, "vidro": 0.05}


def material(nome, hexa):
    caminho = "/Game/Beleza/M_%s" % nome
    m = unreal.EditorAssetLibrary.load_asset(caminho)
    if m:
        return m
    mf = unreal.MaterialFactoryNew()
    m = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "M_%s" % nome, "/Game/Beleza", unreal.Material, mf)
    cor = unreal.MaterialEditingLibrary.create_material_expression(
        m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    cor.set_editor_property("constant", cor_linear(hexa))
    unreal.MaterialEditingLibrary.connect_material_property(
        cor, "", unreal.MaterialProperty.MP_BASE_COLOR)
    rug = unreal.MaterialEditingLibrary.create_material_expression(
        m, unreal.MaterialExpressionConstant, -400, 200)
    rug.set_editor_property("r", RUG.get(nome, 0.65))
    unreal.MaterialEditingLibrary.connect_material_property(
        rug, "", unreal.MaterialProperty.MP_ROUGHNESS)
    # DUAS FACES em tudo. O OBJ sai sem `vn` (a normal vem do enrolamento) e a
    # conversao de referencial ainda passa pelo importador -- com face unica, errar o
    # sentido pinta a superficie de PRETO sem erro nenhum no log, que foi como o forro
    # saiu na primeira rodada. Duas faces custa nada aqui e tira a duvida do caminho.
    m.set_editor_property("two_sided", True)
    if nome == "vidro":
        # Vidro TRANSLUCIDO: sem ele o comodo recebe luz de ceu aberto e a comparacao
        # vira "com e sem janela". Opacidade baixa, que e o que o `matVidro` do three faz.
        m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        op = unreal.MaterialEditingLibrary.create_material_expression(
            m, unreal.MaterialExpressionConstant, -400, 400)
        op.set_editor_property("r", 0.18)
        unreal.MaterialEditingLibrary.connect_material_property(
            op, "", unreal.MaterialProperty.MP_OPACITY)
    unreal.MaterialEditingLibrary.recompile_material(m)
    return m


def limpa():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in eas.get_all_level_actors():
        try:
            eas.destroy_actor(a)
        except Exception:
            pass


def importa(ident):
    """OBJ -> UMA MALHA POR GRUPO. O Interchange nao junta: cada `g` do OBJ vira um
    StaticMesh proprio, com um `1` colado no nome quando ha colisao. Isso e melhor do
    que uma malha so -- casa material com malha pelo NOME, sem depender da ordem dos
    slots, que e o tipo de acoplamento que pinta a parede de cor de piso em silencio.
    A pasta e apagada antes: sem isso a segunda rodada vira `parede2` e por ai vai."""
    origem = os.path.join(MALHAS, "%s.cena.obj" % ident)
    if not os.path.exists(origem):
        raise RuntimeError("falta %s" % origem)
    try:
        unreal.EditorAssetLibrary.delete_directory("/Game/Beleza")
    except Exception as e:
        diga("nao apaguei /Game/Beleza: %s" % e)
    t = unreal.AssetImportTask()
    t.filename = origem
    t.destination_path = "/Game/Beleza"
    t.automated = True
    t.replace_existing = True
    t.save = False
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    malhas = []
    for caminho in unreal.EditorAssetLibrary.list_assets("/Game/Beleza", recursive=False):
        a = unreal.EditorAssetLibrary.load_asset(caminho)
        if isinstance(a, unreal.StaticMesh):
            malhas.append((a.get_name(), a))
    if not malhas:
        raise RuntimeError("importacao nao produziu malha: %s" % origem)
    return malhas


# Guardadas pra ESCADA DE LUZ: o `post_process_settings` do SceneCapture2D nao
# aplica (o get devolve COPIA da struct, e o set nao chega no render) -- medido:
# cinco capturas com bias de -1,0 a -3,0 sairam com o MESMO md5. Quem responde e
# `set_intensity`. Escalar TODAS as fontes pelo mesmo fator muda o nivel sem
# mexer na mistura sol/preenchimento, que e o que uma exposicao faria.
LUZES = []


def monta(d):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    malhas = importa(ID)
    nomes = sorted(d["materiais"].keys())
    orfas = []
    for nome_malha, malha in malhas:
        # prefixo mais LONGO: "piso_madeira1" casa com "piso_madeira", nao com "piso";
        # "movel_3A3E441" casa com "movel_3A3E44". Sem o "mais longo" isso erra.
        casa = [n for n in nomes if nome_malha.startswith(n)]
        if not casa:
            orfas.append(nome_malha)
            continue
        nome = max(casa, key=len)
        ator = eas.spawn_actor_from_class(unreal.StaticMeshActor,
                                          unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
        comp = ator.static_mesh_component
        comp.set_static_mesh(malha)
        mat = material(nome, d["materiais"][nome])
        for i in range(max(1, comp.get_num_materials())):
            comp.set_material(i, mat)
        comp.set_editor_property("cast_shadow", True)
    diga("malhas=%d materiais=%d orfas=%s" % (len(malhas), len(nomes), orfas or "nenhuma"))
    if orfas:
        raise RuntimeError("malha sem material: %s" % orfas)
    # SONDA DE REFERENCIAL. O OBJ e escrito em X=x, Y=z, Z=altura (conferido: X
    # -253..252, Y -300..301, Z 2..273). Se o importador aplicar a propria conversao
    # Y-cima -> Z-cima por cima da minha, a casa chega girada e a camera aponta pro
    # lado errado -- que e um defeito que so aparece como "enquadrou outra coisa",
    # nunca como erro. Imprimir a caixa de dentro da engine e o que decide isso.
    for nome_malha, malha in malhas:
        if nome_malha.startswith("parede"):
            b = malha.get_bounding_box()
            diga("caixa de '%s': min(%.0f,%.0f,%.0f) max(%.0f,%.0f,%.0f)"
                 % (nome_malha, b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z))

    # SOL: a direcao vem do `SOL_OFF` do app.js, ja girada pro referencial da planta.
    # Luz direcional na UE aponta pro proprio +X, entao basta girar o +X pra la.
    s = d["sol"]["dir"]
    dv = unreal.Vector(s[0], s[2], s[1])       # planta (x,y,z) -> UE (x,z,y)
    sol = eas.spawn_actor_from_class(unreal.DirectionalLight,
                                     unreal.Vector(0, 0, 800), unreal.Rotator(0, 0, 0))
    sol.set_actor_rotation(unreal.MathLibrary.make_rot_from_x(dv), False)
    sol.light_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    sol.light_component.set_intensity(7.0)
    LUZES.append((sol.light_component, 7.0, "fora"))
    sol.light_component.set_light_color(unreal.LinearColor(1.0, 0.957, 0.878, 1.0))

    ceu = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 400),
                                     unreal.Rotator(0, 0, 0))
    ceu.light_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    ceu.light_component.set_intensity(CEU_INT)
    LUZES.append((ceu.light_component, CEU_INT, "fora"))
    ceu.light_component.set_editor_property(
        "source_type", unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    ceu.light_component.set_editor_property("real_time_capture", True)
    try:
        eas.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0),
                                   unreal.Rotator(0, 0, 0))
    except Exception as e:
        diga("sem SkyAtmosphere: %s" % e)
    try:
        ceu.light_component.recapture_sky()
    except Exception as e:
        diga("recapture_sky: %s" % e)

    # LUMINARIA DE TETO: o navegador acende TRES pontuais, nos tres maiores comodos,
    # com a intensidade caindo 27,5% a cada uma (`acendeInterior` no app.js). Sem elas
    # aqui o UE ficaria so com sol e ceu -- e a janela desta unidade esta de costas pro
    # sol, entao a primeira rodada saiu azul e quase preta. Isso nao seria "o UE e pior";
    # seria eu comparando duas cenas com iluminacao diferente. Mesmas luzes, so muda
    # quem calcula a ricochetada: e essa a unica variavel que o teste quer isolar.
    try:
        pj = json.load(open(os.path.join(RAIZ, "unreal", "plantas", "%s.json" % ID),
                            encoding="utf-8"))
        # `plantaDaUnidade` ja devolve os comodos ORDENADOS por area decrescente, e o
        # `dump_planta` preserva a ordem -- os tres primeiros sao os mesmos tres.
        for i, c in enumerate(pj["comodos"][:3]):
            cx = sum(q[0] for q in c["poly"]) / len(c["poly"])
            cz = sum(q[1] for q in c["poly"]) / len(c["poly"])
            lz = (pj["pd"] - 0.18) * 100.0
            luz = eas.spawn_actor_from_class(
                unreal.PointLight, unreal.Vector(cx * 100.0, cz * 100.0, lz),
                unreal.Rotator(0, 0, 0))
            lc = luz.point_light_component
            lc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            lc.set_editor_property("intensity_units", unreal.LightUnits.LUMENS)
            lc.set_intensity(LUMENS_TETO * (1 - 0.275 * i))
            LUZES.append((lc, LUMENS_TETO * (1 - 0.275 * i), "luminaria"))
            lc.set_light_color(unreal.LinearColor(1.0, 0.937, 0.839, 1.0))  # 0xFFEFD6
            lc.set_attenuation_radius(850.0)                                 # 8,5 m
            # Opcional e uma a uma: `cast_shadow` NAO existe em PointLightComponent, e
            # com o try em volta do laco inteiro a primeira luz derrubou as tres --
            # o log dizia "sem luminaria" e a cena saia so com sol e ceu.
            for prop, val in (("source_radius", 8.0), ("cast_shadows", True)):
                try:
                    lc.set_editor_property(prop, val)
                except Exception as e2:
                    diga("  (sem %s: %s)" % (prop, e2))
            diga("  luminaria em %s (%.2f, %.2f) %.0f lm"
                 % (c["nome"], cx, cz, LUMENS_TETO * (1 - 0.275 * i)))
    except Exception as e:
        diga("sem luminaria: %s" % e)

    # CHAO LA EMBAIXO: a unidade esta no 6o andar e a janela olha pra cidade. Sem nada
    # ali a janela vira so ceu e some a luz que sobe do chao -- que e metade do que
    # entra por uma janela de verdade.
    try:
        plano = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
        if plano:
            ch = eas.spawn_actor_from_class(unreal.StaticMeshActor,
                                            unreal.Vector(0, 0, -1800),
                                            unreal.Rotator(0, 0, 0))
            ch.static_mesh_component.set_static_mesh(plano)
            ch.set_actor_scale3d(unreal.Vector(400, 400, 1))
            ch.static_mesh_component.set_material(0, material("chao_cidade", 0x8A8478))
    except Exception as e:
        diga("sem chao: %s" % e)


def liga_gi():
    w = mundo()
    for cmd in ("r.DynamicGlobalIlluminationMethod 1",     # Lumen
                "r.ReflectionMethod 1",
                "r.Lumen.ScreenProbeGather 1",
                "r.Lumen.TraceMeshSDFs 1",
                "r.Lumen.DiffuseIndirect.Allow 1",
                "r.Lumen.ScreenProbeGather.RadianceCache 1",
                "r.SkyLight.RealTimeReflectionCapture 1",
                "r.DefaultFeature.AutoExposure 0"):
        try:
            unreal.SystemLibrary.execute_console_command(w, cmd)
        except Exception as e:
            diga("cvar %s: %s" % (cmd, e))


def camera(d):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D,
                                     unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    c = cap.capture_component2d
    c.set_editor_property("projection_type", unreal.CameraProjectionMode.PERSPECTIVE)
    c.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
    c.set_editor_property("capture_every_frame", False)
    c.set_editor_property("capture_on_movement", False)
    # O `fov` do three e VERTICAL; o `fov_angle` da UE e HORIZONTAL. Converter pelo
    # aspecto e o que faz as duas fotos enquadrarem a mesma coisa -- sem isso a do UE
    # sai mais fechada e a comparacao mede lente, nao renderizador.
    import math
    fv = math.radians(d["cam"]["fov"])
    fh = 2.0 * math.atan(math.tan(fv / 2.0) * (float(LARG) / ALT))
    c.set_editor_property("fov_angle", math.degrees(fh))

    pp = c.get_editor_property("post_process_settings")
    pp.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    pp.set_editor_property("override_auto_exposure_method", True)
    pp.set_editor_property("auto_exposure_bias", EXPOSICAO_BIAS)
    pp.set_editor_property("override_auto_exposure_bias", True)
    pp.set_editor_property("motion_blur_amount", 0.0)
    pp.set_editor_property("override_motion_blur_amount", True)
    c.set_editor_property("post_process_settings", pp)

    p = d["cam"]["p"]
    v = d["cam"]["dir"]
    cap.set_actor_location_and_rotation(
        unreal.Vector(p[0] * 100.0, p[2] * 100.0, p[1] * 100.0),
        unreal.MathLibrary.make_rot_from_x(unreal.Vector(v[0], v[2], v[1])), False, False)
    diga("camera em %s olhando %s (frente do ator %s)"
         % (cap.get_actor_location(), unreal.Vector(v[0], v[2], v[1]),
            cap.get_actor_forward_vector()))
    return cap, c


# ---- modo PATH TRACER ---------------------------------------------------------
# O path tracer NAO funciona por `SceneCapture2D` -- so no viewport do editor e no
# Movie Render Queue. Entao aqui as duas fotos (Lumen e path tracer) saem pelo MESMO
# caminho, viewport + `HighResShot`: assim elas tem enquadramento identico e a
# diferenca medida e so o algoritmo de luz. O FOV do viewport nao e o da pagina, e
# nao precisa ser -- a pergunta deste teste e path tracer CONTRA Lumen, nao contra o
# navegador.
class TrabalhoPT(object):
    def __init__(self):
        d = dados_da_cena()
        limpa()
        monta(d)
        liga_gi()
        # A luminaria no mesmo fator que o Lumen ficou calibrado (`L008`), pra que a
        # unica coisa diferente entre as duas fotos seja o tracador.
        for comp, base, tipo in LUZES:
            comp.set_intensity(base * (0.08 if tipo == "luminaria" else 1.0))
        p = d["cam"]["p"]; v = d["cam"]["dir"]
        ue = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
        ue.set_level_viewport_camera_info(
            unreal.Vector(p[0] * 100.0, p[2] * 100.0, p[1] * 100.0),
            unreal.MathLibrary.make_rot_from_x(unreal.Vector(v[0], v[2], v[1])))
        self.fase = 0
        self.n = 0
        diga("PT: viewport posicionado, fase 0 (Lumen)")

    def cmd(self, c):
        unreal.SystemLibrary.execute_console_command(mundo(), c)

    def passo(self):
        self.n += 1
        # fase 0: Lumen assenta e tira a foto de controle
        if self.fase == 0:
            if self.n == 1:
                self.cmd("viewmode lit")
            if self.n < 90:
                return True
            self.cmd("HighResShot %dx%d" % (LARG, ALT))
            diga("PT: HighResShot do LUMEN pedido")
            self.fase = 1; self.n = 0
            return True
        # fase 1: liga o path tracer e deixa acumular
        if self.fase == 1:
            if self.n == 1:
                self.cmd("r.PathTracing 1")
                self.cmd("r.PathTracing.SamplesPerPixel 256")
                self.cmd("r.PathTracing.MaxBounces 8")
                self.cmd("viewmode pathtracing")
                diga("PT: path tracer ligado")
            if self.n % 120 == 0:
                diga("  PT acumulando %d quadros" % self.n)
            if self.n < PT_QUADROS:
                return True
            self.cmd("HighResShot %dx%d" % (LARG, ALT))
            diga("PT: HighResShot do PATH TRACER pedido")
            self.fase = 2; self.n = 0
            return True
        # fase 2: os HighResShot sao assincronos -- da uns quadros pra escrever
        if self.n < 60:
            return True
        diga("FIM modo pt")
        return False


def dados_da_cena():
    d = json.load(open(os.path.join(MALHAS, "%s.cena.json" % ID), encoding="utf-8"))
    cores = d["cores"]
    mats = {"parede": int(str(cores.get("parede", "#D9D4CB")).replace("#", ""), 16),
            "teto": int(str(cores.get("teto", "#E6E3DD")).replace("#", ""), 16),
            "rodape": int(str(cores.get("rodape", "#F4F2EE")).replace("#", ""), 16),
            "piso_frio": int(str(cores.get("piso_frio", "#BCB4A8")).replace("#", ""), 16),
            "piso_madeira": int(str(cores.get("piso_madeira", "#A07D52")).replace("#", ""), 16),
            "vidro": 0xC4D8E6}
    for m in d.get("moveis", []):
        mats["movel_%06X" % m["cor"]] = m["cor"]
    d["materiais"] = mats
    return d


class Trabalho(object):
    def __init__(self):
        d = dados_da_cena()
        self.d = d
        limpa()
        monta(d)
        liga_gi()
        self.cap, self.c = camera(d)
        self.rt = unreal.RenderingLibrary.create_render_target2d(
            mundo(), LARG, ALT, unreal.TextureRenderTargetFormat.RTF_RGBA8)
        self.c.set_editor_property("texture_target", self.rt)
        self.n = 0
        if not os.path.isdir(SAIDA):
            os.makedirs(SAIDA)
        diga("cena montada: camera %s fov_v %.1f, %d moveis"
             % (d["cam"]["p"], d["cam"]["fov"], len(d.get("moveis", []))))

    def passo(self):
        # O Lumen monta a indireta com HISTORICO entre quadros: uma captura so sai
        # sem ricochetada nenhuma. Capturar em todo quadro com a cena parada e o que
        # deixa a solucao assentar -- e nao ha camera se mexendo pra invalidar nada.
        self.c.capture_scene()
        self.n += 1
        if self.n % 30 == 0:
            diga("  convergindo %d/%d" % (self.n, CONVERGE))
        if self.n < CONVERGE:
            return True
        # ESCADA DE EXPOSICAO numa rodada so. Cada rodada do editor custa ~4,5 min e
        # o bias e a UNICA coisa que muda depois que o Lumen convergiu -- e so
        # pos-processo. Adivinhar o numero e refazer a rodada custaria 20 min pra
        # achar o que aqui sai de graca. A comparacao so vale no bias cuja media
        # bate com a do three (146): senao a foto mais clara ganha no olho sem ter
        # ganhado em nada.
        # Varre SO a luminaria; sol e ceu ficam parados. A escada anterior escalava
        # tudo junto e a janela FICOU PRETA -- o quadro ganhava faixa dinamica por
        # ter apagado a cidade la fora, nao por iluminacao melhor. Comparar faixa
        # assim seria comparar com o defeito que eu mesmo criei.
        for f in (0.30, 0.15, 0.08, 0.04, 0.02):
            for comp, base, tipo in LUZES:
                comp.set_intensity(base * (f if tipo == "luminaria" else 1.0))
            # O Lumen refaz a indireta com HISTORICO: trocar a intensidade e ler no
            # quadro seguinte devolve a luz ANTIGA. 25 quadros e o que faz assentar.
            for _ in range(25):
                self.c.capture_scene()
            nome = "%s_ue_L%03d.png" % (ID, int(round(f * 100)))
            unreal.RenderingLibrary.export_render_target(mundo(), self.rt, SAIDA, nome)
            diga("  escrito %s (luminaria x%.2f, sol e ceu fixos)" % (nome, f))
        diga("FIM escada de luminaria completa em %s" % SAIDA)
        return False


_t = None
_alca = None
_berco = BERCO
_ocupado = False


def tick(dt):
    # Guarda de reentrancia: importar malha e compilar material bombeiam o Slate, que
    # chama este mesmo callback por dentro (ver assar.py).
    global _ocupado
    if _ocupado:
        return
    _ocupado = True
    try:
        _tick(dt)
    finally:
        _ocupado = False


def _tick(dt):
    global _t, _berco, _alca
    if _t is None:
        if _berco > 0:
            _berco -= 1
            return
        try:
            _t = TrabalhoPT() if MODO == "pt" else Trabalho()
            return
        except Exception as e:
            diga("ERRO ao comecar: %s" % e)
            unreal.SystemLibrary.quit_editor()
            return
    try:
        if _t.passo():
            return
    except Exception as e:
        diga("ERRO no tick: %s" % e)
    try:
        unreal.unregister_slate_post_tick_callback(_alca)
    except Exception:
        pass
    unreal.SystemLibrary.quit_editor()


def run():
    global _alca
    diga("unidade %s, %dx%d, bias %.2f" % (ID, LARG, ALT, EXPOSICAO_BIAS))
    _alca = unreal.register_slate_post_tick_callback(tick)


run()

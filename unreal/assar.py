# -*- coding: utf-8 -*-
"""Etapa 2 do caminho Unreal: importa a casa, monta a cena e ASSA o atlas.

Roda DENTRO da engine, headless mas COM renderizacao:

    UnrealEditor-Cmd.exe <projeto> -run=pythonscript -script=assar.py
        -AllowCommandletRendering -unattended -nosplash

**NAO E COMMANDLET.** Foi a primeira tentativa, com `-AllowCommandletRendering`, e ela
CAPTURA (as imagens saem) mas so com LUZ DIRETA: 90% das pecas pretas, media global
33/255, e o que estava claro era o retangulo de sol entrando pela janela. Nem
`recapture_sky()` na mao nem os cvars de Lumen mudaram um pixel. O motivo e estrutural:
commandlet nao tem laco de quadro, e tanto a captura do SkyLight quanto o Lumen
dependem de quadros passando -- o Lumen monta a indireta com HISTORICO entre quadros,
e uma chamada isolada de `capture_scene()` nao tem historico nenhum.

Entao isto roda num EDITOR DE VERDADE, com janela e laco de render:

    UnrealEditor.exe <projeto> -ExecCmds="py <este arquivo>" -unattended -nosplash

e o trabalho e feito NO TICK, uma peca por vez, com quadros de folga entre mover a
camera e ler o resultado. E o que da ao Lumen o tempo que ele precisa.

O que se assa aqui e IRRADIANCIA, nao aparencia: a casa entra com material BRANCO
PURO (albedo 1,0), entao o que a captura mostra e exatamente quanta luz chega em cada
ponto. O Three multiplica isso pela cor que ele ja tem. Assar a cor junto congelaria
a paleta do cadastro dentro de uma imagem -- e a paleta vem do anuncio, muda por
unidade e e justamente o que o cadastro existe pra guardar.

**Uma captura ORTOGRAFICA por face, nao um lightmap da engine.** O caminho classico
seria `build_light_maps()` e ler a textura assada. Nao serve: o lightmap da UE mora
num `ULightMapTexture2D` dentro do MapBuildData, em formato empacotado (HQ/LQ, com
coeficientes direcionais), e nao ha como extrair isso pelo Python da engine sem
reimplementar o decodificador. A captura ortografica alinhada a face devolve
exatamente o retangulo que o atlas espera, em pixel de imagem comum, e ainda usa
Lumen -- que e a iluminacao boa, nao o Lightmass velho.

**Exposicao TRAVADA.** `AEM_MANUAL` com bias fixo. Sem isso cada peca recebe a propria
adaptacao automatica: a parede do banheiro sairia tao clara quanto a da sacada, e o
atlas viraria uma colcha de retalhos com degrau em toda emenda.
"""
import json
import os
import unreal

AQUI = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ""
RAIZ = os.path.dirname(AQUI) if AQUI else r"C:\Users\respawn\Desktop\imobiliaria"
MALHAS = os.path.join(RAIZ, "unreal", "malhas")
SAIDA = os.path.join(RAIZ, "unreal", "capturas")

RES = 256           # lado do alvo de render, em pixels
RECUO_CM = 25.0     # quanto a camera fica na frente da face
MARGEM = 1.06       # folga na largura ortografica (a peca fica centrada com borda)

L = unreal.log_warning


def diga(msg):
    L("ASSAR %s" % msg)


# ---- conversao de referencial ------------------------------------------
# a planta e Y-para-cima (como o three); a UE e Z-para-cima. O OBJ ja saiu
# convertido; aqui e o mesmo giro, pros vetores da camera.
def ue_p(p):
    return unreal.Vector(p[0]*100.0, p[2]*100.0, p[1]*100.0)


def ue_v(v):
    return unreal.Vector(v[0], v[2], v[1])


def normaliza(v):
    n = (v.x*v.x + v.y*v.y + v.z*v.z) ** 0.5 or 1.0
    return unreal.Vector(v.x/n, v.y/n, v.z/n)


# ---- cena ---------------------------------------------------------------
def limpa_nivel():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in eas.get_all_level_actors():
        try:
            eas.destroy_actor(a)
        except Exception:
            pass


def importa(ident):
    """OBJ -> StaticMesh. Sem material e sem textura: o material e branco e vem daqui."""
    origem = os.path.join(MALHAS, "%s.obj" % ident)
    if not os.path.exists(origem):
        raise RuntimeError("falta %s" % origem)
    destino = "/Game/Assado/%s" % ident
    t = unreal.AssetImportTask()
    t.filename = origem
    t.destination_path = "/Game/Assado"
    t.destination_name = ident
    t.automated = True
    t.replace_existing = True
    t.save = False
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    m = unreal.EditorAssetLibrary.load_asset(destino)
    if m is None:
        raise RuntimeError("importacao falhou: %s" % destino)
    return m


def material_branco():
    """Albedo 1,0, sem especular. Se ja existir um, reaproveita."""
    caminho = "/Game/Assado/M_Branco"
    m = unreal.EditorAssetLibrary.load_asset(caminho)
    if m:
        return m
    mf = unreal.MaterialFactoryNew()
    m = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "M_Branco", "/Game/Assado", unreal.Material, mf)
    cor = unreal.MaterialEditingLibrary.create_material_expression(
        m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    cor.set_editor_property("constant", unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
    unreal.MaterialEditingLibrary.connect_material_property(
        cor, "", unreal.MaterialProperty.MP_BASE_COLOR)
    zero = unreal.MaterialEditingLibrary.create_material_expression(
        m, unreal.MaterialExpressionConstant, -400, 200)
    zero.set_editor_property("r", 0.0)
    unreal.MaterialEditingLibrary.connect_material_property(
        zero, "", unreal.MaterialProperty.MP_SPECULAR)
    um = unreal.MaterialEditingLibrary.create_material_expression(
        m, unreal.MaterialExpressionConstant, -400, 320)
    um.set_editor_property("r", 1.0)
    unreal.MaterialEditingLibrary.connect_material_property(
        um, "", unreal.MaterialProperty.MP_ROUGHNESS)
    unreal.MaterialEditingLibrary.recompile_material(m)
    return m


def monta_cena(malha, rumo_graus, pd):
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    ator = eas.spawn_actor_from_class(unreal.StaticMeshActor,
                                      unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    comp = ator.static_mesh_component
    comp.set_static_mesh(malha)
    branco = material_branco()
    for i in range(max(1, comp.get_num_materials())):
        comp.set_material(i, branco)
    # a casa tem que ver a luz dos dois lados: as faces sao planas e de face unica,
    # e a captura olha pra face de dentro.
    comp.set_editor_property("cast_shadow", True)

    # SOL: a inclinacao vem do rumo do predio, que e o unico dado de orientacao que o
    # cadastro tem. 45 graus de altura -- sol de meio da manha, que e a hora em que
    # anuncio de imovel e fotografado.
    sol = eas.spawn_actor_from_class(unreal.DirectionalLight,
                                     unreal.Vector(0, 0, 600),
                                     unreal.Rotator(0, -45, rumo_graus))
    sol.light_component.set_intensity(6.0)
    sol.light_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    sol.light_component.set_light_color(unreal.LinearColor(1.0, 0.96, 0.88, 1.0))

    # CEU: a maior parte da luz de um apartamento e ceu difuso, nao sol direto.
    ceu = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300),
                                     unreal.Rotator(0, 0, 0))
    ceu.light_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    ceu.light_component.set_intensity(3.0)
    ceu.light_component.set_editor_property("source_type",
                                            unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    ceu.light_component.set_editor_property("real_time_capture", False)
    # RECAPTURA EXPLICITA. `real_time_capture` depende do laco de jogo, e commandlet
    # nao tem laco: a primeira rodada saiu com 90% das pecas PRETAS porque o SkyLight
    # nunca capturou nada e so a luz direta do sol existia. Mandar recapturar na mao
    # e o que faz o ceu virar luz aqui dentro.
    try:
        ceu.light_component.recapture_sky()
    except Exception as e:
        diga("recapture_sky falhou: %s" % e)

    # atmosfera: e o que da COR ao ceu. Sem ela o SkyLight captura preto e o interior
    # sai iluminado so pelo sol -- que e exatamente o defeito que o bake vem tirar.
    try:
        eas.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0),
                                   unreal.Rotator(0, 0, 0))
    except Exception as e:
        diga("sem SkyAtmosphere: %s" % e)
    return ator


def liga_gi():
    """Lumen ligado na marra, e a nevoa/atmosfera resolvidas antes de assar."""
    w = mundo()
    for cmd in ("r.DynamicGlobalIlluminationMethod 1",      # 1 = Lumen
                "r.ReflectionMethod 1",
                "r.Lumen.ScreenProbeGather 1",
                "r.Lumen.TraceMeshSDFs 1",
                "r.Lumen.DiffuseIndirect.Allow 1",
                "r.SkyLight.RealTimeReflectionCapture 1",
                "r.DefaultFeature.AutoExposure 0"):
        try:
            unreal.SystemLibrary.execute_console_command(w, cmd)
        except Exception as e:
            diga("cvar %s: %s" % (cmd, e))


def mundo():
    """O contexto de mundo do editor. `None` NAO serve: `create_render_target2d` ate
    devolve um objeto, mas `export_render_target` sai em silencio sem escrever byte
    nenhum -- foi assim que a primeira rodada terminou com 162 capturas e uma pasta
    vazia."""
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()


def faz_alvo():
    rt = unreal.RenderingLibrary.create_render_target2d(
        mundo(), RES, RES, unreal.TextureRenderTargetFormat.RTF_RGBA8)
    return rt


def faz_camera():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D,
                                     unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    c = cap.capture_component2d
    c.set_editor_property("projection_type", unreal.CameraProjectionMode.ORTHOGRAPHIC)
    c.set_editor_property("capture_source",
                          unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
    c.set_editor_property("capture_every_frame", False)
    c.set_editor_property("capture_on_movement", False)
    # EXPOSICAO TRAVADA -- ver o cabecalho.
    pp = c.get_editor_property("post_process_settings")
    pp.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    pp.set_editor_property("override_auto_exposure_method", True)
    # BIAS NEGATIVO de proposito. `SCS_FINAL_COLOR_LDR` ja passou pelo tonemapper
    # (ACES), que existe pra COMPRIMIR faixa dinamica -- e faixa dinamica e
    # exatamente o que um mapa de luz precisa carregar. Com bias 0 o meio-tom cai no
    # ombro da curva e o atlas saia chapado: medido, faixa 51 na cena contra 90 do
    # bake em JS. Expondo 1,5 stop abaixo, a parede fica no trecho reto do ACES, e o
    # ganho perdido volta na normalizacao do `unreal_atlas.py`, que e linear.
    pp.set_editor_property("auto_exposure_bias", -1.5)
    pp.set_editor_property("override_auto_exposure_bias", True)
    pp.set_editor_property("motion_blur_amount", 0.0)
    pp.set_editor_property("override_motion_blur_amount", True)
    c.set_editor_property("post_process_settings", pp)
    return cap, c


def assa(ident):
    dados = json.load(open(os.path.join(MALHAS, "%s.tiles.json" % ident), encoding="utf-8"))
    pecas = dados["pecas"]
    diga("unidade %s: %d pecas" % (ident, len(pecas)))

    limpa_nivel()
    malha = importa(ident)
    monta_cena(malha, dados.get("rumo", 0.0), dados["pd"])
    liga_gi()
    cap, c = faz_camera()
    rt = faz_alvo()
    c.set_editor_property("texture_target", rt)

    pasta = os.path.join(SAIDA, ident)
    if not os.path.isdir(pasta):
        os.makedirs(pasta)

    feito = 0
    for i, p in enumerate(pecas):
        p0 = p["p0"]; du = p["du"]; dv = p["dv"]; n = p["n"]
        cw, ch = p["m"]
        centro = [p0[k] + du[k]*0.5 + dv[k]*0.5 for k in range(3)]
        pos = ue_p([centro[k] + n[k]*(RECUO_CM/100.0) for k in range(3)])
        frente = normaliza(ue_v([-n[0], -n[1], -n[2]]))
        cima = normaliza(ue_v(dv))
        rot = unreal.MathLibrary.make_rot_from_xz(frente, cima)
        cap.set_actor_location_and_rotation(pos, rot, False, False)
        c.set_editor_property("ortho_width", max(cw, ch) * 100.0 * MARGEM)
        # DUAS capturas: o Lumen monta a iluminacao indireta com historico entre
        # quadros, e a primeira captura de uma posicao nova sai sem esse historico.
        # A segunda le a cena ja resolvida. Custa o dobro de nada -- o gargalo destas
        # rodadas e compilacao de shader, nao render.
        c.capture_scene()
        c.capture_scene()
        unreal.RenderingLibrary.export_render_target(mundo(), rt, pasta, "%04d.png" % i)
        feito += 1
        if feito == 1:
            try:
                c0 = unreal.RenderingLibrary.read_render_target_pixel(mundo(), rt,
                                                                     RES//2, RES//2)
                diga("  primeira peca, pixel do meio: %s" % c0)
            except Exception as e:
                diga("  nao consegui ler pixel: %s" % e)
        if feito % 50 == 0:
            diga("  %s %d/%d" % (ident, feito, len(pecas)))
    diga("unidade %s pronta: %d capturas em %s" % (ident, feito, pasta))
    return feito


# ---- o laco -------------------------------------------------------------
# Uma peca por vez, com ESPERA entre posicionar e ler. `ESPERA` e em quadros: o
# Lumen precisa de alguns pra indireta assentar depois que a camera anda. Com 0 a
# peca sai com a iluminacao da peca ANTERIOR -- que e pior que sair preta, porque
# parece certa.
ESPERA = 3


class Trabalho(object):
    def __init__(self, idents):
        self.idents = idents
        self.i = -1
        self.pecas = []
        self.k = 0
        self.espera = 0
        self.total = 0
        self.cap = None
        self.rt = None
        self.pasta = None
        self.proxima_unidade()

    def proxima_unidade(self):
        self.i += 1
        if self.i >= len(self.idents):
            self.pecas = []
            return False
        ident = self.idents[self.i]
        dados = json.load(open(os.path.join(MALHAS, "%s.tiles.json" % ident),
                               encoding="utf-8"))
        self.ident = ident
        self.pecas = dados["pecas"]
        self.k = 0
        self.espera = 0
        diga("unidade %s: %d pecas" % (ident, len(self.pecas)))
        limpa_nivel()
        malha = importa(ident)
        monta_cena(malha, dados.get("rumo", 0.0), dados["pd"])
        liga_gi()
        self.cap, self.c = faz_camera()
        self.rt = faz_alvo()
        self.c.set_editor_property("texture_target", self.rt)
        self.pasta = os.path.join(SAIDA, ident)
        if not os.path.isdir(self.pasta):
            os.makedirs(self.pasta)
        self.posiciona()
        return True

    def posiciona(self):
        p = self.pecas[self.k]
        p0, du, dv, n = p["p0"], p["du"], p["dv"], p["n"]
        cw, ch = p["m"]
        centro = [p0[j] + du[j]*0.5 + dv[j]*0.5 for j in range(3)]
        pos = ue_p([centro[j] + n[j]*(RECUO_CM/100.0) for j in range(3)])
        frente = normaliza(ue_v([-n[0], -n[1], -n[2]]))
        cima = normaliza(ue_v(dv))
        rot = unreal.MathLibrary.make_rot_from_xz(frente, cima)
        self.cap.set_actor_location_and_rotation(pos, rot, False, False)
        self.c.set_editor_property("ortho_width", max(cw, ch) * 100.0 * MARGEM)
        self.espera = ESPERA

    def passo(self):
        """Um quadro. Devolve False quando acabou tudo."""
        if not self.pecas:
            return False
        if self.espera > 0:
            self.espera -= 1
            self.c.capture_scene()      # aquece: da quadro pro Lumen assentar
            return True
        self.c.capture_scene()
        unreal.RenderingLibrary.export_render_target(mundo(), self.rt, self.pasta,
                                                    "%04d.png" % self.k)
        self.total += 1
        self.k += 1
        if self.total % 50 == 0:
            diga("  %s %d/%d" % (self.ident, self.k, len(self.pecas)))
        if self.k >= len(self.pecas):
            diga("unidade %s pronta: %d capturas" % (self.ident, self.k))
            return self.proxima_unidade()
        self.posiciona()
        return True


_trabalho = None
_alca = None
_idents = []
_berco = 20      # quadros de espera antes de comecar
_ocupado = False


def tick(dt):
    global _trabalho, _alca, _berco, _ocupado
    # GUARDA DE REENTRANCIA. Montar a cena (importar malha, criar ator, compilar
    # material) BOMBEIA O SLATE por dentro, e o slate chama este mesmo callback de
    # novo. Sem a guarda, cinco `Trabalho` nasciam ao mesmo tempo e brigavam pelo
    # mesmo ator -- o sintoma foi "StaticMeshComponent: ObjectInstance is null",
    # que nao diz nada sobre reentrancia.
    if _ocupado:
        return
    _ocupado = True
    try:
        _tick(dt)
    finally:
        _ocupado = False


def _tick(dt):
    global _trabalho, _alca, _berco
    # O script de inicializacao do plugin roda ANTES de haver mundo: montar a cena
    # ali dava "no world context". Entao os primeiros quadros so passam.
    if _trabalho is None:
        if _berco > 0:
            _berco -= 1
            return
        try:
            _trabalho = Trabalho(_idents)
            return
        except Exception as e:
            diga("ERRO ao comecar: %s" % e)
            unreal.SystemLibrary.quit_editor()
            return
    try:
        if _trabalho.passo():
            return
    except Exception as e:
        diga("ERRO no tick: %s" % e)
    diga("FIM total=%d" % (_trabalho.total if _trabalho else 0))
    try:
        unreal.unregister_slate_post_tick_callback(_alca)
    except Exception:
        pass
    unreal.SystemLibrary.quit_editor()


def run():
    global _alca
    alvo = os.environ.get("UNIDADE", "").strip()
    idents = []
    for nome in sorted(os.listdir(MALHAS)):
        if nome.endswith(".tiles.json"):
            i = nome[:-len(".tiles.json")]
            if not alvo or i == alvo:
                idents.append(i)
    diga("unidades: %s" % ", ".join(idents))
    globals()["_idents"] = idents
    _alca = unreal.register_slate_post_tick_callback(tick)


run()

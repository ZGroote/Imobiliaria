# -*- coding: utf-8 -*-
"""Renderiza a MAQUETE de um prédio (GLB do Blender) no Unreal, no mesmo enquadramento
ortográfico do `blender_maquete_base.renderizar()`. Substituto medido do Twinmotion, que é
o mesmo motor (Lumen); o path tracer fica de fora porque a GTX 1650 não tem RT.

    python pipeline/unreal_roda.py unreal/render_maquete.py --marca MAQUETE --limite 1500

Variáveis de ambiente: GLB (caminho), SAIDA (pasta), ELEV (graus do sol; vazio = o da KEY).
Mede e registra por fase: importar, montar, convergir o Lumen, exportar.

Referencial: Blender (x, y, z) em metros, Z pra cima, destro -> UE (x, -y, z) em cm.
O Interchange nega o Y (ver memória unreal-teste-controlado); a caixa do prédio é impressa
de dentro da engine pra conferir, porque o erro aparece como "enquadrou outra coisa".
"""
import json
import math
import os
import time
import unreal

GLB = os.environ.get("GLB", r"C:\Users\respawn\Desktop\imobiliaria\v1.5\miniaturas\monte-dos-cedros_blender\monte-dos-cedros.glb")
SAIDA = os.environ.get("SAIDA", r"C:\Users\respawn\Desktop\imobiliaria\v1.5\miniaturas\estudo-render\cedros")
ELEV = os.environ.get("ELEV", "")
LARG, ALT = 1200, 950
ALVO = (22.0, -1.0, 22.0)            # o mesmo target do modelar_montes.py (Cedros)
DIST = (-95.0, -100.0, 70.0)         # o mesmo `distance`
ORTHO_M = 137.5                      # 110 do Blender x 1,25: medido pela caixa do prédio nas duas imagens
KEY_LOC = (-60.0, -90.0, 115.0)      # a KEY do renderizar(), pra copiar a direção do sol
BERCO, CONVERGE = 20, 120
PASTA = "/Game/Maquete"

diga = lambda m: unreal.log_warning("MAQUETE %s" % m)
T = {}


def ue(p):
    return unreal.Vector(p[0] * 100.0, -p[1] * 100.0, p[2] * 100.0)


def mundo():
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()


def limpa():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for a in eas.get_all_level_actors():
        try:
            eas.destroy_actor(a)
        except Exception:
            pass


def importa():
    try:
        unreal.EditorAssetLibrary.delete_directory(PASTA)
    except Exception:
        pass
    t = unreal.AssetImportTask()
    t.filename = GLB
    t.destination_path = PASTA
    t.automated = True
    t.replace_existing = True
    t.save = False
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    malhas = []
    for c in unreal.EditorAssetLibrary.list_assets(PASTA, recursive=True):
        a = unreal.EditorAssetLibrary.load_asset(c)
        if isinstance(a, unreal.StaticMesh):
            malhas.append(a)
    if not malhas:
        raise RuntimeError("GLB não produziu malha: %s" % GLB)
    return malhas


def cores_do_glb():
    """Nome do material -> (cor linear, rugosidade, emissão), lido do bloco JSON do GLB.
    O Interchange importa a geometria mas deixou o material padrão (xadrez) — medido na
    1ª rodada. Refazer o material pelo NOME do slot evita depender do importador."""
    import struct
    b = open(GLB, "rb").read()
    n = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + n].decode("utf-8"))
    out = {}
    for m in j.get("materials", []):
        p = m.get("pbrMetallicRoughness", {})
        out[m.get("name", "")] = (p.get("baseColorFactor", [0.8, 0.8, 0.8, 1])[:3],
                                  p.get("roughnessFactor", 0.8), m.get("emissiveFactor", [0, 0, 0]))
    return out


def material(nome, cor, rug, emi):
    seguro = "".join(c if c.isalnum() else "_" for c in nome)
    m = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "M_" + seguro, PASTA + "/Cores", unreal.Material, unreal.MaterialFactoryNew())
    mel = unreal.MaterialEditingLibrary
    c = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c.set_editor_property("constant", unreal.LinearColor(cor[0], cor[1], cor[2], 1))
    mel.connect_material_property(c, "", unreal.MaterialProperty.MP_BASE_COLOR)
    r = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 200)
    r.set_editor_property("r", rug)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    if max(emi) > 0:
        e = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 400)
        e.set_editor_property("constant", unreal.LinearColor(emi[0] * 4, emi[1] * 4, emi[2] * 4, 1))
        mel.connect_material_property(e, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    m.set_editor_property("two_sided", True)
    mel.recompile_material(m)
    return m


def pinta(atores):
    cores = cores_do_glb()
    feitos, sem = {}, set()
    for a in atores:
        comp = a.static_mesh_component
        nomes = [str(s) for s in comp.get_material_slot_names()]
        for i in range(comp.get_num_materials()):
            slot = nomes[i] if i < len(nomes) else ""
            chave = next((k for k in cores if k and (slot == k or slot.startswith(k) or k.startswith(slot))), None)
            if chave is None:
                sem.add(slot); continue
            if chave not in feitos:
                feitos[chave] = material(chave, *cores[chave])
            comp.set_material(i, feitos[chave])
    diga("materiais do GLB=%d aplicados=%d slots sem par=%s" % (len(cores), len(feitos), sorted(sem)[:8] or "nenhum"))


LUZES = []


def monta():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    t0 = time.time()
    malhas = importa()
    T["importar_s"] = round(time.time() - t0, 1)
    t0 = time.time()
    # O Interchange já traz a posição no ASSET quando o GLB tem a malha aplicada; se vier
    # com ator de cena, os atores já estão no nível. Conta o que existe antes de espalhar.
    atores = [a for a in eas.get_all_level_actors() if isinstance(a, unreal.StaticMeshActor)]
    if not atores:
        for m in malhas:
            a = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0),
                                           unreal.Rotator(0, 0, 0))
            a.static_mesh_component.set_static_mesh(m)
        atores = [a for a in eas.get_all_level_actors() if isinstance(a, unreal.StaticMeshActor)]
    lo = [1e18] * 3; hi = [-1e18] * 3
    for a in atores:
        o, e = a.get_actor_bounds(False)
        for i, (c, x) in enumerate(((o.x, e.x), (o.y, e.y), (o.z, e.z))):
            lo[i] = min(lo[i], c - x); hi[i] = max(hi[i], c + x)
    diga("atores=%d malhas=%d caixa_cm min(%.0f,%.0f,%.0f) max(%.0f,%.0f,%.0f)"
         % (len(atores), len(malhas), lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]))
    pinta(atores)

    # SOL: a direção da KEY do Blender (do sol PARA o alvo), com a elevação opcional trocada.
    kx, ky, kz = (KEY_LOC[i] - ALVO[i] for i in range(3))
    if ELEV:
        h = math.sqrt(kx * kx + ky * ky + kz * kz); az = math.atan2(ky, kx); el = math.radians(float(ELEV))
        kx, ky, kz = h * math.cos(az) * math.cos(el), h * math.sin(az) * math.cos(el), h * math.sin(el)
    para_alvo = unreal.Vector(-kx, ky, -kz)          # -(KEY-ALVO), com Y negado pro UE
    sol = eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 5000),
                                     unreal.Rotator(0, 0, 0))
    sol.set_actor_rotation(unreal.MathLibrary.make_rot_from_x(para_alvo), False)
    lc = sol.light_component
    lc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    lc.set_intensity(7.0)
    LUZES.append((lc, 7.0))
    lc.set_light_color(unreal.LinearColor(1.0, 0.88, 0.72, 1.0))   # a cor da KEY
    try:
        lc.set_editor_property("atmosphere_sun_light", True)
    except Exception as e:
        diga("(sem atmosphere_sun_light: %s)" % e)
    ceu = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 4000), unreal.Rotator(0, 0, 0))
    sc = ceu.light_component
    sc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    sc.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    sc.set_editor_property("real_time_capture", True)
    sc.set_intensity(1.0)
    LUZES.append((sc, 1.0))
    eas.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    try:
        sc.recapture_sky()
    except Exception as e:
        diga("recapture: %s" % e)
    # chão neutro sob o prédio, como a mesa de uma maquete
    plano = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
    ch = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(ALVO[0] * 100, -ALVO[1] * 100, lo[2] - 2),
                                    unreal.Rotator(0, 0, 0))
    ch.static_mesh_component.set_static_mesh(plano)
    ch.set_actor_scale3d(unreal.Vector(300, 300, 1))
    ch.static_mesh_component.set_material(0, material("CHAO", (0.55, 0.55, 0.53), 0.9, (0, 0, 0)))
    T["montar_s"] = round(time.time() - t0, 1)


def liga_gi():
    for cmd in ("r.DynamicGlobalIlluminationMethod 1", "r.ReflectionMethod 1",
                "r.Lumen.TraceMeshSDFs 1", "r.DefaultFeature.AutoExposure 0",
                "r.SkyLight.RealTimeReflectionCapture 1"):
        unreal.SystemLibrary.execute_console_command(mundo(), cmd)


def camera():
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    c = cap.capture_component2d
    c.set_editor_property("projection_type", unreal.CameraProjectionMode.ORTHOGRAPHIC)
    c.set_editor_property("ortho_width", ORTHO_M * 100.0)
    c.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
    c.set_editor_property("capture_every_frame", False)
    pos = [ALVO[i] + DIST[i] for i in range(3)]
    olhar = unreal.Vector(-DIST[0], DIST[1], -DIST[2])   # Y negado
    cap.set_actor_location_and_rotation(ue(pos), unreal.MathLibrary.make_rot_from_x(olhar), False, False)
    return c


class Trabalho(object):
    def __init__(self):
        t0 = time.time()
        limpa(); monta(); liga_gi()
        self.c = camera()
        self.rt = unreal.RenderingLibrary.create_render_target2d(
            mundo(), LARG, ALT, unreal.TextureRenderTargetFormat.RTF_RGBA8)
        self.c.set_editor_property("texture_target", self.rt)
        self.n = 0
        self.t_conv = time.time()
        T["setup_total_s"] = round(time.time() - t0, 1)

    def passo(self):
        self.c.capture_scene()
        self.n += 1
        if self.n < CONVERGE:
            return True
        T["convergir_s"] = round(time.time() - self.t_conv, 1)
        # ESCADA DE LUZ: com a autoexposição desligada o nível absoluto é chute (7 lux saiu
        # quase preto). O post_process do SceneCapture não aplica (memória
        # unreal-teste-controlado); quem responde é set_intensity. Sol e céu escalam JUNTOS,
        # então a mistura não muda, só o nível — que é o que uma exposição faria.
        base = "unreal_lumen%s" % ("_sol" + ELEV if ELEV else "")
        T["escada"] = []
        for fator in (0.5, 1, 2, 3):
            for comp, b in LUZES:
                comp.set_intensity(b * fator)
            t0 = time.time()
            for _ in range(25):
                self.c.capture_scene()
            nome = "%s_x%s.png" % (base, str(fator).replace(".", "p"))
            unreal.RenderingLibrary.export_render_target(mundo(), self.rt, SAIDA, nome)
            T["escada"].append(dict(fator=fator, arquivo=nome, s=round(time.time() - t0, 1)))
        T["quadros_convergencia"] = CONVERGE
        with open(os.path.join(SAIDA, base + ".json"), "w", encoding="utf-8") as f:
            json.dump(T, f, ensure_ascii=False, indent=1)
        diga("FIM %s" % json.dumps(T))
        return False


_t, _alca, _berco, _ocupado = None, None, BERCO, False
T0 = time.time()


def tick(dt):
    global _ocupado
    if _ocupado:
        return
    _ocupado = True
    try:
        _tick()
    finally:
        _ocupado = False


def _tick():
    global _t, _berco
    if _t is None:
        if _berco > 0:
            _berco -= 1
            return
        try:
            T["editor_ate_mundo_s"] = round(time.time() - T0, 1)
            _t = Trabalho()
            return
        except Exception as e:
            diga("ERRO ao começar: %s" % e)
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


diga("GLB %s -> %s, %dx%d, ortho %.0f m" % (GLB, SAIDA, LARG, ALT, ORTHO_M))
_alca = unreal.register_slate_post_tick_callback(tick)

"""Confere projeção ortográfica e preserva as outras três fotografias finais."""
from pathlib import Path
import base64
import hashlib
import json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

PASTA = Path(__file__).resolve().parent


def sha(arquivo):
    return hashlib.sha256(arquivo.read_bytes()).hexdigest()


def main():
    proof = json.loads((PASTA / "qa/capturas.json").read_text("utf8"))
    others = {v: sha(PASTA / "comparacoes" / f"{v}.png") for v in ("fachada", "aerea", "portaria")}
    errors, transitions = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                                     headless=True, args=["--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto((PASTA / "maquete-liv-ipanema.html").as_uri(), wait_until="load")
        light = page.evaluate("""async()=>{await window.__liv.luzPronta;const s=window.__liv.luz;
          return {ready:s.ready,error:window.__liv.erroLuz||null,geometryHashVerified:s.geometryHashVerified,
          textureHashVerified:s.textureHashVerified,atlas:LIV_LIGHTMAP_DATA.json['manifest.json'].textureSHA256};}""")
        assert light["ready"] and not light["error"] and light["atlas"] == proof["atlasSHA256"], light
        page.locator("#alternarFicha").click()
        page.wait_for_timeout(300)

        def snap():
            return page.evaluate("""()=>{const q=window.__maq;q.poeCam();q.ren.render(q.cena,q.cam);
              return {mode:q.modo(),type:q.cam.type,aspect:q.cam.aspect,r:q.orb.r,th:q.orb.th,ph:q.orb.ph,
              fov:q.cam.fov,up:q.cam.up.toArray(),camera:q.cam.position.toArray(),left:q.cam.left,
              right:q.cam.right,top:q.cam.top,bottom:q.cam.bottom,
              width:q.ren.domElement.clientWidth,height:q.ren.domElement.clientHeight};}""")

        page.locator('[data-vista="implantacao"]').click()
        page.wait_for_timeout(150)
        initial = snap()
        assert initial["type"] == "OrthographicCamera" and initial["ph"] == 0, initial
        ratio = page.evaluate("""()=>{const q=window.__maq;function span(y){
          const a=new THREE.Vector3(-23.85,y,0).project(q.cam),b=new THREE.Vector3(23.85,y,0).project(q.cam);
          return Math.hypot(b.x-a.x,b.y-a.y);}return span(48.45)/span(0);}""")
        assert abs(ratio - 1) < 1e-8, ratio
        page.locator("#c").hover()
        page.mouse.wheel(0, -150)
        page.wait_for_timeout(120)
        wheel = snap()
        assert wheel["type"] == "OrthographicCamera" and wheel["r"] < initial["r"], wheel
        assert abs(wheel["camera"][1] - initial["camera"][1]) < 1e-8, wheel
        rect = page.locator("#c").bounding_box()
        x, y = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 30, y - 20, steps=4)
        page.mouse.up()
        page.wait_for_timeout(100)
        drag = snap()
        assert drag["th"] != wheel["th"] and drag["type"] == "OrthographicCamera", drag
        page.locator('[data-vista="implantacao"]').click()
        page.locator("#alternarFicha").click()
        page.wait_for_timeout(250)
        expanded = snap()
        assert abs(expanded["aspect"] - expanded["width"] / expanded["height"]) < 1e-6, expanded
        page.set_viewport_size({"width": 1100, "height": 850})
        page.wait_for_timeout(250)
        resized = snap()
        assert abs((resized["right"] - resized["left"]) / (resized["top"] - resized["bottom"])
                   - resized["width"] / resized["height"]) < 1e-6, resized
        for mode in ("planta3d", "maquete"):
            page.locator(f'[data-modo="{mode}"]').click()
            page.wait_for_timeout(120)
            state = snap()
            assert state["type"] == "PerspectiveCamera" and state["fov"] == 34, state
            transitions.append(state)
        page.locator('[data-vista="portaria"]').click()
        state = snap()
        assert state["type"] == "PerspectiveCamera" and state["fov"] == 60, state
        transitions.append(state)
        for mode in ("planta2d", "visita", "maquete"):
            page.locator('[data-modo="maquete"]').click()
            page.locator('[data-vista="implantacao"]').click()
            page.locator(f'[data-modo="{mode}"]').click()
            page.wait_for_timeout(100)
            state = snap()
            assert state["type"] == "PerspectiveCamera", state
            transitions.append(state)
        page.set_viewport_size({"width": 1600, "height": 1000})
        page.wait_for_timeout(250)
        if page.locator("#alternarFicha").get_attribute("aria-expanded") == "true":
            page.locator("#alternarFicha").click()
        page.wait_for_timeout(300)
        page.locator("#livAndar").select_option("-1")
        page.locator('[data-vista="implantacao"]').click()
        page.wait_for_timeout(200)
        data = page.evaluate("""()=>{const q=window.__maq;const png=window.__liv.captura();
          q.quadro(performance.now());q.quadro(performance.now()+16);
          return {foto:png,pose:{camera:q.cam.position.toArray(),alvo:q.alvo.toArray(),
            orb:{r:q.orb.r,th:q.orb.th,ph:q.orb.ph},fov:q.cam.fov,projection:q.cam.type,
            left:q.cam.left,right:q.cam.right,top:q.cam.top,bottom:q.cam.bottom,
            near:q.cam.near,far:q.cam.far,up:q.cam.up.toArray()},
            canvas:{width:q.ren.domElement.width,height:q.ren.domElement.height,
              css:q.ren.domElement.getBoundingClientRect().toJSON()},andar:q.andar,
            conjunto:document.getElementById('verConjunto').getAttribute('aria-pressed'),
            atlasSHA256:LIV_LIGHTMAP_DATA.json['manifest.json'].textureSHA256,
            drawCalls:q.ren.info.render.calls};}""")
        raw = base64.b64decode(data.pop("foto").split(",", 1)[1])
        assert data["atlasSHA256"] == proof["atlasSHA256"] and data["andar"] == -1 and data["conjunto"] == "true", data
        assert not errors, errors
        (PASTA / "comparacoes/implantacao.png").write_bytes(raw)
        page.screenshot(path=str(PASTA / "qa/implantacao-ortografica-ui.png"))
        browser.close()
    for view, oldsha in others.items():
        assert sha(PASTA / "comparacoes" / f"{view}.png") == oldsha, view
    record = {"vista": "implantacao", "arquivo": "comparacoes/implantacao.png",
              "pngSHA256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
              "capturadoUTC": datetime.now(timezone.utc).isoformat(),
              "htmlCapturaSHA256": sha(PASTA / "maquete-liv-ipanema.html"), **data}
    proof["fotos"] = [record if row["vista"] == "implantacao" else row for row in proof["fotos"]]
    proof["galeriaFinalVerificada"] = False
    (PASTA / "qa/capturas.json").write_text(json.dumps(proof, indent=2, ensure_ascii=False), "utf8")
    smoke = {"tipo": "implantacao-ortografica", "erros": errors, "roofGroundScaleRatio": ratio,
             "topo": initial, "wheel": wheel, "drag": drag, "fichaExpandida": expanded,
             "resize": resized, "transicoes": transitions, "luz": light,
             "outrasFotosPreservadas": others, "captura": record}
    (PASTA / "qa/implantacao-ortografica.json").write_text(json.dumps(smoke, indent=2, ensure_ascii=False), "utf8")
    print(json.dumps({"ratio": ratio, "captura": record, "erros": errors}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

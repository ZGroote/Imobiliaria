"""Fotografias reais do canvas com identificação do atlas carregado e smoke offline."""
from pathlib import Path
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import tempfile

from playwright.sync_api import sync_playwright

PASTA = Path(__file__).resolve().parent
VISTAS = ("fachada", "aerea", "portaria", "implantacao")


def sha256(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", required=True, help="SHA256 do atlas final aprovado")
    args = parser.parse_args()
    arquivo = PASTA / "maquete-liv-ipanema.html"
    hash_html = sha256(arquivo.read_bytes())
    manifest_disco = json.loads((PASTA / "luz/manifest.json").read_text("utf8"))
    assert manifest_disco["textureSHA256"] == args.atlas, "Atlas em disco não é o esperado"
    erros, rede = [], []
    fotos = []
    with tempfile.TemporaryDirectory(prefix="liv-fotos-") as temporaria:
        staging = Path(temporaria)
        with sync_playwright() as pw:
            navegador = pw.chromium.launch(
                executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                headless=True, args=["--allow-file-access-from-files"])
            pagina = navegador.new_page(viewport={"width": 1600, "height": 1000},
                                        device_scale_factor=2)
            pagina.on("pageerror", lambda erro: erros.append(str(erro)))
            pagina.on("request", lambda req: rede.append(req.url)
                      if req.url.startswith(("https://", "http://")) else None)
            # Comprova que os recursos necessários estão embutidos no HTML.
            pagina.route("http://**/*", lambda route: route.abort())
            pagina.route("https://**/*", lambda route: route.abort())
            pagina.goto(arquivo.as_uri(), wait_until="load")
            pagina.wait_for_function("window.__liv && window.__liv.luzPronta")
            luz = pagina.evaluate("""async () => {
              await window.__liv.luzPronta;
              const s=window.__liv.luz;
              return {erro:window.__liv.erroLuz || null,
                ready:s && s.ready,groups:s && s.groups,drawCalls:s && s.drawCalls,
                geometryHashVerified:s && s.geometryHashVerified,
                textureHashVerified:s && s.textureHashVerified,
                manifest:LIV_LIGHTMAP_DATA.json['manifest.json']};
            }""")
            assert not luz["erro"] and luz["ready"], luz
            assert luz["geometryHashVerified"] and luz["textureHashVerified"], luz
            assert luz["manifest"]["textureSHA256"] == args.atlas, "HTML usa outro atlas"
            modos = []
            for modo in ("maquete", "planta2d", "planta3d", "visita", "maquete"):
                pagina.locator(f'[data-modo="{modo}"]').click()
                pagina.wait_for_timeout(150)
                modos.append(pagina.evaluate("window.__maq.modo()"))
            assert modos == ["maquete", "planta2d", "planta3d", "visita", "maquete"], modos
            pagina.locator("#livAndar").select_option("-1")
            if pagina.locator("#alternarFicha").get_attribute("aria-expanded") == "true":
                pagina.locator("#alternarFicha").click()
            pagina.wait_for_timeout(400)
            if pagina.locator("#verConjunto").get_attribute("aria-pressed") != "true":
                pagina.locator("#verConjunto").click()
            for vista in VISTAS:
                # A altura do canvas já corresponde à ficha recolhida antes do fit.
                pagina.locator(f'[data-vista="{vista}"]').click()
                pagina.wait_for_timeout(200)
                registro = pagina.evaluate("""() => {
                  const q=window.__maq;
                  const foto=window.__liv.captura();
                  q.quadro(performance.now());q.quadro(performance.now()+16);
                  return {foto,pose:{camera:q.cam.position.toArray(),alvo:q.alvo.toArray(),
                    orb:{r:q.orb.r,th:q.orb.th,ph:q.orb.ph},fov:q.cam.fov},
                    canvas:{width:q.ren.domElement.width,height:q.ren.domElement.height,
                      css:q.ren.domElement.getBoundingClientRect().toJSON()},
                    andar:q.andar,conjunto:document.getElementById('verConjunto').getAttribute('aria-pressed'),
                    atlasSHA256:LIV_LIGHTMAP_DATA.json['manifest.json'].textureSHA256,
                    drawCalls:q.ren.info.render.calls};
                }""")
                dados = base64.b64decode(registro.pop("foto").split(",", 1)[1])
                assert registro["andar"] == -1 and registro["conjunto"] == "true", registro
                assert registro["atlasSHA256"] == args.atlas, registro
                assert registro["canvas"]["width"] >= 1440, registro
                assert registro["drawCalls"] < 70, registro
                (staging / f"{vista}.png").write_bytes(dados)
                fotos.append({"vista": vista, "arquivo": f"comparacoes/{vista}.png",
                              "pngSHA256": sha256(dados), "bytes": len(dados), **registro})
            pagina.screenshot(path=str(staging / "offline-final.png"))
            assert not erros, erros
            assert not rede, rede
            navegador.close()
        assert sha256(arquivo.read_bytes()) == hash_html, "HTML alterado durante a captura"
        manifest_atual = json.loads((PASTA / "luz/manifest.json").read_text("utf8"))
        assert manifest_atual["textureSHA256"] == args.atlas, "Atlas alterado durante a captura"
        (PASTA / "comparacoes").mkdir(exist_ok=True)
        (PASTA / "qa").mkdir(exist_ok=True)
        for vista in VISTAS:
            (staging / f"{vista}.png").replace(PASTA / "comparacoes" / f"{vista}.png")
        (staging / "offline-final.png").replace(PASTA / "qa/offline-final.png")
    resultado = {"capturadoUTC": datetime.now(timezone.utc).isoformat(),
                 "htmlSHA256": hash_html, "atlasSHA256": args.atlas,
                 "modeloSHA256": luz["manifest"]["sourceSHA256"],
                 "geometrySHA256": luz["manifest"]["geometrySHA256"],
                 "viewport": {"width": 1600, "height": 1000}, "deviceScaleFactor": 2,
                 "origem": "file://", "offline": True, "requisicoesHTTP": rede,
                 "erros": erros, "modos": modos, "luz": luz, "fotos": fotos}
    (PASTA / "qa/capturas.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False), "utf8")
    print(json.dumps({"atlasSHA256": args.atlas, "fotos": fotos, "erros": erros}, ensure_ascii=False))


if __name__ == "__main__":
    main()

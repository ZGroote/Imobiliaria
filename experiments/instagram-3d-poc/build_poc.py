#!/usr/bin/env python3
"""Build isolado do POC Instagram/WebView para a maquete LEVE.

O arquivo fonte continua sendo gerado pelo `pagina_maquete.py` do projeto. Este módulo
não altera a fábrica nem a publicação: ele injeta apenas uma casca de apresentação e
controles próprios do experimento em uma cópia do HTML gerado.
"""
from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path

POC_MARKER = "instagram-3d-poc-v1"
DEFAULT_PROPERTY = "monte-dos-cedros-37"

STYLE = r"""
<style id="instagram-3d-poc-style" data-poc="instagram-3d-poc-v1">
html, body { width:100%; height:100%; overscroll-behavior:none; }
body.instagram-3d-poc {
  width:100%; min-height:100vh; min-height:100dvh; height:100vh; height:100dvh;
  overflow:hidden; padding:0 !important; background:#0E141B;
}
body.instagram-3d-poc .folha {
  width:100%; max-width:none; height:100%; min-height:0; margin:0;
  display:flex; flex-direction:column; gap:0;
}
body.instagram-3d-poc #cena,
body.instagram-3d-poc.ficha-recolhida #cena {
  width:100%; height:auto; min-height:0; flex:1 1 auto; margin:0;
  padding-top:max(62px, calc(50px + env(safe-area-inset-top)));
  padding-bottom:max(78px, calc(66px + env(safe-area-inset-bottom)));
}
body.instagram-3d-poc #ficha { display:none !important; }
body.instagram-3d-poc #ferramentas { left:max(10px, env(safe-area-inset-left)); }
body.instagram-3d-poc #joy {
  left:max(12px, env(safe-area-inset-left));
  bottom:max(86px, calc(72px + env(safe-area-inset-bottom)));
}
#ig3d-bar {
  position:fixed; z-index:30; left:max(10px, env(safe-area-inset-left));
  right:max(10px, env(safe-area-inset-right)); top:max(8px, env(safe-area-inset-top));
  min-height:46px; display:flex; align-items:center; gap:10px; padding:8px 10px;
  border:1px solid rgba(255,255,255,.14); border-radius:14px;
  background:rgba(12,18,25,.82); backdrop-filter:blur(12px); color:#E7EBF0;
  font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
}
#ig3d-bar .ig3d-copy { min-width:0; flex:1; }
#ig3d-bar strong { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#ig3d-status { display:block; margin-top:2px; font-size:10px; font-weight:500; opacity:.62; }
#ig3d-bar button, #ig3d-dock button, #ig3d-error button, #ig3d-error a {
  min-height:44px; border-radius:11px; border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.08); color:#E7EBF0; font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
  padding:0 13px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center;
  touch-action:manipulation; -webkit-tap-highlight-color:transparent;
}
#ig3d-bar button { min-width:44px; padding:0 10px; }
#ig3d-dock {
  position:fixed; z-index:30; left:max(10px, env(safe-area-inset-left));
  right:max(10px, env(safe-area-inset-right)); bottom:max(8px, env(safe-area-inset-bottom));
  display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:8px;
  border:1px solid rgba(255,255,255,.14); border-radius:15px;
  background:rgba(12,18,25,.82); backdrop-filter:blur(12px);
}
#ig3d-dock button[data-primary="true"] {
  background:rgba(75,219,124,.16); border-color:rgba(75,219,124,.5); color:#BFF3D2;
}
#ig3d-error {
  position:fixed; z-index:50; inset:0; display:none; align-items:center; justify-content:center;
  padding:24px; background:rgba(14,20,27,.94); color:#E7EBF0;
  font:500 14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; text-align:center;
}
#ig3d-error[data-open="true"] { display:flex; }
#ig3d-error .ig3d-error-card { width:min(420px,100%); }
#ig3d-error strong { display:block; font-size:18px; margin-bottom:8px; }
#ig3d-error p { opacity:.72; margin-bottom:14px; }
#ig3d-error .ig3d-error-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
@media (orientation:landscape) and (max-height:520px) {
  #ig3d-bar { right:auto; max-width:min(420px,55vw); }
  #ig3d-dock { left:auto; width:min(360px,45vw); grid-template-columns:1fr 1fr; }
}
</style>
"""

SCRIPT = r"""
<script id="instagram-3d-poc-script" data-poc="instagram-3d-poc-v1">
(function () {
  "use strict";
  var PLANTA = 'button[data-modo="planta3d"]';
  var VISITA = 'button[data-modo="visita"]';

  function q(sel) { return document.querySelector(sel); }
  function clique(sel) { var b = q(sel); if (b) { b.click(); return true; } return false; }
  function status(texto) { var el = q("#ig3d-status"); if (el) el.textContent = texto; }
  function falha(titulo, detalhe) {
    var box = q("#ig3d-error"); if (!box) return;
    q("#ig3d-error-title").textContent = titulo;
    q("#ig3d-error-detail").textContent = detalhe;
    box.dataset.open = "true";
  }
  function modoAtual() {
    var ativo = q('#modos button[aria-pressed="true"]');
    return ativo ? ativo.dataset.modo : "";
  }
  function atualizaDock() {
    var visita = modoAtual() === "visita";
    var prim = q("#ig3d-primary");
    if (!prim) return;
    prim.textContent = visita ? "Voltar à planta" : "Entrar no imóvel";
    prim.dataset.destino = visita ? "planta3d" : "visita";
    status(visita ? "Visita 3D · arraste para olhar" : "Planta 3D · arraste e use pinça para zoom");
  }
  function abrirModo(nome) {
    if (!clique('button[data-modo="' + nome + '"]')) {
      falha("Viewer indisponível", "O modo 3D esperado não foi encontrado nesta versão do artefato.");
      return;
    }
    requestAnimationFrame(atualizaDock);
  }

  function montaCasca() {
    document.body.classList.add("instagram-3d-poc");
    var bar = document.createElement("div");
    bar.id = "ig3d-bar";
    bar.innerHTML = '<div class="ig3d-copy"><strong>Monte dos Cedros · 3D</strong><span id="ig3d-status">Preparando Planta 3D…</span></div>' +
      '<button id="ig3d-reset" type="button" aria-label="Restaurar câmera" title="Restaurar câmera">↺</button>';
    document.body.appendChild(bar);

    var dock = document.createElement("div");
    dock.id = "ig3d-dock";
    dock.innerHTML = '<button id="ig3d-primary" type="button" data-primary="true" data-destino="visita">Entrar no imóvel</button>' +
      '<button id="ig3d-open" type="button">Abrir fora do app</button>';
    document.body.appendChild(dock);

    var err = document.createElement("div");
    err.id = "ig3d-error";
    err.innerHTML = '<div class="ig3d-error-card"><strong id="ig3d-error-title">Não foi possível abrir o 3D</strong>' +
      '<p id="ig3d-error-detail">Tente recarregar ou abrir a mesma página fora do navegador interno.</p>' +
      '<div class="ig3d-error-actions"><button id="ig3d-retry" type="button">Recarregar</button>' +
      '<a id="ig3d-external" target="_blank" rel="noopener">Abrir fora do app</a></div></div>';
    document.body.appendChild(err);
    q("#ig3d-external").href = location.href;

    q("#ig3d-primary").addEventListener("click", function () { abrirModo(this.dataset.destino); });
    q("#ig3d-reset").addEventListener("click", function () { location.reload(); });
    q("#ig3d-retry").addEventListener("click", function () { location.reload(); });
    q("#ig3d-open").addEventListener("click", function () {
      var w = window.open(location.href, "_blank", "noopener");
      if (!w) status("O app bloqueou a nova janela · use o menu do Instagram para abrir no navegador");
    });
  }

  function verificaWebGL() {
    var c = q("#c");
    if (!c) { falha("Viewer indisponível", "O canvas 3D não existe neste artefato."); return false; }
    c.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      falha("O 3D foi interrompido", "O navegador perdeu o contexto WebGL. Recarregue a página para continuar.");
    }, false);
    return true;
  }

  function inicia() {
    montaCasca();
    if (!verificaWebGL()) return;
    if (!clique(PLANTA)) {
      falha("Planta 3D indisponível", "Esta versão do imóvel não expõe o modo Planta 3D esperado pelo POC.");
      return;
    }
    requestAnimationFrame(atualizaDock);
  }

  addEventListener("orientationchange", function () { setTimeout(function () { dispatchEvent(new Event("resize")); }, 120); });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) status("Viewer pausado"); else atualizaDock();
  });
  addEventListener("error", function (e) {
    if (String(e.message || "").toLowerCase().indexOf("webgl") >= 0)
      falha("Falha no WebGL", "O navegador interno não conseguiu manter o renderizador 3D.");
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicia, {once:true});
  else inicia();
})();
</script>
"""


def inject_poc(html: str) -> str:
    """Injeta a casca do POC em uma cópia do HTML da maquete."""
    if POC_MARKER in html:
        raise ValueError("HTML já contém o POC")
    required = ["</head>", "</body>", 'id="c"', 'data-modo="planta3d"', 'data-modo="visita"']
    missing = [marker for marker in required if marker not in html]
    if missing:
        raise ValueError("artefato incompatível; ausente: " + ", ".join(missing))
    html = html.replace("</head>", STYLE + "\n</head>", 1)
    html = html.replace("</body>", SCRIPT + "\n</body>", 1)
    return html


def generate_source(repo_root: Path, property_id: str, target: Path) -> None:
    generator = repo_root / "v1.5" / "miniaturas" / "pagina_maquete.py"
    if not generator.is_file():
        raise FileNotFoundError(f"gerador não encontrado: {generator}")
    cmd = [sys.executable, str(generator), "--unidade", property_id, "--modo", "leve", "--saida", str(target)]
    subprocess.run(cmd, cwd=repo_root, check=True)


def build(repo_root: Path, output: Path, source: Path | None, property_id: str) -> dict[str, object]:
    output.parent.mkdir(parents=True, exist_ok=True)
    if source is None:
        with tempfile.TemporaryDirectory(prefix="ig3d-poc-") as td:
            generated = Path(td) / "source.html"
            generate_source(repo_root, property_id, generated)
            original = generated.read_text(encoding="utf-8")
    else:
        original = source.read_text(encoding="utf-8")
    result = inject_poc(original)
    output.write_text(result, encoding="utf-8")
    data = result.encode("utf-8")
    return {"output": str(output), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "property": property_id, "mode": "leve"}


def main() -> int:
    here = Path(__file__).resolve()
    repo_default = here.parents[2]
    parser = argparse.ArgumentParser(description="Gera o POC isolado Instagram/WebView a partir da maquete LEVE.")
    parser.add_argument("--repo", type=Path, default=repo_default)
    parser.add_argument("--source", type=Path, help="HTML já gerado; se omitido, roda pagina_maquete.py --modo leve")
    parser.add_argument("--property", default=DEFAULT_PROPERTY)
    parser.add_argument("--output", type=Path, default=here.parent / "dist" / "index.html")
    args = parser.parse_args()
    info = build(args.repo.resolve(), args.output.resolve(), args.source.resolve() if args.source else None, args.property)
    print("POC gerado: {output}\nmodo: {mode}\nimóvel: {property}\nbytes: {bytes}\nsha256: {sha256}".format(**info))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

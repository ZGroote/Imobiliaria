"""Baixa apenas os arquivos públicos efetivamente usados pelo LIV publicado."""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
BASE = "https://conectaimoveis3d.com.br/liv-classico/"
FILES = {
    "exterior.json.gz": "modelo/entrada/candidato/assets/scene.json.gz",
    "exterior-manifest.json": "modelo/entrada/candidato/assets/manifest.json",
    "apartamento.json.gz": "interiores/canto/source.json.gz",
    "unidade.json": "interiores/canto/unidade.json",
    "moveis.json.gz": "interiores/shared/furniture.json.gz",
    "materiais.json.gz": "interiores/shared/materials.json.gz",
    "texture-00.png": "modelo/entrada/candidato/assets/texture-00.png",
    "texture-01.png": "modelo/entrada/candidato/assets/texture-01.png",
}


def main():
    target = ROOT / "fontes"
    target.mkdir(exist_ok=True)
    provenance = {"pagina": "https://conectaimoveis3d.com.br/maquetes/liv/", "arquivos": []}
    for filename, relative in FILES.items():
        url = BASE + relative
        with urlopen(Request(url, headers={"User-Agent": "Codex-LIV-SketchUp/1.0"}), timeout=45) as response:
            data = response.read()
            content_type = response.headers.get("Content-Type", "")
        assert "html" not in content_type.lower(), (url, content_type)
        (target / filename).write_bytes(data)
        entry = {"arquivo": filename, "url": url, "bytes": len(data),
                 "sha256": hashlib.sha256(data).hexdigest()}
        provenance["arquivos"].append(entry)
        print(json.dumps(entry), flush=True)
    (target / "origem.json").write_text(json.dumps(provenance, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()

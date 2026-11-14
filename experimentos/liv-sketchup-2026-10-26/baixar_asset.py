"""Adquire somente o GLB publico disponibilizado nos metadados do Warehouse."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse
from uuid import UUID

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("nome")
parser.add_argument("id")
args = parser.parse_args()
UUID(args.id)
assert args.nome.isalnum()
api = "https://3dwarehouse.sketchup.com/warehouse/v1.0/entities/" + args.id
with urlopen(api, timeout=25) as response:
    metadata = json.load(response)
binary = metadata["binaries"]["glb"]
url = binary["contentUrl"]
parsed = urlparse(url)
assert parsed.hostname == "download-warehouse.sketchup.com" and "/content/public/" in parsed.path
with urlopen(url, timeout=40) as response:
    data = response.read()
assert data[:4] == b"glTF", "Resposta diferente de GLB"
path = root / "dados" / "warehouse" / (args.nome + ".glb")
path.parent.mkdir(exist_ok=True)
path.write_bytes(data)
(root / "fontes" / ("warehouse-" + args.nome + ".json")).write_text(json.dumps(metadata), encoding="utf-8")
record = {"nome": args.nome, "titulo": metadata["title"], "id": args.id,
          "pagina": "https://3dwarehouse.sketchup.com/model/" + args.id,
          "arquivo": path.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
          "origem": "GLB publico indicado pelo proprio 3D Warehouse", "copyright": metadata.get("copyright")}
(root / "fontes" / ("credito-" + args.nome + ".json")).write_text(json.dumps(record, indent=2), encoding="utf-8")
print(json.dumps(record), flush=True)

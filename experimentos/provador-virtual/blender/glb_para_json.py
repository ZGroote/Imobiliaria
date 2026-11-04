"""Converte .glb em glTF JSON com o buffer embutido (para hosts que não servem binários)."""
import base64
import json
import struct
import sys
from pathlib import Path

for caminho in map(Path, sys.argv[1:]):
    dados = caminho.read_bytes()
    assert dados[:4] == b"glTF"
    pos, js, binario = 12, None, b""
    while pos < len(dados):
        n, tipo = struct.unpack_from("<I4s", dados, pos)
        bloco = dados[pos + 8:pos + 8 + n]
        if tipo == b"JSON":
            js = json.loads(bloco)
        elif tipo == b"BIN\0":
            binario = bloco
        pos += 8 + n
    js["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binario).decode()
    saida = caminho.with_suffix(".gltf.json")
    saida.write_text(json.dumps(js, separators=(",", ":")))
    print(saida, saida.stat().st_size)

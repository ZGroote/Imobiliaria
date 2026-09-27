"""Entry point único da geração LEVE no Blender.

Uso:
  blender --background --factory-startup --python modelar_imovel.py -- <propertyId>

Resolve a família pela fonte LEVE normalizada e delega ao gerador aprovado sem tocar
na cena antes dele.
"""
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
sys.path.insert(0, str(REPO))

from pipeline.fonte_leve import FonteLeveErro, normalizar


GENERATORS = {
    "montes-mrv-v1": ROOT / "modelar_montes.py",
    "castanheiras-ebm-v1": ROOT / "modelar_castanheiras.py",
}


def property_id(argv=None):
    argv = sys.argv if argv is None else argv
    if "--" not in argv:
        raise SystemExit(
            "uso: blender --background --factory-startup --python "
            "modelar_imovel.py -- <propertyId>"
        )
    i = argv.index("--")
    if i + 1 >= len(argv) or not argv[i + 1].strip():
        raise SystemExit("propertyId ausente")
    return argv[i + 1]


def resolver(property_id):
    try:
        fonte = normalizar(property_id)
    except FonteLeveErro as exc:
        raise SystemExit(str(exc))
    profile = fonte["style"]["profile"]
    try:
        target = GENERATORS[profile]
    except KeyError:
        raise SystemExit("perfil LEVE sem gerador Blender: " + profile)
    if not target.is_file():
        raise SystemExit("gerador Blender ausente: " + target.name)
    return profile, target


def main():
    uid = property_id()
    profile, target = resolver(uid)
    print("LEVE_DISPATCH", uid, profile, target.name, flush=True)
    runpy.run_path(str(target), run_name="__main__")


if __name__ == "__main__":
    main()

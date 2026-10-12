"""Monta uma entrega local por lista fechada; não publica nem altera a base."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
PAGES = ["maquete-liv-ipanema.html", "prova-rgbm.html", "interior.html",
         "diagnostico.html", "materiais.html", "mapa-liv-ipanema-5km.html"]
STATIC_IMPORT = re.compile(r"(?m)^\s*(?:import\b[^;]*?|export\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?))\s+from\s*['\"]([^'\"\r\n]+)['\"]")
DYNAMIC_IMPORT = re.compile(r"\bimport\s*\(\s*['\"]([^'\"\r\n]+)['\"]\s*\)")
HTML_RESOURCE = re.compile(r"(?:src|href)=[\"']([^\"']+\.(?:js|css))[\"']")
THREE = {"three": "node_modules/three/build/three.webgpu.js",
         "three/webgpu": "node_modules/three/build/three.webgpu.js",
         "three/tsl": "node_modules/three/build/three.tsl.js"}


def identity(data: bytes):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def local_path(name: str) -> str:
    if (not isinstance(name, str) or not name or "\\" in name or ":" in name
            or "\0" in name or "?" in name or "#" in name):
        raise ValueError(f"Caminho de entrega inválido: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in name.split("/")):
        raise ValueError(f"Caminho de entrega inválido: {name!r}")
    return path.as_posix()


def inventory(root=ROOT):
    files = {}

    def add(name, expected=None):
        name = local_path(name)
        source = root / name
        if source.is_symlink() or not source.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Recurso fora da origem: {name}")
        data = source.read_bytes()
        actual = identity(data)
        if expected is not None and actual != {k: expected[k] for k in ("bytes", "sha256")}:
            raise ValueError(f"Identidade divergente: {name}")
        if name in files and files[name] != actual:
            raise ValueError(f"Origem mudou durante a montagem: {name}")
        files[name] = actual
        return data

    # Resolve the actual JS graph, including fixed dynamic imports. Unknown bare
    # imports fail closed instead of copying an entire dependency installation.
    visited = set()

    def module(name):
        if name in visited:
            return
        visited.add(name)
        source = add(name).decode("utf8")
        for spec in [*STATIC_IMPORT.findall(source), *DYNAMIC_IMPORT.findall(source)]:
            if spec in THREE:
                target = THREE[spec]
            elif spec.startswith("three/addons/"):
                target = "node_modules/three/examples/jsm/" + spec[len("three/addons/"):]
            elif spec.startswith("./") or spec.startswith("../"):
                candidate = ((root / name).parent / spec).resolve()
                if not candidate.is_relative_to(root.resolve()):
                    raise ValueError(f"Import fora da origem: {name}: {spec}")
                target = candidate.relative_to(root).as_posix()
            else:
                raise ValueError(f"Import não previsto: {name}: {spec}")
            module(target)

    for page in PAGES:
        source = add(page).decode("utf8")
        for spec in HTML_RESOURCE.findall(source):
            name = local_path(spec.removeprefix("./"))
            if name.endswith(".js"):
                module(name)
            else:
                add(name)
    # Workers are instantiated by URL, not imported into a page's JS realm.
    module("transfer-worker.js")
    module("node_modules/three/build/three.tsl.js")
    add("node_modules/three/LICENSE")
    for name in ["draco/gltf/draco_decoder.js", "draco/gltf/draco_wasm_wrapper.js",
                 "draco/gltf/draco_decoder.wasm", "basis/basis_transcoder.js",
                 "basis/basis_transcoder.wasm"]:
        add("node_modules/three/examples/jsm/libs/" + name)

    for directory, units in [("assets-prova", "unidades.json"),
                             ("modelo/variante/assets", "modelo/unidades-contorno.json"),
                             ("modelo/entrada/candidato/assets", "modelo/entrada/unidades-entrada.json")]:
        manifest = json.loads(add(directory + "/manifest.json"))
        if manifest.get("schema") != "liv-proof-manifest-v1":
            raise ValueError("Manifesto de exterior inválido.")
        add(units)
        for name, record in manifest["files"].items():
            add(directory + "/" + local_path(name), record)
    environment = json.loads(add("assets-ambiente/manifest.json"))
    add("assets-ambiente/" + local_path(environment["file"]["name"]), environment["file"])
    sample = json.loads(add("assets-materiais/manifest.json"))
    if sample.get('schema')!='liv-pbr-fixture-v1':raise ValueError('Manifesto da bancada PBR inválido.')
    for name,record in sample['files'].items():add('assets-materiais/'+local_path(name),record)

    transfer = json.loads(add("transfer-manifest.json"))
    if transfer.get("schema") != "liv-transfer-manifest-v1":
        raise ValueError("Manifesto de transferências inválido.")
    versioned = {key: value for key, value in transfer.items() if key != "version"}
    canonical = json.dumps(versioned, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    if hashlib.sha256(canonical).hexdigest() != transfer["version"]:
        raise ValueError("Versão do catálogo de transferências inválida.")
    for record in transfer["files"]:
        add(record["path"], record)
    add("comercial.json")
    add("vinculos.json")
    add("estoque-config.json")
    add("estoque-demo-config.json")
    sales = json.loads(add("estoque-build.json"))
    if sales.get('schema') != 'liv-sales-bundle-v1':raise ValueError('Bundle comercial inválido.')
    add(sales['file']['path'], sales['file'])
    add("mapa-runtime/manifest.json")
    add("mapa-parcela.json")
    # Include all the preserved payload, for a real independent recovery path.
    baseline = json.loads((root / "manifesto.json").read_bytes())
    for name, record in baseline["arquivos"].items():
        add("site-baseline/" + local_path(name), record)
    return dict(sorted(files.items()))


def review_inventory(root=ROOT):
    names = ['AMBIENCIA.md','CATALOGO.md','COMERCIAL.md','ESTOQUE.md','DISPONIBILIDADE.md','DEMONSTRACAO.md','DIAGNOSTICO.md','VINCULOS.md','REDE-MEMORIA.md','MATERIAIS.md','MAPA-MODELO.md','INTERIORES.md','CORTES.md','TROCA-PLANTAS.md','TOPOS-PAREDES.md',
             'evidencias/estabilidade-visual-corrigida/runtime.json','evidencias/topos-corte-tour/runtime.json',
             'evidencias/estabilidade-visual-corrigida/webgpu-0-canto.png',
             'evidencias/estabilidade-visual-corrigida/webgpu-1-meio.png',
             'evidencias/troca-plantas-antes/runtime.json','evidencias/troca-plantas-conferida/runtime.json',
             'evidencias/parede-inteira-inicial/runtime.json',
             'evidencias/parede-inteira-inicial/webgpu-canto-inteiras.png',
             'evidencias/parede-inteira-inicial/webgpu-meio-inteiras.png',
             'evidencias/demo-disponibilidade/runtime.json','evidencias/demo-disponibilidade/distribuicao.json',
             'evidencias/demo-disponibilidade/webgpu-False-estacionamento.png',
             'evidencias/demo-disponibilidade/webgpu-False-lazer.png',
             'evidencias/demo-disponibilidade/auto-True-estacionamento.png',
             'evidencias/demo-disponibilidade/painel-136-ocupados-34-disponiveis.png',
             'evidencias/ficha-sem-blocos-comercial/runtime.json',
             'evidencias/ficha-sem-blocos-vinculos/runtime.json',
             'evidencias/disponibilidade-filtro/runtime.json',
             'evidencias/disponibilidade-filtro/webgpu-False-disponiveis-demonstracao.png',
             'evidencias/disponibilidade-filtro/webgl-False-disponiveis-demonstracao.png',
             'evidencias/disponibilidade-filtro/auto-True-disponiveis-demonstracao.png',
             'evidencias/estoque-admin/runtime.json','evidencias/estoque-admin/ficha-publica-desktop.png',
             'evidencias/estoque-admin/ficha-publica-toque.png','evidencias/estoque-admin/painel-estoque-desktop.png',
             'evidencias/mapa-sem-preenchimento/runtime.json','evidencias/mapa-sem-preenchimento/depois.png',
             'evidencias/rede-memoria-gzip-final/medicao.json','evidencias/ambiencia-conferida/runtime.json',
             'evidencias/vinculos-conferidos/runtime.json','evidencias/comercial-apos-vinculos/runtime.json',
             'evidencias/diagnostico-aparelho-final/runtime.json']
    for backend in ['webgpu-False','webgl-False','auto-True']:
        for light in ['dia','entardecer']:
            names.append(f'evidencias/ambiencia-conferida/{backend}-perspectiva-{light}.png')
    files={}
    for name in names:
        path=root/local_path(name)
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError('Evidência fora da origem.')
        files[name]=identity(path.read_bytes())
    return dict(sorted(files.items()))


def verify(folder: Path, expected, manifest=False):
    found = {}
    for path in folder.rglob("*"):
        if path.is_symlink():
            raise ValueError("Entrega contém link simbólico.")
        if path.is_file() and not (manifest and path.relative_to(folder).as_posix() == "entrega-manifest.json"):
            found[path.relative_to(folder).as_posix()] = identity(path.read_bytes())
    if found != expected:
        raise ValueError("Conteúdo da entrega divergente; destino preservado.")


LANDING = '''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>LIV Ipanema — avaliação</title><style>body{font:16px/1.6 system-ui;background:#0c1219;color:#e6edf1;max-width:720px;margin:48px auto;padding:20px}a{display:block;padding:14px;margin:12px 0;border:1px solid #3a4b5d;border-radius:10px;color:#96e2bc}p{color:#acbac7}</style><h1>LIV Ipanema</h1><p>Versão de avaliação. As 170 posições seguem a repetição do modelo; plantas por final, gardens e dados comerciais aguardam confirmação.</p><a href="maquete-liv-ipanema.html?geometria=entrada&amp;unidades=edificio">Explorar o edifício e as duas plantas</a><a href="diagnostico.html">Registrar teste de caminhada no aparelho</a><a href="materiais.html">Conferir materiais de um modelo GLB/GLTF</a><a href="site-baseline/maquete-liv-ipanema.html">Abrir a base preservada</a></html>'''.encode()


def build(name="liv-avaliacao", root=ROOT):
    if not re.fullmatch(r"liv-[a-z0-9-]{1,60}", name):
        raise ValueError("Use um nome liv-* com letras minúsculas, números e hífens.")
    release_root = root.resolve() / "entregas"
    if release_root.is_symlink():
        raise ValueError("A pasta de entregas não pode ser um link.")
    release_root.mkdir(exist_ok=True)
    target = release_root / name
    if target.is_symlink() or target.resolve().parent != release_root:
        raise ValueError("Destino fora da pasta de entregas.")
    files = inventory(root)
    review = review_inventory(root)
    files["index.html"] = identity(LANDING)
    firebase={"hosting":{"site":"imobilaria-deccb-miniaturas","public":"site","ignore":["**/.*"],
              "headers":[{"source":"**","headers":[{"key":"Cache-Control","value":"no-cache"},
              {"key":"X-Content-Type-Options","value":"nosniff"}]}]}}
    configs={'firebase.json':(json.dumps(firebase,indent=2)+'\n').encode(),
             '.firebaserc':(json.dumps({'projects':{'default':'imobilaria-deccb'}},indent=2)+'\n').encode()}
    config_records={name:identity(data) for name,data in configs.items()}
    canonical = json.dumps({"site":files,"review":review,"config":config_records}, sort_keys=True, separators=(",", ":")).encode()
    fingerprint = hashlib.sha256(canonical).hexdigest()
    result = {"schema": "liv-release-v1", "version": fingerprint, "profile": "avaliacao-local",
              "published": False, "physicalMobileQualified": False,
              "commercialStatus": json.loads((root / "comercial.json").read_bytes())["status"],
              "relationStatus": json.loads((root / "vinculos.json").read_bytes())["status"],
              "commercialProvider": {"kind":"firebase-opt-in", "configuredPropertyId":json.loads((root/"estoque-config.json").read_bytes()).get("propertyId"),
                                     "adminBuildValidated":True, "productionActivated":False, "realInventoryRegistered":False},
              "sunset": "ilustrativo-com-bake-diurno", "recipeSHA256":identity(Path(__file__).read_bytes())["sha256"],
              "pending": ["Android/iPhone físicos", "vínculo e espelhamento por final",
                          "medidas executivas/gardens", "tabela comercial confirmada"],
              "files": files, "reviewFiles":review, "configFiles":config_records,"fileCount": len(files),
              "totalBytes": sum(r["bytes"] for r in files.values()), "reviewBytes":sum(r["bytes"] for r in review.values())}
    try:
        result["sourceGitCommit"] = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        result["sourceGitCommit"] = None
    if target.exists():
        verify(target / "site", files,manifest=True)
        verify(target / "revisao", review)
        if {p.name for p in target.iterdir()}!={'site','revisao','firebase.json','.firebaserc','LEIA-ME.txt'}:
            raise ValueError('Entrega contém arquivos de configuração inesperados.')
        for name,record in config_records.items():
            path=target/name
            if path.is_symlink() or identity(path.read_bytes())!=record:raise ValueError('Configuração da entrega divergente.')
        prior = json.loads((target / "site/entrega-manifest.json").read_bytes())
        if {k:v for k,v in prior.items() if k!="sourceGitCommit"} != {k:v for k,v in result.items() if k!="sourceGitCommit"}:
            raise ValueError("Entrega existente tem outra versão; use um nome novo.")
        return {"directory": str(target), "version": fingerprint, "reused": True, "published": False}
    # Stage is a verified child of the explicitly named release folder. Only its
    # known temporary tree is removed by TemporaryDirectory on a failed build.
    with tempfile.TemporaryDirectory(prefix=".liv-entrega-", dir=release_root) as temporary:
        staging = Path(temporary).resolve()
        if staging.parent != release_root or not staging.name.startswith(".liv-entrega-"):
            raise ValueError("Staging fora da pasta prevista.")
        package = staging / name
        site = package / "site"
        site.mkdir(parents=True)
        for path, record in files.items():
            destination = site / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            if path == "index.html":
                destination.write_bytes(LANDING)
            else:
                shutil.copyfile(root / path, destination)
            if identity(destination.read_bytes()) != record:
                raise ValueError(f"Fonte mudou durante a cópia: {path}")
        verify(site, files)
        review_folder=package/'revisao';review_folder.mkdir()
        for path,record in review.items():
            destination=review_folder/path;destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(root/path,destination)
            if identity(destination.read_bytes())!=record:raise ValueError(f'Evidência mudou durante a cópia: {path}')
        verify(review_folder,review)
        (site / "entrega-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        for path,data in configs.items():(package/path).write_bytes(data)
        # The JSON manifest pins actual bytes, including local edits. A Git HEAD
        # alone is deliberately not presented as the package's content identity.
        (package / "LEIA-ME.txt").write_text("LIV Ipanema — pacote de avaliação, sem publicação.\n"
            "Servir site/ por HTTP; index.html abre a entrada completa.\n"
            "HTTPS é necessário para WebGPU e Service Worker fora do localhost.\n"
            "Diagnóstico físico: abrir diagnostico.html, declarar aparelho e executar as duas caminhadas.\n"
            "Recuperação: servir site/site-baseline/; conteúdo conferido pelo inventário preservado.\n"
            "firebase.json está preparado para um preview separado; nenhum projeto/channel foi publicado.\n"
            "Estoque ao vivo: ver revisao/ESTOQUE.md; publicar também regras e painel e vincular o ID real antes de ativar.\n"
            f"Versão SHA-256 do conjunto: {fingerprint}\n", encoding="utf8")
        package.rename(target)
    return {"directory": str(target), "version": fingerprint, "files": len(files), "reviewFiles":len(review),
            "bytes": result["totalBytes"], "reviewBytes":result["reviewBytes"], "reused": False, "published": False}


def archive(result):
    target=Path(result['directory']).resolve();release_root=target.parent
    if target.is_symlink() or release_root.name!='entregas' or not target.name.startswith('liv-'):
        raise ValueError('Origem do ZIP fora da entrega prevista.')
    manifest=json.loads((target/'site/entrega-manifest.json').read_bytes())
    expected={*(f'site/{name}' for name in manifest['files']),*(f'revisao/{name}' for name in manifest['reviewFiles']),
              *manifest['configFiles'],'site/entrega-manifest.json','LEIA-ME.txt'}
    files={}
    for path in target.rglob('*'):
        if path.is_symlink():raise ValueError('ZIP não aceita links.')
        if path.is_file():files[local_path(path.relative_to(target).as_posix())]=identity(path.read_bytes())
    if set(files)!=expected:raise ValueError('ZIP contém arquivos fora da lista de entrega.')
    destination=release_root/f'{target.name}-{result["version"][:12]}.zip'
    if destination.is_symlink() or destination.resolve().parent!=release_root:raise ValueError('Destino do ZIP inválido.')

    def check(path):
        with zipfile.ZipFile(path) as source:
            if source.namelist()!=sorted(files):raise ValueError('ZIP existente contém outro conjunto de arquivos.')
            for name,record in files.items():
                if identity(source.read(name))!=record:raise ValueError('ZIP existente tem conteúdo divergente.')

    if destination.exists():check(destination)
    else:
        fd,temporary=tempfile.mkstemp(prefix='.liv-zip-',suffix='.tmp',dir=release_root)
        import os
        os.close(fd);staging=Path(temporary).resolve()
        if staging.parent!=release_root or not staging.name.startswith('.liv-zip-'):raise ValueError('Staging do ZIP fora do destino.')
        try:
            with zipfile.ZipFile(staging,'w') as output:
                for name in sorted(files):
                    info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.external_attr=0o100644<<16
                    output.writestr(info,(target/name).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
            check(staging);staging.rename(destination)
        finally:
            if staging.exists():staging.unlink()
    return {'path':str(destination),**identity(destination.read_bytes())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nome", default="liv-avaliacao")
    parser.add_argument('--zip',action='store_true',help='Também gerar ZIP conferido, com metadados determinísticos.')
    arguments = parser.parse_args()
    result=build(arguments.nome)
    if arguments.zip:result['archive']=archive(result)
    print(json.dumps(result, ensure_ascii=False, indent=2))

"""Congela o capturador e prepara cinco sessões físicas M1.1-A, ainda não iniciadas."""
import argparse
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
FICHA = RAIZ / "tasks/miniaturas/m1-1a/ficha-template.json"
MODELO = tuple("painel/src/components/construtor-planta/" + nome for nome in
               ("modelo.ts", "editorDocument.ts", "catalogoMoveis.ts"))
# Mesma barreira de publicação do job painel em .github/workflows/ci.yml.
PROIBIDOS = (b"exemplo", b"semear", b"@teste.dev", b"demo-painel", b"emulador",
             b"127.0.0.1", b"localhost:", b"private_key", b"BEGIN PRIVATE KEY",
             b"client_email", b"firebase-adminsdk", b"service_account", b"service-account")


def hash_arquivo(path):
    dado = path.read_bytes()
    return {"bytes": len(dado), "sha256": hashlib.sha256(dado).hexdigest()}


def link(path):
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def escrever_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def conferir_template(ficha):
    def vazio(value):
        if isinstance(value, dict):
            return all(vazio(child) for child in value.values())
        return value is None or value == []
    metadata = {"schemaVersion", "caso", "baselineCommit", "rodada", "status", "physicalAccepted"}
    if (ficha.get("schemaVersion") != 1 or ficha.get("status") != "nao-iniciada"
            or ficha.get("physicalAccepted") is not False
            or any(ficha.get(key) is not None for key in ("caso", "baselineCommit", "rodada"))
            or not all(vazio(value) for key, value in ficha.items() if key not in metadata)):
        raise ValueError("O template deve começar sem dados observados, sessão ou aceite físico.")


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args]).decode("utf-8").strip()


def conferir_fonte(root, baseline):
    commit = git(root, "rev-parse", baseline + "^{commit}")
    if git(root, "rev-parse", "HEAD") != commit:
        raise ValueError("O checkout de build não está na baseline indicada.")
    if git(root, "status", "--porcelain", "--untracked-files=all", "--", "painel"):
        raise ValueError("Há alterações no painel do checkout de build.")
    for env in (root / "painel").glob(".env*"):
        if env.name not in (".env.production", ".env.development"):
            raise ValueError("Remova configurações locais do checkout de build: " + env.name)
    entradas = git(root, "ls-files", "painel").splitlines()
    fontes = {}
    for relativo in entradas:
        path = root / relativo
        if link(path) or not path.is_file():
            raise ValueError("Fonte ausente ou simbólica: " + relativo)
        fontes[relativo] = hash_arquivo(path)
    for relativo in MODELO:
        # Os helpers do avaliador precisam corresponder ao editor congelado. EOL
        # é normalizado só nesta comparação de fonte, nunca nos downloads.
        source = (root / relativo).read_bytes().replace(b"\r\n", b"\n")
        atual = (RAIZ / relativo).read_bytes().replace(b"\r\n", b"\n")
        if source != atual:
            raise ValueError("O modelo do avaliador difere da baseline: " + relativo)
    return commit, fontes


def build(root, log):
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise ValueError("npm não encontrado. Instale as dependências do painel com npm ci.")
    # O Next carrega a configuração de produção versionada; nenhuma variável pública
    # herdada pode trocar silenciosamente a baseline para emulador/API de desenvolvimento.
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("NEXT_PUBLIC_")}
    env.update(CI="1", NODE_ENV="production", NEXT_TELEMETRY_DISABLED="1")
    try:
        with log.open("wb") as stream:
            # Tailwind/PostCSS/TypeScript são dependências de build, mesmo em produção.
            for args in (("ci", "--include=dev", "--no-audit", "--no-fund"), ("run", "build")):
                subprocess.run([npm, *args], cwd=root / "painel", env=env,
                               stdout=stream, stderr=subprocess.STDOUT, check=True)
    except subprocess.CalledProcessError as exc:
        linhas = log.read_text(encoding="utf-8", errors="replace").splitlines()
        final = "\n".join(linhas[-40:])
        raise ValueError("Instalação/build falhou (exit %d):\n%s" % (exc.returncode, final)) from exc


def arquivos(pasta):
    if link(pasta) or not pasta.is_dir():
        raise ValueError("Pasta ausente ou simbólica: " + str(pasta))
    result = []
    for path in sorted(pasta.rglob("*")):
        if link(path):
            raise ValueError("Link simbólico não permitido: " + str(path))
        if path.is_file():
            result.append(path)
    return result


def copiar_site(out, site):
    arquivos(out)  # Não seguir links, inclusive nos diretórios intermediários.
    for nome in ("capturador.html", "capturador.txt"):
        path = out / nome
        if not path.is_file():
            raise ValueError("Build estático incompleto: " + nome)
        shutil.copy2(path, site / nome)
    for nome in ("capturador", "_next/static"):
        source = out / nome
        if not arquivos(source):
            raise ValueError("Build estático incompleto: " + nome)
        shutil.copytree(source, site / nome)
    for path in arquivos(site):
        name = path.name.lower()
        if "exemplo" in name or "seed" in name or name.endswith(".map") or name.startswith(".env"):
            raise ValueError("Arquivo de desenvolvimento no site: " + name)
        dado = path.read_bytes()
        for proibido in PROIBIDOS:
            if proibido in dado:
                raise ValueError("Padrão proibido no site: " + proibido.decode() + " em " + str(path.relative_to(site)))


def preparar(root, baseline, destino):
    destino = Path(destino).absolute()
    if destino.exists() or link(destino):
        raise ValueError("O destino já existe; use uma pasta nova.")
    # Evita colocar o pacote dentro do próprio build ou sob um link para outro lugar.
    if any(link(parent) for parent in (destino, *destino.parents)):
        raise ValueError("O destino não pode usar links simbólicos.")
    destino = destino.resolve()
    root = Path(root).resolve()
    if destino.is_relative_to(root / "painel") or destino.is_relative_to(RAIZ / "painel"):
        raise ValueError("O destino precisa ficar fora do painel.")
    commit, fontes = conferir_fonte(root, baseline)
    ficha = json.loads(FICHA.read_text(encoding="utf-8"))
    conferir_template(ficha)
    destino.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix=".preparo-m1-1a-", dir=destino.parent))
    try:
        build(root, temp / "build.log")
        commit_depois, fontes_depois = conferir_fonte(root, commit)
        if commit_depois != commit or fontes_depois != fontes:
            raise ValueError("A fonte mudou durante o build; rodada recusada.")
        site = temp / "site"
        site.mkdir()
        copiar_site(root / "painel/out", site)
        for i in range(1, 6):
            caso = "C" + str(i)
            pasta = temp / caso
            pasta.mkdir()
            value = {**ficha, "caso": caso, "baselineCommit": commit, "rodada": destino.name}
            escrever_json(pasta / "ficha.json", value)
        manifesto = {
            "schemaVersion": 1, "rodada": destino.name,
            "criadoEm": datetime.now(timezone.utc).isoformat(),
            "baselineCommit": commit, "physicalAccepted": False,
            "sessoesPreparadas": ["C1", "C2", "C3", "C4", "C5"], "sessoesRealizadas": 0,
            "runtime": {"python": sys.version.split()[0],
                        "node": subprocess.check_output(["node", "--version"]).decode().strip(),
                        "jsonschema": version("jsonschema")},
            "fontesBuild": fontes,
            "ferramentas": {str(path.relative_to(RAIZ)).replace("\\", "/"): hash_arquivo(path)
                            for path in (Path(__file__), FICHA, RAIZ / "tasks/miniaturas/m1-1a-usabilidade-mobile.md",
                                         RAIZ / "tools/avaliar_projeto_capturado.mjs",
                                         RAIZ / "tools/servir_lan.py")},
            "fontesAvaliacao": {relativo: hash_arquivo(RAIZ / relativo) for relativo in
                                git(RAIZ, "ls-files", "pipeline", "schemas", "v1.5/renderizador-v16-moveis",
                                    "v1.5/miniaturas/pagina_maquete.py", "v1.5/miniaturas/*.js",
                                    "moveis/moveis_lib.json", "tools/sonda-maquete.mjs",
                                    "painel/src/components/construtor-planta/modelo.ts",
                                    "painel/src/components/construtor-planta/editorDocument.ts",
                                    "painel/src/components/construtor-planta/catalogoMoveis.ts").splitlines()},
            "site": {path.relative_to(site).as_posix(): hash_arquivo(path) for path in arquivos(site)},
            "observacao": "Pacote de preparação. Testes locais não comprovam sessões físicas.",
        }
        escrever_json(temp / "manifesto.json", manifesto)
        (temp / "README.md").write_text(
            "# Rodada M1.1-A: " + destino.name + "\n\n"
            "Baseline: `" + commit + "`. Cinco fichas **não iniciadas**, 0/5 sessões.\n\n"
            "1. Leia `tasks/miniaturas/m1-1a-usabilidade-mobile.md` na raiz do projeto.\n"
            "2. Confira: `python tools/preparar_sessoes_m1_1a.py --verificar \"" + str(destino) + "\"`.\n"
            "3. Sirva SOMENTE o site: `python tools/servir_lan.py \"" + str(destino / "site") + "\"`.\n"
            "4. No celular, abra `https://<ip-do-pc>:8813/capturador`; faça o preflight físico.\n"
            "5. Registre os dados observados em C1/ficha.json até C5/ficha.json.\n\n"
            "Guarde fontes, downloads e capturas dentro do caso. Nunca sirva a rodada inteira.\n"
            "Para cada avaliação, use uma subpasta nova; preserve o download original.\n"
            "M1.1 continua pendente até a homologação física documentada.\n", encoding="utf-8")
        if destino.exists() or link(destino):
            raise ValueError("O destino foi ocupado durante o preparo; nenhum conteúdo foi substituído.")
        temp.rename(destino)
    finally:
        if temp.exists() and temp.resolve().parent == destino.parent.resolve():
            shutil.rmtree(temp)
    verificar(destino)
    return manifesto


def verificar(rodada):
    rodada = Path(rodada).absolute()
    if any(link(parent) for parent in (rodada, *rodada.parents)):
        raise ValueError("A rodada não pode usar links simbólicos.")
    manifesto = json.loads((rodada / "manifesto.json").read_text(encoding="utf-8"))
    site = rodada / "site"
    atual = {path.relative_to(site).as_posix(): hash_arquivo(path) for path in arquivos(site)}
    if not atual or atual != manifesto["site"]:
        raise ValueError("O site difere do manifesto: arquivo ausente, extra ou alterado.")
    if manifesto["sessoesPreparadas"] != ["C1", "C2", "C3", "C4", "C5"]:
        raise ValueError("A rodada deve preparar exatamente C1…C5.")
    if manifesto["physicalAccepted"] is not False or manifesto["sessoesRealizadas"] != 0:
        raise ValueError("O manifesto de preparação não pode declarar homologação.")
    for grupo in ("ferramentas", "fontesAvaliacao"):
        for relativo, identidade in manifesto[grupo].items():
            path = RAIZ / relativo
            if not path.resolve().is_relative_to(RAIZ) or link(path) or hash_arquivo(path) != identidade:
                raise ValueError("Ferramenta/fonte de avaliação mudou: " + relativo)
    # Fichas são editáveis durante a coleta; sua identidade deve acompanhar a baseline.
    for caso in manifesto["sessoesPreparadas"]:
        ficha = json.loads((rodada / caso / "ficha.json").read_text(encoding="utf-8"))
        if ficha["caso"] != caso or ficha["baselineCommit"] != manifesto["baselineCommit"] or ficha["rodada"] != manifesto["rodada"]:
            raise ValueError("Ficha de outra rodada/baseline: " + caso)
    return manifesto


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-root", help="checkout limpo da baseline, com dependências do painel instaladas")
    parser.add_argument("--baseline", help="commit exato do capturador")
    parser.add_argument("--destino", help="pasta nova para site, manifesto e cinco fichas")
    parser.add_argument("--verificar", help="confere uma rodada existente sem iniciar sessões")
    args = parser.parse_args(argv)
    if args.verificar and any((args.build_root, args.baseline, args.destino)):
        parser.error("--verificar não pode ser combinado com preparo")
    if not args.verificar and not all((args.build_root, args.baseline, args.destino)):
        parser.error("preparo exige --build-root, --baseline e --destino")
    try:
        r = verificar(args.verificar) if args.verificar else preparar(args.build_root, args.baseline, args.destino)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        sys.stderr.write("Preparação recusada: " + str(exc) + "\n")
        return 2
    print("Site conferido: %d arquivos; baseline %s; homologação física pendente."
          % (len(r["site"]), r["baselineCommit"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

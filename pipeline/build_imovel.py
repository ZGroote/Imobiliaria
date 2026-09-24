# -*- coding: utf-8 -*-
"""Build imutavel de um imovel: tour + maquete numa pasta com o hash do conteudo.

    python pipeline/build_imovel.py monte-dos-cedros-37

Sai em `publicacao/builds/<imovel>/<build>/` (tour.html, maquete.html, manifest.json),
com `<build> = sha256(tour.html + maquete.html)[:12]`. O ID e o conteudo: sem data,
sem caminho, sem commit. Ponteiro mutavel nao mora aqui -- isso e o promover/reverter
(B4) -- e nada do Firebase entra.

O build nasce numa pasta temporaria ao lado e so no fim ganha o nome. Pasta existente
nunca e sobrescrita: o mesmo conteudo reaproveita o build que ja esta la, e o mesmo ID
com bytes diferentes aborta.

A ultima linha do stdout e um JSON com o resultado; o progresso vai pro stderr.
"""
import argparse
import contextlib
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import runpy
import shutil
import subprocess
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline import imovel  # noqa: E402
from pipeline.build.config import resolve  # noqa: E402
from pipeline.build.manifest import entradas, snapshot  # noqa: E402

PILOTO = RAIZ / 'tasks/v1.0/piloto.json'
TERRENOS = RAIZ / 'exteriores/v1/terrenos-manifesto.json'
MAQUETE = RAIZ / 'v1.5/miniaturas/pagina_maquete.py'
PADRAO_CEDROS = RAIZ / 'v1.5/miniaturas/padrao_atual.py'
BUILDS = RAIZ / 'publicacao/builds'
SITE = 'https://imobilaria-deccb-imoveis.web.app'
# "Navegar pelo mapa" vai pro ponteiro estavel do mapa (B1), nunca pra um mapa versionado.
MAPA = 'https://imobilaria-deccb.web.app/'
ARQUIVOS = ('tour.html', 'maquete.html')


def build_id(tour, maquete):
    return hashlib.sha256(tour + maquete).hexdigest()[:12]


def prefixo_publico(prefixo):
    """`./quintais/<hash>/` (relativo a pagina do mapa) -> `/quintais/<hash>/` (raiz do site).

    O tour do build e servido longe dos tiles; com o prefixo relativo ele buscaria
    `/imovel/quintais/...`. Absoluto, `..`, drive ou URL no manifesto dos terrenos e
    dado errado, nao caso a acomodar."""
    p = PurePosixPath(prefixo.replace('\\', '/'))
    if p.is_absolute() or ':' in prefixo or '..' in p.parts or not p.parts:
        raise ValueError('prefixo de tiles deve ser relativo e interno ao mapa: %r' % prefixo)
    return '/' + '/'.join(p.parts) + '/'


def fontes_da_maquete(imovel_id):
    """O que o pagina_maquete.py le. No Cedros ele entrega a pagina inteira ao
    padrao_atual.py, e as fontes passam a ser os arquivos do `padrao-atual/`."""
    fontes = [MAQUETE]
    padrao = runpy.run_path(str(PADRAO_CEDROS))
    if imovel_id == padrao['UID']:
        fontes += [PADRAO_CEDROS] + [padrao['SOURCE'] / p
                                     for p in padrao['source_manifest']()['sources']]
    # ponytail: nas outras unidades o pagina_maquete.py tambem le v1.5/miniaturas/*.js
    # e o modelo.json do Blender, que ficam de fora; incluir quando o build passar do Cedros.
    return fontes


def _arquivo(p):
    dado = p.read_bytes()
    return {'bytes': len(dado), 'sha256': hashlib.sha256(dado).hexdigest()}


def _commit():
    try:
        return subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=str(RAIZ), check=True,
                              capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def construir(imovel_id, builds=BUILDS):
    piloto = json.loads(PILOTO.read_text(encoding='utf-8'))
    config = resolve(piloto['cidade'], piloto['variante'])
    achadas = imovel._unidades(config.cidade(), {imovel_id})
    if not achadas:
        raise ValueError('imovel inexistente ou sem lote/planta: ' + imovel_id)
    tiles = prefixo_publico(json.loads(TERRENOS.read_text(encoding='utf-8'))['prefix'])

    fontes = entradas(config) + [PILOTO, TERRENOS, Path(__file__).resolve(),
                                 RAIZ / 'pipeline/imovel.py', RAIZ / 'pipeline/recorte.py']
    fontes += fontes_da_maquete(imovel_id)
    antes = snapshot(fontes)
    pasta = builds / imovel_id
    pasta.mkdir(parents=True, exist_ok=True)
    trabalho = Path(tempfile.mkdtemp(prefix='.build-', dir=pasta))
    try:
        gerado, _, _ = imovel.gera(
            config, achadas[0], piloto['raio_entorno_m'], str(trabalho), MAPA,
            maquete_href='maquete.html', prefixo_tiles=tiles,
            url=SITE + '/imovel/' + imovel_id,
            # sem a hora que o montador poria: e ela que mudaria o ID a cada minuto
            carimbo='%s / %s / %s' % (config.slug, config.versao, imovel_id))
        Path(gerado).rename(trabalho / 'tour.html')
        subprocess.run([sys.executable, str(MAQUETE), '--cidade', piloto['cidade'],
                        '--unidade', imovel_id, '--saida', str(trabalho / 'maquete.html'),
                        '--mapa', 'tour.html'],
                       check=True, cwd=str(RAIZ), stdout=sys.stderr)
        if snapshot(fontes) != antes:
            raise ValueError('uma fonte mudou durante a montagem; repita com fontes estaveis')

        build = build_id(*((trabalho / n).read_bytes() for n in ARQUIVOS))
        alvo = pasta / build
        resultado = {'imovel': imovel_id, 'build': build, 'reutilizado': alvo.exists(),
                     'pasta': (alvo.relative_to(RAIZ).as_posix() if alvo.is_relative_to(RAIZ)
                               else str(alvo))}
        if alvo.exists():
            for n in ARQUIVOS:
                if not (alvo / n).is_file() or (alvo / n).read_bytes() != (trabalho / n).read_bytes():
                    raise ValueError('build %s ja existe com outro %s: colisao ou pasta '
                                     'alterada fora do build' % (build, n))
            shutil.rmtree(trabalho)
            return resultado

        manifesto = {
            'schema': 1,
            'imovel': imovel_id,
            'build': build,
            'gerado_em': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'commit': _commit(),
            'fontes': {Path(k).relative_to(RAIZ).as_posix(): v for k, v in antes.items()},
            'arquivos': {n: _arquivo(trabalho / n) for n in ARQUIVOS},
            'tiles': tiles,
            'publico': {'tour': '/imovel/' + imovel_id, 'maquete': '/maquete/' + imovel_id},
        }
        (trabalho / 'manifest.json').write_text(
            json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        trabalho.rename(alvo)       # no Windows falha se o destino existir: nunca sobrescreve
    except Exception:
        if trabalho.exists():
            print('build incompleto preservado para diagnostico em:', trabalho, file=sys.stderr)
        raise
    return resultado


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('imovel', help='id do cadastro, ex.: monte-dos-cedros-37')
    args = parser.parse_args(argv)
    try:
        # Cadastro, montador e recorte imprimem progresso no stdout, que e so da linha final.
        with contextlib.redirect_stdout(sys.stderr):
            resultado = construir(args.imovel)
    except ValueError as exc:
        parser.exit(1, str(exc) + '\n')
    print(json.dumps(resultado, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

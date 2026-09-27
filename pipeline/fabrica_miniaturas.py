# -*- coding: utf-8 -*-
"""M1 da fábrica de miniaturas: orquestra o caminho atual e grava um relatório.

    python pipeline/fabrica_miniaturas.py monte-dos-cedros-37

Não publica e não recalcula bake. O objetivo deste primeiro runner é tornar explícitos
estado, duração, identidade e bloqueios usando os geradores que já existem. O relatório
padrão fica em publicacao/fabrica/<imovel>/report.json (publicacao/ já é ignorado).
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import runpy
import sys
import time

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline import build_imovel, imovel  # noqa: E402
from pipeline.build.config import resolve  # noqa: E402
from pipeline.build.manifest import entradas, snapshot  # noqa: E402

SCHEMA = 1
JOB_VERSION = 1


class Bloqueado(Exception):
    def __init__(self, codigo, mensagem):
        super().__init__(mensagem)
        self.codigo = codigo


def _agora():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def _digest(valor):
    bruto = json.dumps(valor, ensure_ascii=False, sort_keys=True,
                       separators=(',', ':'), default=str).encode('utf-8')
    return hashlib.sha256(bruto).hexdigest()


def _relativo(path):
    p = Path(path).resolve()
    try:
        return p.relative_to(RAIZ).as_posix()
    except ValueError:
        return str(p)


def validar_entrada(imovel_id):
    """Confirma que o imóvel atual pode entrar no caminho de geração existente."""
    if imovel_id in build_imovel.NAO_PUBLICAR:
        raise Bloqueado('ORIGIN_UNCONFIRMED', build_imovel.NAO_PUBLICAR[imovel_id])
    piloto = json.loads(build_imovel.PILOTO.read_text(encoding='utf-8'))
    config = resolve(piloto['cidade'], piloto['variante'])
    unidades = imovel._unidades(config.cidade(), {imovel_id})
    if not unidades:
        raise Bloqueado('INPUT_MISSING',
                         'imóvel inexistente ou sem lote/localização/planta: ' + imovel_id)
    u = unidades[0]
    planta = u.get('planta') or {}
    return {
        'cidade': config.slug,
        'variante': config.versao,
        'unidade': str(u.get('id')),
        'comodos': len(planta.get('comodos') or []),
        'moveis': len(planta.get('moveis') or []),
    }


def resolver_fontes(imovel_id):
    """Snapshot compacto das fontes que determinam o caminho atual."""
    piloto = json.loads(build_imovel.PILOTO.read_text(encoding='utf-8'))
    config = resolve(piloto['cidade'], piloto['variante'])
    base = list(entradas(config))
    base += [build_imovel.PILOTO, build_imovel.TERRENOS,
             Path(build_imovel.__file__).resolve(),
             RAIZ / 'pipeline' / 'imovel.py',
             RAIZ / 'pipeline' / 'recorte.py']
    mini = [Path(p) for p in build_imovel.fontes_da_maquete(imovel_id)]
    faltam_mini = [_relativo(p) for p in mini if not p.is_file()]
    if faltam_mini:
        raise Bloqueado('INPUT_MISSING',
                         'fontes obrigatórias da maquete ausentes: ' + ', '.join(faltam_mini))
    paths = sorted(set(Path(p) for p in base + mini), key=lambda p: str(p))
    snap = snapshot(paths)
    normal = {_relativo(k): v for k, v in snap.items()}
    return {
        'fontes': len(normal),
        'presentes': sum(v is not None for v in normal.values()),
        'ausentes_opcionais': sorted(k for k, v in normal.items() if v is None),
        'sha256': _digest(normal),
        'caminhos': sorted(normal),
        'fontes_maquete': sorted(_relativo(p) for p in mini),
    }


def verificar_maquete(imovel_id):
    """Verifica o perfil atual sem recalcular geometria, UV ou bake."""
    padrao = runpy.run_path(str(build_imovel.PADRAO_CEDROS))
    if imovel_id == padrao['UID']:
        manifest = padrao['source_manifest']()
        return {
            'perfil': 'premium-atual',
            'standard': manifest['standard'],
            'release': manifest['release'],
            'fontes': len(manifest['sources']),
            'sha256': _digest(manifest['sources']),
            'bake_recalculado': False,
        }
    fontes = [Path(p) for p in build_imovel.fontes_da_maquete(imovel_id)]
    return {
        'perfil': 'leve-atual',
        'fontes': len(fontes),
        'sha256': _digest({_relativo(p): hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in fontes}),
        'bake_recalculado': False,
    }


def construir(imovel_id, builds):
    """Chama o build imutável já existente; nenhum preview é montado."""
    return build_imovel.construir(imovel_id, builds=Path(builds))


def verificar_build(imovel_id, build, builds):
    """Confere bytes, manifest e identidade do build retornado."""
    pasta = Path(builds) / imovel_id / build['build']
    manifest_path = pasta / 'manifest.json'
    if not manifest_path.is_file():
        raise ValueError('build sem manifest.json: ' + str(pasta))
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest.get('imovel') != imovel_id or manifest.get('build') != build['build']:
        raise ValueError('manifest não identifica o build retornado')
    dados = {}
    bytes_build = []
    for nome in build_imovel.ARQUIVOS:
        path = pasta / nome
        raw = path.read_bytes()
        bytes_build.append(raw)
        atual = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        esperado = (manifest.get('arquivos') or {}).get(nome)
        if atual != esperado:
            raise ValueError('%s difere do manifest' % nome)
        dados[nome] = atual
    if build_imovel.build_id(*bytes_build) != build['build']:
        raise ValueError('bytes do build não reproduzem o próprio id')
    return {
        'build': build['build'],
        'reutilizado': bool(build.get('reutilizado')),
        'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(),
        'arquivos': dados,
    }


def _job(relatorio, nome, entrada, funcao, retry_safe=True):
    inicio_wall = _agora()
    inicio = time.perf_counter()
    registro = {
        'jobType': nome,
        'version': JOB_VERSION,
        'status': 'running',
        'startedAt': inicio_wall,
        'inputSha256': _digest(entrada),
        'retrySafe': bool(retry_safe),
        'log': [],
    }
    relatorio['jobs'].append(registro)
    try:
        saida = funcao()
        registro['status'] = 'succeeded'
        registro['output'] = saida
        return True, saida
    except Bloqueado as exc:
        registro['status'] = 'blocked'
        registro['error'] = {'code': exc.codigo, 'message': str(exc)}
        relatorio['status'] = 'blocked'
        return False, None
    except Exception as exc:
        registro['status'] = 'failed'
        registro['error'] = {'type': type(exc).__name__, 'message': str(exc)}
        relatorio['status'] = 'failed'
        return False, None
    finally:
        registro['finishedAt'] = _agora()
        registro['durationMs'] = round((time.perf_counter() - inicio) * 1000, 3)


def _grava(caminho, relatorio):
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    temporario = caminho.with_name('.' + caminho.name + '.tmp')
    temporario.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2) + '\n',
                          encoding='utf-8')
    os.replace(temporario, caminho)


def executar(imovel_id, builds=build_imovel.BUILDS, relatorio_path=None):
    """Executa M1 e devolve sempre o relatório, inclusive em blocked/failed."""
    builds = Path(builds)
    relatorio_path = Path(relatorio_path) if relatorio_path else (
        RAIZ / 'publicacao' / 'fabrica' / imovel_id / 'report.json')
    relatorio = {
        'schema': SCHEMA,
        'property': imovel_id,
        'startedAt': _agora(),
        'status': 'running',
        'jobs': [],
        'preview': {'executed': False},
        'qa': {'browserVisual': 'not_run',
               'reason': 'M1 só verifica identidade/integridade; QA visual continua separado'},
    }

    ok, validacao = _job(relatorio, 'validar_entrada', {'property': imovel_id},
                         lambda: validar_entrada(imovel_id))
    if ok:
        ok, fontes = _job(relatorio, 'resolver_fontes',
                          {'property': imovel_id, 'validation': validacao},
                          lambda: resolver_fontes(imovel_id))
    if ok:
        ok, perfil = _job(relatorio, 'verificar_maquete',
                          {'property': imovel_id, 'sources': fontes['sha256']},
                          lambda: verificar_maquete(imovel_id))
    if ok:
        ok, build = _job(relatorio, 'build_imovel',
                         {'property': imovel_id, 'sources': fontes['sha256'],
                          'profile': perfil['sha256']},
                         lambda: construir(imovel_id, builds))
    if ok:
        ok, conferido = _job(relatorio, 'verificar_build',
                             {'property': imovel_id, 'build': build['build']},
                             lambda: verificar_build(imovel_id, build, builds))
    if ok:
        relatorio['status'] = 'succeeded'
        relatorio['result'] = {
            'build': conferido['build'],
            'reutilizado': conferido['reutilizado'],
            'manifestSha256': conferido['manifest_sha256'],
        }

    relatorio['finishedAt'] = _agora()
    relatorio['report'] = _relativo(relatorio_path)
    _grava(relatorio_path, relatorio)
    return relatorio


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('imovel')
    parser.add_argument('--relatorio', help='caminho do JSON; padrão: publicacao/fabrica/<id>/report.json')
    parser.add_argument('--builds', help='raiz alternativa de builds (útil para prova isolada)')
    args = parser.parse_args(argv)
    relatorio = executar(args.imovel,
                         builds=Path(args.builds) if args.builds else build_imovel.BUILDS,
                         relatorio_path=Path(args.relatorio) if args.relatorio else None)
    for job in relatorio['jobs']:
        print('%-20s %s' % (job['jobType'], job['status']), file=sys.stderr)
    resumo = {'property': args.imovel, 'status': relatorio['status'],
              'report': relatorio['report'], 'preview': False}
    if relatorio.get('result'):
        resumo['build'] = relatorio['result']['build']
        resumo['reutilizado'] = relatorio['result']['reutilizado']
    print(json.dumps(resumo, ensure_ascii=False))
    return {'succeeded': 0, 'blocked': 2}.get(relatorio['status'], 1)


if __name__ == '__main__':
    raise SystemExit(main())

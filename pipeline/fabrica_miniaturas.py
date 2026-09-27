# -*- coding: utf-8 -*-
"""Fábrica local de miniaturas: valida, gera LEVE, verifica e monta o build imutável.

    python pipeline/fabrica_miniaturas.py monte-dos-cedros-37

Não publica e não recalcula bake PREMIUM. O LEVE é gerado em pasta temporária e só
os artefatos determinísticos são promovidos. Relatórios/cache ficam em
publicacao/fabrica/<imovel>/ (publicacao/ já é ignorado).
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import time

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline import build_imovel, fonte_leve, imovel  # noqa: E402
from pipeline.build.config import resolve  # noqa: E402
from pipeline.build.manifest import entradas, snapshot  # noqa: E402

SCHEMA = 1
JOB_VERSION = 2
MINI_ROOT = RAIZ / 'v1.5' / 'miniaturas'
MODELAR_IMOVEL = MINI_ROOT / 'modelar_imovel.py'
BASE_BLENDER = MINI_ROOT / 'blender_maquete_base.py'
BLENDER_ESPERADO = 'Blender 5.2.2'


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


def _arquivo(path):
    path = Path(path)
    raw = path.read_bytes()
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


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


def descrever_leve(imovel_id):
    """Assina fonte normalizada + código que determina os artefatos LEVE."""
    try:
        normal = fonte_leve.normalizar(imovel_id)
    except fonte_leve.FonteLeveErro as exc:
        raise Bloqueado('UNSUPPORTED_CASE', str(exc))

    dispatch = runpy.run_path(str(MODELAR_IMOVEL))
    try:
        profile, generator = dispatch['resolver'](imovel_id)
    except SystemExit as exc:
        raise Bloqueado('UNSUPPORTED_CASE', str(exc))

    codigo = [
        Path(fonte_leve.__file__).resolve(),
        MODELAR_IMOVEL,
        Path(generator).resolve(),
        BASE_BLENDER,
    ]
    assinatura_codigo = {_relativo(p): _arquivo(p)['sha256'] for p in codigo}
    canonical = fonte_leve.canonical(imovel_id)
    entrada = {
        'schema': 1,
        'property': imovel_id,
        'profile': profile,
        'slug': normal['style']['slug'],
        'canonicalSha256': hashlib.sha256(canonical.encode('utf-8')).hexdigest(),
        'code': assinatura_codigo,
    }
    entrada['sha256'] = _digest(entrada)
    return entrada


def _modelo_geravel(imovel_id):
    try:
        desc = descrever_leve(imovel_id)
    except Bloqueado:
        return None
    return MINI_ROOT / (desc['slug'] + '_blender') / 'modelo.json'


def resolver_fontes(imovel_id):
    """Snapshot das entradas; artefatos LEVE geráveis são saídas, não pré-requisitos."""
    piloto = json.loads(build_imovel.PILOTO.read_text(encoding='utf-8'))
    config = resolve(piloto['cidade'], piloto['variante'])
    base = list(entradas(config))
    base += [build_imovel.PILOTO, build_imovel.TERRENOS,
             Path(build_imovel.__file__).resolve(),
             RAIZ / 'pipeline' / 'imovel.py',
             RAIZ / 'pipeline' / 'recorte.py']
    mini = [Path(p) for p in build_imovel.fontes_da_maquete(imovel_id)]
    geravel = _modelo_geravel(imovel_id)
    fontes_geradas = [p for p in mini if geravel is not None and p.resolve() == geravel.resolve()]
    entradas_mini = [p for p in mini if p not in fontes_geradas]
    faltam_mini = [_relativo(p) for p in entradas_mini if not p.is_file()]
    if faltam_mini:
        raise Bloqueado('INPUT_MISSING',
                         'fontes obrigatórias da maquete ausentes: ' + ', '.join(faltam_mini))
    paths = sorted(set(Path(p) for p in base + entradas_mini), key=lambda p: str(p))
    snap = snapshot(paths)
    normal = {_relativo(k): v for k, v in snap.items()}
    return {
        'fontes': len(normal),
        'presentes': sum(v is not None for v in normal.values()),
        'ausentes_opcionais': sorted(k for k, v in normal.items() if v is None),
        'sha256': _digest(normal),
        'caminhos': sorted(normal),
        'fontes_maquete': sorted(_relativo(p) for p in entradas_mini),
        'fontes_geradas': sorted(_relativo(p) for p in fontes_geradas),
    }


def resolver_blender(executavel=None):
    """Localiza Blender 5.2.2; configuração explícita vence autodetecção."""
    explicito = executavel or os.environ.get('BLENDER_EXE')
    candidatos = []
    if explicito:
        candidatos = [Path(explicito)]
    else:
        encontrado = shutil.which('blender')
        if encontrado:
            candidatos.append(Path(encontrado))
        if os.name == 'nt':
            pf86 = Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)'))
            pf = Path(os.environ.get('ProgramFiles', 'C:/Program Files'))
            candidatos += [
                pf86 / 'Steam/steamapps/common/Blender/blender.exe',
                pf / 'Blender Foundation/Blender 5.2/blender.exe',
            ]

    vistos = set()
    for path in candidatos:
        path = Path(path)
        chave = str(path).lower()
        if chave in vistos or not path.is_file():
            continue
        vistos.add(chave)
        proc = subprocess.run([str(path), '--version'], capture_output=True, text=True)
        primeira = ((proc.stdout or '') + '\n' + (proc.stderr or '')).strip().splitlines()
        versao = primeira[0].strip() if primeira else ''
        if proc.returncode != 0:
            continue
        if not versao.startswith(BLENDER_ESPERADO):
            raise Bloqueado('ENVIRONMENT_MISMATCH',
                             'Blender incompatível: %s; esperado %s' %
                             (versao or str(path), BLENDER_ESPERADO))
        return {'path': str(path), 'version': versao}

    if explicito:
        raise Bloqueado('ENVIRONMENT_MISSING',
                         'Blender não encontrado no caminho configurado: ' + str(explicito))
    raise Bloqueado('ENVIRONMENT_MISSING',
                     'Blender 5.2.2 não encontrado; configure BLENDER_EXE uma vez')


def _artefatos_leve(slug, raiz=MINI_ROOT):
    pasta = Path(raiz) / (slug + '_blender')
    return {
        'modelo.json': pasta / 'modelo.json',
        slug + '.glb': pasta / (slug + '.glb'),
        'validacao.json': pasta / 'validacao.json',
    }


def _hashes_existentes(paths):
    if not all(Path(p).is_file() for p in paths.values()):
        return None
    return {nome: _arquivo(path) for nome, path in paths.items()}


def _ler_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return None


def _validar_artefatos_leve(slug, paths):
    faltam = [nome for nome, path in paths.items() if not Path(path).is_file()]
    if faltam:
        raise ValueError('gerador LEVE não produziu: ' + ', '.join(faltam))
    json.loads(Path(paths['modelo.json']).read_text(encoding='utf-8'))
    glb = Path(paths[slug + '.glb']).read_bytes()
    if len(glb) < 12 or glb[:4] != b'glTF':
        raise ValueError('GLB LEVE inválido')
    validacao = json.loads(Path(paths['validacao.json']).read_text(encoding='utf-8'))
    checks = validacao.get('checks') or {}
    if not checks or not all(v is True for v in checks.values()):
        raise ValueError('validacao.json LEVE contém check não aprovado')
    return {nome: _arquivo(path) for nome, path in paths.items()}


def _promocao_segura(destinos, state):
    """Não pisa em edição local que não seja a última saída conhecida da fábrica."""
    dentro_repo = all(Path(p).resolve().is_relative_to(RAIZ) for p in destinos.values())
    if not dentro_repo:
        return
    atuais = _hashes_existentes(destinos)
    if state and atuais == state.get('outputs'):
        return
    relativos = [_relativo(p) for p in destinos.values()]
    proc = subprocess.run(['git', 'status', '--porcelain', '--'] + relativos,
                          cwd=str(RAIZ), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError('não foi possível conferir estado local dos artefatos LEVE')
    if proc.stdout.strip():
        raise Bloqueado('LOCAL_OUTPUT_DIRTY',
                         'artefatos LEVE têm alteração local não reconhecida pela fábrica')


def _promover_artefatos(origens, destinos):
    for nome in origens:
        src, dst = Path(origens[nome]), Path(destinos[nome])
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_name('.' + dst.name + '.fabrica.tmp')
        shutil.copyfile(src, tmp)
        os.replace(tmp, dst)


def gerar_leve(imovel_id, cache_path=None, blender=None, dest_root=MINI_ROOT,
                descricao=None):
    """Gera LEVE isolado, valida e promove apenas artefatos determinísticos."""
    desc = descricao or descrever_leve(imovel_id)
    cache_path = Path(cache_path) if cache_path else (
        RAIZ / 'publicacao' / 'fabrica' / imovel_id / 'leve-state.json')
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    state = _ler_json(cache_path)
    destinos = _artefatos_leve(desc['slug'], dest_root)
    atuais = _hashes_existentes(destinos)

    if (state and state.get('schema') == 1
            and state.get('inputSha256') == desc['sha256']
            and atuais is not None and atuais == state.get('outputs')):
        try:
            conferidos = _validar_artefatos_leve(desc['slug'], destinos)
        except (OSError, ValueError, json.JSONDecodeError):
            conferidos = None
        if conferidos == atuais:
            return {
                'profile': desc['profile'],
                'slug': desc['slug'],
                'cached': True,
                'inputSha256': desc['sha256'],
                'blender': state.get('blender'),
                'outputs': atuais,
            }

    ambiente = resolver_blender(blender)
    with tempfile.TemporaryDirectory(prefix='leve-', dir=str(cache_path.parent)) as tmp:
        env = os.environ.copy()
        env['LEVE_OUTPUT_ROOT'] = tmp
        comando = [
            ambiente['path'], '--background', '--factory-startup',
            '--python-exit-code', '1', '--python', str(MODELAR_IMOVEL),
            '--', imovel_id,
        ]
        proc = subprocess.run(comando, cwd=str(RAIZ), env=env,
                              capture_output=True, text=True)
        if proc.returncode != 0:
            cauda = '\n'.join(((proc.stdout or '') + '\n' + (proc.stderr or '')).splitlines()[-30:])
            raise RuntimeError('Blender falhou ao gerar LEVE:\n' + cauda)

        origens = _artefatos_leve(desc['slug'], Path(tmp))
        gerados = _validar_artefatos_leve(desc['slug'], origens)
        _promocao_segura(destinos, state)
        _promover_artefatos(origens, destinos)
        promovidos = _validar_artefatos_leve(desc['slug'], destinos)
        if promovidos != gerados:
            raise ValueError('artefatos LEVE mudaram durante a promoção')

    novo_state = {
        'schema': 1,
        'property': imovel_id,
        'profile': desc['profile'],
        'slug': desc['slug'],
        'inputSha256': desc['sha256'],
        'blender': ambiente,
        'outputs': promovidos,
    }
    _grava(cache_path, novo_state)
    return {
        'profile': desc['profile'],
        'slug': desc['slug'],
        'cached': False,
        'inputSha256': desc['sha256'],
        'blender': ambiente,
        'outputs': promovidos,
    }


def verificar_maquete(imovel_id):
    """Verifica o perfil que alimentará a montagem final; PREMIUM não é recalculado."""
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
    faltam = [_relativo(p) for p in fontes if not p.is_file()]
    if faltam:
        raise Bloqueado('INPUT_MISSING',
                         'LEVE gerado não atende a montagem: ' + ', '.join(faltam))
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


def executar(imovel_id, builds=build_imovel.BUILDS, relatorio_path=None, blender=None):
    """Executa a fábrica local e devolve relatório inclusive em blocked/failed."""
    builds = Path(builds)
    relatorio_path = Path(relatorio_path) if relatorio_path else (
        RAIZ / 'publicacao' / 'fabrica' / imovel_id / 'report.json')
    cache_leve = relatorio_path.parent / 'leve-state.json'
    relatorio = {
        'schema': SCHEMA,
        'property': imovel_id,
        'startedAt': _agora(),
        'status': 'running',
        'jobs': [],
        'preview': {'executed': False},
        'qa': {'browserVisual': 'not_run',
               'reason': 'QA visual/browser continua separado nesta etapa da fábrica'},
    }

    ok, validacao = _job(relatorio, 'validar_entrada', {'property': imovel_id},
                         lambda: validar_entrada(imovel_id))
    if ok:
        ok, fontes = _job(relatorio, 'resolver_fontes',
                          {'property': imovel_id, 'validation': validacao},
                          lambda: resolver_fontes(imovel_id))
    if ok:
        descricao = descrever_leve(imovel_id)
        ok, leve = _job(relatorio, 'gerar_leve', descricao,
                        lambda: gerar_leve(imovel_id, cache_path=cache_leve,
                                           blender=blender, descricao=descricao))
    if ok:
        ok, perfil = _job(relatorio, 'verificar_maquete',
                          {'property': imovel_id, 'sources': fontes['sha256'],
                           'leve': leve['outputs']},
                          lambda: verificar_maquete(imovel_id))
    if ok:
        ok, build = _job(relatorio, 'build_imovel',
                         {'property': imovel_id, 'sources': fontes['sha256'],
                          'leve': leve['inputSha256'], 'profile': perfil['sha256']},
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
            'leveCached': bool(leve['cached']),
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
    parser.add_argument('--blender', help='Blender 5.2.2; opcional se BLENDER_EXE/autodetecção resolver')
    args = parser.parse_args(argv)
    relatorio = executar(args.imovel,
                         builds=Path(args.builds) if args.builds else build_imovel.BUILDS,
                         relatorio_path=Path(args.relatorio) if args.relatorio else None,
                         blender=args.blender)
    for job in relatorio['jobs']:
        print('%-20s %s' % (job['jobType'], job['status']), file=sys.stderr)
    resumo = {'property': args.imovel, 'status': relatorio['status'],
              'report': relatorio['report'], 'preview': False}
    if relatorio.get('result'):
        resumo['build'] = relatorio['result']['build']
        resumo['reutilizado'] = relatorio['result']['reutilizado']
        resumo['leveCached'] = relatorio['result']['leveCached']
    print(json.dumps(resumo, ensure_ascii=False))
    return {'succeeded': 0, 'blocked': 2}.get(relatorio['status'], 1)


if __name__ == '__main__':
    raise SystemExit(main())

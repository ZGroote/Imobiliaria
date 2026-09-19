"""Monta uma base local do piloto sem alterar a pasta publicada.

    python pipeline/preparar_piloto.py
    python pipeline/preparar_piloto.py --destino <diretorio-novo>

Uma pasta existente nunca e sobrescrita. O manifesto registra o que foi montado;
nao transforma montagem bem-sucedida em aprovacao de QA ou de produto.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from html import escape
import json
from pathlib import Path
import shutil
import sys
import tempfile

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from pipeline import imovel, montar
from pipeline.build.config import resolve
from pipeline.build.html import comprime
from pipeline.build.manifest import entradas, snapshot

PILOTO = RAIZ / 'tasks/v1.0/piloto.json'


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def indice(unidades, versao):
    cards = []
    for u in unidades:
        titulo, descricao = imovel._texto_da_ficha(u)
        url = 'mapa/imovel-' + u['id'] + '.html?imovel=' + u['id'] + '&modo=ficha'
        cards.append('<article><h2>' + escape(titulo) + '</h2><p>' +
                     escape(descricao) + '</p><a href="' + escape(url, quote=True) +
                     '">Abrir imóvel e tour</a></article>')
    return '''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Piloto — Mapa 3D Imobiliário</title>
<style>
body{margin:0;background:#101923;color:#edf2f7;font:16px/1.6 system-ui,sans-serif}
main{max-width:880px;margin:auto;padding:32px 20px}h1{line-height:1.2}
small{color:#c0cbd7}article{background:#1a2836;border:1px solid #344657;
border-radius:16px;padding:24px;margin:20px 0}h2{font-size:22px;margin-top:0}
a{display:inline-block;color:#ffe09b;padding:12px 0;text-underline-offset:4px}
a:focus-visible{outline:2px solid #ffe09b;outline-offset:4px}
</style></head><body><main><small>''' + escape(versao) + ''' · Base local em desenvolvimento</small>
<h1>Conheça o imóvel por dentro</h1>
<p>Três empreendimentos em São Carlos. Visualizações 3D a partir das plantas cadastradas.
Preços sob consulta. Localizações aproximadas, ainda não confirmadas.</p>
''' + '\n'.join(cards) + '''
<p>Esta base ainda não é a versão 1.0 estável. Os quatro modos completos, os previews
de compartilhamento e a validação em celulares estão no plano de desenvolvimento.</p>
</main></body></html>'''


def preparar(destino=None):
    piloto = json.loads(PILOTO.read_text(encoding='utf-8'))
    versao = piloto['versao_desenvolvimento']
    config = resolve(piloto['cidade'], piloto['variante'])
    alvo = Path(destino).resolve() if destino else RAIZ / 'releases' / versao
    if alvo.exists():
        raise ValueError('destino ja existe; use outro --destino: ' + str(alvo))
    unidades = {u['id']: u for u in imovel._unidades(config.cidade(), set(piloto['imoveis']))}
    faltam = set(piloto['imoveis']) - unidades.keys()
    if faltam:
        raise ValueError('unidades ausentes ou sem lote/planta: ' + ', '.join(sorted(faltam)))
    unidades = [unidades[id_] for id_ in piloto['imoveis']]

    # Preflight antes de montar qualquer pagina: estes arquivos sao buscados por HTTP.
    tiles = json.loads((RAIZ / 'exteriores/v1/terrenos-manifesto.json').read_text(encoding='utf-8'))
    prefixo = Path(tiles['prefix'])
    if prefixo.is_absolute() or '..' in prefixo.parts:
        raise ValueError('prefixo de tiles deve ser relativo e interno ao mapa')
    origem_tiles = RAIZ / 'v16-moveis/publicado/mapa' / prefixo
    for key in tiles['keys']:
        if Path(key).name != key or '/' in key or '\\' in key:
            raise ValueError('chave de tile invalida')
        source = origem_tiles / (key + '.bin')
        if not source.is_file() or source.stat().st_size == 0:
            raise ValueError('tile ausente ou vazio: ' + str(source))

    fontes = entradas(config) + [PILOTO, Path(__file__), RAIZ / 'pipeline/imovel.py',
                                RAIZ / 'pipeline/recorte.py']
    hashes_fontes = snapshot(fontes)
    alvo.parent.mkdir(parents=True, exist_ok=True)
    trabalho = Path(tempfile.mkdtemp(prefix='.piloto-', dir=alvo.parent))
    mapa = trabalho / 'mapa'
    mapa.mkdir()
    try:
        completo = comprime(montar.monta(config=config))
        nome_mapa = 'sao-carlos-' + hashlib.sha256(completo.encode('utf-8')).hexdigest()[:12] + '.html'
        (mapa / nome_mapa).write_text(completo, encoding='utf-8')
        for u in unidades:
            pagina, _, _ = imovel.gera(config, u, piloto['raio_entorno_m'], str(mapa), nome_mapa)
            print('tour:', Path(pagina).name)
        (mapa / prefixo).mkdir(parents=True, exist_ok=True)
        for key in tiles['keys']:
            shutil.copy2(origem_tiles / (key + '.bin'), mapa / prefixo / (key + '.bin'))
        (trabalho / 'index.html').write_text(indice(unidades, versao), encoding='utf-8')
        (trabalho / 'LEIA-ME.md').write_text(
            '# Piloto ' + versao + '\n\nBase local em desenvolvimento; nao publicada.\n\n'
            'Abra por HTTP para carregar os quintais:\n\n'
            '```powershell\npython -m http.server 8765 --bind 127.0.0.1 --directory "' +
            str(alvo) + '"\n```\n\nAbra http://127.0.0.1:8765/ no navegador.\n\n'
            'Plano e pendencias: tasks/v1.0/ no repositorio.\n', encoding='utf-8')
        if snapshot(fontes) != hashes_fontes:
            raise ValueError('uma fonte mudou durante a montagem; repita com fontes estaveis')
        arquivos = {p.relative_to(trabalho).as_posix(): {
            'bytes': p.stat().st_size, 'sha256': sha256(p)}
            for p in sorted(trabalho.rglob('*')) if p.is_file()}
        manifesto = {
            'versao': versao, 'versao_alvo': piloto['versao_alvo'],
            'estado': 'em_desenvolvimento', 'publicado': False,
            'gerado_em': datetime.now(timezone.utc).isoformat(),
            'cidade': piloto['cidade'], 'variante': piloto['variante'],
            'imoveis': piloto['imoveis'], 'mapa': 'mapa/' + nome_mapa,
            'fontes': {Path(k).relative_to(RAIZ).as_posix(): v for k, v in hashes_fontes.items()},
            'arquivos': arquivos,
            'verificacoes': {'montagem': 'concluida', 'tiles_copiados': len(tiles['keys']),
                            'qa_completo': 'pendente', 'mobile_real': 'pendente',
                            'preview_whatsapp': 'pendente', 'quatro_modos': 'pendente'},
        }
        (trabalho / 'manifesto.json').write_text(
            json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        trabalho.rename(alvo)
    except Exception:
        print('Montagem incompleta preservada para diagnostico em:', trabalho, file=sys.stderr)
        raise
    print('Base local pronta:', alvo)
    return alvo


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destino', help='diretorio novo para a base local')
    try:
        preparar(parser.parse_args().destino)
    except ValueError as exc:
        parser.exit(1, str(exc) + '\n')

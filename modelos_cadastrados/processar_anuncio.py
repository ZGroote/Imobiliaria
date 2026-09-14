"""URL pública -> fotos -> análise visual -> Blender e GLB, sempre para revisão.

python modelos_cadastrados/processar_anuncio.py "https://.../12345"
python modelos_cadastrados/processar_anuncio.py "https://.../12345" --preparar
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'pipeline'))
from receita import validar, validar_referencias


def achar_blender(explicito=None):
    candidatos = [explicito, os.environ.get('BLENDER_EXE'), shutil.which('blender'),
                  'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe']
    candidatos += [str(p) for p in Path('C:/Program Files/Blender Foundation').glob('Blender */blender.exe')]
    for p in candidatos:
        if p and Path(p).is_file():
            return str(Path(p).resolve())
    raise RuntimeError('Blender não encontrado. Informe --blender CAMINHO ou a variável BLENDER_EXE.')


def gravar(path, value):
    path = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix='.' + path.name + '.', suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def assinatura(manifesto, destino):
    hashes = []
    for foto in manifesto['fotos']:
        path = (destino / foto['arquivo']).resolve()
        if not path.is_relative_to(destino) or not path.is_file():
            raise ValueError('Foto ausente ou fora da pasta do anúncio; use --atualizar-fotos')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != foto['sha256']:
            raise ValueError('Foto alterada depois da extração; use --atualizar-fotos')
        hashes.append(digest)
    return {'url': manifesto['url'], 'fotos_sha256': hashes}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('url', help='URL pública do anúncio do próprio imóvel')
    parser.add_argument('--destino', type=Path, help='Pasta do processo; padrão processados/<hash-da-url>')
    parser.add_argument('--preparar', action='store_true', help='Somente extrair fotos/dados, sem usar IA ou Blender')
    parser.add_argument('--receita', type=Path, help='Usar geometria JSON já revisada, sem chamar o Codex')
    parser.add_argument('--reanalisar', action='store_true', help='Gerar nova proposta com IA, mantendo a receita anterior no histórico')
    parser.add_argument('--atualizar-fotos', action='store_true', help='Reconsultar o anúncio e atualizar a galeria em cache')
    parser.add_argument('--sem-render', action='store_true', help='Salvar .blend e GLB sem renderizar imagens')
    parser.add_argument('--blender', help='Executável do Blender')
    parser.add_argument('--codex', help='Executável do Codex CLI já autenticado')
    parser.add_argument('--max-fotos', type=int, default=30)
    parser.add_argument('--timeout-ia', type=int, default=900, help='Prazo da análise em segundos')
    args = parser.parse_args(argv)
    if args.preparar and (args.receita or args.reanalisar):
        parser.error('--preparar não combina com --receita ou --reanalisar')
    if args.receita and args.reanalisar:
        parser.error('--receita e --reanalisar são alternativas')
    if not 1 <= args.max_fotos <= 100 or args.timeout_ia < 30:
        parser.error('use entre 1 e 100 fotos e timeout de pelo menos 30 segundos')
    destino = (args.destino or ROOT / 'processados' / hashlib.sha256(args.url.encode()).hexdigest()[:12]).resolve()
    destino.mkdir(parents=True, exist_ok=True)
    job = destino / 'processo.json'
    state = {'url': args.url, 'status': 'extraindo', 'aprovado': False, 'publicado': False}
    # A cached folder is tied to one URL; never silently reuse geometry for another property.
    vinculo_confirmado = False
    if job.exists():
        try:
            anterior = json.loads(job.read_text(encoding='utf-8'))
            if not isinstance(anterior, dict) or not isinstance(anterior.get('url'), str) or not anterior['url'].strip():
                raise ValueError('URL ausente')
        except (ValueError, OSError):
            parser.error('processo.json inválido ou ilegível; não é possível confirmar o anúncio desta pasta. Escolha uma nova pasta com --destino.')
        if anterior['url'] != args.url:
            parser.error('o destino já pertence a outro anúncio; escolha outra pasta')
        vinculo_confirmado = True
    # Validate existing ownership before writing any new process state. An interrupted
    # manifest can be recovered only when the original process still identifies this URL.
    anuncio_path = destino / 'anuncio.json'
    anuncio = None
    if anuncio_path.exists():
        try:
            anuncio = json.loads(anuncio_path.read_text(encoding='utf-8'))
            if not isinstance(anuncio, dict) or not isinstance(anuncio.get('url'), str) or not anuncio['url'].strip():
                raise ValueError('URL ausente')
        except (ValueError, OSError):
            if args.atualizar_fotos and vinculo_confirmado:
                anuncio = None
            elif vinculo_confirmado:
                parser.error('anuncio.json inválido ou ilegível; use --atualizar-fotos para recuperar as referências deste anúncio.')
            else:
                parser.error('anuncio.json inválido e sem processo.json que confirme o anúncio; escolha uma nova pasta com --destino.')
        if anuncio is not None and anuncio['url'] != args.url:
            parser.error('Manifesto pertence a outro anúncio; escolha outra pasta')
    gravar(job, state)
    try:
        from extrair_anuncio import extrair
        if args.atualizar_fotos or not anuncio or not anuncio.get('fotos'):
            print('1/3 Extraindo fotos e dados do anúncio...', flush=True)
            anuncio = extrair(args.url, destino, max_images=args.max_fotos)
        if not anuncio.get('fotos'):
            raise RuntimeError('Nenhuma foto válida extraída. Anúncio indisponível, bloqueado ou formato não reconhecido; consulte anuncio.json.')
        print(f"Fotos disponíveis: {len(anuncio['fotos'])}. Pasta: {destino}", flush=True)
        origem = assinatura(anuncio, destino)
        if args.preparar:
            state['status'] = 'referencias_coletadas'
            return 0
        blender = achar_blender(args.blender)
        receita_path = destino / 'receita.json'
        origem_path = destino / 'receita.origem.json'
        if args.receita:
            receita = validar_referencias(validar(json.loads(args.receita.read_text(encoding='utf-8'))), anuncio)
            gravar(receita_path, receita)
            gravar(origem_path, origem)
        elif receita_path.exists() and not args.reanalisar:
            if not origem_path.exists() or json.loads(origem_path.read_text(encoding='utf-8')) != origem:
                raise ValueError('Receita sem vínculo com estas fotos. Use --reanalisar ou --receita para importar explicitamente.')
            validar_referencias(validar(json.loads(receita_path.read_text(encoding='utf-8'))), anuncio)
            print('Reutilizando receita.json. Use --reanalisar para uma nova proposta.', flush=True)
        else:
            if receita_path.exists():
                from datetime import datetime
                shutil.copy2(receita_path, destino / ('receita-anterior-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json'))
            state['status'] = 'analisando'; gravar(job, state)
            print('2/3 Análise visual pelo Codex autenticado (consome o uso normal da conta)...', flush=True)
            from analisar_fotos import analisar
            analisar(anuncio, destino, codex=args.codex, timeout=args.timeout_ia)
            gravar(origem_path, origem)
        state['status'] = 'modelando'; gravar(job, state)
        print('3/3 Criando peças, projeto e GLB no Blender...', flush=True)
        started = time.time()
        cmd = [blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(ROOT / 'pipeline' / 'montar_blender.py'),
               '--', '--receita', str(receita_path), '--destino', str(destino)]
        if not args.sem_render:
            cmd += ['--render']
        with (destino / 'blender.log').open('w', encoding='utf-8') as log:
            result = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, timeout=900, shell=False)
        if result.returncode != 0 or not (destino / 'exterior.glb').is_file() or not (destino / 'projeto.blend').is_file():
            raise RuntimeError('Blender não produziu todos os arquivos esperados; consulte blender.log.')
        if any((destino / p).stat().st_mtime < started - 2 for p in ['exterior.glb', 'projeto.blend']):
            raise RuntimeError('Blender deixou arquivos antigos; a nova construção não foi confirmada.')
        state['status'] = 'aguardando_revisao'
        state['arquivos'] = ['anuncio.json', 'receita.json', 'projeto.blend', 'exterior.glb']
        if not args.sem_render:
            state['arquivos'] += ['frente.png', 'perspectiva.png']
            if not all((destino / p).is_file() for p in ['frente.png', 'perspectiva.png']):
                raise RuntimeError('Projeto exportado, mas faltam renders para revisão; consulte blender.log.')
            if any((destino / p).stat().st_mtime < started - 2 for p in ['frente.png', 'perspectiva.png']):
                raise RuntimeError('Renders pertencem a uma execução anterior; a nova revisão visual não foi gerada.')
            from gerar_revisao import gerar
            gerar(destino)
            state['arquivos'].append('revisao.html')
        print('Gerado para revisão: ' + str(destino), flush=True)
        return 0
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        state.update(status='erro', erro=str(exc))
        print('Não concluído: ' + str(exc), file=sys.stderr)
        return 1
    finally:
        gravar(job, state)


if __name__ == '__main__':
    raise SystemExit(main())

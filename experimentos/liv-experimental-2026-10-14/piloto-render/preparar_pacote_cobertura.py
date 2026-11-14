"""Empacota a cena e receitas de captura/treino, sem contratar GPU nem enviar arquivos."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
from validar_captura import validar

BASE = Path(__file__).resolve().parent
EXECUTAR = '''#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
ETAPA=${1:-validar}
BLENDER_BIN=${BLENDER_BIN:-blender}
NS_TRAIN=${NS_TRAIN:-ns-train}
NS_EXPORT=${NS_EXPORT:-ns-export}
NS_EVAL=${NS_EVAL:-ns-eval}
case "$ETAPA" in validar|render|treino) ;; *) echo "Uso: bash executar.sh [validar|render|treino]"; exit 2 ;; esac
python validar_captura.py dataset --fonte apartamento.blend
if [ "$ETAPA" = render ]; then
  "$BLENDER_BIN" -b apartamento.blend --python-exit-code 1 --python gpu.py --python capturar_splat.py -- \\
    --perfil cobertura --zona "__ZONA__" --folga __FOLGA__ --colado __COLADO__ --passo __PASSO__ \\
    --rumos __RUMOS__ __JITTER__ --res __RES__ --amostras __AMOSTRAS__ --saida dataset --unidade unidade.json
  python validar_captura.py dataset --completo --fonte apartamento.blend
fi
if [ "$ETAPA" = treino ]; then
  python validar_captura.py dataset --completo --fonte apartamento.blend
  python -c 'import json; assert not json.load(open("dataset/plano-captura.json"))["diagnostico"], "Amostra de diagnóstico não serve para treino"'
  test ! -e treino || { echo "Pasta treino já existe; preserve a execução anterior e use outra cópia do pacote."; exit 1; }
  export TORCHDYNAMO_DISABLE=1 TORCH_COMPILE_DISABLE=1
  "$NS_TRAIN" splatfacto --vis tensorboard --output-dir treino --experiment-name piloto-continuo \\
    --viewer.quit-on-train-completion True --max-num-iterations 30000 \\
    --steps-per-eval-all-images 0 --steps-per-eval-image 1000 \\
    --pipeline.datamanager.cache-images cpu \\
    --pipeline.model.camera-optimizer.mode off \\
    --pipeline.model.cull-alpha-thresh 0.005 \\
    nerfstudio-data --data dataset --downscale-factor 1 --auto-scale-poses False \\
    --center-method none --orientation-method none --scene-scale 6 --load-3D-points True > treino.log 2>&1
  CFG=$(find treino -name config.yml -print -quit)
  test -n "$CFG"
  "$NS_EXPORT" gaussian-splat --load-config "$CFG" --output-dir resultado
  "$NS_EVAL" --load-config "$CFG" --output-path resultado/eval.json --render-output-path resultado/eval
  echo "Concluído: resultado/splat.ply, eval.json e imagens de avaliação. Revisão visual pendente."
fi
'''


def preparar(plano, saida, fonte=None):
    fonte = Path(fonte) if fonte else BASE / 'nuvem/apto-empacotado.blend'
    resumo = validar(plano, fonte=fonte)
    config = json.loads((plano / 'plano-captura.json').read_text(encoding='utf-8'))
    if config.get('diagnostico'): raise ValueError('Empacote o plano completo, não a amostra')
    arquivos = {name: (BASE / name).read_bytes() for name in (
        'capturar_splat.py', 'planta.py', 'validar_captura.py')}
    comando = EXECUTAR
    for chave, valor in {
        'ZONA': ','.join(config['zona']), 'FOLGA': config['folga'],
        'COLADO': config['colado'], 'PASSO': config['passo'], 'RUMOS': config['rumos'],
        'JITTER': '--sem-jitter' if config.get('sem_jitter') else '',
        'RES': f"{config['dataset']['w']}x{config['dataset']['h']}", 'AMOSTRAS': config['amostras'],
    }.items():
        comando = comando.replace(f'__{chave}__', str(valor))
    arquivos.update({
        'apartamento.blend': fonte.read_bytes(),
        'gpu.py': (BASE / 'nuvem/gpu.py').read_bytes(),
        'unidade.json': (BASE.parent / 'interiores/meio/unidade.json').read_bytes(),
        'dataset/plano-captura.json': (plano / 'plano-captura.json').read_bytes(),
        'executar.sh': comando.encode('utf-8'),
    })
    # Somente referências que pertencem ao plano e à fonte validada; nunca copiar capturas antigas.
    for frame in config['dataset']['frames']:
        image = plano / frame['file_path']
        if image.is_file(): arquivos['dataset/' + frame['file_path']] = image.read_bytes()
    for name in ('README.md', 'validacao-local.json', 'evidencias/entrada-antes-depois.jpg',
                 'evidencias/amostras-seis-ambientes.jpg', 'evidencias/vidros-antes-depois.jpg',
                 'evidencias/varanda-fundo-antes-depois.jpg'):
        evidence = fonte.parent / name
        if evidence.is_file(): arquivos['preparacao/' + name] = evidence.read_bytes()
    texto = f'''# Captura contínua do LIV — {plano.name}

Estado: PLANO VALIDADO; {resumo['imagens_presentes']} referências renderizadas incluídas;
{resumo['render_pendente']} imagens finais ainda precisam ser renderizadas.
Este ZIP não contém um splat novo nem um dataset completo.

## Conteúdo e execução

A cena tem texturas empacotadas. O plano contém {resumo['cameras']} vistas em {resumo['posicoes']} posições,
com {resumo['treino']} imagens para treino e {resumo['validacao']} para avaliação em posições separadas.
Piso/horizonte/teto são capturados a -60/0/+60 graus. Fonte: {config['source_sha256']}.

Pré-requisitos: Blender 5.2.2 compatível com a cena, Python 3.10+ e, para treino,
ambiente Nerfstudio/Splatfacto funcional com PyTorch/CUDA. Nenhum instalador é executado pelo pacote.

1. Extraia numa pasta nova e execute `bash executar.sh validar`.
2. Renderize aqui ou na GPU alugada: `BLENDER_BIN=/caminho/blender bash executar.sh render`.
   Captura final: {config['dataset']['w']}x{config['dataset']['h']}, {config['amostras']} amostras Cycles.
   {config['rumos']} rumos por posição, jitter angular {'desativado' if config.get('sem_jitter') else 'ativado'}.
   Retomar o mesmo comando reaproveita as imagens.
   Não mude a cena ou os parâmetros na mesma pasta. `transforms.json` só surge ao terminar o conjunto.
3. Com o render completo: `bash executar.sh treino`. Se necessário configure NS_TRAIN, NS_EXPORT e NS_EVAL.
   O cache de imagens fica em CPU para poupar VRAM. O treino é um único modelo contínuo da zona capturada.
4. Traga `resultado/` e `treino.log`; preserve o checkpoint para ajustes posteriores.

## Aprovação antes da integração

Compare as imagens de `resultado/eval` com as referências. Faça sala → varanda → sala,
olhando piso, teto e portas, com a câmera à altura de 1,62 m. Reprove buracos pretos,
grandes deformações e superfícies que somem. Métricas médias não substituem essa inspeção.

Converta o PLY aprovado para SOG com a ferramenta de conversão já usada pelo projeto.
Na PRÉVIA, aponte as entradas sala e varanda de splat/comodos.json para o mesmo arquivo piloto.sog;
os demais cômodos continuam com seus arquivos atuais. Não ative o piloto fora das áreas treinadas.
Para o plano de apartamento completo, só unifique todas as entradas depois da validação de todos os cômodos.
O resultado pode continuar com falhas: este pacote prepara o teste, não garante qualidade do treino.

## Fontes técnicas

- https://docs.nerf.studio/quickstart/data_conventions.html
- https://github.com/nerfstudio-project/nerfstudio/blob/main/nerfstudio/data/dataparsers/nerfstudio_dataparser.py

Matrizes seguem Blender/OpenGL; normalização, centralização e rotação automáticas ficam desativadas
para conservar o encaixe com o Tour. A divisão explícita train/val/test impede reutilizar a mesma posição nos dois grupos.
'''
    arquivos['README.md'] = texto.encode('utf-8')
    arquivos['manifesto.json'] = json.dumps({name: hashlib.sha256(data).hexdigest() for name, data in arquivos.items()}, indent=2).encode()
    saida.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(saida, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in arquivos.items(): z.writestr(name, data)
    with zipfile.ZipFile(saida) as z:
        if z.testzip(): raise ValueError('Falha de integridade no ZIP')
    return {'arquivo': str(saida), 'bytes': saida.stat().st_size, **resumo}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plano', type=Path, default=BASE / 'cobertura-20261015/piloto')
    parser.add_argument('--saida', type=Path, default=BASE / 'cobertura-20261015/pacote-piloto.zip')
    parser.add_argument('--fonte', type=Path, help='Cópia corrigida da cena, validada pelo SHA-256 do plano')
    args = parser.parse_args()
    print(json.dumps(preparar(args.plano, args.saida, args.fonte), ensure_ascii=False, indent=2))

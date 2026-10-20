# Preparação corrigida — 16/10/2026

Objetivo: corrigir a origem do preto e validar referências locais antes de contratar outra GPU.
O splat anterior e os backups de 15/10 permanecem preservados. A cena original não foi sobrescrita.

## Mudanças na fonte

- A abertura preta ao lado do sofá é a entrada `a5`, sem folha na cena original.
  Foi adicionada uma porta fechada com 0,80 × 2,10 m, na posição cadastrada na planta.
  A hipótese anterior de completar um cenário externo foi refinada por essa correspondência.
- O material da folha é independente do atlas da malha importada. O primeiro ensaio, que
  reutilizou o atlas sem UV correspondente e ficou escuro, foi preservado em `../correcao-20261016-tentativa1`.
- O material `Vidro` usa transmissão reta com reflexão Fresnel e rugosidade 0,04.
  É uma aproximação de vidro fino, sem refração volumétrica. Não transforma vidro em superfície opaca.
  Espelhos continuam como na fonte. O shader volumétrico original está preservado no arquivo.
- As 15 texturas estão empacotadas em `apartamento.blend`.
- O céu original ficava preto abaixo do horizonte, visível na janela da varanda. Foi
  acrescentado um mínimo de radiância neutra no ambiente. É um fundo externo genérico,
  sem representar a vista real do imóvel. A fonte anterior está em `../correcao-20261016-antes-fundo`.
  Todas as referências finais são renderizadas novamente com esse fundo.

## Captura única para os seis ambientes

`dataset/plano-captura.json` contém 2.590 câmeras em 109 posições: 2.213 vistas de treino e
377 de avaliação, reservadas por posição. Todos os seis ambientes têm piso, horizonte e teto
nos dois grupos. O plano usa oito rumos exatos por posição, com inclinações −60°, 0° e +60°,
resolução 1280 × 720, 128 amostras Cycles, câmera sem profundidade de campo e lentes constantes.
Os testes em portas adicionam posições de captura aos dois lados das passagens livres.

O conjunto completo precisa ser renderizado na fonte corrigida. Não misturar as 678 capturas
de sala/varanda nem as 478 capturas antigas com este conjunto: elas pertencem à fonte anterior.
As referências locais são parte do plano final e podem ser reaproveitadas no render completo.

## Evidências e verificação

Depois de concluir a amostragem, `validacao-local.json` registra fonte, cobertura por cômodo,
integridade das imagens e a medição da região que era preta. As evidências ficam em:

- `evidencias/entrada-antes-depois.jpg`: mesma câmera e mesmo enquadramento.
- `evidencias/amostras-seis-ambientes.jpg`: piso/horizonte/teto de cada ambiente.
- `evidencias/vidros-antes-depois.jpg`: comparação do material nas mesmas câmeras.
- `evidencias/varanda-fundo-antes-depois.jpg`: a região abaixo do horizonte antes e depois.
- `amostras.json`: poses exatas da seleção local.
- `amostras-renderizadas.json`: fonte e parâmetros usados nos renders corrigidos.

O relatório distingue referências verificadas de reconstrução aprovada. A correção final da
nitidez só pode ser julgada depois de treinar e percorrer o novo splat.
Na comparação dos vidros, `--original` abre a cópia corrigida e troca apenas o shader em memória;
porta, geometria, luzes e câmeras permanecem iguais. O `.blend` corrigido não é alterado.

## Execução na próxima máquina

O pacote `pacote-apartamento-corrigido.zip` contém a fonte corrigida, as referências locais,
o plano e os scripts. O manifesto registra SHA-256 de cada arquivo. Extraia em pasta nova.

```bash
bash executar.sh validar
BLENDER_BIN=/caminho/blender bash executar.sh render
bash executar.sh treino
```

A primeira etapa confere a fonte e as imagens já disponíveis. A segunda completa os renders
e gera os pontos e `transforms.json`. A terceira recusa conjunto incompleto, treina um único
modelo para todo o apartamento, exporta PLY e avalia as câmeras reservadas.
O pacote reproduz passo, folga, distância mínima, rumos, jitter, resolução e amostras do plano.
Na execução anterior, o ambiente funcional foi Blender 5.2.2, Nerfstudio 1.1.5,
PyTorch 2.4.1/CUDA 12.4, gsplat 1.4.0 e NumPy 1.26.4. O pacote não instala esse ambiente.

O tempo de GPU precisa contemplar o render de todo o apartamento, além do treino e download.
O plano tem aproximadamente 3,8 vezes as vistas do piloto de 678 imagens. Não contar com a
janela anterior de duas horas para renderizar este conjunto e treinar, sem nova medição.

## Reproduzir a preparação local

Na raiz do repositório, com Blender 5.2.2:

```powershell
$b = 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe'
$p = 'experimentos/liv-experimental-2026-10-14/piloto-render'
$r = "$p/correcao-20261016"
# Para recriar a fonte use uma pasta nova; o script recusa sobrescrever uma cena existente.
& $b -b "$p/nuvem/apto-empacotado.blend" --python-exit-code 1 --python "$p/corrigir_fonte_captura.py" -- --saida "$p/nova-preparacao/apartamento.blend" --unidade "$p/../interiores/meio/unidade.json"
& $b -b "$r/apartamento.blend" --python-exit-code 1 --python "$p/capturar_splat.py" -- --perfil cobertura --rumos 8 --sem-jitter --sem-render --saida "$r/dataset" --unidade "$p/../interiores/meio/unidade.json"
& $b -b "$r/apartamento.blend" --python-exit-code 1 --python "$p/nuvem/gpu.py" --python "$p/amostrar_correcao.py" -- --pasta $r
& $b -b "$p/nuvem/apto-empacotado.blend" --python-exit-code 1 --python "$p/nuvem/gpu.py" --python "$p/amostrar_correcao.py" -- --pasta $r --original
python "$p/validar_preparo.py" $r
python "$p/preparar_pacote_cobertura.py" --plano "$r/dataset" --fonte "$r/apartamento.blend" --saida "$r/pacote-apartamento-corrigido.zip"
```

Não aprovar a publicação pelas referências ou pelas métricas médias. Depois do treino, conferir
os seis ambientes em movimento, piso, teto, portas, vidros, espelhos e contornos dos móveis,
incluindo posições entre as câmeras de captura.

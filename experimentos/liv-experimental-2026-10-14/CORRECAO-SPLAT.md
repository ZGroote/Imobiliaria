# Correção do Tour — 15/10/2026

## Estado

Render e dois treinos de 30 mil etapas concluídos na GPU alugada pelo usuário. Capturas, checkpoints,
PLYs, avaliações e SOGs novos estão preservados localmente. Há prévias separadas para sala/varanda
e apartamento contínuo. **Qualidade visual reprovada para publicação**: reflexos/vidro, teto da suíte
e fundo externo escuro ainda exigem trabalho. Os arquivos publicados não foram substituídos; nenhum deploy foi feito.

## Correções de execução

- A câmera é enviada ao iframe mesmo durante o carregamento. A imagem só é revelada depois de um render com a câmera recebida.
- Downloads antigos não mudam o cômodo selecionado; um pré-carregamento não fica visível sozinho.
- Até três arquivos ficam no cache. Um ambiente próximo pode ser antecipado, sem somar dois splats na mesma imagem.
- Erro de carregamento ou perda do contexto WebGL devolve a malha do Tour. Não se tenta baixar um arquivo com erro a cada quadro.
- Ao ocultar o Tour, o desenho do splat pausa; ao encerrar, observadores e substituição de render são removidos.
- Os limites antigos de cômodos foram mantidos para os arquivos publicados. A prévia global usa um arquivo único
  em todo o percurso e não depende desses limites aproximados.

Isso melhora a troca/carregamento. Não preenche regiões sem cobertura com pixels inventados e não constitui uma composição com profundidade entre malha e splat.

## Captura

O perfil `cobertura` usa câmera a 1,62 m, oito rumos, inclinações de -60/0/+60 graus e lente de 16 mm.
A grade é de 55 cm, com pontos adicionais nos dois lados das portas. As posições são verificadas por raios contra a cena.
Sem profundidade de campo; intrínsecos correspondem ao sensor horizontal e à resolução exportada.

- Piloto sala + varanda: **1.355 vistas / 57 posições**.
- Apartamento Meio completo: **2.809 vistas / 119 posições**, incluindo todos os seis cômodos.
- Amostra local: **12 PNGs em 640×360 / 24 amostras**, conferidos em folha de contato.
- Captura final: **1280×720 / 128 amostras**. Na execução de 2h foram renderizadas e copiadas
  **678 vistas / 57 posições**, com quatro rumos exatos, sem jitter, e as três inclinações.
  O dataset local em `cobertura-20261015/piloto-2h/dataset` passou por `validar_captura.py --completo --fonte`.

Treino e avaliação reservam posições diferentes por cômodo. O plano registra o SHA-256 da cena e os parâmetros;
retomar com outra cena/configuração na mesma pasta é recusado. No perfil novo, `--planejar` não cria um
`transforms.json` que pareça pronto para treino; o arquivo só aparece depois do render e dos pontos iniciais.
`validar_captura.py --completo` verifica arquivos, dimensões PNG, matrizes, divisões e correspondência com o plano.
A amostra limitada é marcada como diagnóstico e não é apresentada como dataset final.

A cena de origem tem 15 imagens, todas empacotadas, e foi aberta no Blender 5.2.2.
As skills Blender Cameras e Blender Rendering orientaram a câmera e a conferência de render.

## Arquivos de evidência

Em `piloto-render/cobertura-20261015/`:

- `amostras-cobertura.jpg`: folha de contato das novas capturas, ainda sem treino.
- `amostra/images/`: os 12 renders reais.
- `piloto/plano-captura.json` e `apartamento/plano-captura.json`: poses e divisões completas.
- `diagnostico-tour-webgl.json`: percurso observado no navegador, seis ambientes alcançados, posições seguras e splats apresentados.
- `diagnostico-tour-390.json`: o mesmo percurso em viewport de 390×844, também com seis rotas concluídas.
- `verificacao-local.json`: resumo dos testes e SHA-256 dos pacotes.
- `pacote-piloto.zip`: cena, plano, scripts e instruções para render e treino do piloto contínuo.
- `pacote-apartamento.zip`: alternativa para o apartamento inteiro; usar depois de aprovar o piloto.

Os ZIPs contêm planos, não as imagens finais nem um splat novo.

## Como retomar

Para a revisão local, a partir da raiz do repositório:

```powershell
python experimentos/liv-experimental-2026-10-14/servidor-prova-splat.py
```

Abra `http://127.0.0.1:8876/experimentos/liv-experimental-2026-10-14/prova-splat.html`.
O botão de percurso usa as rotas e colisões do produto. O relatório mostra o cache e permite baixar o diagnóstico.
PASS nessa página significa rotas e apresentação funcionando; ainda é necessário julgar a qualidade visual.
O servidor de diagnóstico escuta apenas em `127.0.0.1`; o botão Salvar vista preserva o PNG
em `piloto-render/cobertura-20261015/evidencias/vista-atual.png`.

### Resultado da alugada em 15/10

O piloto sala/varanda completou 30 mil etapas e as 93 vistas de avaliação: PSNR 29,94 dB,
SSIM 0,9691 e LPIPS 0,0904. Checkpoint final e `resultado-remoto.tgz` estão copiados para
`cobertura-20261015/piloto-2h`; os hashes e a leitura dos arquivos foram conferidos.
`splat/piloto-continuo.sog` tem aproximadamente 16,5 MB e está em `comodos-piloto.json`.
Abra `prova-splat.html?piloto=1`. O percurso sala → varanda → sala passou e piso/teto foram inspecionados.
O teto da sala ficou completo nas vistas conferidas; vidro/reflexos e contornos de móveis ainda deformam.
O resultado permanece experimental e não foi publicado.

O teste global combina as 678 vistas novas com 478 capturas anteriores dos outros cômodos,
preservando lentes por quadro e posições separadas de avaliação. Duas câmeras antigas repetidas
na fonte atual deram SSIM acima de 0,9998. São 1.009 vistas de treino e 147 de avaliação.
Seu treino também terminou; exportação, 147 avaliações e checkpoint estão preservados em
`cobertura-20261015/global-contexto`. SOG: `splat/apartamento-continuo.sog`, 661.301 gaussianas, 11,3 MB.
Abra `prova-splat.html?piloto=global`; um arquivo cobre todo o percurso, sem as zonas aproximadas antigas.
O navegador percorreu os seis cômodos sem erro, com cerca de 60 fps neste desktop GTX 1650.
PSNR agregado 30,97 dB; SSIM 0,9737; LPIPS 0,0943. O conjunto de avaliação é diferente do piloto;
nas mesmas 93 vistas o PSNR piloto/global é 29,92/28,79 dB. Não apresentar as médias de conjuntos
diferentes como prova de melhora. Os quartos e banhos
ainda têm a cobertura antiga. Este teste não substitui a captura de 2.809 vistas planejada.

**Reprovado para publicação**: teto da suíte borrado, vidro/reflexos e contornos ainda deformados.
Também foi reproduzida a área preta ao lado do sofá no render Cycles da fonte, com a câmera exata do Tour.
Dois raios nessa abertura não atingem geometria: é o fundo externo da cena. Completar o cenário externo
antes da próxima captura, além de recapturar piso/teto dos demais cômodos. Evidências em
`evidencias/referencia-sala.png`, `piloto-teto.png` e `global-teto-suite-reprovado.png`.
`global-contexto/execucao-final.json` registra o resultado e os hashes dos backups.

Para recriar o pacote:

```powershell
python experimentos/liv-experimental-2026-10-14/piloto-render/preparar_pacote_cobertura.py
```

Extraia o ZIP numa pasta nova. O README interno explica os pré-requisitos e os comandos:

```bash
bash executar.sh validar
BLENDER_BIN=/caminho/blender bash executar.sh render
bash executar.sh treino
```

O render pode rodar aqui ou na alugada. O treino exige ambiente Nerfstudio/CUDA já configurado.
Na execução de 15/10, render e treino foram iniciados na alugada com duas A100 de 40 GB.
Retornar `resultado/` e preservar checkpoints/logs.
O piloto é um único splat contínuo para sala e varanda. Só integrar em prévia após revisar portas,
piso, teto, movimento para frente/para trás e vistas reservadas. Conversão PLY → SOG e integração em prévia
foram concluídas nos dois ensaios; aprovação final continua pendente pelos defeitos registrados acima.

## Verificação local

```powershell
node experimentos/liv-experimental-2026-10-14/test_splat_cache.mjs
node experimentos/liv-experimental-2026-10-14/test_splat_integration.mjs
python experimentos/liv-experimental-2026-10-14/piloto-render/test_validar_captura.py
node experimentos/liv-experimental-2026-10-14/test_interior_navigation.mjs
node experimentos/liv-experimental-2026-10-14/test_interior_camera.mjs
```

Os testes de cache/ponte cobrem pré-carregamento, troca, falha, resposta atrasada, devolução à malha e encerramento.
Navegação: 48 rotas sequenciais nas duas tipologias; câmera: 80 cantos projetados e três casos de foco.
O navegador real percorreu os seis ambientes com os arquivos atuais; esse teste não aprova a reconstrução visual.

Houve um erro isolado de MutationObserver sem URL no console do navegador. Não há MutationObserver no código
do piloto; sua origem não foi determinada. Não atribuir esse registro aos buracos do splat sem evidência.
Ainda faltam testes em aparelho físico e avaliação de desempenho do modelo que será treinado.

## Base técnica

[Convenções de dados do Nerfstudio](https://docs.nerf.studio/quickstart/data_conventions.html)
e [leitura de divisões explícitas](https://github.com/nerfstudio-project/nerfstudio/blob/main/nerfstudio/data/dataparsers/nerfstudio_dataparser.py).
O treino conserva as coordenadas Blender/OpenGL, sem rotação, escala ou centralização automáticas.

## Preparação corrigida em 16/10

Fonte e referências locais prontas em `piloto-render/correcao-20261016/`.
Detalhes, evidências e reprodução em [README da preparação](piloto-render/correcao-20261016/README.md).
A abertura da sala corresponde à entrada `a5`: foi acrescentada uma folha fechada de 0,80 × 2,10 m.
Outra área preta vinha do céu sem fundo abaixo do horizonte na janela da varanda; a fonte agora
usa um fundo neutro, que não representa a vista real. O material de vidro fino tem transmissão
reta e reflexão Fresnel, sem refração volumétrica. A comparação estática tem diferenças discretas;
o efeito na reconstrução precisa ser avaliado depois do treino.

Foram renderizadas e inspecionadas 18 referências finais, três por cômodo, a 1280×720 e 128 amostras.
O plano completo tem 2.590 imagens em 109 posições, com 2.213 para treino e 377 para avaliação.
Todos os cômodos têm piso/horizonte/teto nos dois grupos. Nenhuma captura antiga foi incorporada.
O ZIP de aproximadamente 25 MB inclui essas 18 imagens; faltam renderizar 2.572 na fonte corrigida.
Manifesto, arquivos extraídos, sintaxe do shell e reprodução do plano no Blender passaram.
`validacao-local.json` registra os resultados. Ainda não há um splat treinado dessa fonte nem aprovação para publicar.

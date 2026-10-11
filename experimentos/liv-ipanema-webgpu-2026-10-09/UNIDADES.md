# LIV Ipanema — seleção do pavimento piloto

10/10/2026. Na [prévia local](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html), **Explore os finais** liga a lista, o clique na maquete, o realce e a ficha do 1º pavimento tipo acima do térreo. A lista enquadra o lado correspondente; o toque na fachada conserva a câmera. A seleção reaparece ao retornar das plantas/Tour ou recarregar a página. Destacar outro pavimento limpa o final.

As dez posições seguem a ordem da página 15 do [book oficial](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf). **Os volumes são zonas aproximadas de interação, sem comprovação dos limites dos apartamentos.** A ficha mantém planta/espelhamento e área por final em conferência, além de disponibilidade, preço, número comercial e vaga não informados. Nenhum identificador “101” foi criado.

## Registro da prancha sobre o modelo

[unidades.json](unidades.json) preserva procedência, hashes do book/rasterização, dimensões da imagem, âncoras e faixas lidas. [unidades.js](unidades.js) valida dez IDs únicos, lados, volumes sem sobreposição e ausência de dados comerciais ou vínculos inventados.

A rasterização de 2100 × 1051 px foi inspecionada. O eixo longo da torre vai de `v=898` junto à portaria a `v=373` junto ao bosque. Os extremos foram registrados na lâmina atual `x=-23,85..23,85 m`, e o intervalo ilustrado `v=666..708` foi alinhado ao núcleo deslocado do modelo: `CORE_X=-0,13×47,7` e `CORE_W=0,076×47,7`, faixa `x=-8,0136..-4,3884 m`. Esses parâmetros vêm do gerador existente, sem modificá-lo.

O registro usa dois trechos proporcionais: na ala da portaria, `x=-23,85+(898-v)×15,8364/190`; na ala do bosque, `x=-4,3884+(666-v)×28,2384/293`. O núcleo permanece fora das zonas. Isso evita atribuir a circulação a um final quando as proporções da prancha e da reconstrução diferem. A transformação é **inferida**, distinta da transformação em pixels da imagem menor usada pelo autor da implantação. A profundidade usa apenas os lados relativos já registrados no código: ímpares no estacionamento (`z<0`), pares no lazer (`z>0`). Não fornece norte/insolação.

| Finais | Faixa vertical da prancha (px) | Faixa de seleção no eixo longo (m) | Ímpar / par |
|---|---|---|---|
| 01 / 02 | 809–898 | −23,85 a −16,43 | Estacionamento / lazer |
| 03 / 04 | 708–809 | −16,43 a −8,01 | Estacionamento / lazer |
| 05 / 06 | 564–666 | −4,39 a 5,44 | Estacionamento / lazer |
| 07 / 08 | 465–564 | 5,44 a 14,98 | Estacionamento / lazer |
| 09 / 10 | 373–465 | 14,98 a 23,85 | Estacionamento / lazer |

O intervalo ilustrado `v=666..708` foi excluído da seleção, assim como uma faixa central em `z`. As zonas verticais `y=3,02..5,68 m` deixam as lajes fora do clique; o passo de 2,85 m é inferido. O perímetro retangular atual e os recuos da prancha diferem, portanto essas faixas não devem orientar cotas, área, divisórias ou atribuição comercial. Gardens e outros pavimentos não foram cadastrados neste incremento.

## Picking e apresentação

[picking.js](picking.js) usa [Raycaster.setFromCamera](https://threejs.org/docs/pages/Raycaster.html) e [Ray.intersectBox](https://threejs.org/docs/pages/Ray.html) da versão local Three.js 0.186.1. Consulta apenas o envelope e dez zonas no encerramento de um toque/clique. O primeiro encontro com a cobertura ou outro pavimento não seleciona uma posição escondida. A política é conservadora e aproximada: não testa triângulos de paredes, árvores ou mobiliário da implantação.

Arrastes maiores que 6 px, movimento de ida/volta, múltiplos dedos, cancelamento e perda de captura não viram seleção. A lista nativa de botões oferece o mesmo ID por teclado e possui alvos de pelo menos 44 px. A legenda sobre a maquete identifica a escolha; o realce azul usa MeshBasicMaterial e LineBasicMaterial padrão. São duas geometrias pequenas e dois materiais próprios, sem luz ou sombra adicionais, descartados ao sair do exterior. Materiais PBR, posições, normais, UVs e atlas do prédio são preservados.

## Plantas e Tour

O cadastro mantém `typology`, `plan2d`, `mirroring` e `areaM2` **nulos por final**. Escolher um final não altera a tipologia do catálogo. Canto e Meio continuam com suas próprias plantas 2D, geometrias, materiais e bakes, conforme [INTERIORES.md](INTERIORES.md). A ficha informa qual referência geral está sendo exibida e que a associação com o final está em conferência. Nenhum interior foi espelhado automaticamente ou apresentado como unidade validada.

## Verificação

- `node --test test_unidades.mjs`: cinco testes de IDs/procedência, registro não uniforme, raios frontais/oblíquos/laterais, bloqueio por cobertura/outro nível/núcleo, rejeição de registros inválidos e enquadramento em oito combinações de lado/proporção.
- `python qa_unidades.py`: [relatório](evidencias/unidades-piloto/runtime.json) de WebGPU, WebGL2 e toque emulado. Inclui dez escolhas por lista e dez por fachada em cada perfil, Enter/Espaço, arraste, pinça no perfil de toque, cadastro/sessão, Canto/Meio nos três modos, retorno à câmera, 320/768/1024/1440 px e descarte de cada recurso exatamente uma vez.
- A edição de modelo é verificada antes de habilitar o picking. O relatório identifica todos os arquivos de execução e fontes testadas; o hash da rasterização foi conferido.
- Duas falhas injetadas verificam cadastro ausente e posições de outra edição: a planta 2D continua acessível, a seleção incompatível é recusada e a recuperação carrega o cadastro/realce sem duplicar recursos.

T08/T09 permanecem parciais: a ordem/realce ilustrativo foi implementada, mas a associação planta/final/espelhamento exige evidência adicional. A reconstrução exterior também conserva as pendências de T06/T07. Toque emulado não substitui o ensaio no Poco X6 ou iPhone; nenhuma publicação foi feita.

## Registro sobre o contorno corrigido — 11/10/2026

A [integração opcional](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=contorno) usa [modelo/unidades-contorno.json](modelo/unidades-contorno.json), esquema `liv-pilot-units-v2`, ligado à autoria `618c4f55…`. A edição sem parâmetro conserva `unidades.json` e o esquema anterior. Os dez IDs, faixas da prancha, lados e campos nulos são iguais; os volumes de interação mudam para acompanhar os recuos. As hipóteses de altura/extensão dos recuos não viram informação comercial.

[modelo/registrar_unidades.py](modelo/registrar_unidades.py) compara os triângulos superiores da laje real com o contorno registrado e recorta as faixas antigas por esse polígono, excluindo núcleo e corredor. Confere ausência de regiões com área sobreposta e grava procedência/hashes dos insumos. Coordenadas são quantizadas à precisão de 0,00001 m da autoria; isso descreve a representação numérica, sem sugerir precisão do levantamento.

[unit-footprint.js](unit-footprint.js) valida contornos ortogonais simples e calcula o primeiro encontro do raio com o prisma fechado da torre. A cobertura e os demais pavimentos continuam bloqueando escolhas ocultas. O destaque azul extruda o polígono do final; suas tampas não cobrem os rasgos. Os dez destaques compartilham dois buffers e dois materiais padrão, trocando apenas a faixa desenhada. Consultas continuam restritas ao fim do toque/clique, sem acrescentar iluminação ou sombras ao realce.

Os doze testes CPU de unidades/contorno/materiais passaram. A [qualificação da integração](evidencias/unidades-recuos-integrado/runtime.json) passou em WebGPU, WebGL2 e toque emulado: dez escolhas por lista/fachada, teclado/gestos, conferência independente das tampas desenhadas, preservação da torre/UV/atlas/materiais, sessão e descarte único dos quatro recursos. Canto e Meio passaram nos três modos em cada perfil. Três falhas injetadas rejeitam cadastro ausente, edição incompatível e uma zona retangular que preencheria um recuo; Planta 2D e recuperação continuam acessíveis. Retornar do mapa restaura edição e seleção. Naquela qualificação, o modelo dentro do mapa ainda era o da base.

A [revalidação após corrigir cobertura e rodateto](evidencias/unidades-cobertura/runtime.json) passou nos mesmos três perfis com a autoria `618c4f55…` e o novo pacote de Canto. Inclui seleção por lista/fachada, recuperação das três falhas e retorno normal e com falha do mapa, preservando a edição do contorno.

A [revisão do mapa](MAPA-MODELO.md) agora transporta o GLB dessa autoria, conferido contra geometria, materiais e todas as instâncias. A [qualificação do mapa atual](evidencias/mapa-contorno-conferido/runtime.json) passou na edição original desktop e na variante desktop/toque emulado/sem cache, incluindo retorno com o mesmo ID selecionado e rejeição de GLB incompatível. Não confirma o vínculo comercial das plantas.

```powershell
python modelo/registrar_unidades.py
node --test test_unidades.mjs test_contorno_unidades.mjs test_acabamentos.mjs
python qa_unidades.py --geometria contorno --saida evidencias/unidades-recuos-nova-revisao
```

Executar a partir deste diretório, com os artefatos locais reproduzidos. Preservar relatórios históricos usando um novo destino. A comparação geométrica isolada continua sem cadastro, e o modo integrado habilita o piloto explicitamente. O GLB do mapa foi conferido; tempo de abertura, refinamento da entrada e ensaios físicos precedem a adoção dessa autoria como padrão. T06–T09 continuam parciais.

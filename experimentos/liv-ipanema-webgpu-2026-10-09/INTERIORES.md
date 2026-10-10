# LIV — duas plantas e interiores

Etapa de 10/10/2026, antecipada pela solicitação do usuário. A escolha **Canto / Meio** é um catálogo de tipologias e permanece independente da seleção de pavimento. O vínculo de cada final com a tipologia e a orientação do espelho continua pendente.

A Planta 3D agora oferece **Paredes baixas**, com corte de apresentação a 1,20 m e móveis na altura original. É possível voltar às paredes inteiras, e o Tour sempre usa a cena completa. Os materiais PBR e atlas próprios continuam preservados; a fonte autoral de Meio foi reproduzida byte a byte. Detalhes e ensaios em [CORTES.md](CORTES.md).

## Fontes e dimensões

As duas imagens oficiais vêm da galeria da Livon e correspondem à página 14 do [book oficial](https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf). `plantas2d/manifest.json` registra a identidade das cópias sem edição.

| Tipologia | Fonte 2D | Área publicada, com varanda | Base de geometria |
|---|---|---|---|
| Canto | `planta-47-59.jpg` | 47,59 m² = 43,18 + 4,41 | Unidade do construtor e cena congelada do interior anterior |
| Meio | `planta-tipo.jpg` | 47,5–47,89 m² | Novo traçado próprio, `interiores/meio/unidade.json` |

Meio possui varanda/serviço e cozinha à esquerda, dormitório central, banho da suíte acima do vestíbulo e suíte à direita, com contorno em L. Não é um espelhamento do canto. A área branca abaixo da suíte permanece fora do contorno habitável, sem atribuir-lhe uso técnico confirmado.

As imagens não fornecem cotas executivas. O canto conserva a escala inferida de 11 mm/pixel e contorno nominal entre eixos de 47,235 m². O meio usa escala uniforme estimada de 11,3142 mm/pixel, calibrada pela caixa aparente da varanda e seu componente publicado de 4,41 m², com grade de 50 mm; contorno nominal de 44,6 m². A diferença em relação à área comercial é registrada, sem deformar o desenho para igualá-la. Pé-direito de 2,70 m, vãos, móveis e acabamentos são aproximações.

`interiores/meio/construir-meio.ts` usa as APIs reais do construtor. A exportação passa por round-trip do documento/editor/móveis e pelo normalizador nominal e portões do consumidor. `referencia.json` identifica coordenadas observadas, metodologia, contagens, hashes e limites. `conferencia.png` sobrepõe contornos, vãos e footprints à imagem oficial; `conferencia.json` registra sua identidade.

## Runtime e iluminação

`interior.html` usa o mesmo Three.js fixado em 0.186.1 e WebGPURenderer, com seleção automática e fallback WebGL2. Planta 3D e Tour compartilham uma cena da tipologia atual; mudar tipologia ou voltar ao exterior encerra a cena anterior. O forro fica oculto na Planta 3D e aparece no Tour.

O descarte interrompe o desenho imediatamente. O iframe antigo fica oculto e inerte até a inicialização/renderização pendente assentar e os recursos serem liberados; remover seu contexto antes disso pode abandonar a promessa de `requestDevice`. A vista escolhida continua abrindo durante essa limpeza. Se o driver não responder por 30 s, o host encerra o contexto como último recurso. Esse fallback é teardown do navegador, sem comprovação de memória GPU liberada por contador JavaScript.

Os materiais PBR e seus mapas são preservados como materiais padrão. Cada planta possui transporte RGBM próprio em TSL, com unidade, fonte, geometria compacta, UV1 e atlas conferidos. Meio usa a cena exportada de suas próprias fábricas HouseMesh/Openings/FurnitureCatalog, incluindo os mapas PBR de madeira/tecido/revestimento com UV local. O conjunto da varanda conserva o ajuste ilustrativo de cerca de 10 cm para liberar a passagem, sem alterar o contorno ou reduzir o corpo do visitante. Nenhuma planta recebe o atlas da outra.

O bake de Meio tem 2048×2048 pixels, 512 amostras Cycles/OPTIX e 34 superfícies alvo, sobre 31.700 triângulos válidos. A captura preserva os 29 móveis nominais e suas partes por identidade explícita. O tapete conserva seu footprint e espessura em uma superfície fechada, eliminando 18 pares de faces coplanares da biblioteca. A conferência de normais/tapete passou antes do bake. O transporte inclui DIRECT/INDIRECT sem COLOR, permanece linear e recebe OIDN RTLightmap sem imagem auxiliar de albedo; nenhuma amostra denoised foi cortada pela faixa RGBM 16. Fontes e resultados estão em `interiores/meio/cena-exportada.json`, `cena-reproduzida.json` e `bake/`.

A sombra solar de 1024×1024 é calculada inicialmente e reaproveitada durante caminhada/giro. Mudar a visibilidade do forro, mover/girar/restaurar móveis ou alternar a geometria/material baked marca o mapa para atualizar. Planta 3D e Tour continuam usando o mesmo renderer. A restauração aplica o conjunto de móveis antes de recalcular as colisões e rotas uma vez.

O enquadramento considera o volume completo, a proporção da tela e o espaço dos controles. **Enquadrar** recupera a vista geral da Planta 3D; órbitas manuais são preservadas ao redimensionar e restaurar. O Tour prioriza focos do ambiente escolhido, conferindo obstruções e as posições atuais dos móveis. [CAMERAS.md](CAMERAS.md) registra o ajuste, sua reprodução e os limites.

A navegação utiliza as mesmas paredes e aberturas da planta, colisão contínua com paredes/folhas/móveis e rotas dentro dos ambientes. O corpo conserva raio de 30 cm e câmera a 1,62 m; os alvos ficam em pontos livres de cada ambiente. O ajuste de móveis invalida a iluminação baked incompatível e mantém iluminação dinâmica. Restaurar integralmente o layout original permite reativar o bake correspondente. Os ajustes permanecem na sessão da aba e são descartados quando a identidade da fonte muda. Cancelar a reabertura antes de o host concluir o preparo/restauração conserva o último snapshot válido de câmera/móveis, inclusive no intervalo após o interior ficar pronto. Não existe gravação comercial de alterações dos móveis.

O catálogo `interiores/catalogo.json` registra recursos e hashes por tipologia. `gerar_pacote_interiores.py` valida todas as entradas antes de gravar, adota arquivos completos por renomeação e conserva bytes/mtimes nas repetições idênticas. O canto conserva os bytes da cena e iluminação anteriores. Os inputs compartilhados existentes são verificados e preservados; `--atualizar-compartilhados` exige requalificar fontes e bakes vinculados. Os binários grandes ficam locais e identificados pelo catálogo.

## Fila e reprodução

A sequência continua **tela inicial → Tour → mapa → Planta 2D**. O Tour prepara os recursos compartilhados e as duas tipologias. O clique prioriza os arquivos compartilhados e os da tipologia escolhida, cancelando demandas antigas inclusive dentro do mesmo grupo. A fila apenas transfere e verifica dados; não constrói cenas ocultas.

```powershell
node experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/construir-meio.ts
python experimentos/liv-ipanema-webgpu-2026-10-09/exportar_bake_meio.py --validar
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_pacote_interiores.py --tipologia meio
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_manifesto_transferencias.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_luz_estatica.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/interiores-luz-estatica
```

O script de traçado produz documentos nominais; a conversão para `unidade.json` usa o pipeline registrado na referência. Não executar geradores canônicos/publicação como substituto desta evolução isolada.

`exportar_bake_meio.py` reconstrói a cena nominal pelas entradas congeladas num perfil descartável; `--validar` compara seus bytes com o snapshot aprovado sem substituí-lo. A reprodução local passou byte a byte. Para recalcular a luz, exportar a cena, executar `interior/preparar_luz.py --source .../meio/source.json --out .../meio/bake --size 2048 --padding 12`, conferir a geometria e sua aprovação, executar `interior/bake_luz.py` no Blender em background com `--out .../meio/bake --samples 512 --no-glb`, e `interior/denoise_luz.py --out .../meio/bake`. Esses scripts ficam em `v1.5/miniaturas/liv-ipanema/interior/`; seus destinos nesta etapa pertencem somente a Meio. Requerem xatlas, NumPy, SciPy, Blender/Cycles e OIDN 2.3.3. A aprovação existente só vale para seus hashes registrados. Recuperar os binários preservados e verificar as identidades quando for necessário conservar exatamente o pacote atual.

## Verificação registrada

O primeiro incremento de duas tipologias permanece documentado nos relatórios abaixo, do commit `5a25de4`. As novas provas de iluminação estão em `evidencias/luz-estatica/runtime.json`: seis casos PASS em WebGPU, WebGL2 e toque emulado, com duas plantas. A tela de toque usa CSS 390×844/DPR 3 e canvas efetivo 780×1688. Cada caminhada de 24 quadros reaproveitou a sombra com zero novos passes, contra 24 quando a atualização automática foi ligada no controle. Mover/restaurar produziu imagens idênticas ao recálculo de referência; o mesmo ponto/UV1 da parede variou no máximo 0,16 no RGB médio de 0–255 ao girar a câmera. Cinco regressões do empacotador passaram: repetição sem regravar, unidade incorreta, UVs do canto, atlas alterado e fábrica modificada; rejeições preservam todos os arquivos existentes.

- `evidencias/interiores-luz-estatica/runtime.json`: três perfis funcionais PASS com os dois bakes próprios. Resetar o conjunto de móveis consultou as rotas uma única vez em cada tipologia/perfil. Imagens 2D, caminhada, giro, móveis, sessão, PNG, alternância e descarte passaram com o código final.
- `evidencias/falhas-luz-estatica/runtime.json`: 19 cenários PASS. Inclui corrupção do atlas de Meio e associação indevida do atlas íntegro de Canto à identidade de Meio; ambos rejeitam a entrada e recuperam a iluminação correta ao tentar novamente.
- `evidencias/fila-luz-estatica/runtime.json`: quatro cenários PASS com os 139 arquivos reais. Cache frio/completo, prioridade do clique, pré-requisitos do mapa, compartilhamento, quota cheia e abertura sem Service Worker passaram.

Histórico do primeiro incremento, conservado com suas identidades originais:

- `evidencias/interiores-tipologias/runtime.json`: três perfis aprovados com o código final, desktop WebGPU, desktop WebGL2 e toque emulado 390×844. Confere imagens 2D, geometrias diferentes, seis ambientes de cada planta, circulação, troca de modo/tipologia, móveis, captura PNG decodificada, descarte e restauração da sessão. Planta 3D e Tour reutilizam o mesmo iframe; o tour também pode abrir diretamente e retornar à câmera de planta. Áreas de toque têm pelo menos 44 px e o painel de móveis não disputa espaço com o comando de caminhada.
- `evidencias/interiores-navegacao/runtime.json`: 48 rotas e 8.604 verificações independentes de colisão aprovadas. Exercita segmentos que tangenciam paredes, folhas e móveis girados, além de trajetos nos seis ambientes das duas unidades.
- `evidencias/falhas-interiores-final/runtime.json`: 17 cenários aprovados com o código final, incluindo ausência/falha de WebGPU, falha dos dois backends, recursos ausentes/corrompidos, erro de renderer, callback simulado de perda WebGPU, cancelamento durante fetch/init, driver sem resposta, snapshots preservados antes e após o primeiro frame e descarte de snapshot de outra identidade. A prova do driver sem resposta qualifica a abertura de 2D e remoção do contexto após 30 s; não mede memória GPU desse contexto.
- `evidencias/fila-tipologias/runtime.json`: quatro cenários aprovados com os 135 arquivos reais, cache frio/completo, prioridade do clique, mapa, quota cheia e abertura direta sem Service Worker. Doze casos menores do worker, incluindo interrupção entre canto/meio no mesmo grupo, duas abas e reinício do worker, estão em `evidencias/transferencias-tipologias/runtime.json`.
- `evidencias/navegacao-tipologias/runtime.json`: retorno mapa/maquete e histórico aprovados em 320, 768 e 1440 px, preservando o pavimento, a câmera e os controles; mapa de 5 km e catálogo de 614 pontos mantidos.

Os relatórios registram a identidade dos recursos e do código ensaiado. As capturas PNG ficam locais. Chrome 154.0.8037.98 no Windows, com WebGPU efetivo e fallback WebGL2; toque e viewport de celular são emulados. Estes resultados não demonstram fidelidade executiva, ganho de FPS ou funcionamento em Android/iPhone físicos.

```powershell
node experimentos/liv-ipanema-webgpu-2026-10-09/test_interior_navigation.mjs
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_transferencias.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/transferencias-tipologias
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_fila_integrada.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/fila-luz-estatica
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_falhas_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/falhas-luz-estatica
python experimentos/liv-ipanema-webgpu-2026-10-09/test_pacote_interiores.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_navegacao.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/navegacao-tipologias
```

Executar QAs de navegador em sequência. Requerem Playwright, Pillow, Chrome e o servidor local indicado no README. O traçado TypeScript usa Node 24 e o construtor local; a exportação usa Pillow e os módulos nominais do pipeline. O pacote compartilhado congela os módulos de geometria/móveis e materiais usados nesta etapa; regenerá-lo após mudar essas fontes requer nova qualificação.

## Limites

Esta etapa não constitui levantamento arquitetônico, configuração garden, vínculo por final, área útil aferida, estoque ou disponibilidade comercial. Espelhamentos e acabamentos finais ainda precisam de confirmação. Qualificação Android/iPhone físicos e desempenho permanecem no plano. Nenhuma publicação é feita por estes comandos.

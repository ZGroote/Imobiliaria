# LIV — duas plantas e interiores

Etapa de 10/10/2026, antecipada pela solicitação do usuário. A escolha **Canto / Meio** é um catálogo de tipologias e permanece independente da seleção de pavimento. O vínculo de cada final com a tipologia e a orientação do espelho continua pendente.

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

Os materiais PBR e seus mapas são preservados como materiais padrão. O transporte RGBM em TSL fica restrito à iluminação específica do canto, com unidade, fonte, geometria compacta, UV1 e atlas conferidos. O meio usa geometria própria das fábricas HouseMesh/Openings/FurnitureCatalog, mapas PBR de madeira/tecido/revestimento reaproveitados com UV local e iluminação dinâmica. O conjunto da varanda recebeu ajuste ilustrativo de cerca de 10 cm para liberar a passagem, sem alterar o contorno ou reduzir o corpo do visitante. Seu bake específico permanece pendente; nunca recebe o atlas do canto.

A navegação utiliza as mesmas paredes e aberturas da planta, colisão contínua com paredes/folhas/móveis e rotas dentro dos ambientes. O corpo conserva raio de 30 cm e câmera a 1,62 m; os alvos ficam em pontos livres de cada ambiente. O ajuste de móveis invalida a iluminação baked incompatível e mantém iluminação dinâmica. Restaurar integralmente o layout original permite reativar o bake correspondente. Os ajustes permanecem na sessão da aba e são descartados quando a identidade da fonte muda. Cancelar a reabertura antes de o host concluir o preparo/restauração conserva o último snapshot válido de câmera/móveis, inclusive no intervalo após o interior ficar pronto. Não existe gravação comercial de alterações dos móveis.

O catálogo `interiores/catalogo.json` registra recursos e hashes por tipologia. `gerar_pacote_interiores.py` produz os pacotes a partir das fontes locais; o canto conserva os bytes da cena e iluminação anteriores. Os binários grandes ficam locais, regeneráveis e identificados pelo catálogo.

## Fila e reprodução

A sequência continua **tela inicial → Tour → mapa → Planta 2D**. O Tour prepara os recursos compartilhados e as duas tipologias. O clique prioriza os arquivos compartilhados e os da tipologia escolhida, cancelando demandas antigas inclusive dentro do mesmo grupo. A fila apenas transfere e verifica dados; não constrói cenas ocultas.

```powershell
node experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/construir-meio.ts
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_pacote_interiores.py
python experimentos/liv-ipanema-webgpu-2026-10-09/gerar_manifesto_transferencias.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/interiores-tipologias
```

O script de traçado produz documentos nominais; a conversão para `unidade.json` usa o pipeline registrado na referência. Não executar geradores canônicos/publicação como substituto desta evolução isolada.

## Verificação registrada

- `evidencias/interiores-tipologias/runtime.json`: três perfis aprovados com o código final, desktop WebGPU, desktop WebGL2 e toque emulado 390×844. Confere imagens 2D, geometrias diferentes, seis ambientes de cada planta, circulação, troca de modo/tipologia, móveis, captura PNG decodificada, descarte e restauração da sessão. Planta 3D e Tour reutilizam o mesmo iframe; o tour também pode abrir diretamente e retornar à câmera de planta. Áreas de toque têm pelo menos 44 px e o painel de móveis não disputa espaço com o comando de caminhada.
- `evidencias/interiores-navegacao/runtime.json`: 48 rotas e 8.604 verificações independentes de colisão aprovadas. Exercita segmentos que tangenciam paredes, folhas e móveis girados, além de trajetos nos seis ambientes das duas unidades.
- `evidencias/falhas-interiores-final/runtime.json`: 17 cenários aprovados com o código final, incluindo ausência/falha de WebGPU, falha dos dois backends, recursos ausentes/corrompidos, erro de renderer, callback simulado de perda WebGPU, cancelamento durante fetch/init, driver sem resposta, snapshots preservados antes e após o primeiro frame e descarte de snapshot de outra identidade. A prova do driver sem resposta qualifica a abertura de 2D e remoção do contexto após 30 s; não mede memória GPU desse contexto.
- `evidencias/fila-tipologias/runtime.json`: quatro cenários aprovados com os 135 arquivos reais, cache frio/completo, prioridade do clique, mapa, quota cheia e abertura direta sem Service Worker. Doze casos menores do worker, incluindo interrupção entre canto/meio no mesmo grupo, duas abas e reinício do worker, estão em `evidencias/transferencias-tipologias/runtime.json`.
- `evidencias/navegacao-tipologias/runtime.json`: retorno mapa/maquete e histórico aprovados em 320, 768 e 1440 px, preservando o pavimento, a câmera e os controles; mapa de 5 km e catálogo de 614 pontos mantidos.

Os relatórios registram a identidade dos recursos e do código ensaiado. As capturas PNG ficam locais. Chrome 154.0.8037.98 no Windows, com WebGPU efetivo e fallback WebGL2; toque e viewport de celular são emulados. Estes resultados não demonstram fidelidade executiva, ganho de FPS ou funcionamento em Android/iPhone físicos.

```powershell
node experimentos/liv-ipanema-webgpu-2026-10-09/test_interior_navigation.mjs
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_transferencias.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/transferencias-tipologias
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_fila_integrada.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/fila-tipologias
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_falhas_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/falhas-interiores-final
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_navegacao.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/navegacao-tipologias
```

Executar QAs de navegador em sequência. Requerem Playwright, Pillow, Chrome e o servidor local indicado no README. O traçado TypeScript usa Node 24 e o construtor local; a exportação usa Pillow e os módulos nominais do pipeline. O pacote compartilhado congela os módulos de geometria/móveis e materiais usados nesta etapa; regenerá-lo após mudar essas fontes requer nova qualificação.

## Limites

Esta etapa não constitui levantamento arquitetônico, configuração garden, vínculo por final, área útil aferida, estoque ou disponibilidade comercial. Espelhamentos ainda precisam de confirmação. Qualificação Android/iPhone físicos, desempenho e iluminação baked do meio permanecem no plano. Nenhuma publicação é feita por estes comandos.

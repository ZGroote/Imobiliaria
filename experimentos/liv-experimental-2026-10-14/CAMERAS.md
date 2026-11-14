# LIV — enquadramento das plantas e vistas do Tour

Incremento local de 10/10/2026 sobre `ffffd59`, para as tipologias Canto e Meio.

## Problema e ajuste

O enquadramento anterior calculava a distância somente pela largura/profundidade da planta. A altura das paredes e a profundidade relativa à câmera também ampliam a projeção. No ensaio direto de 960×720, WebGL2, os oito cantos do volume completo alcançaram coordenadas de tela normalizadas de **1,407 em Canto** e **1,219 em Meio**; o limite da tela é 1. As capturas e o relatório do código anterior ficam em `evidencias/cameras-antes/runtime.json`.

`interior-camera.js` calcula a distância a partir dos oito cantos reais, do FOV e da proporção do canvas. `interior-renderer.js` reserva espaço para os controles e textos do interior. A vista inicial mostra o volume inteiro, e **Enquadrar** recupera essa apresentação depois de girar, deslocar ou aproximar. A câmera enquadrada acompanha o redimensionamento. Gestos de órbita/zoom passam a preservar a vista manual; redimensionar não apaga essa escolha.

A restauração também elimina a inércia pendente do OrbitControls antes de aplicar a pose. O ensaio anterior encontrou deslocamento de aproximadamente 5 cm ao restaurar uma câmera logo após um arrasto. O ajuste usa os métodos públicos `update` e `enableDamping`, sem depender de propriedades internas do controle.

No Tour, a chegada prioriza a cama nos quartos, sofá/mesa na sala e peças adequadas nos demais ambientes. O alvo usa os móveis atuais e precisa pertencer ao ambiente solicitado. Uma consulta de visibilidade contra as malhas rejeita focos obstruídos; vidro transparente não bloqueia essa consulta. Ambientes sem foco adequado conservam a orientação de circulação existente. Essa consulta acontece na abertura/chegada, sem acrescentar raycast ao giro ou à caminhada manual.

Os alvos são escolhas de apresentação do interior ilustrativo. O corpo e a câmera conservam raio de 30 cm e altura de 1,62 m. Os trajetos, dimensões, mapas PBR, geometria, forro e atlas RGBM próprios permanecem associados às mesmas identidades.

## Reprodução e verificação

```powershell
node experimentos/liv-ipanema-webgpu-2026-10-09/test_interior_camera.mjs
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_cameras_interiores.py
```

O teste CPU usa a projeção efetiva de PerspectiveCamera como verificação independente da fórmula: 80 cantos em dez combinações de proporção/margens, além de foco visível/obstruído e preservação das entradas. O QA abre o visualizador integrado em Chrome descartável e verifica ambos os interiores em WebGPU, WebGL2 e toque emulado. Confere o retorno da câmera manual, redimensionamento, ida real a um ambiente, vistas dos seis ambientes, PNG decodificado e descarte. A assinatura das malhas, materiais e mapas antes/depois das mudanças de câmera detecta alterações indevidas na cena.

`evidencias/cameras-interiores/runtime.json` registra **três perfis PASS**, com ambas as plantas, em Chrome 154.0.8037.98/Windows. As oito projeções de cada volume ficaram dentro das margens declaradas. O desktop usou canvas de 920×556; o toque emulado usou DPR 3, limitado pelo renderer a DPR 2, com canvas de 728×908. O mesmo contexto de toque passou em 320×568 e 844×390, voltando ao retrato inicial. A restauração manual variou no máximo 3,6×10⁻¹⁵ m, sem o desvio da inércia. Todos os recursos próprios foram descartados, e a assinatura de geometria/materiais/mapas permaneceu idêntica.

`evidencias/interiores-cameras/runtime.json` registra três perfis funcionais PASS com caminhada real nos seis ambientes de cada planta, móveis, modos, sessão, captura e descarte. A reprodução autoral de Meio também passou byte a byte.

`evidencias/luz-cameras-visibilidade/runtime.json` registra seis casos PASS. A pose de regressão da parede é independente dos novos focos do Tour. O raycast de toda a cena confere que o ponto acima de 2,10 m é a primeira superfície opaca visível, antes e depois do giro; face e UV1 são os mesmos. A variação máxima do RGB médio foi 0,16/255. A caminhada continuou reaproveitando a sombra, sem novos passes; a imagem restaurada diferiu no máximo 1/255 do recálculo de controle. Os hashes de código dos três relatórios foram conferidos após concluir os ensaios. O relatório anterior `luz-cameras/` precede o teste com visibilidade explícita e não representa o QA final.

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/interiores-cameras
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_luz_estatica.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/luz-cameras-visibilidade
```

Não mede desempenho nem fidelidade em celulares físicos. O vínculo por final, espelhamentos e acabamentos finais continuam no plano; não houve publicação.

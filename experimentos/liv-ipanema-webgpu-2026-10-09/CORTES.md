# LIV — paredes em corte na Planta 3D

O corte de apresentação de Canto e Meio revela os móveis atrás das paredes da frente. A altura de **1,20 m** é uma escolha de visualização, sem alterar o pé-direito nominal nem as dimensões ilustrativas das duas fontes. **Paredes baixas** alterna entre corte e paredes inteiras; a preferência acompanha o snapshot da tipologia. O Tour sempre recupera paredes, esquadrias, forro e luminárias completos.

`interior-cutaway.js` usa [ClippingGroup do Three.js](https://threejs.org/docs/pages/ClippingGroup.html), disponível no WebGPURenderer r186.1 usado pelo projeto. O grupo corta paredes e esquadrias, conservando as malhas e os materiais PBR/RGBM existentes. Móveis mantêm sua altura e não entram nesse grupo. Forro, plafons e acabamentos junto ao teto ficam ocultos na Planta 3D; permanecem visíveis no Tour.

A tampa do corte usa os eixos, espessura de 13 cm e remates da construção nativa. Só cobre trechos de parede que atravessam a altura escolhida, sem fechar os vãos de portas. Suas 48 faces triangulares em Canto e 52 em Meio formam uma malha por interior e reutilizam o material PBR original da parede, incluindo seus mapas e UVs projetadas no plano horizontal. Essa malha é apenas de apresentação, não atua na colisão e não projeta sombra.

O corte conserva a sombra do apartamento completo (`clipShadows=false`), coerente com o atlas próprio de cada tipologia. Alternar **Paredes baixas** não pede recálculo da sombra nem invalida o bake. A troca Planta 3D/Tour continua atualizando a sombra quando a visibilidade do forro muda. Caminhada e giro conservam o cache existente.

No caminho autoral de Meio, uma cópia da hierarquia nominal é capturada antes da preparação da apresentação. Compartilha os dados PBR e de geometria existentes e mantém ordem e transformações originais. `exportar_bake_meio.py` usa essa hierarquia; o corte e sua tampa não entram na fonte do bake. A reprodução `--validar` passou byte a byte, conservando a fonte `677d11f09f5b86b81f1599ef15d64cbf109e51ca1abd40dbb991b844065bf188` e a fábrica `8cdcb146c77f61820dea230ce4c9c33f6654171ebb61059cdafb515311bae48a`.

## Verificação

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_corte_interiores.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_cameras_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/cameras-corte
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_luz_estatica.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/luz-corte
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_interiores.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/interiores-corte
python experimentos/liv-ipanema-webgpu-2026-10-09/exportar_bake_meio.py --validar
```

O ensaio de corte localiza por raycast pontos visíveis da parede completa, acima e abaixo do corte. Compara pixels do canvas no mesmo enquadramento: as superfícies acima devem revelar o interior, enquanto as de baixo devem permanecer estáveis. As amostras da região preservada usam centros de pixels e uma margem de dois pixels confirmada por raycast, evitando misturar bordas de janelas com superfícies reveladas pelo corte. Verifica os centros dos seis vãos de portas por tipologia contra a tampa, identidade das malhas/materiais/mapas, cache de sombra, Tour, preferência restaurada, snapshots antigos e descarte de recursos.

`evidencias/corte-interiores/runtime.json` registra **seis casos PASS**, Canto/Meio em WebGPU, WebGL2 e toque emulado. Cada caso conferiu 40 amostras reveladas acima do corte e 40 preservadas abaixo; as 40 amostras acima mudaram mais de 5/255 no RGB médio. A variação máxima abaixo foi 0,12/255. Os 36 testes de vãos ficaram vazios, e todos os recursos próprios foram descartados.

`evidencias/cameras-corte/runtime.json` registra **três perfis PASS** com ambas as tipologias, incluindo redimensionamento para 320 px e paisagem, foco dos seis ambientes, retorno à planta e órbita manual. A restauração da câmera variou no máximo 4,5×10⁻¹⁵ m. `evidencias/luz-corte/runtime.json` registra **seis casos PASS**: cada caminhada de 24 quadros teve zero novos passes de sombra, o recálculo de controle diferiu no máximo 1/255 e o ponto acima da porta manteve face/UV1/visibilidade, com variação média máxima de 0,16/255 durante o giro. Esses relatórios incluem o novo módulo de corte nos hashes do código.

`evidencias/interiores-corte/runtime.json` registra **três perfis funcionais PASS** com as duas tipologias. Confere imagens 2D, giro/ida real aos seis ambientes, móveis e recuperação do bake, alternância de modos/tipologias, captura, sessão, cancelamento e descarte. Os hashes do código dos quatro relatórios foram conferidos após os ensaios.

Os relatórios de navegador registram os hashes do código testado. As capturas PNG permanecem locais. Toque/DPR e telas de celular são emulados em Chrome desktop; o ensaio não mede FPS ou uso de memória em Poco/Android/iPhone físicos. Não houve publicação nem alteração nos binários da fila de transferência.

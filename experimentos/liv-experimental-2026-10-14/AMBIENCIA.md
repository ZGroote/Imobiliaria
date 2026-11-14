# Dia e entardecer ilustrativo — 11/10/2026

O controle **Iluminação da maquete** alterna o estado diurno preservado e um entardecer de direção artística. A escolha acompanha a sessão, os dois apartamentos e o retorno do mapa; `?luz=dia` ou `?luz=entardecer` explícito prevalece sobre a sessão. Os interiores conservam sua iluminação pré-calculada aprovada, independente dessa escolha exterior.

`ambiencia.js` ajusta cor, exposição, intensidade/reflexos e fundo por propriedades padrão. Conserva a identidade dos materiais, roughness/metalness/Physical, geometrias, UVs e um único atlas RGBM. Não há shader escrito para cada material, transmissão adicional ou nova cena. As sombras continuam fixas. `ambiencia-perfis.js` separa os parâmetros puros, para que a página hospedeira e o mapa não carreguem Three.js somente para conservar a escolha.

**O entardecer reutiliza o bake diurno e a direção fixa das luzes.** É um estudo visual, não um segundo bake de iluminação fisicamente coerente e não uma simulação de sol por localização/data/hora. T07 ainda precisa de calibração artística final com as referências; T16 aguarda norte/implantação validados e contribuições direta/indireta separadas. Não mover o sol sobre essa sombra fixa nem rotular a opção como análise de insolação.

## Verificação

Duas verificações Node passaram: restauração exata das propriedades/identidades, idempotência, estado inválido, descarte e sombras preservadas; queries válidas. [QA funcional](evidencias/ambiencia-conferida/runtime.json): três perfis aprovados, WebGPU desktop, WebGL2 desktop e 390 px/toque emulado, no Chrome 154.0.8037.98/Windows 11/GTX 1650.

- Nove vistas dia → entardecer → dia, PNG real decodificado; diferença máxima na restauração **0/255**.
- Nas regiões opacas do modelo, diferença média RGB dia/entardecer entre 15,90 e 20,11 níveis; o `meanRgbaChange` do relatório inclui também o fundo/alpha, não é uma medida isolada de material.
- Nenhum novo download do RGBM/PMREM nem chamada de atualização das matrizes de sombra durante as trocas medidas. Dados-fonte/malhas/materiais restaurados sem mudança.
- Seleção mantida, vinte alternâncias, Canto/Meio nos três modos, opção exterior desabilitada nos interiores, recarga com query explícita e retorno real do mapa aprovados.

`uniformChangeMs` soma **vinte alterações e submissões síncronas**: 38,9–53,6 ms nos perfis. Não representa tempo GPU ou FPS sustentado, nem qualifica aparelho físico. A primeira execução em `ambiencia-final/` conserva um erro do protocolo: o helper aguardava Maquete depois de escolher Planta 2D. O helper foi chamado com o modo correto na repetição; nenhuma correção do produto foi necessária para esse timeout.

```powershell
& 'C:/Program Files/nodejs/node.exe' --test experimentos/liv-ipanema-webgpu-2026-10-09/test_ambiencia.mjs
& 'C:/Python314/python.exe' experimentos/liv-ipanema-webgpu-2026-10-09/qa_ambiencia.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/ambiencia-nova
```

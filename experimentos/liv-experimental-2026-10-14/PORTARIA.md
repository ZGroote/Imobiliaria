# Acesso de perto e acabamentos nativos — 10/10/2026

Atualização de 11/10: [entrada revisada](modelo/entrada/README.md) com portal/marquise/guarita corrigidos pela imagem de divulgação, geometria fechada sem sobreposições, quatro PBR padrão e UV/bake próprios. A edição opcional `?geometria=entrada` está ligada à maquete completa, cadastro aproximado, mapa e fila; Canto e Meio continuam experiências gerais separadas. Qualificação e custo em [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md). O registro abaixo descreve a revisão anterior, preservada.

A maquete oferece **Acesso de perto**, além da vista ampla **Portaria**. O novo
enquadramento mira o portal, a marquise e a placa do modelo existente. A distância
se adapta à proporção da tela; girar manualmente deixa a câmera livre. A vista
e a seleção do pavimento/final voltam após a Planta 2D e a recarga da sessão.

O perfil `referencia` mantém o acabamento pintado da torre e acrescenta dois
clones de **MeshStandardMaterial**: vidros da implantação com metalness 0 e
roughness 0,16; letreiro com metalness 0 e roughness 0,65. São ajustes estimados
da resposta PBR, sem medição fotométrica ou especificação da incorporadora.
A conversão para nós é feita pelo WebGPURenderer fixado em Three.js 0.186.1,
tanto em WebGPU quanto em WebGL2. Não foi escrito um shader novo.

O grupo exportado de vidros reúne os volumes da implantação, incluindo acesso
e equipamentos comuns. A revisão abrange esse grupo inteiro. Os vidros dos
carros compartilham o material original, mas conservam sua atribuição. O
letreiro recebe um clone separado do usado nas esquadrias da torre. As três
atribuições têm SHA da edição, nomes semânticos e assinaturas verificados antes
de qualquer alteração. Os três clones entram no descarte da cena.

As 56 malhas, 41 superfícies baked, cor base, posições, normais, matrizes, UV1,
texturas, irradiância e luzes são preservadas. Os vidros continuam opacos: a cena
não contém um interior completo da guarita para uma representação transmissiva.
Nenhum arquivo é acrescentado à fila de conteúdos. Os dois apartamentos e seus
respectivos bakes não foram alterados.

## Referência e limites visuais

Foi inspecionado o render oficial `referencias/portaria.jpg`, da
[galeria do LIV Ipanema](https://www.livonincorporadora.com.br/produtos/liv-ipanema/).
SHA-256: `5c66690329183ba4adf56401cf0d6c6b470cbb42feba810499ddec7acc379cc2`;
1.200 × 628 px, 78.340 bytes. Mostra portal retangular, marquise baixa, grades,
vidros e placa de identificação. O ambiente de entardecer não permite extrair
valores exatos de roughness, metalness ou cor.

A aproximação também expõe diferenças importantes: o portal e a marquise do
modelo têm posição/forma simplificadas; a placa fica parcialmente encoberta
por grades/pilares, e a marca ainda usa tipografia/cor aproximadas. Estes ajustes
de material e câmera **não encerram a reconstrução da entrada**. O perímetro
da cobertura da torre continua pendente conforme [NOTAS-GEOMETRIA.md](modelo/NOTAS-GEOMETRIA.md).
Corrigir esses volumes exige autoria, UVs e iluminação da própria variante.

O comparativo coloca o render oficial ao lado de duas capturas do modelo.
Somente as capturas base/referência têm câmera e luz iguais. A diferença de pixels
constata alteração do acabamento; não comprova fidelidade geométrica, melhoria
artística, ganho de FPS ou de abertura. T06 e T07 permanecem parciais.

## Verificação reproduzível

Com o servidor da raiz em `127.0.0.1:8790`:

```powershell
node --test experimentos/liv-ipanema-webgpu-2026-10-09/test_acabamentos.mjs experimentos/liv-ipanema-webgpu-2026-10-09/test_unidades.mjs
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_refinamento.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/refinamento-acesso-final
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_portaria.py
python experimentos/liv-ipanema-webgpu-2026-10-09/qa_unidades.py --saida experimentos/liv-ipanema-webgpu-2026-10-09/evidencias/unidades-portaria-final
```

Executar os ensaios gráficos sequencialmente. `qa_portaria.py` compara os três
clones com seus materiais fonte, preservação das malhas/atlas, oito cantos do
enquadramento em cinco tamanhos de tela, seleção do final, PNG, sessão, câmera
livre e descarte. Os perfis são WebGPU desktop, WebGL2 desktop e toque emulado.
O ensaio de unidades também percorre as duas plantas em 2D/3D/Tour e recuperação
de catálogo. Os resultados ficam em destinos próprios, com hashes do código
e dos recursos usados; os relatórios anteriores continuam históricos.

Resultado registrado: **sete testes CPU passaram**. Os três perfis passaram no
[acesso](evidencias/portaria-final/runtime.json), nos
[acabamentos/Varandas](evidencias/refinamento-acesso-final/runtime.json) e na
[seleção e interiores](evidencias/unidades-portaria-final/runtime.json).
O acesso manteve os oito cantos da caixa visíveis em cinco tamanhos por perfil;
os três clones, dois materiais fonte compartilhados e atlas foram descartados
uma vez ao trocar de modo. Girar por toque, câmera livre ao redimensionar,
sessão e final selecionado passaram. A rejeição real de assinatura liberou
111 recursos e dois bitmaps antes da recuperação; duas falhas de catálogo
também se recuperaram. Os 14 recursos do catálogo de interiores e os 139 da
fila foram conferidos byte a byte; a fila conserva 33.298.171 bytes de conteúdo.

O telefone Poco X6 5G do usuário ainda precisa de ensaio físico. Este incremento
não resolve o critério de tempo de abertura registrado em [PERF.md](PERF.md).
A versão pública não foi modificada.

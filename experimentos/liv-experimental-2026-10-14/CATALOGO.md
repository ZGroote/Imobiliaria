# Posições do edifício e seleção pela maquete

[Prévia local com a entrada e o catálogo completo](http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio). A página do produto usa entrada e edifício completo por padrão, com seleção nos 17 níveis. `unidades=piloto` ativa explicitamente o experimento de dez finais. A edição da geometria pode ser solicitada separadamente: base, contorno ou entrada. Os helpers e catálogos dos experimentos conservam seus próprios padrões.

## Identidade e limites

O book, página 16, publica térreo + 16 pavimentos tipo, dez unidades por nível, 170 unidades e 175 vagas. O cadastro expande as dez zonas já registradas na página 15 usando o espaçamento de 2,85 m do modelo. Isso reconcilia a contagem publicada com 170 posições técnicas; não comprova divisórias, numeração comercial, áreas, gardens, tipologia ou espelhamento por final.

Os IDs são `liv-ipanema/pavimento-modelo-00/final-01` até `liv-ipanema/pavimento-modelo-16/final-10`. O índice 00 é térreo, 01–16 são níveis do modelo. IDs do primeiro pavimento permanecem iguais ao piloto. Não inferir número comercial a partir desses IDs. A ficha indica no térreo que área/limites do quintal ainda precisam de conferência; não se criaram gardens retangulares presumidos.

`catalogo-unidades.js` valida a fonte do piloto antes da expansão e conserva sua identidade, contorno, ordem, campos vazios e matriz de limitações. Cadastro e renderer conferem o mesmo SHA-256 do modelo. A fonte não é modificada pela seleção ou pela expansão.

## Fluxo

O clique/toque na fachada identifica final e pavimento e mostra o apartamento selecionado, preservando a câmera. **Informações do apartamento** abre sua ficha; os botões de planta 2D/3D e Tour ficam disponíveis após validar o vínculo dessa unidade. Voltar à maquete mantém a seleção para escolher outra visualização ou outro apartamento. A seleção funciona também com “Sem destaque”. Alterar manualmente o pavimento limpa uma seleção de outro nível. Laje, cobertura, circulação e faces ocultas continuam sem apartamento presumido.

O filtro de disponibilidade fica junto às opções da maquete e destaca os disponíveis em verde. Os estados desconhecidos permanecem neutros. Sessão, reload e retorno do mapa preservam geometria, pavimento e seleção. Canto/Meio são escolhidos pelos vínculos explícitos do cadastro; nenhuma planta é atribuída por semelhança visual.

Os 170 realces reutilizam as mesmas duas geometrias do piloto e dez contornos normalizados, deslocados/escalados na seleção. Não há um renderer ou uma geometria de destaque por apartamento. A expansão acrescenta registros; seu custo completo precisa entrar nos ensaios de rede/memória/aparelhos.

## Verificação

Os ensaios abaixo registram a interface anterior com espelho. A interface atual é verificada por `qa_entrega.py`, `qa_comercial.py`, `qa_vinculos.py` e `qa_demo_disponibilidade.py`, incluindo ausência dos blocos removidos e seleção pela fachada. O teste com 136 ocupados e 34 disponíveis está descrito em [DEMONSTRACAO.md](DEMONSTRACAO.md).

`node --test test_catalogo_unidades.mjs test_unidades.mjs test_contorno_unidades.mjs`: 21 testes sobre três edições, unicidade, 17×10, fonte preservada, gardens pendentes, raios de todos os níveis, limites, câmeras e mesmos buffers de destaque. `python qa_catalogo.py --saida evidencias/catalogo-edificio-fachada`: três perfis, 510 seleções sincronizadas, cliques reais de fachada/espelho em térreo/1º/8º/16º, teclado/filtro, dois interiores nos quatro modos, reload e retorno do mapa. Os testes não declaram aparelho físico.

`evidencias/piloto-apos-catalogo/` registra três perfis do piloto, recuperação de catálogo inválido e retorno do mapa. Os primeiros QAs do catálogo corrigiram duas expectativas do script: a indicação é “sem vínculo com uma unidade específica”, e um global ainda não inicializado precisa ser acessado por `window`. A captura inicial também revelou o excesso de céu nos andares altos; a vista do espelho passou a enquadrar toda a fachada, mantendo a câmera do piloto.

T11 continua parcial até conferência por final e integração comercial real. A estrutura de 170 posições não é uma homologação arquitetônica ou comercial.

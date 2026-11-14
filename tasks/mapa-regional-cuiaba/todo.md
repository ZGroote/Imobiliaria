# Tarefas: teste de mapas regionais em Cuiabá

Estado: planejamento concluído; implementação não iniciada. Referências: [plano](plan.md) e [decisão proposta](decisao-base.md). Arquivos marcados como novos são sugestões de localização, não módulos existentes.

## T01 — Definir pontos e cobertura do piloto

**Descrição:** selecionar pontos técnicos sem empreendimento real, inventariar as camadas e fixar a área de referência maior.

**Aceite:**
- [ ] Coordenadas verificadas dos quatro cenários registradas; dois pontos escolhidos para a primeira entrega.
- [ ] Área de referência contém os raios de 5 km e margem dos primeiros pontos; código municipal, CRS e origens documentados.
- [ ] Cada fonte tem estado confirmado/pendente e a ausência de lotes oficiais não é tratada como dado cadastral disponível.

**Verificação:** conferir coordenadas e cobertura nas fontes; validar a configuração via `padrao.cidade.carrega('cuiaba')` quando criada.
**Dependências:** nenhuma. **Escopo:** pequeno.
**Arquivos previstos:** `padrao/cidades/cuiaba.json` (novo), `tasks/mapa-regional-cuiaba/pontos.json` (novo), `tasks/mapa-regional-cuiaba/fontes.md` (novo).

## T02 — Fixar contrato regional e protocolo de medição

**Descrição:** definir entrada centro/raio/perfil/snapshot, manifesto, política de borda, origem e medições antes de implementar derivações.

**Aceite:**
- [ ] Contrato aceita 2.500/5.000 m, diferencia camada vazia de importação falha e declara margem/entidades retidas.
- [ ] Referência e pacote regional usam o mesmo perfil; condições de cache e cinco execuções por cenário registradas.
- [ ] Critérios de identidade, cobertura, bytes, memória e tempo definidos; meta numérica de redução será preenchida após a baseline.

**Verificação:** validar exemplos de manifesto, incluindo latitude/longitude invertidas, raio inválido e cobertura insuficiente.
**Dependências:** T01. **Escopo:** pequeno.
**Arquivos previstos:** `pipeline/regional/contrato.py` (novo), `tests/test_regional_contrato.py` (novo), `tasks/mapa-regional-cuiaba/protocolo.md` (novo).

## T03 — Preparar a base espacial local

**Descrição:** criar a configuração reproduzível do PostGIS e o catálogo de fontes/snapshots/cobertura/feições/rasters/pacotes.

**Aceite:**
- [ ] Instância de teste isolada e schema versionado, com índice espacial correspondente às consultas.
- [ ] Importação idempotente por fonte/versão/ID e publicação de snapshot apenas depois da validação.
- [ ] Configuração não contém credenciais reais; há procedimento para reconstruir a base de teste.

**Verificação:** teste de integração de importação repetida, raio em metros e plano de consulta com volume representativo.
**Dependências:** T02. **Escopo:** médio.
**Arquivos previstos:** `pipeline/regional/schema.sql`, `pipeline/regional/base.py`, configuração local da base e `tests/test_regional_base.py` (novos).

## T04 — Importar vias e contexto OSM

**Descrição:** usar extrato Centro-Oeste e armazenar vias, água, áreas verdes e POIs da área de teste com geometrias e dependências completas.

**Aceite:**
- [ ] Seleção do PBF explícita e parser `--pbf` corrigido, sem interpretar caminho como cidade.
- [ ] IDs, relações/multipolígonos e nós de borda preservados; falhas ficam no relatório de importação.
- [ ] Snapshot registra data/hash/cobertura, e uma segunda execução não repete o download existente.

**Verificação:** fixtures de via e multipolígono cruzando bbox; amostragem visual de centro/borda e teste de repetição.
**Dependências:** T03. **Escopo:** médio.
**Arquivos previstos:** `pipeline/fontes/osm_extract.py`, `pipeline/regional/importar_osm.py` e `tests/test_regional_osm.py` (dois novos).

## T05 — Importar edificações Overture

**Descrição:** obter edificações por área e importar uma versão fixada, com IDs e atributos conhecidos.

**Aceite:**
- [ ] Download sempre limitado por bbox e versão registrada; sem alteração do snapshot durante a geração.
- [ ] Origem, geometria e alturas disponíveis preservadas; estimativas permanecem identificadas.
- [ ] Importação valida geometria, rejeições e duplicidade; não confunde footprint com lote.

**Verificação:** comparar amostra importada com o arquivo original, contagens/checksums e importação repetida.
**Dependências:** T03; pode ocorrer em paralelo com T04 após o contrato comum. **Escopo:** médio.
**Arquivos previstos:** `pipeline/fontes/overture.py`, `pipeline/regional/importar_overture.py`, `tests/test_regional_overture.py` (dois novos).

## Checkpoint A — Base mínima consultável

- [ ] Fontes, geometria e limites da primeira região validados; snapshot pronto.
- [ ] Consultar dois pontos cobertos retorna somente a região/dependências necessárias sem novos downloads externos.
- [ ] Disponibilidade cadastral e qualidade local registradas separadamente da completude de importação.

## T06 — Exportar pacote regional com identidade estável

**Descrição:** consultar a base por raio/margem e emitir entradas compatíveis com o pipeline, manifesto e hashes.

**Aceite:**
- [ ] Seleção usa geometria completa, origem única e IDs determinísticos; não lê todo o acervo por empreendimento.
- [ ] Cobertura insuficiente de camada obrigatória tem estado específico; o pacote validado fixa o snapshot.
- [ ] Pedido repetido reutiliza pacote; ponto próximo reutiliza a base sem consultar fornecedores.

**Verificação:** testes de interseção na borda, dependências, origem, repetibilidade e cache; medir consultas/bytes lidos.
**Dependências:** Checkpoint A. **Escopo:** médio.
**Arquivos previstos:** `pipeline/regional/exportar.py`, `pipeline/regional/pacote.py`, `tests/test_regional_exportar.py` (novos).

## T07a — Converter e classificar as fontes regionais

**Descrição:** converter OSM/Overture exportados para o formato compacto intermediário `city_v2`, preservando o elo com IDs e coordenadas das fontes.

**Aceite:**
- [ ] `city_v2` contém edifícios/vias classificados e atributos necessários ao consumo posterior.
- [ ] IDs/procedência e origem/projeção preservados; valores estimados permanecem identificados.
- [ ] Conversão usa somente o pacote regional e suas dependências declaradas.

**Verificação:** comparar registros convertidos com originais e com a referência de mesmo perfil; medir tempo/bytes da conversão.
**Dependências:** T06. **Escopo:** médio.
**Arquivos previstos:** `pipeline/regional/converter.py`, `tests/test_regional_converter.py` (novos), adaptador da conversão/classificação existente a identificar na implementação.

## T07b — Construir o grafo e as faces regionais

**Descrição:** construir `faces_ruas`, requerido por `pipeline/city_base.py`, usando ruas completas e a margem validada.

**Aceite:**
- [ ] Grafo preserva conectividade e mantém relação com as vias originais.
- [ ] Faces/quadras internas correspondem à referência maior; bordas não fecham artificialmente.
- [ ] Dependências que excedam a margem provocam ampliação registrada ou estado específico de insuficiência.

**Verificação:** fixtures de vias atravessando a borda, quadra que cruza o círculo e relação maior que a margem; comparar faces internas.
**Dependências:** T07a. **Escopo:** médio.
**Arquivos previstos:** `pipeline/regional/faces.py`, `tests/test_regional_faces.py` (novos), adaptador da etapa viária existente a identificar.

## T07c — Agrupar edifícios e gerar malhas regionais

**Descrição:** alimentar `pipeline/city_base.py` com `city_v2`/`faces_ruas` regionais, gerar grupos e triangular chão/asfalto.

**Aceite:**
- [ ] `b[]`, `bl[]` e registros de streaming válidos, sem trocar identidades na reindexação.
- [ ] Geometrias observadas equivalentes no domínio comum; estimativas e diferenças procedurais avaliadas separadamente.
- [ ] Grupos de renderização e dados sintéticos não aparecem como cadastro oficial de terrenos.

**Verificação:** decoder de `tests/test_city_data.mjs`, gate de identidade e comparação de núcleo/borda; medir agrupamento/triangulação.
**Dependências:** T07b. **Escopo:** médio.
**Arquivos previstos:** `pipeline/regional/derivar.py`, `tests/test_regional_derivar.py` (novos), `pipeline/city_base.py`, etapa de chão/asfalto a identificar.

## T08 — Montar o primeiro mapa local de Cuiabá

**Descrição:** fornecer configuração e fontes regionais ao montador, preservando o caminho municipal existente.

**Aceite:**
- [ ] Mapa de 2,5 km abre e navega; cenário identificado como ponto técnico, sem anúncio fictício.
- [ ] POIs são locais; posições e atlas geográficos de São Carlos ficam ausentes; bibliotecas genéricas identificadas.
- [ ] JSON municipal não é regravado a cada pacote e testes do legado continuam passando.

**Verificação:** `python -m unittest discover -s tests -p 'test_build_config.py'`; `node --test tests/test_city_data.mjs`; abrir referência/região nas mesmas condições.
**Dependências:** T07c. **Escopo:** médio.
**Arquivos previstos:** `pipeline/build/config.py`, `pipeline/build/pacotes.py`, `pipeline/montar.py`, `pipeline/build/manifest.py`, `tests/test_regional_montagem.py` (novo).

## Checkpoint B — Prova de geração regional

- [ ] Primeiro mapa funcional de 2,5 km gerado a partir da base; identidade e bordas verificadas.
- [ ] Logs comprovam preparação regional antes do HTML; medir baseline e estabelecer meta quantitativa para o restante.
- [ ] Revisar a operação/custo da base e registrar aceite ou revisão da proposta de PostGIS.

## T09 — Acrescentar rasters regionais

**Descrição:** incluir relevo TOPODATA e depois cobertura do solo somente por janelas da região, em perfil próprio.

**Aceite:**
- [ ] Relevo e vetores compartilham origem; transformação, nodata, grade e referência vertical registrados.
- [ ] Leitura/exportação limitada às janelas necessárias; não transportar o raster municipal completo.
- [ ] Vegetação raster só entra após validar aquisição/ano; árvores ilustrativas não são apresentadas como levantamento individual.

**Verificação:** amostras de centro/cantos, nodata e alinhamento; comparar referência e recorte com o mesmo perfil raster.
**Dependências:** Checkpoint B. **Escopo:** médio; dividir relevo e cobertura em duas tarefas se necessário.
**Arquivos previstos:** `pipeline/regional/rasters.py`, adaptador TOPODATA, `tests/test_regional_rasters.py` (novos), configuração regional.

## T10 — Executar comparação de alcance e reutilização

**Descrição:** gerar 2,5/5 km nos pontos técnicos, incluindo centro próximo e fronteira municipal.

**Aceite:**
- [ ] Matriz de quatro pontos e dois raios, com referência de mesmo perfil/snapshot, registrada.
- [ ] Relatório separa ingestão, consulta, geração, bytes por camada/biblioteca e rede real do navegador; cinco execuções por cenário frio/quente.
- [ ] Identidade/cobertura/borda passam; diferenças procedurais são registradas, redução supera ruído, e regressões de interação/memória são explicadas antes do aceite.

**Verificação:** comparações automatizadas, capturas centrais/borda e inspeção desktop/mobile; executar `tests/test_recorte_gate.py` e decoder de cidade.
**Dependências:** T08 e T09 para o perfil enriquecido. **Escopo:** médio.
**Arquivos previstos:** `pipeline/mede_regional.py`, testes de equivalência regional, `relatorios/mapa-regional-cuiaba/` (novos).

## T11 — Validar ampliação da base de Cuiabá

**Descrição:** ampliar a importação para a cobertura declarada da cidade e faixa externa, sem refazer aquisição por imóvel.

**Aceite:**
- [ ] Cobertura por camada cobre Cuiabá + 5 km + margem, ou identifica explicitamente lacunas restantes.
- [ ] Atualização cria snapshot novo e preserva pacotes antigos; novo ponto coberto não consulta fornecedores.
- [ ] Custos e infraestrutura necessária registrados; status de lotes municipais atualizado após investigar exportação.

**Verificação:** amostras distribuídas, consistência de snapshots, teste de fora da cobertura e métricas de tamanho/importação.
**Dependências:** T10. **Escopo:** médio.
**Arquivos previstos:** configuração Cuiabá, adaptadores de aquisição existentes, relatório de cobertura e operação.

## T12 — Integrar a localização de um empreendimento real

**Descrição:** quando existir cadastro de Cuiabá, usar suas coordenadas para gerar o mapa e vinculá-lo à miniatura.

**Aceite:**
- [ ] Cidade, localização e raio são entradas explícitas do build; não há dependência exclusiva do piloto de São Carlos.
- [ ] Cadastro referencia snapshot/pacote e distingue localização confirmada de aproximada.
- [ ] Link miniatura → mapa funciona e nova geração reutiliza a base validada.

**Verificação:** `python -m unittest discover -s tests -p 'test_build_imovel.py'` e teste do fluxo com um cadastro real; fixture técnica não conta como validação comercial.
**Dependências:** T11 e disponibilidade de empreendimento real. Não bloqueia a conclusão do experimento técnico. **Escopo:** médio.
**Arquivos previstos:** `pipeline/build_imovel.py`, `pipeline/fabrica_miniaturas.py`, `pipeline/imovel.py`, `tests/test_build_imovel.py`.

## Checkpoint final do experimento

- [ ] T01–T11 verificadas; qualidade e ganho medidos, cobertura/lacunas explícitas e decisão operacional registrada.
- [ ] T12 permanece pendente se ainda não houver empreendimento real, sem declarar o vínculo comercial testado.
- [ ] Nenhum resultado é marcado concluído apenas pela existência do plano ou por redução do HTML com perda de conteúdo.

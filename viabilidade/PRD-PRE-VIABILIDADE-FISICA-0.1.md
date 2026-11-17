# PRD — Pré-viabilidade Física, Estrutural e Geotécnica
## Imobiliária 3D | Do potencial urbanístico ao empreendimento tecnicamente justificável | Versão 0.1 — proposta para revisão

**Status:** especificação de produto; **não autoriza implementação, merge, deploy, publicação ou uso para dimensionamento executivo**.  
**Data:** 16/11/2026.  
**Natureza:** extensão futura e incremental do estudo de viabilidade e do Projetista Arquitetônico Assistido; desenvolvimento paralelo e isolado da operação comercial de maquetes 3D.  
**Documentos relacionados:** `viabilidade/PRD-VIABILIDADE-1.0.md`, `viabilidade/PRD-V1-COMERCIAL.md` e `PRD-Projetista-Arquitetonico-Assistido-v0.1.md` (15/11/2026).  
**Observação:** as referências a documentos relacionados são dependências declaradas; suas versões integrais não foram auditadas neste PRD. A integração efetiva depende de inspeção do repositório e dos contratos vigentes.

---

## 1. Decisão de produto e princípio inegociável

O estudo não deve confundir **potencial urbanístico/geometria**, **plausibilidade arquitetônica**, **pré-viabilidade estrutural**, **pré-viabilidade geotécnica** e **viabilidade econômica**. A maquete 3D será consequência da geometria versionada, e não prova de que o empreendimento pode ser construído.

**Princípio:** nenhuma alternativa poderá receber o status abrangente **“viabilidade construtiva verificada”** enquanto faltar qualquer verificação obrigatória aplicável ao escopo reivindicado. Resultados matematicamente incorretos são defeitos; resultados matematicamente corretos sob premissas incompletas podem ser mantidos **apenas como hipóteses condicionais**, com pendências claras.

**Promessa permitida:** “Compare alternativas preliminares e identifique quais condições urbanísticas, geométricas, estruturais, geotécnicas e econômicas foram verificadas e quais continuam pendentes.”  
**Promessa proibida:** “A plataforma atesta a segurança de uma torre, dimensiona fundações definitivas, garante a construção ou substitui laudos e responsáveis técnicos.”

**Não objetivo:** bloquear a exploração de volumetrias sempre que faltar sondagem. A alternativa pode ser visualizada, calculada e comparada, desde que sua classificação não induza conformidade que não foi demonstrada.

## 2. Problema

Um lote pode comportar, em planta e segundo certos índices urbanísticos, duas torres de muitos pavimentos. Isso **não comprova** que o sistema estrutural seja adequado, que o subsolo permita uma solução fundacional economicamente aceitável ou que o investimento seja rentável. Ainda mais importante: **área total e peso total não bastam** para calcular fundações — importam a distribuição das ações por apoios, os efeitos horizontais, a deformabilidade do solo, os recalques e a interação solo–estrutura.

Atualmente, o PRD do Projetista Arquitetônico Assistido descreve a estrutura apenas como indicativa e exclui projeto estrutural, fundações, análise completa de normas e orçamento de obra do MVP. Esta extensão **não reinterpreta retroativamente** o escopo anterior: introduz um domínio progressivo, com estados de verificação explícitos, sem prometer uma solução completa na primeira entrega.

## 3. Público e valor

**Usuários iniciais:** equipe interna e profissionais de arquitetura/engenharia trabalhando em cenários supervisionados. **Usuários posteriores:** incorporadoras, construtoras e analistas de terrenos, com permissões e revisão técnica adequadas.

**Valor esperado:** comparar hipóteses de implantação e reconhecer precocemente quando o aproveitamento aparentemente alto poderá depender de soluções estruturais/geotécnicas mais complexas, de dados faltantes ou de custos ainda incertos.

## 4. Taxonomia de resultados (obrigatória)

Cada alternativa recebe **estados por domínio**, nunca um único booleano genérico `viavel`:

| Domínio | Exemplos de verificação | Resultado admissível |
|---|---|---|
| Geométrico | Interseções, recuos geométricos, áreas, orientação, acessos modelados | conforme / violação / não verificado / erro técnico |
| Urbanístico | Regras municipais aplicáveis, zoneamento, parâmetros e fonte atual | conforme / violação / não verificado / erro técnico |
| Arquitetônico | Unidades, circulações, núcleos e verificações implementadas | conforme / violação / não verificado / erro técnico |
| Estrutural | Ações, combinações, resistência, estabilidade e deslocamentos *dentro do método habilitado* | conforme / violação / não verificado / erro técnico |
| Geotécnico | Perfil do subsolo, sistema de fundação, capacidade de suporte e recalques *quando analisados* | conforme / violação / não verificado / erro técnico |
| Econômico | Estimativas de custo/receita e incertezas | cenário calculado / dados insuficientes / erro técnico |

**Síntese global:** `HIPOTESE_PRELIMINAR`, `CONDICIONAL_COM_PENDENCIAS`, `INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS` ou `VERIFICADO_NO_ESCOPO_DECLARADO` (este último **não** equivale a aprovação legal, projeto executivo ou certificação de segurança; requer lista positiva e completa de verificações do escopo, fontes, versões e eventual revisão profissional).

Uma regra não testada **nunca** será marcada “conforme”. Uma regra que não se aplica deve usar `NAO_APLICAVEL`, com justificativa, e não ser confundida com aprovação. Uma falha do solver é `ERRO_TECNICO`, não “inviável”. Não usar um selo verde abrangente para resultados com lacunas obrigatórias.

## 5. Jornadas de usuário

### 5.1 Estudo sem sondagem (caso frequente)
1. Abrir um lote e uma revisão de estudo de viabilidade.
2. Validar fontes de limites, geometria e topografia disponíveis.
3. Gerar uma ou mais configurações de edifícios e maquetes externas coerentes com os modelos geométricos.
4. Visualizar **quantidades e cargas apenas como estimativas condicionais**, conforme catálogo de premissas documentadas, sem derivar capacidade de suporte do solo a partir de ausência de dados.
5. Receber pendências: sondagem geotécnica, definição de sistema estrutural, combinações de ações, cálculo de fundações, restrições de implantação e orçamento.
6. Exportar **estudo preliminar condicionado**, com aviso visível e lista das verificações não realizadas.

### 5.2 Estudo com sondagem e parâmetros técnicos
1. Anexar relatório de investigação geotécnica (p. ex., SPT) e localizar corretamente cada ponto de investigação e sua referência altimétrica.
2. Registrar profundidades, estratos, valores N-SPT, observações e nível d'água (quando informado), com unidades, fonte e qualidade.
3. Um profissional habilitado revisa interpretação, representatividade da investigação e parâmetros de cálculo. **O N-SPT não é capacidade de carga direta**.
4. Selecionar metodologia de análise habilitada e hipóteses estruturais, com cargas provenientes de modelo justificado.
5. Calcular cenários **apenas dentro do domínio de aplicação validado**; apresentar solicitações, resistências, deformações, margens e pendências.
6. Comparar alternativas e gerar relatório rastreável; bloquear qualquer conclusão positiva caso faltem verificações obrigatórias.

### 5.3 Comparar implantações
1. Gerar duas alternativas para o mesmo lote (ex.: três torres mais baixas versus duas mais altas).
2. Comparar área privativa, núcleos, áreas comuns, distribuição conceitual de esforços, hipóteses de fundações, custos em faixas e incerteza.
3. Filtrar por conformidade demonstrada, pendências e cenários; **não ranquear “segurança” por peso total**.
4. Editar a alternativa e disparar reavaliação de todas as grandezas derivadas; preservar versões anteriores.

## 6. Escopo funcional detalhado

### 6.1 Geometria, topografia e implantação
- Usar contorno real do lote, sistema de referência, cotas, recuos, acessos e limites com proveniência; admitir dados incertos e registrar efeito da incerteza.
- Considerar declividades, taludes, corte/aterro, contenções e subsolos como **questões verificáveis ou pendentes**, nunca como fatores automaticamente resolvidos.
- Manter coerência: área, pavimentos, torres e volumes 2D/3D/relatório derivam do mesmo modelo canônico.
- Recusar geometrias malformadas, sobreposições indevidas, unidades inconsistentes e resultados fora da tolerância.

### 6.2 Inventário preliminar de ações e estrutura
- Registrar uso, tipologia de estrutura, pé-direito, sistema de lajes, vedações, acabamentos, sobrecargas, coberturas, instalações e hipóteses de materiais.
- Quando houver parâmetros suficientes, estimar **ações permanentes e variáveis por elementos, pavimentos e apoios**, com unidades e faixas documentadas. Sem modelo de transferência de cargas, declarar que a estimativa agregada **não representa reações de fundação**.
- Anotar ações horizontais e estabilidade global como **não verificadas** até existir método apropriado; o cálculo do peso vertical não as substitui.
- Registrar combinações de ações e hipóteses normativas apenas quando efetivamente implementadas, atualizadas e validadas.
- Suportar análise de sensibilidade (mudança de pavimentos, vão, material ou sistema) sem apresentar extrapolação fora do domínio como conformidade.

### 6.3 Dados geotécnicos e fundações
- Catálogo de sondagens e ensaios com localização, data, profundidades, métodos, cotas, responsável, documentação original e confidencialidade.
- Diferenciar **informação observada**, **parâmetro interpretado**, **parâmetro adotado** e **resultado calculado**; exigir vínculo entre eles.
- Registrar posição/variação do nível d'água quando houver e ausência de informação quando não houver.
- Representar alternativas conceituais de fundações (superficiais/profundas) **sem recomendação automática antes do cálculo verificado**.
- Para métodos implementados e aprovados tecnicamente, analisar estado-limite de resistência, recalques e aspectos pertinentes à interação solo–estrutura, conforme escopo validado; deixar explícitas verificações ausentes.
- Se a investigação for insuficiente para o porte, cargas ou variabilidade do terreno, resultado geotécnico permanece `NAO_VERIFICADO`.

### 6.4 Custos e análise econômica
- Comparar custos estimados por cenários **com faixa de confiança, data-base, fonte, localização e hipóteses**.
- Separar custo geral, estimativa estrutural, fundações, terraplenagem/contenções, equipamentos, contingências e receitas estimadas.
- Não transformar indicação genérica de solo “bom/ruim” em orçamento preciso; sem dados técnicos, custo fundacional deve ser `INSUFICIENTE_PARA_ESTIMAR` ou cenário explicitamente hipotético.
- Permitir indicadores de área comercializável, custo aproximado/m² e sensibilidade da rentabilidade a soluções estruturais, sem garantia de resultado comercial.

### 6.5 Motor de alternativas
- Entrada: lote versionado, programa arquitetônico, limites conhecidos, restrições bloqueadas, premissas de estrutura/solo e objetivo explícito.
- Gerar primeiro candidatos geometricamente válidos; rodar verificadores do escopo habilitado por domínio.
- Não descartar automaticamente propostas só por falta de sondagem; classificá-las como **condicionais**.
- Excluir do conjunto “verificado” candidatos com violação demonstrada ou pendências obrigatórias, sem proibir exploração e comparação.
- Otimizar conforme métrica declarada (unidades, área privativa, custo estimado, retorno condicionado). Não afirmar ótimo global sem demonstração matemática.
- Registrar candidatos recusados e motivos: violação comprovada, parâmetros ausentes, fora de domínio, limite de busca atingido e falha de execução.

### 6.6 Relatório e interface
- Painel com status por domínio, medição, limiar, método, norma de referência, unidade, fonte, data, responsável e nível de confiança.
- Para uma alteração de torre ou pavimento, recalcular/invalidar todas as dependências (ações, estrutura, geotecnia, custo, síntese), sem reutilizar conclusões antigas.
- Relatórios rotulados **“estudo preliminar / sujeito a validação profissional”** e com pendências claramente visíveis no PDF e na exportação de dados.
- Maquete externa apresenta uma legenda persistente: `configuração esquemática`, `condicionada` ou `verificada apenas no escopo X`; visual refinado não muda o status.

## 7. Contratos e dados canônicos

**Entidades novas propostas:** `FeasibilityAssessment`, `DomainVerification`, `SourceEvidence`, `TerrainSurvey`, `GeotechnicalInvestigation`, `Borehole`, `SoilLayer`, `GroundwaterObservation`, `GeotechnicalParameter`, `StructuralAssumption`, `LoadCase`, `LoadCombination`, `LoadEstimate`, `SupportReaction`, `FoundationScenario`, `SettlementAssessment`, `CostScenario`, `ProfessionalReview`, `ValidationRun`.

**Campos mínimos de qualquer grandeza:** `value`, `unit`, `quantity_kind`, `derivation_or_method`, `assumptions`, `source_id`, `source_version`, `confidence_or_uncertainty`, `validation_status`, `calculated_at`, `engine_version`, `scope`. Não inventar valor ausente; guardar nulo com motivo.

**Modelo simplificado de um resultado de verificação (ilustrativo, não contrato aprovado):**

```json
{
  "domain": "geotechnical",
  "check_id": "foundation-settlement",
  "status": "NOT_VERIFIED",
  "reason": "No reviewed investigation and settlement model",
  "measured": null,
  "limit": null,
  "unit": "mm",
  "method_version": null,
  "source_ids": [],
  "affected_elements": ["tower-01"],
  "required_actions": ["Review geotechnical investigation", "Run validated settlement analysis"]
}
```

**Integridade:** IDs estáveis, coordenadas e datum explícitos, unidades dimensionais verificadas, sem sobrescrita de revisões, hash de entradas e resultados, versionamento de catálogo de regras e invalidação por dependências. Não permitir que o cliente marque `CONFORME` sem evidência de cálculo e permissões adequadas.

## 8. Requisitos e critérios de aceite

| ID | Requisito | Critério de aceite testável |
|---|---|---|
| PVF-001 | Separação entre domínios | A alternativa exibe status independente de geometria, urbanismo, arquitetura, estrutura, geotecnia e economia; falta de dados não vira conforme |
| PVF-002 | Sem falso positivo global | Sem sondagem/avaliação obrigatória, não existe rótulo “viabilidade construtiva verificada” |
| PVF-003 | Geometria única | Alterar uma torre muda, em uma revisão única, maquete, quadro de áreas e dependências afetadas |
| PVF-004 | Cálculo dimensional | Testes de unidades e casos de referência rejeitam somas/comparações dimensionais inválidas |
| PVF-005 | Cargas rastreáveis | Estimativas mostram origem, hipóteses, componentes e sinalizam reações desconhecidas quando não modeladas |
| PVF-006 | SPT não é capacidade direta | A importação de N-SPT jamais gera automaticamente um valor de capacidade portante sem interpretação/método declarado |
| PVF-007 | Dado insuficiente | Ausência/inadequação de investigação mantém geotecnia não verificada, mesmo com maquete pronta |
| PVF-008 | Revisão auditável | Alterar sondagem, modelo estrutural ou regra invalida resultados dependentes e mantém histórico anterior |
| PVF-009 | Falha classificada | Distinguir violação real, fora de domínio, insuficiência de dados, limite de busca e erro de execução |
| PVF-010 | Comparação justa | Alternativas usam data-base e pressupostos visíveis; diferença de custo sem base comparável é sinalizada |
| PVF-011 | Exportação segura | Relatório apresenta verificações por domínio, pendências, origens, versões, responsáveis e ressalva técnica |
| PVF-012 | Análise técnica habilitada | Não oferecer “conforme estrutural/geotécnico” antes de método implementado, validado e revisão técnica exigida |
| PVF-013 | Isolamento de produção | POC não altera maquetes comerciais, painel, dados produtivos, PRs ativos nem contratos sem autorização |
| PVF-014 | Testes adversários | Casos de cargas incompatíveis, unidades trocadas, recalques não calculados, laudos conflitantes e modelos fora de domínio nunca geram conformidade falsa |

## 9. Casos de teste obrigatórios

1. **Lote com envelope permitido, sem sondagem:** geometria pode ser conforme; geotecnia = não verificado; síntese não atesta construtibilidade.
2. **Duas torres com mesma área total e diferentes configurações:** não inferir iguais reações de apoio ou igual custo fundacional.
3. **Acréscimo de pavimento:** invalidar resultados estruturais, geotécnicos e econômicos dependentes; rastrear mudança de áreas e cargas estimadas.
4. **SPT importado com campos faltantes ou cotas incompatíveis:** impedir interpretação conclusiva e sinalizar pendências.
5. **Suposta capacidade de carga inserida sem fonte ou método:** rejeitar a conclusão positiva; preservar o dado apenas como hipótese não verificada, se autorizado.
6. **Geometria inválida e interferências:** impedir resultados de área inconsistentes e propagação de números incorretos.
7. **Cargas dimensionais incompatíveis (kN, kN/m², kg):** falha explícita de validação de unidades.
8. **Resultado de solver fora do domínio:** não classificar como inviabilidade física demonstrada.
9. **Troca de norma, parâmetros do solo ou laudo:** revalidação obrigatória e comparação entre revisões.
10. **Exportação/maquete premium visualmente convincente:** manter aviso de pendência técnica.

## 10. Arquitetura e fronteiras de responsabilidade

**Fluxo:** estudo e terreno versionados → proposta arquitetônica canônica → estimador preliminar de ações → verificadores especializados *quando habilitados* → análise de cenários de fundação *quando houver dados e método validados* → custos condicionais → classificação por domínio → comparador, relatório e maquete 3D.

**Separações obrigatórias:**
1. Núcleo geométrico: geometria e métricas.
2. Motor urbanístico: regras municipais verificadas e vigentes.
3. Motor arquitetônico: plantas, núcleos e alternativas.
4. Motor de ações/estrutura: hipóteses, solicitações e verificações implementadas.
5. Motor geotécnico: investigação, interpretação e verificações de fundação habilitadas.
6. Motor econômico: custos e cenários, sem substituir verificação de engenharia.
7. Apresentação: maquete e relatório, sem cálculo independente de indicadores.

Não presumir que o renderizador 3D existente já aceita cargas ou tipologias estruturais; integrar por **adaptador versionado** após inspeção técnica. As maquetes comerciais seguem prontas para venda e sem dependência de entrega deste PRD.

## 11. Escopo inicial e exclusões

**Primeiro domínio (proposto, a validar em PA-G0):** lotes de geometria simples, edifícios residenciais de pavimentos-tipo, poucos sistemas estruturais conceituais, análises de ações **preliminares** e cenários com lacunas explicitadas. Terrenos com aterros não controlados, encostas complexas, grandes contenções, vizinhança sensível ou subsolo heterogêneo devem ser sinalizados como fora do domínio para conclusões especializadas.

**Fora do primeiro MVP:** projeto de fundações, cálculo estrutural executivo, emissão de ART/RRT pela plataforma, aprovação municipal, sondagem automática inferida por mapa, interpretação geotécnica conclusiva por IA, certificação de segurança, orçamentos contratuais e escolha automática de solução de fundação como recomendação técnica definitiva.

## 12. Normas, responsabilidade e governança

Antes de cada método entrar em produção, equipe técnica habilitada deve identificar **versões vigentes e aplicáveis**, escopo e limitações das normas pertinentes (por exemplo: ABNT NBR 6120 para ações, NBR 6118 quando se tratar de estruturas de concreto, NBR 6122 para fundações, NBR 6484 para SPT; além das normas de ações do vento, combinações e demais regras relevantes conforme o caso). **Esta lista é indicativa, não constitui validação de vigência ou suficiência normativa.**

- Nenhum resultado substitui sondagem necessária, projeto e revisão de engenharia, obrigações legais ou responsabilidade técnica.
- Relatórios indicam autor/operador, responsável pela revisão quando houver, data, fontes e restrições.
- Dados de laudos e projetos podem ser confidenciais: exigir controle de acesso, proteção contra alteração indevida e retenção definida.
- Fórmulas devem ter referências, unidades, derivação/histórico de teste, faixa de aplicação, precisão e rastreabilidade, incluindo testes contra soluções de referência revisadas por profissionais.

## 13. Plano por portões (desenvolvimento paralelo)

| Portão | Entrega | Condição de saída |
|---|---|---|
| PVF-G0 | Inventário de contratos, métodos, dados, lacunas e matriz normativa | Escopo verificável e desenho de dependências aprovados para POC |
| PVF-G1 | Classificação por domínio e proveniência | Sem `viavel=true` genérico, sem falsos positivos por dados ausentes |
| PVF-G2 | Geometria ↔ carga preliminar | Estimativas coerentes, dimensionais, rastreáveis e invalidação automática |
| PVF-G3 | Cadastro de investigações geotécnicas | SPT e documentos armazenados/versionados; sem conversão automática indevida para capacidade |
| PVF-G4 | Cenários estruturais/geotécnicos supervisionados | Métodos definidos e validados para domínio delimitado, com testes adversários |
| PVF-G5 | Comparador técnico-econômico | Cenários e sensibilidades reproduzíveis, com incertezas visíveis |
| PVF-G6 | Auditoria independente e piloto isolado | Revisão profissional, testes integrados, métricas e autorização explícita para eventual publicação |

**Dependência crítica:** PVF-G1 e o contrato de dados podem ser trabalhados em paralelo ao Projetista Arquitetônico; PVF-G2+ dependem de geometrias confiáveis e dados técnicos suficientes. Implementar separadamente de qualquer branch produtiva e não alterar PR #124 sem decisão explícita.

## 14. Métricas de qualidade

- **0 falsos positivos** de conformidade em suíte adversária obrigatória; acompanhar também falsos negativos.
- 100% dos resultados exportados associados a revisão, premissas, unidades, fontes e versão do motor.
- 100% das mudanças em entrada relevante invalidam as análises dependentes.
- Concordância com casos de referência, tolerâncias estabelecidas por método e avaliação independente de especialista.
- Percentual de resultados “não verificado” corretamente classificados; evitar reduzir esse número ocultando dados ausentes.
- Tempo e esforço até comparar alternativas condicionais, sem sacrificar rastreabilidade.

## 15. Principais riscos e mitigação

| Risco | Mitigação |
|---|---|
| Tratar geometria como engenharia validada | Estados separados, síntese conservadora e linguagem controlada |
| Converter peso total em “capacidade de fundação” | Modelar trajetórias de carga, apoios e métodos especializados; ausência = pendência |
| Transformar N-SPT em capacidade direta | Separar dados medidos, interpretação, método e parecer profissional |
| Normas equivocadas ou desatualizadas | Catálogo versionado, revisão de aplicabilidade e bloqueio de resultados afetados |
| IA produzir conclusão técnica sem base | IA apenas assistiva; cálculo auditável e verificadores determinísticos |
| Escopo crescer para software executivo | Portões, MVP restrito e integração posterior com ferramentas especializadas |
| Maquete visual mascarar incerteza | Sinalização persistente no viewer e nas exportações |
| Afetar negócio comercial de maquetes | Isolamento de branch, dados, deploy e contratos compartilhados |

## 16. Decisões abertas e próximas ações

**Decisões a tomar em PVF-G0:**
1. Quais tipos de empreendimento entram no domínio inicial (casas, pequenos edifícios, torres residenciais)?
2. Quais dados reais de topografia/sondagem estarão disponíveis e com que direitos de uso?
3. Qual catálogo preliminar de estruturas e premissas será admitido, com revisão de engenheiro calculista?
4. Como representar cargas, apoios, subsolos e nível d'água sem conflitar com o modelo geométrico do projetista?
5. Que verificações técnicas precisariam ser satisfeitas para cada rótulo comercial de resultado?
6. Quem poderá inserir, revisar, aprovar e exportar hipóteses e resultados?
7. O módulo econômico será lançado na mesma fase ou após validação das estimativas físicas?

**Próxima autorização solicitada:** somente revisão deste PRD e inventário técnico PVF-G0. Nenhuma implementação, merge ou publicação está autorizada por este documento.

---

### Resumo decisório

O sistema deve **calcular corretamente o que é calculável, demonstrar as hipóteses usadas e recusar conclusões que dependam de dados ou métodos ausentes**. Sem sondagem ou verificações estruturais, uma maquete e um envelope urbanístico podem ser resultados úteis, mas não constituem prova de viabilidade construtiva. A evolução pretendida é de **volumetria urbanística → composição arquitetônica → pré-análise de ações e solo → verificações especializadas → cenários econômico-construtivos**, em módulos independentes, auditáveis e integráveis.


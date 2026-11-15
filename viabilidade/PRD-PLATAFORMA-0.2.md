# PRD — Imobiliária 3D
## Plataforma de Engenharia Automatizada e Inteligência para o Ciclo de Vida da Construção

**Versão:** 0.2 — Proposta estratégica para revisão  
**Data:** 14/11/2026  
**Status:** Documento proposto; não aprovado para implementação integral  
**Base:** `viabilidade/PRD.md` v0.1, preservado como referência histórica  
**Produto:** Imobiliária 3D  
**Natureza:** Visão plurianual, modular e progressiva

> **Decisão de escopo:** Este documento amplia a visão estratégica. Ele **não** modifica os critérios de aceite do protótipo atual, autoriza refatorações do legado ou determina integração com produção.

---

## 1. Resumo executivo

A Imobiliária 3D pretende evoluir de uma plataforma de apresentação de imóveis e estudos preliminares de terrenos para uma plataforma capaz de **executar métodos técnicos de arquitetura e engenharia, configurados, testados e homologados por profissionais especializados**, a fim de produzir projetos técnicos reproduzíveis e auditáveis, dentro de domínios de aplicação explicitamente validados.

A cadeia-alvo é: **terreno → dados e restrições → viabilidade → arquitetura → disciplinas complementares → compatibilização → documentação e revisão profissional → aprovação externa aplicável → planejamento e acompanhamento da obra → entrega e operação**.

O diferencial proposto não consiste em uma IA que improvisa projetos a cada solicitação. Consiste em uma infraestrutura de **motores de engenharia especializados** que aplicam metodologias codificadas, com apoio de IA para coleta de requisitos, exploração de alternativas, explicação, extração de conhecimento e assistência aos profissionais.

A construção desse conhecimento ocorrerá com especialistas de referência por disciplina e um **Laboratório de Engenharia Comparativa**: diferentes profissionais resolverão problemas equivalentes e explicarão decisões, alternativas descartadas, normas, cálculos e fatores determinantes. Essas contribuições serão convertidas em hipóteses, regras e testes somente após validação e homologação.

A plataforma não substitui responsabilidade técnica profissional, vistoria, sondagem, levantamentos, licenciamento ou aprovações obrigatórias. A meta é **reduzir trabalho repetitivo e retrabalho**, preservando segurança, qualidade e rastreabilidade.

### 1.1 Princípios inegociáveis

1. Projetar a arquitetura para extensibilidade, entregar recursos por etapas e medir resultados antes de expandir.
2. **Métodos e cálculos técnicos reproduzíveis** devem ser independentes da variabilidade do modelo de linguagem.
3. Cada motor declara seu **domínio de validade** e recusa conclusões fora dele.
4. Rastrear entradas, fontes, versões normativas, hipóteses, cálculos, decisões e resultados.
5. Especialistas **constroem e homologam** os métodos; profissionais responsáveis revisam os projetos específicos conforme a legislação e as atribuições aplicáveis.
6. Alterar uma disciplina invalida ou reavalia explicitamente os resultados dependentes.
7. Preservar sistemas produtivos e os padrões de visualização **LEVE e PREMIUM**; nenhuma refatoração preventiva sem prova de necessidade.
8. Diferenciar modelo conceitual, projeto técnico gerado, projeto revisado e projeto legalmente aprovado.

## 2. Problema, oportunidade e hipótese de valor

### 2.1 Problemas

- Dados de terrenos, parâmetros urbanísticos, projetos, cálculos e execução costumam existir em ferramentas e processos desconectados.
- Soluções técnicas de profissionais experientes nem sempre são formalizadas para reutilização verificável.
- A repetição de etapas entre concepção, engenharia, compatibilização, apresentação e orçamento produz retrabalho.
- Sistemas puramente generativos podem entregar resultados plausíveis visualmente, mas sem garantias suficientes de método, conformidade, consistência ou rastreabilidade.
- Mudanças em um projeto frequentemente exigem revisões manuais em várias disciplinas e documentos.

### 2.2 Hipótese de produto

Se transformarmos métodos de especialistas em motores testados e versionados, e conectarmos esses motores a um modelo compartilhado de empreendimento, poderemos gerar propostas e projetos técnicos de maneira progressivamente mais rápida, consistente e auditável **dentro de tipologias e condições bem delimitadas**.

Essa hipótese deverá ser validada com profissionais e clientes reais; não se presume existência de demanda ou viabilidade econômica para a visão integral.

## 3. Objetivos

### 3.1 Objetivos estratégicos

- Analisar terrenos e gerar estudos de viabilidade fundamentados em dados e normas.
- Gerar concepção arquitetônica paramétrica, plantas e modelos técnicos editáveis.
- Desenvolver motores especializados para arquitetura, estruturas, instalações hidrossanitárias, elétrica e disciplinas futuras.
- Gerar desenhos, documentação, memoriais, quantitativos e registros de cálculo conforme o escopo homologado.
- Detectar conflitos entre disciplinas e apoiar a resolução coordenada de alterações.
- Integrar revisão, correções, responsabilização técnica e aprovações externas quando cabíveis.
- Evoluir para orçamento, planejamento, suprimentos, acompanhamento de obra, as built e manutenção.
- Reutilizar o núcleo técnico para visualização, visitas 3D, configuradores e produtos comerciais.

### 3.2 Objetivos de negócio

- Atender inicialmente necessidades concretas de imobiliárias, construtoras, incorporadoras, loteadoras e escritórios técnicos.
- Demonstrar ganho mensurável de tempo e redução de retrabalho em tipologias-piloto.
- Descobrir quais módulos têm disposição real de pagamento, custos sustentáveis e vantagens competitivas.
- Permitir eventual oferta modular B2B, sem obrigar aquisição de todo o ecossistema.

### 3.3 Não objetivos da fase atual

Na fase de viabilidade externa, **não** serão produzidos projetos executivos arquitetônicos, estruturais, elétricos ou hidráulicos, nem será alegada aprovação legal. Não haverá alteração automática de produção, Firebase ou dos fluxos comerciais existentes. Não será exigida a criação imediata de editor BIM nativo ou de sistema de gestão de obras.

## 4. Perfis, autoridade e responsabilidade

| Perfil | Papel no produto |
|---|---|
| Dono do produto / administrador | Estratégia, governança, acessos e publicação autorizada |
| Especialista de referência | Desenha método técnico, hipóteses, regras, exceções e critérios de homologação |
| Engenheiro / arquiteto responsável | Revisa resultados, corrige, aprova o que lhe compete e assume responsabilidade formal quando aplicável |
| Auditor técnico independente | Testa motores, confronta resultados e registra não conformidades |
| Desenvolvedor / mantenedor de motor | Implementa e versiona algoritmos, sem poder homologar sozinho a correção técnica |
| Incorporadora / construtora | Define programa, limites, objetivos, orçamento e uso comercial |
| Corretor / proprietário / comprador | Consulta possibilidades ou configura propostas de acordo com permissões |
| Equipe de obra | Planeja, registra execução, desvios, medições e inspeções, conforme sua autoridade |

**Separação de responsabilidades:** homologar um **motor/método** não equivale a assinar ou aprovar automaticamente cada **projeto gerado**. Um resultado fora de escopo ou com dados insuficientes é encaminhado ao profissional, não rotulado como aprovado.

## 5. Módulos da plataforma

Os módulos A–G do PRD 0.1 são preservados conceitualmente, com escopo ampliado para apoiar o novo núcleo.

| Código | Módulo | Responsabilidade |
|---|---|---|
| A | Inteligência territorial | Lotes, georreferenciamento, relevo, dados de campo, documentos e proveniência |
| B | Inteligência urbanística e normativa | Regras legais, jurisdições, vigência, conflitos e fontes |
| C | Motor de viabilidade | Envelopes, cenários, métricas e incertezas |
| D | Gerador paramétrico de edificações | Edificações e tipologias, com evolução de volumes para elementos técnicos |
| E | Organização arquitetônica interna | Pavimentos, ambientes, circulação e layouts |
| F | Configurador residencial | Propostas controladas para lotes, modelos e compradores |
| G | Experiência 3D e comercialização | Modelos LEVE/PREMIUM, comparação, visitas, relatórios e publicação |
| H | Laboratório de Conhecimento Técnico | Captura de métodos, entrevistas, casos comparativos e avaliação de hipóteses |
| I | Plataforma de Motores de Engenharia | Execução de procedimentos por disciplina, cálculos, regras, testes e limites |
| J | Modelo Técnico Integrado | Componentes, sistemas e relações entre disciplinas; interoperabilidade BIM |
| K | Geração e Compatibilização | Plantas, cortes, detalhes, memoriais, quantitativos e interferências |
| L | Homologação e Governança | Domínios validados, revisões, aprovações, logs e evidências |
| M | Ciclo de Vida da Obra | Custos, planejamento, progresso, mudanças, as built e operação |

### 5.1 Disciplina não é módulo monolítico

Cada disciplina será implementada como um conjunto de métodos e componentes plugáveis com contratos versionados. Ex.: instalações elétricas poderão conter métodos distintos para levantamento de cargas, definição de circuitos, dimensionamento, roteamento, verificações e documentação.

## 6. Aquisição e formalização do conhecimento especializado

### 6.1 Especialistas de referência

O plano inicial é trabalhar com **ao menos um especialista por disciplina priorizada**, começando por apenas uma disciplina em piloto. O especialista participa de entrevistas, revisão de casos, definição de regras, exceções, cálculos, parâmetros e critérios de homologação. Suas preferências não se tornam normas obrigatórias.

### 6.2 Laboratório de Engenharia Comparativa

O laboratório receberá **problemas padronizados** com a mesma documentação de entrada e encomendará soluções independentes a outros profissionais, incluindo justificativas técnicas.

**Plano experimental incremental sugerido:**

1. **Calibração:** uma planta/problema, três profissionais independentes.
2. **Piloto:** cinco problemas, cinco soluções independentes por problema, se custos e utilidade justificarem.
3. **Expansão:** diversidade de tipologias, condições e restrições; avaliar repetibilidade.
4. **Biblioteca:** horizonte de até 200 casos de referência diversos, sem compromisso antecipado de contratar todos.

Uma grande quantidade de **soluções para o mesmo problema** mede divergência de métodos; uma grande quantidade de **problemas diferentes** mede cobertura. Precisamos das duas dimensões.

### 6.3 Registro de decisões

Cada decisão relevante deverá poder registrar: problema, condições, objetivo, método, normas consultadas, entradas, cálculo, opção escolhida, alternativas descartadas, justificativa, incertezas, profissional, data e versão.

As entrevistas deverão incluir perguntas contrafactuais: **o que mudaria se uma condição específica fosse diferente?** Respostas são hipóteses de comportamento, a confirmar com testes, não provas isoladas de causalidade.

### 6.4 Separação do corpus

Manter conjuntos independentes para desenvolvimento, validação e testes de regressão. Não usar os mesmos exemplos para ajustar regras e depois alegar generalização a partir deles. Garantir contratos de autoria, direitos de uso para desenvolvimento de software, privacidade e responsabilidade.

### 6.5 Fluxo de incorporação ao motor

`Solução/explicação → hipótese formal → regra ou estratégia proposta → teste reproduzível → revisão especializada → homologação → versão publicada do método`.

Divergências entre especialistas devem ser preservadas e classificadas; votação majoritária não determina conformidade normativa.

## 7. Arquitetura de execução técnica

### 7.1 Três camadas

- **IA assistiva/probabilística:** entrevista, levantamento de requisitos, investigação de alternativas, interpretação assistida de texto e explicação contextual.
- **Motores técnicos determinísticos:** cálculos, verificações, geração paramétrica, regras e transformação de dados.
- **Governança e prova:** normas versionadas, domínio de validade, conjuntos de teste, revisão especializada, auditoria e autorização.

### 7.2 Domínio de validade por método

Cada método deve declarar: especialidade, tipologias suportadas, localização/jurisdição quando relevante, faixas de parâmetros, entradas obrigatórias, dependências técnicas, versões normativas, exceções e condições que exigem revisão especial.

O sistema deve retornar estados diferenciados, por exemplo: `APTO_PARA_PROCESSAMENTO`, `DADOS_INSUFICIENTES`, `FORA_DO_ESCOPO`, `FALHA_DE_VALIDACAO` e `GERADO_PARA_REVISAO`. Nenhum desses estados implica aprovação legal.

### 7.3 Dependências e invalidação

Quando um elemento, premissa ou método muda, um grafo de dependências deve identificar quais cálculos, geometrias, documentos e aprovações podem ter perdido validade. Não realizar alterações silenciosas nem preservar atestados de revisão sobre uma versão modificada.

### 7.4 Interoperabilidade

Projetar troca com ecossistemas CAD/BIM e formatos abertos relevantes, avaliando IFC, IDS e BCF no momento adequado. O objetivo de longo prazo inclui **geração própria de projetos técnicos**, e interoperabilidade é uma capacidade de saída/entrada, não uma substituição da geração própria. Editor técnico nativo completo permanece decisão futura.

## 8. Modelo conceitual de dados

Entidades herdadas do PRD 0.1: `Terrain`, `Parcel`, `RegulationSet`, `Project`, `ProjectRevision`, `FeasibilityStudy`, `Scenario`, `SiteLayout`, `Building`, `Floor`, `Unit`, `Space`, `Component`, `GeometryArtifact`, `ValidationResult`, `Review`, `Publication`.

Novas entidades lógicas propostas (não correspondem necessariamente a tabelas):

| Entidade | Função |
|---|---|
| `EngineeringDiscipline` | Especialidade e atribuições |
| `EngineeringMethod` | Algoritmo/método técnico, versão e autoria |
| `RuleSet` | Regras e fontes técnicas versionadas |
| `ApplicabilityDomain` | Pré-condições e limites de uso |
| `ExpertReferenceCase` | Problema, entradas e solução independente |
| `DesignDecision` | Escolha, alternativas e justificativas |
| `CalculationRecord` | Entradas, método, resultados e rastreabilidade |
| `TechnicalSystem` | Rede, circuito, sistema ou subconjunto disciplinar |
| `TechnicalArtifact` | Prancha, memorial, modelo e relatório derivado |
| `DependencyGraph` | Impacto e invalidação entre objetos |
| `BenchmarkEvaluation` | Comparação de casos e avaliação independente |
| `MethodApproval` | Homologação de versão e domínio do método |
| `TechnicalApproval` | Revisão do projeto específico por responsável habilitado |
| `ConstructionActivity` | Etapa e relação com planejamento da obra |
| `FieldObservation` | Medição, inspeção e evidência da execução |

Todos os artefatos derivados devem declarar qual revisão de projeto, quais versões de métodos e quais entradas os produziram. Alteração de qualquer dependência relevante poderá invalidar o artefato.

## 9. Fluxos-alvo

### 9.1 Criação de método

Especialista descreve procedimento → equipe formaliza cálculos e domínio → testes sintéticos e casos de referência → auditoria independente → homologação controlada → publicação da versão do método.

### 9.2 Projeto automatizado dentro do escopo

Cliente informa lote e requisitos → sistema valida dados e aplicabilidade → gera viabilidade → seleciona alternativa aprovada para evolução → cria arquitetura → executa disciplinas complementares homologadas → verifica interferências e requisitos → produz documentação e evidências → responsável revisa e corrige → processos externos de aprovação, quando aplicáveis.

### 9.3 Alteração coordenada

Alteração arquitetônica ou técnica → versionamento → identificação de dependências afetadas → recomputação controlada → nova verificação → necessidade explícita de nova revisão/aprovação para artefatos impactados.

### 9.4 Ciclo de vida da obra (futuro)

Projeto aprovado → planejamento e orçamento → execução com registros → comparação planejado/realizado → gestão de mudanças, medições e inspeções → as built → entrega, garantias e manutenção.

## 10. Requisitos transversais

- **RT-001:** todas as regras e métodos têm versão, origem e responsável pela homologação.
- **RT-002:** resultados técnicos são reproduzíveis sob mesmas entradas e versões.
- **RT-003:** fronteiras de aplicabilidade são verificadas antes e durante o processamento.
- **RT-004:** casos fora de escopo não são apresentados como resultados concluídos/conformes.
- **RT-005:** geometria, cálculos e documentos técnicos mantêm consistência ou sinalizam divergência.
- **RT-006:** componentes e cálculos afetados por mudanças são invalidados ou reavaliados.
- **RT-007:** auditor independente consegue reproduzir decisões e testes essenciais.
- **RT-008:** homologação de método e aprovação de projeto são processos distintos.
- **RT-009:** o laboratório preserva soluções independentes e direitos de uso rastreáveis.
- **RT-010:** nenhuma integração poderá regressar publicação e experiências 3D existentes sem testes específicos.
- **RT-011:** suportar representação LEVE/PREMIUM sem confundir qualidade visual com maturidade técnica.
- **RT-012:** controle de acesso, segregação por organização e histórico de alterações não destrutivo.

## 11. Níveis de maturidade (eixos separados)

Não confundir três dimensões:

1. **Geométrica/visual:** terreno → massa → pavimentos → elementos → visualização detalhada.
2. **Técnica:** conceito → cálculo estruturado → verificação → revisão responsável → autorização/aprovação aplicável.
3. **Domínio de validade:** não suportado → experimental → validado em casos definidos → homologado para um conjunto delimitado de condições.

Um modelo bonito em PREMIUM pode continuar tecnicamente experimental; um modelo LEVE pode conter informações técnicas rigorosas.

## 12. Roadmap de longo prazo

| Fase | Marco | Gate de saída |
|---|---|---|
| 0 | Pesquisa e protótipo isolado de viabilidade | Entrega documental registrada; não equivale a homologação |
| 1 | Homologação dos estudos de viabilidade em pilotos | Testes reproduzidos, defeitos críticos resolvidos, revisão profissional |
| 2 | Modelo técnico compartilhado e primeira tipologia simples | Dados e geometria coerentes com contratos versionados |
| 3 | Laboratório de especialistas + motor arquitetônico | Primeiro método documentado, casos independentes e aprovação de escopo |
| 4 | Primeiro motor complementar (elétrico ou hidrossanitário) | Cálculos e artefatos auditáveis dentro de domínio restrito |
| 5 | Compatibilização de duas disciplinas | Interferências detectáveis, tratamento de mudanças e revisão |
| 6 | Geração de pacote técnico e workflow profissional | Documentos, cálculos e revisões rastreáveis |
| 7 | Novas tipologias e disciplinas | Demonstração de reutilização e manutenção sustentável |
| 8 | Conjunto coordenado de projetos de uma edificação | Avaliação independente por profissionais e limites explícitos |
| 9 | Orçamento, planejamento e execução assistida | Piloto de acompanhamento com dados reais controlados |
| 10 | Ciclo completo de empreendimento | Métricas de qualidade, uso e economia sustentáveis |

A sequência é proposta, sem prazos comprometidos. Configuradores de loteamentos, experiências internas e comercialização permanecem trilhas de produto, liberadas conforme as capacidades técnicas amadureçam.

## 13. Métricas de validação e sucesso

- Cobertura real do domínio validado, por disciplina e tipologia.
- Taxa e gravidade de não conformidades encontradas por auditoria independente.
- Falsos positivos e falsos negativos da classificação `FORA_DO_ESCOPO`.
- Reprodutibilidade matemática e consistência entre cálculos, desenhos e modelos.
- Retrabalho profissional, tempo até revisão e número de ciclos de correção.
- Taxa de detecção de interferências e alterações propagadas corretamente.
- Custos por projeto, por motor e por entrega aceita; custo de infraestrutura e tokens.
- Qualidade das explicações de decisões; porcentagem com fontes e justificativas verificáveis.
- Aderência comercial: adoção por profissionais, disposição de pagamento e valor efetivamente gerado.

**Meta norteadora:** aumentar a parcela de projetos **dentro do escopo homologado** que chegam à revisão com pouca necessidade de correção e nenhuma não conformidade crítica conhecida. Não usar quantidade de projetos gerados como indicador isolado.

## 14. Riscos prioritários e mitigação

| Risco | Resposta planejada |
|---|---|
| Generalizar padrões de poucos especialistas | Diversidade de casos, revisão independente, domínio explícito |
| Aprender preferências como se fossem normas | Classificar regra obrigatória, cálculo, estratégia e heurística |
| Contaminação entre treino e validação | Conjuntos separados e casos adversários inéditos |
| Resultados plausíveis mas incorretos | Testes determinísticos, comparação com engenharia de referência, não conformidades rastreáveis |
| Mudanças silenciosas entre disciplinas | Grafo de dependências, versões imutáveis, recálculo e reaprovação |
| Normas municipais incompletas/conflitantes | Fontes, vigência, bloqueio de conclusões e revisão responsável |
| Dados de terreno insuficientes | Proveniência, precisão e exigência de levantamento apropriado |
| Responsabilidade técnica mal definida | Papéis formais, homologação separada de aprovação do projeto |
| Direitos sobre projetos de referência | Contratos, consentimentos e controle de confidencialidade/autoria |
| Construir um monólito excessivo | Motores isolados, contratos e provas de integração antes de expandir |
| Regressão na plataforma atual | PR → CI → revisão → merge autorizado → deploy isolado → smoke |

## 15. Decisões arquiteturais propostas

- **DA-011 — Engenharia codificada:** métodos especializados serão formalizados em motores executáveis; modelos de linguagem não substituem o cálculo validado.
- **DA-012 — Domínios declarados:** cada motor define onde pode ou não operar e como tratar exceções.
- **DA-013 — Especialista como construtor de método:** profissionais definem e homologam conhecimento técnico, além de revisar projetos específicos.
- **DA-014 — Laboratório comparativo:** soluções independentes alimentam hipóteses e testes; consenso não equivale a conformidade.
- **DA-015 — Revisão por dependências:** mudança em artefatos compartilhados invalida verificações e aprovações afetadas.
- **DA-016 — Modelo técnico compartilhado:** representação de sistemas e componentes precede dependência exclusiva de um software CAD/BIM.
- **DA-017 — Autoria e direitos rastreáveis:** uso de projetos/explicações de especialistas depende de acordos explícitos.
- **DA-018 — Homologação distinta de aprovação:** validar um motor não assina automaticamente os projetos gerados por ele.
- **DA-019 — Integração incremental:** viabilidade atual permanece isolada até seus próprios gates; legado LEVE/PREMIUM preservado.
- **DA-020 — Engenharia própria com interoperabilidade:** motores internos geram resultados técnicos; exportação/importação BIM serve à colaboração, não define o limite da visão.

Permanecem válidas as decisões DA-001 a DA-010 do PRD 0.1, salvo futura alteração documentada.

## 16. Questões abertas para pesquisa

1. Qual tipologia mínima terá documentação de entrada suficientemente confiável para o primeiro motor arquitetônico?
2. Qual disciplina complementar oferece melhor equilíbrio entre verificabilidade, custo e valor no primeiro piloto?
3. Como estruturar contratos com especialistas e critérios de seleção/independência?
4. Qual formato estruturado mínimo representa sistemas elétricos e hidrossanitários sem exigir um editor BIM completo?
5. Como verificar quantitativamente o limite de validade e o nível de confiança da solução, sem prometer certeza indevida?
6. Quais dados de campo, normas técnicas e documentos devem ser obrigatórios para cada disciplina?
7. Como separar responsabilidade pelos métodos, software, revisão e projeto específico?
8. Que integrações CAD/BIM são necessárias antes de decidir sobre edição técnica nativa?
9. Qual custo por projeto validado tornará o produto economicamente atraente?
10. Quais módulos de obra podem ser testados primeiro sem comprometer a operação principal?

## 17. Próxima decisão recomendada

**Não iniciar seis módulos simultaneamente.** Primeiro, concluir o plano de homologação do motor de viabilidade: reproduzir testes no HEAD, fechar defeitos críticos, confirmar normas e dados dos pilotos e revisar resultados com profissional de São Carlos.

Em paralelo apenas no plano documental, desenhar o contrato mínimo de `EngineeringMethod`, `ApplicabilityDomain`, `CalculationRecord` e `DesignDecision`, sem migrar dados produtivos nem reescrever o motor atual.

Após esse gate, escolher um problema arquitetônico simples e um especialista para testar formalização de conhecimento com outros profissionais independentes.

---

**Status final:** proposta estratégica para debate. Não é autorização de implementação, assinatura de projeto ou aprovação de construção.


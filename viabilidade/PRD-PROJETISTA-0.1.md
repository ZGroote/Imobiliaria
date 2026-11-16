# PRD — Projetista Arquitetônico Assistido
## Imobiliária 3D | Da planta do apartamento ao empreendimento | Versão 0.1 — proposta para revisão

**Status:** especificação de produto; não autoriza implementação, merge ou publicação.  
**Data:** 15/11/2026.  
**Dependências:** `viabilidade/PRD-VIABILIDADE-1.0.md` e `viabilidade/PRD-V1-COMERCIAL.md`.  
**Natureza:** evolução planejada, separada do MVP comercial atual e do PR #124.

## 1. Visão e decisão de produto

Construir um ambiente de **concepção arquitetônica preliminar assistida por regras**, integrado ao estudo de viabilidade da Imobiliária 3D. O usuário poderá criar plantas de apartamentos manualmente ou pedir ao sistema que proponha plantas e distribuições. O software organizará unidades em pavimentos, pavimentos em torres e torres no lote, procurando configurações viáveis dentro das restrições **conhecidas e verificadas**, e produzindo representação 2D/3D coerente e métricas rastreáveis.

**Dois modos, um só modelo de projeto:**
- **Modo Livre (projeto do usuário):** desenhar ambientes e apartamentos, adicionar tipos, compor pavimentos, ajustar núcleos/circulações e implantação; receber verificações explicativas durante a edição.
- **Modo Automático (propostas do sistema):** informar metas e restrições — por exemplo, 6 unidades por pavimento, apartamentos de ~60 m², prioridades de aproveitamento — e receber alternativas preliminares de plantas, pavimentos e torres, todas editáveis.

Os modos são intercambiáveis: uma alternativa automática pode ser editada manualmente; um projeto manual pode solicitar recomposição/otimização de partes não bloqueadas pelo usuário.

**Promessa permitida:** "Explore organizações preliminares de apartamentos, pavimentos e torres e entenda suas verificações e incertezas."  
**Promessa proibida:** "O software aprova o projeto, garante a melhor solução ou assegura que a edificação poderá ser construída."

## 2. Problema e públicos

A volumetria de viabilidade responde quanto *pode caber em tese*, mas não demonstra a organização de unidades e áreas comuns. Desenhar alternativas manualmente em ferramentas desconectadas dificulta comparar aproveitamento, manter números consistentes e saber qual regra foi violada.

**Usuários iniciais:** operadores internos, arquitetos e profissionais de projeto em ambiente supervisionado; posteriormente incorporadoras e usuários comerciais com permissões adequadas. Não pressupor competência técnica de usuários finais.

## 3. Experiência-alvo e jornadas

### 3.1 Jornada A — Criar apartamento e montar o edifício
1. Abrir estudo versionado, escolher lote e alternativa/envelope de referência; apresentar fontes, status de conferência, limites e lacunas.
2. Criar **Planta Tipo A** no editor 2D: contorno, paredes, cômodos, portas, janelas e dimensões simples. O 3D esquemático da planta acompanha as mudanças.
3. Criar **Planta Tipo B** ou duplicar A e editar. Cada planta guarda versão, área útil/privativa conforme definição documentada, programa de ambientes e necessidades de acesso/ventilação quando verificáveis.
4. Inserir plantas em um pavimento. O sistema propõe ou calcula espaços comuns: circulação, hall, núcleo de escada/elevador *esquemático*, shafts e sobras geométricas, sem assumir que sua existência comprova segurança, acessibilidade ou dimensionamento normativo.
5. Ajustar posições, girar unidades, travar elementos e redistribuir; mostrar conflitos geométricos e estimativas atualizadas.
6. Confirmar a composição do pavimento (com status de validação explícito). Pedir ao sistema possibilidades de repetição: pavimentos, torres e implantação, respeitando o envelope e as limitações de área, altura e recuos disponíveis.
7. Comparar opções e selecionar uma; inspecionar maquete do edifício com contagem de torres, pavimentos e unidades; voltar à planta a qualquer momento.

### 3.2 Jornada B — Gerar a partir de objetivos
1. Selecionar estudo e definir programa: área-alvo por unidade (ex.: 50/60/70 m²), número desejado de apartamentos por andar (ex.: 6), tipologias, vagas desejadas e prioridade de otimização.
2. Sistema produz geometrias esquemáticas de apartamentos, reserva áreas comuns e testa composições de pavimento; informa premissas e regras ainda não verificadas.
3. Sistema posiciona edifícios e compara configurações de número de torres e andares; apresenta alternativas viáveis *segundo as regras implementadas*, com indicadores e motivos de descarte.
4. Usuário seleciona uma proposta, abre no Modo Livre, altera e salva nova revisão.

### 3.3 Jornada C — Corrigir problema
Ao tentar adicionar pavimento ou deslocar torre, o sistema recalcula e indica por exemplo: "Recuo lateral adotado: 3,00 m; distância desenhada: 2,40 m; diferença: 0,60 m". A indicação deve apontar o elemento no 2D/3D, fonte/versão da regra e possível correção. Quando o dado-base não estiver confirmado, sinalizar **não verificado** em vez de reprovar ou aprovar falsamente.

## 4. Escopo funcional

### 4.1 Editor de apartamento (2D + 3D)
- Desenhar, mover, rotacionar, dimensionar, copiar e excluir paredes e ambientes; portas e janelas esquemáticas na fase inicial.
- Edição com grade, cotas, encaixe (*snap*), desfazer/refazer, seleção e propriedades numéricas.
- Atualização síncrona da geometria e das áreas da planta no 2D e 3D; nenhum redesenho independente para relatório.
- Biblioteca de plantas reutilizáveis com versões e identificação de tipologia; componentes estruturais e instalações são apenas indicativos onde não houver verificador próprio.
- Validações geométricas básicas: polígonos inválidos, sobreposição, vazios, acesso e dimensões mínimas **somente quando o parâmetro normativo aplicável estiver documentado e conferido**.

### 4.2 Compositor de pavimentos
- Posicionar uma ou várias plantas dentro do envelope do pavimento; editar distribuição manualmente.
- Calcular área de unidades, área comum, áreas residuais e conflitos de geometria sem dupla contagem.
- Propor corredor, hall, núcleos e shafts esquemáticos; mostrar elementos ainda não dimensionados normativamente.
- Permitir pavimento tipo, térreo/embasamento e pavimento especial quando modelados; repetição com exceções explícitas.

### 4.3 Implantação de torres
- Criar instâncias de pavimentos, empilhá-los e calcular gabarito geométrico, área ocupada e contagem efetiva de unidades.
- Posicionar múltiplas torres no lote; verificar interseção, afastamentos conhecidos, ocupação, altura e demais regras cobertas pelo domínio validado.
- Comparar implantação e apresentar uma maquete 3D simples porém **derivada das plantas**, incluindo ritmo de pavimentos, acessos genéricos e massas de fachada. Janelas/varandas só como elementos do projeto ou convenção explicitamente ilustrativa.

### 4.4 Gerador de alternativas
- Entradas obrigatórias: estudo/revisão, terreno, objetivo mensurável, programa de unidades, restrições fixadas e elementos bloqueados pelo usuário.
- Gerar candidatos por heurísticas determinísticas inicialmente; registrar versão, semente quando aplicável, tempo e limites da busca.
- Dimensionar unidades e áreas comuns com modelo geométrico explícito; não usar apenas divisão de área total por área-alvo.
- Comparar número de torres, pavimentos, unidades, área privativa e área comum, mantendo coerência entre geometria e quadro de áreas.
- Suportar objetivos distintos: maximizar número de unidades, área privativa, aderência ao mix desejado ou reduzir áreas comuns, com pesos e conflitos apresentados.
- Quando uma opção não surgir, distinguir: **impossibilidade demonstrada sob hipóteses**, **busca não encontrou**, **dados insuficientes** e **erro de execução**. Não afirmar ótimo global sem prova.

### 4.5 Validador explicativo
Três estados primários por regra: **conforme**, **violação** e **não verificado**. Cada verificação retorna identificador, estado, medições, valor-limite quando conhecido, unidade, elementos afetados, regra/fonte/versão, gravidade e sugestão não vinculante. Bloquear apenas operações que corrompem o modelo; permitir exploração de opções com violações, mas impedir indicação de conformidade ou exportação como proposta validada.

### 4.6 Relatório, comparação e revisão
- Quadro de unidades por tipo/pavimento/torre, pavimentos, áreas, taxa de ocupação, CA usado, altura, espaços comuns e alertas.
- Mesmas geometrias e métricas para editor 2D, maquete 3D, comparador e relatório; arredondamento só na apresentação.
- Salvar, duplicar, comparar revisões e exportar estudo preliminar com marca d'água conceitual e lista de pendências.
- Vincular projeto à revisão imutável do estudo de viabilidade de origem. Se as regras ou a zona mudarem, marcar o projeto como **necessita revalidação**, nunca recalcular silenciosamente.

## 5. Requisitos funcionais e critérios de aceite

| ID | Requisito | Critério verificável |
|---|---|---|
| PA-001 | Estudo vinculado | Todo projeto referencia estudo, revisão, regras e origem de dados; versão ausente bloqueia status de conformidade |
| PA-002 | Editor 2D/3D único | Editar uma parede atualiza planta, volume, áreas e persistência sem divergência geométrica |
| PA-003 | Plantas reutilizáveis | Criar, duplicar, editar e posicionar pelo menos 2 tipos de apartamento em um pavimento |
| PA-004 | Área comum explícita | Área comum, unidades e resíduos fecham balanço geométrico dentro de tolerância definida; sobreposições são detectadas |
| PA-005 | Pavimentos e torres | Contagens de unidades e áreas correspondem às instâncias efetivamente inseridas, inclusive pavimentos excepcionais |
| PA-006 | Diagnóstico contextual | Violação conhecida indica elemento, regra, limite, medição e diferença; sem regra validada => não verificado |
| PA-007 | Gerador editável | Pedir 6 unidades por andar cria alternativas esquemáticas ou causa falha classificada; qualquer alternativa pode ser aberta no editor |
| PA-008 | Otimização auditável | Resultado declara objetivo, estratégia, tentativas, limites e ausência de garantia de ótimo global |
| PA-009 | Coerência visual | Modelo 3D e relatório derivam da mesma versão de geometria e mostram números consistentes |
| PA-010 | Revisões reproduzíveis | Salvar/reabrir e recalcular mantêm resultado dentro de tolerância; mudança de regra requer revalidação |
| PA-011 | Escopo e segurança | Não tratar planta, circulação, acessibilidade, incêndio ou estrutura como aprovados sem verificador e revisão aplicáveis |
| PA-012 | Publicação controlada | Integração segue PR → CI → revisão → deploy isolado → smoke → autorização; sem alteração automática do painel ou produção |

## 6. Contratos e modelo de dados (proposta)

**Entidades principais:** `StudyReference`, `Site`, `RuleSetReference`, `UnitType`, `Room`, `Wall`, `Opening`, `FloorPlate`, `SharedSpace`, `Core`, `FloorInstance`, `Tower`, `SiteLayout`, `DesignRevision`, `ValidationFinding`, `GenerationRun`.

**Hierarquia:** empreendimento → torres → instâncias de pavimento → plantas de apartamentos e áreas comuns → ambientes/elementos. Plantas-tipo são definições reutilizáveis, separadas das instâncias; cada instância registra transformação, pavimento e vínculos.

**Regras do contrato:**
- Coordenadas, unidades, sistema de referência, origem geométrica e tolerâncias explícitos; operações de geometria em representação adequada (não aproximar área via pixels do canvas).
- IDs estáveis para localizar erros nos objetos do editor; toda transformação é auditável e reversível.
- `DesignRevision` imutável para exportações, com hash de conteúdo, versão de esquema, motor, regras, fontes e estudo-base.
- Métricas calculadas no núcleo, não recalculadas separadamente pelo navegador ou relatório.
- `ValidationFinding` suporta estados conforme/violação/não verificado, e também erro técnico na execução.

## 7. Arquitetura funcional

**Fluxo:** estudo de viabilidade versionado → modelo de terreno e regras → editor manual **ou** gerador automático → modelo arquitetônico canônico → motor geométrico/validador → 2D, 3D, comparador e relatório.

Separar: (i) **motor geométrico** (interseções, áreas, encaixe), (ii) **motor de regras** com fontes/status, (iii) **mecanismo de geração/busca**, (iv) **interface de edição e visualização**. A geração não pode editar silenciosamente elementos fixados pelo usuário. Uma regra nunca deve ter interpretação divergente entre os dois modos.

Integrar ao motor atual por um adaptador versionado e testado. O novo PRD **não modifica** o contrato de viabilidade nem assume homologação dos dados de São Carlos; propor evolução de contrato apenas em PR independente com testes de migração.

## 8. Domínio inicial e limites

**Primeiro domínio proposto (a validar):** lotes simples, edifícios residenciais com pavimento tipo, planta poligonal ortogonal, unidade de um nível, circulação horizontal esquemática, geometria sem terrenos de topografia complexa. Começar com poucos padrões de núcleo e mix de unidades.

**Fora do MVP:** projeto executivo, BIM completo, estruturas, instalações, orçamento de obra, aprovação legal automática, análise completa de incêndio, acessibilidade, iluminação/ventilação, desempenho térmico, otimização global certificada e geração automática de interiores fotorrealistas. Esses itens podem exigir validações especializadas posteriores.

**Restrições cartográficas:** se o sistema usar mapas de 2017, mudanças posteriores (ex.: áreas industriais 44/45 e Zona 6E) exigem atualização, exclusão explícita do domínio ou classificação não verificada. A ausência de alerta não pode ser interpretada como inexistência de restrição.

## 9. Requisitos não funcionais

- **Rastreabilidade:** cada resultado reproduzível, com fontes e revisões; sem números divergentes no 2D/3D/relatório.
- **Integridade:** persistência atômica e proteção contra perda de trabalho; sem modificar projetos anteriores ao atualizar motor.
- **Segurança:** validação também no servidor ao persistir/exportar; rejeitar entrada malformada e conteúdo não confiável; controles de autorização e privacidade.
- **Desempenho:** interação local responsiva para o caso de referência; geração executada com orçamento explícito, cancelamento e resultados parciais classificados. Metas numéricas após benchmark em dispositivos-alvo, não inventar SLA.
- **Acessibilidade:** operação por teclado para ações essenciais e informações de erro acessíveis, inclusive sem depender apenas de cor.
- **Testabilidade:** testes geométricos baseados em propriedades, adversários, regressão e consistência intercamadas; benchmarks repetíveis.

## 10. Plano por portões — não iniciar todos em paralelo

| Portão | Entrega | Saída exigida |
|---|---|---|
| PA-G0 | Descoberta e contratos | Casos de uso concretos, inventário do motor, definição de área/norma, esquema canônico, riscos e dados de referência |
| PA-G1 | Editor de uma planta | Desenho 2D, 3D sincronizado, áreas, versões, testes de persistência |
| PA-G2 | Composição de pavimento | Duas plantas-tipo, corredor/núcleo esquemático, conflitos e balanço geométrico |
| PA-G3 | Torres no lote | Repetir pavimentos, implantar torres, medir e validar limites conhecidos, maquete esquemática |
| PA-G4 | Gerador inicial | Gerar e ordenar alternativas por objetivo explícito; editar proposta no modo livre; evidência de busca/limitações |
| PA-G5 | Auditoria e piloto isolado | Testes adversários, revisão de arquiteto e auditor técnico, smoke, feedback de operadores; nenhum uso comercial sem autorização |

**Ordem executiva:** concluir e estabilizar o PR #124 e suas revisões antes de iniciar trabalho de integração deste novo produto. Uma prova de conceito independente pode existir em branch isolada somente após autorização específica.

## 11. Critérios de aceite do MVP deste novo produto

MVP aceito somente quando um operador consegue, em terreno e regras de domínio definido: (1) criar 2 plantas de apartamentos distintas; (2) visualizá-las em 2D/3D e editar dimensões; (3) encaixá-las num pavimento com área comum contabilizada; (4) repetir pavimentos e configurar uma ou mais torres; (5) obter pelo menos duas alternativas automáticas quando houver candidatos plausíveis, ou motivo classificado quando não houver; (6) editar uma alternativa gerada; (7) provocar violação conhecida e receber explicação correta; (8) salvar/reabrir sem mudar métricas; (9) gerar relatório coerente com a maquete; (10) identificar claramente toda regra não verificada.

Os casos de validação devem incluir lote insuficiente, conjunto de unidades que não cabe, torre fora do lote, recuo violado, restrição não conhecida, regra atualizada e tentativa de extrapolar domínio. A revisão independente confirma tanto falsos positivos quanto falsos negativos.

## 12. Métricas de sucesso

- Percentual de propostas com consistência exata entre geometria, quadro de áreas e relatório.
- Percentual de violações intencionais detectadas e falsos negativos em suíte adversária.
- Tempo e ações até produzir alternativa editável em casos de referência.
- Percentual de alternativas geradas que podem ser modificadas sem reconstrução manual.
- Completude de proveniência normativa e proporção de verificações classificadas corretamente como não verificadas.
- Avaliação de usabilidade por operadores/profissionais, sem confundir satisfação visual com conformidade técnica.

## 13. Principais riscos e mitigação

1. **Inventar planta irreal por simples divisão de área:** exigir geometria de unidades e áreas comuns sem interseções; declarar hipóteses.
2. **Conformidade falsa:** três estados de verificação, escopo por município/tipologia e revisão profissional.
3. **Otimizador vender ótimo sem prova:** objetivo explícito, limite de busca, resultados classificados, preservação de soluções.
4. **Divergência entre interfaces:** modelo geométrico canônico, métricas centralizadas e snapshots versionados.
5. **Mudanças de normas/mapas:** versionamento, proveniência, revalidação e bloqueio da conclusão positiva sem dados atuais.
6. **Escopo virar BIM completo:** portões progressivos, backlog separado e exclusões explícitas.
7. **Dados cartográficos/terceiros:** verificar permissão de uso/republicação antes de distribuir materiais incorporados.

## 14. Decisões e questões em aberto

**Decisões propostas:** dois modos no mesmo produto; um modelo canônico; 3D derivado da planta; liberdade de experimentar com violações visíveis; alternativas automáticas editáveis; regras com fonte e estado; integração conservadora.

**A validar antes de PA-G1:** definição operacional de área privativa/útil/computável; padrão mínimo de cômodos e paredes; se as cotas serão internas ou externas; unidades em pavimento único no MVP; catálogo inicial de núcleos; alcance de normas edilícias e acessibilidade; custo de manter edição 2D e 3D síncrona; qual benchmark de dispositivo e escala usar; forma de armazenar projetos sem impactar o Firestore de produção.

**A validar antes de PA-G4:** objetivos de otimização, prioridades conflitantes, limites de busca, tipos de corredor/núcleo, tolerâncias e critérios para afirmar impossibilidade geométrica.

## 15. Próxima decisão solicitada

Aprovar **somente a especificação e o estudo de arquitetura PA-G0** após revisão dos requisitos. Não abrir implementação nem alterar produção como consequência automática deste documento. Manter em primeiro plano o CI e as auditorias do PR #124 e a validação urbanística independente da viabilidade.


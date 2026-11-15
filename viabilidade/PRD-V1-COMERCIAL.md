# PRD — Imobiliária 3D | Versão 1 Comercial
## Viabilidade preliminar, maquete volumétrica do estudo e maquete completa do empreendimento

**Versão:** 1.0 — Proposta para validação do produto  
**Data:** 15/11/2026  
**Status:** Escopo de produto proposto; NÃO autoriza implementação, integração ou publicação  
**Produto:** Imobiliária 3D  
**Referências:** `viabilidade/PRD.md` (v0.1 histórica); `viabilidade/PRD-VIABILIDADE-1.0.md` (especificação técnica do motor); `viabilidade/PRD-PLATAFORMA-0.2.md` (visão estratégica futura); `viabilidade/README.md` (contratos atuais).  
**Separação essencial:** o presente documento define **o que comercializar na V1**. Não substitui o PRD técnico da viabilidade e não inicia o programa futuro de engenharia automatizada.

---

## 1. Decisão executiva

A primeira versão comercial da Imobiliária 3D terá **três pilares**, sem exigir geração automática de plantas executivas ou contratação imediata de equipes de engenharia multidisciplinar:

1. **Estudo preliminar de viabilidade construtiva:** análise exploratória de um terreno, legislação e premissas disponíveis, com alternativas geométricas e métricas estimadas, fontes, incertezas e relatório.
2. **Maquete 3D do estudo de viabilidade:** representação volumétrica e navegável dos cenários calculados, vinculada ao estudo e suas limitações.
3. **Maquete completa de um empreendimento:** apresentação visual detalhada, incluindo, conforme o material de origem e o pacote contratado, áreas externas, edificações, unidades, interiores e áreas comuns. Pode ser elaborada a partir de projetos/modelos fornecidos por profissionais, sem depender de geração automática de engenharia.

**Diretriz de negócio:** lançar um produto útil, demonstrar demanda e gerar receita que possa financiar a pesquisa futura em motores de arquitetura e engenharia. A maquete completa e o estudo preliminar são **produtos relacionados, mas independentes**: um cliente poderá contratar uma maquete completa sem adquirir o estudo de viabilidade, e vice-versa.

**Diretriz técnica:** preservar a plataforma existente, as experiências 3D e os padrões **LEVE e PREMIUM**. O novo motor de viabilidade só será integrado por autorização específica, após testes, critérios de escopo e validações apropriadas.

## 2. Problema e proposta de valor

### 2.1 Problemas dos clientes

- Proprietários, corretores e incorporadoras precisam compreender e comunicar rapidamente possibilidades preliminares de aproveitamento de um terreno.
- Comparar alternativas de implantação em tabelas e desenhos técnicos pode ser difícil para clientes comerciais.
- Empreendimentos com projeto já desenvolvido precisam de apresentações 3D convincentes para marketing, pré-venda, negociação e relacionamento com interessados.
- É fácil confundir estimativas automatizadas e representações visuais com comprovação jurídica ou técnica de exequibilidade.

### 2.2 Solução da V1

Uma experiência integrada — sem obrigatoriedade de usar todos os serviços — que oferece **triagem urbanística/geométrica**, **visualização do potencial construtivo** e **apresentação imobiliária completa**.

**Promessa comercial permitida:** "Compare cenários preliminares de aproveitamento e apresente empreendimentos em experiências 3D navegáveis."

**Promessa proibida:** "O sistema garante que esse empreendimento pode ser aprovado ou construído" ou "gera automaticamente todos os projetos necessários para a obra".

## 3. Públicos e formas de uso

| Perfil | Necessidade | Produto prioritário |
|---|---|---|
| Proprietário de terreno | Entender possibilidades iniciais antes de investir | Estudo + maquete de cenários |
| Corretor e imobiliária | Comunicar potencial de terrenos e apresentar imóveis | Estudos compartilháveis e maquetes |
| Incorporadora / construtora | Triar terrenos, avaliar alternativas e apresentar lançamentos | Ambos, conforme etapa do empreendimento |
| Loteadora | Apresentar lotes e propostas visuais de edificações | Maquetes e estudos preliminares quando aplicáveis |
| Arquiteto / profissional habilitado | Consultar hipóteses e revisar premissas de um estudo | Estudo rastreável e relatório |
| Comprador / interessado | Explorar empreendimento e ambientes | Maquete completa, quando disponível |
| Administrador / operador | Cadastrar materiais, controlar acesso, versões e publicações | Operação de toda a V1 |

O estudo gerado por software é **subsídio preliminar**, não parecer técnico assinado. A maquete detalhada é uma **representação de apresentação** e deve identificar a origem do projeto e eventuais divergências ou itens ilustrativos.

## 4. Escopo dos três pilares

### 4.1 Pilar A — Estudo preliminar de viabilidade

**Entradas:** polígono e área do lote, identificação e frente, sistema de referência, parâmetros urbanísticos, vínculo entre zona e lote, restrições especiais conhecidas, relevo disponível e premissas de tipologia/empreendimento.

**Processamento:** validação das entradas; aplicação das regras implementadas com origem documentada; formação de envelopes; geração de alternativas; cálculo consistente das métricas; classificação de limites, advertências e dados não confirmados.

**Saídas:** estudo versionado, alternativas A–D ou subconjunto viável, parâmetros utilizados, métricas estimadas, explicação de alternativas ausentes, relatório preliminar e possibilidade de encaminhamento para revisão humana.

**Limitações obrigatórias:**

- Resultado *preliminar*; não é licenciamento, projeto de arquitetura nem viabilidade legal garantida.
- Zoneamento de um lote e parâmetros de uma zona são afirmações diferentes: cada uma com seu status de conferência.
- Relevo aproximado (como Copernicus GLO-30) não substitui levantamento planialtimétrico e não deve ser apresentado como cota de implantação executiva.
- O motor poderá suportar inicialmente um município e tipologias limitadas; situações fora do domínio verificado devem ser identificadas, não tratadas como aprovadas.
- A expressão "melhor alternativa" exige critério explícito; heurística não pode ser vendida como otimização global comprovada.

**Base técnica vinculante para implementação:** `viabilidade/PRD-VIABILIDADE-1.0.md`, incluindo VF-001–VF-012, tratamento de ausência de opções, testes e portões 1A–1E.

### 4.2 Pilar B — Maquete 3D do estudo

- Visualizar terreno e envelopes; girar, aproximar, afastar e inspecionar volumes.
- Comparar cenários com identificadores, tipologia, ocupação, pavimentos, áreas e unidades estimadas quando existentes.
- Exibir alertas relevantes no mesmo fluxo da visualização, não escondidos exclusivamente em textos técnicos.
- Diferenciar **massa conceitual** de projeto arquitetônico detalhado.
- Possibilitar abertura do relatório da mesma revisão do estudo, sem divergências entre números da maquete e relatório.
- Caso um cenário não seja encontrado ou não tenha unidades, indicar classificação do motivo (impossível conforme hipóteses; busca inconclusiva; falta de dados; erro), conforme implementação suportada.
- Prever uso em desktop e mobile, com critérios mensuráveis de desempenho após medição.

**Condição de aceite:** qualquer usuário deve perceber claramente que uma torre genérica/volume simplificado representa **potencial hipotético**, e não a fachada final de um edifício ou um projeto autorizado.

### 4.3 Pilar C — Maquete completa do empreendimento

**Objetivo:** oferecer uma experiência de apresentação de empreendimento efetivamente modelado, com qualidade visual adequada ao pacote comercial e às informações fornecidas.

**Escopo funcional, quando existente no projeto contratado:**

- Terreno e implantação, edificações e fachadas detalhadas.
- Materiais, acabamentos, paisagismo e elementos de ambientação.
- Unidades/ambientes internos e espaços coletivos para navegação, conforme material recebido e escopo contratado.
- Navegação intuitiva em diferentes dispositivos, usando padrões LEVE/PREMIUM apropriados.
- Publicação controlada, identificação de versão, compartilhamento e integração aos fluxos comerciais existentes.

**Fontes:** arquivos e documentos fornecidos pelo cliente/profissional (plantas, modelos, memoriais descritivos, referências de acabamento) ou outros insumos com autorização de uso. Definir checklist de recebimento e registrar o que é representação confirmada versus ilustrativa.

**Fronteira importante:** a maquete completa **não exige** que a Imobiliária 3D calcule fundações, estruturas, elétrica ou hidráulica. Também **não se promete** conversão automática de qualquer arquivo de projeto em uma maquete perfeita; o esforço humano de modelagem, limpeza e validação pode continuar fazendo parte da operação V1.

**Não assumir automaticamente que todas as capacidades desejadas já estão prontas.** Inventariar os fluxos LEVE/PREMIUM, os tipos de cenas atualmente suportados e as etapas manuais antes de fechar o catálogo de pacotes.

## 5. Experiências e jornadas

### Fluxo V1-A — Análise de um terreno

1. Operador ou usuário autorizado cadastra/seleciona lote e fonte dos dados.
2. Sistema apresenta dados disponíveis e destaca informações não conferidas.
3. Define parâmetros e premissas; registra origem de cada um.
4. Motor gera alternativas preliminares e valida as verificações implementadas.
5. Usuário compara números, limitações e maquetes volumétricas.
6. Pode guardar uma revisão e emitir relatório com identificação e ressalvas.
7. Antes de uso que dependa de conformidade específica, encaminha premissas e resultados a profissional competente.

### Fluxo V1-B — Contratação de maquete completa

1. Cliente solicita apresentação de um empreendimento e informa objetivo comercial.
2. Operador define escopo e solicita materiais de origem e autorizações.
3. Equipe prepara/modela/adapta a maquete; registra pontos ilustrativos ou materiais faltantes.
4. Responsável pelo material confere conformidade visual com as referências disponíveis.
5. Versão é submetida a revisão e aprovação comercial pertinente.
6. Publicação controlada no fluxo da Imobiliária 3D, com validação pós-publicação.

### Fluxo V1-C — Evolução de estudo para maquete detalhada (opcional)

Um cenário de viabilidade pode inspirar o desenvolvimento de um projeto por profissional competente. **Não existe conversão automática implícita** de estudo preliminar em projeto executivo ou maquete detalhada. A ligação entre os produtos é explícita, com nova revisão, novos documentos de referência e confirmação do escopo.

## 6. Requisitos funcionais da V1

| ID | Requisito | Prioridade | Critério de aceite |
|---|---|---|---|
| V1-001 | Cadastro/entrada controlada do lote | P0 | Origem, sistema de referência e campos obrigatórios identificados |
| V1-002 | Regras urbanísticas com rastreabilidade | P0 | Fonte, versão, premissa ou ausência identificável |
| V1-003 | Geração de alternativas preliminares | P0 | Opções suportadas e rejeições classificadas corretamente |
| V1-004 | Métricas coerentes com geometria | P0 | Mesma revisão e medidas consistentes no JSON, UI e relatório |
| V1-005 | Alertas de incerteza e limites | P0 | Visíveis em estudo, maquete e relatório |
| V1-006 | Maquete volumétrica navegável | P0 | Visualização e comparação sem representar volume como projeto definitivo |
| V1-007 | Relatório preliminar compartilhável | P0 | Identificação de estudo, fontes, premissas, ressalvas e revisão |
| V1-008 | Suporte à maquete completa de empreendimento | P0 | Pelo menos um fluxo demonstrável de modelagem/apresentação de projeto com materiais válidos |
| V1-009 | Preservar LEVE e PREMIUM | P0 | Testes de regressão não quebram nenhum dos dois perfis |
| V1-010 | Publicação e controle de acesso | P0 | Somente publicação autorizada, revisão rastreável e possibilidade de reversão |
| V1-011 | Rastreio de insumos da maquete completa | P0 | Origem, permissão de uso e caráter ilustrativo identificados |
| V1-012 | Experiência responsiva e acessível | P1 | Fluxos-chave validados em dispositivos e entradas definidas |
| V1-013 | Associação opcional estudo ↔ apresentação comercial | P1 | Link entre revisões sem transformar cenário em projeto aprovado |
| V1-014 | Comparação comercial de alternativas | P1 | Comparação não omite restrições relevantes |
| V1-015 | Operação padronizada da maquete completa | P1 | Checklist de materiais, revisão e aceite do cliente documentado |

**P0:** necessário para considerar a V1 comercial pronta dentro do escopo contratado. **P1:** incremento posterior ou requisito que pode ser adiado por decisão explícita, sem alegar que foi entregue.

## 7. Estados de revisão e publicação

Separar **maturidade técnica do estudo** de **qualidade visual da maquete**.

Estados recomendados para estudos: `RASCUNHO`, `GERADO_PRELIMINAR`, `DADOS_INSUFICIENTES`, `FORA_DO_ESCOPO`, `ENCAMINHADO_REVISAO`, `REVISADO_POR_PROFISSIONAL` (quando comprovado).

Estados recomendados para maquetes: `EM_PREPARACAO`, `EM_REVISAO`, `APROVADA_PARA_APRESENTACAO`, `PUBLICADA`, `SUBSTITUIDA`.

Estes rótulos são **proposta de interface/contrato**, não instrução para alterar agora o esquema de dados existente. Uma maquete comercial publicada não torna o estudo subjacente tecnicamente aprovado.

## 8. Dados e contratos mínimos

**Reutilizar inicialmente os contratos já existentes** entre lote, zona, premissas, envelope, opções e incertezas, conforme `viabilidade/README.md`. No módulo atual, a referência de coordenadas é SIRGAS 2000 / UTM 23S (EPSG:31983), com atenção ao legado SAD69 / UTM 23S (EPSG:29193).

Conceitos adicionais da V1, somente quando uma integração exigir:

| Entidade lógica | Propósito |
|---|---|
| `FeasibilityStudy` | Entradas, versões, cenários, status e incertezas |
| `Scenario` | Uma hipótese de aproveitamento e seu conjunto de métricas/volumes |
| `StudyVisualization` | Artefato volumétrico derivado de determinada revisão do estudo |
| `PresentationProject` | Solicitação comercial de maquete detalhada |
| `SourceMaterial` | Plantas, modelos, referências, autorização e limitações de uso |
| `PresentationRevision` | Versão da maquete completa e aprovações comerciais |
| `Publication` | Artefato disponibilizado, autorização, rollback e referência da versão |

Evitar migrações preventivas. Se o esquema atual já suportar o uso, preferir adaptação mínima e documentada. **Dados canônicos e modelos 3D derivados permanecem separados.**

## 9. Qualidade, segurança e desempenho

- **Correção e reprodutibilidade:** preservar testes geométricos, critérios de monotonicidade condicionada, coerência métrica e casos adversários descritos no PRD técnico de viabilidade.
- **Fontes e incertezas:** normas não confirmadas e dados incompletos continuam sinalizados; não inventar números para preencher lacunas.
- **Isolamento:** nenhum módulo experimental pode causar regressão em imóveis publicados, painel ou contratos existentes.
- **Controle de acesso:** proteger dados de clientes, materiais recebidos e versões não públicas; não publicar automaticamente novos estudos.
- **Testes:** `viabilidade/conferir.py` e GitHub Actions constituem base de verificação, mas CI verde não equivale a revisão urbanística humana nem autorização de deploy.
- **Disponibilidade:** medir tempo de estudo, carregamento 3D, resposta em mobile e falhas antes de fixar SLAs numéricos.
- **LEVE/PREMIUM:** manter ambos suportados; não confundir perfil de desempenho com grau de precisão técnica ou visual.
- **Licenças e autoria:** verificar autorização para usar projetos, imagens, marcas, materiais técnicos e modelos fornecidos por terceiros.
- **Privacidade/segregação:** isolar projetos comerciais e arquivos entre clientes e papéis.

## 10. Riscos conhecidos do motor de viabilidade

Não apagar nem amenizar pendências existentes:

1. **Recuos assimétricos com permeabilidade restritiva:** possível resultado não monotônico; requer tratamento no Portão 1B e regressão específica.
2. **Garagem computável:** comportamento não monotônico conhecido; requer tratamento no Portão 1B e regressão específica.
3. **Alternativa com zero unidades ou ausente:** classificar motivo; não confundir heurística inconclusiva com impossibilidade demonstrada.
4. **Relevo aproximado:** disponibilizar proveniência e ressalvas visíveis na UI e no relatório.
5. **Zonas e lotes de São Carlos:** ainda existem limites e interpretações que requerem conferência específica, particularmente casos limítrofes já documentados.
6. **Auditorias e documentação:** achados superados precisam de atualização por evidência do código vigente, evitando abrir defeitos duplicados.

Os portões, testes e critérios de revisão do PRD técnico continuam aplicáveis ao módulo de viabilidade; o que foi retirado do escopo da V1 é **a homologação dos futuros motores de engenharia especializada**, não as verificações mínimas de segurança do estudo preliminar.

## 11. Roadmap para lançamento

| Portão | Entrega | Saída esperada | Autorização |
|---|---|---|---|
| V1-G0 | Congelar escopo e inventariar produto atual | Mapa de funcionalidades reais, lacunas, contratos e riscos | Documentação, sem produção |
| V1-G1 | Estabilizar motor e maquete volumétrica | CI no HEAD, regressões críticas resolvidas, relatório coerente e avisos corretos | Mudanças no motor exigem aprovação específica |
| V1-G2 | Conferir domínio inicial de estudos | Município/tipologias declarados, dados-piloto e normas conferidos em amostra apropriada | Revisão profissional quando necessária |
| V1-G3 | Auditar produção de maquete completa | Demonstração com arquivos reais e checklist de origem, visual, operação e desempenho | Sem reescrever padrões 3D |
| V1-G4 | Preparar catálogo e fluxo comercial | Pacotes, entregáveis, limitações, revisão e responsabilidades definidos | Aprovação de negócio |
| V1-G5 | Integrar em ambiente isolado | PR, CI, revisão, deploy isolado, smoke e rollback documentado | Autorização específica |
| V1-G6 | Piloto comercial controlado | Clientes-piloto, feedback, métricas e revisão de riscos | Publicação autorizada |
| V1-G7 | Lançamento ampliado | Resultados de pilotos e suporte operacional suficientes | Decisão explícita do responsável |

**Mapeamento para o PRD técnico:** o trabalho de viabilidade segue os portões 1A–1E; o novo roadmap V1 coordena **viabilidade + maquete completa + operação comercial**, sem substituir aqueles critérios.

Não iniciar motor de projeto executivo para cumprir qualquer gate acima.

## 12. Critérios de aceite do lançamento

A V1 só deve ser considerada pronta para piloto comercial quando:

1. O escopo e as limitações de cada produto estejam visíveis e compreensíveis.
2. O motor gere estudos reproduzíveis para casos declarados como suportados; falhas críticas conhecidas que invalidem conclusões sejam corrigidas ou bloqueiem o cenário afetado.
3. Os dados legais e territoriais usados em demonstrações externas sejam adequadamente conferidos, ou classificados sem ambiguidade como não verificados; uso técnico definitivo não seja alegado.
4. Números no relatório e na maquete volumétrica correspondam à mesma revisão do estudo.
5. Estudo preliminar e maquete completa sejam distinguíveis na experiência e nas propostas comerciais.
6. Haja fluxo demonstrado de maquete completa com material de origem, revisão e publicação controlada, respeitando LEVE/PREMIUM.
7. A integração não provoque regressão nos imóveis publicados; smoke e plano de reversão estejam documentados.
8. Materiais, imagens e modelos de terceiros possuam base de uso/autorizações verificadas.
9. Clientes-piloto possam receber entregáveis, entender o que foi e não foi validado e reportar problemas.
10. Um responsável autorize expressamente o lançamento conforme resultados e riscos remanescentes.

**Separação operacional:** é possível lançar a oferta de **maquetes completas** antes do módulo de viabilidade, se o fluxo existente atender aos requisitos próprios; e vice-versa. Não atrelar artificialmente os dois cronogramas.

## 13. Indicadores de sucesso

**Viabilidade:** tempo por estudo preliminar; proporção de entradas suficientes; casos fora de escopo detectados; consistência métrica; taxa de falhas e retrabalho; relatórios encaminhados a revisão; estudos efetivamente úteis para decisões comerciais.

**Maquete volumétrica:** carregamento/estabilidade por dispositivo; comparações realizadas; compreensão das ressalvas; diferenças entre estudo e visual detectadas em testes.

**Maquete completa:** tempo e custo por entrega; retrabalho por inconsistência de insumos; revisões até aceite; desempenho LEVE/PREMIUM; satisfação e uso comercial pelo cliente.

**Negócio:** solicitações qualificadas; taxa de conversão por produto; receita, margem e custo operacional; recorrência; número de clientes que contratam ambos os produtos.

Definir metas quantitativas após medir a linha de base. Não usar número de modelos 3D gerados como sinônimo de qualidade ou resultado econômico.

## 14. Fora do escopo V1 — visão futura preservada

Ficam **explicitamente fora da V1**, até existir verba, especialistas e nova autorização:

- Laboratório de Engenharia Comparativa e contratação sistemática de profissionais para ensinar e avaliar métodos.
- Motores automatizados de arquitetura executiva, estrutura/fundação, elétrica, hidráulica/hidrossanitária e outras disciplinas.
- Geração automática de memoriais de cálculo executivos, projetos complementares e documentação apta à obra.
- Compatibilização multidisciplinar automatizada em nível executivo.
- Assinatura técnica, responsabilidade profissional ou garantia de aprovação municipal pelo software.
- Gestão integral de execução, orçamento executivo, medições, as built e manutenção.
- Editor CAD/BIM nativo completo e migrações preventivas para suportá-lo.

Essas iniciativas continuam registradas no `PRD-PLATAFORMA-0.2.md` como **estratégia futura**, não como pré-requisitos do lançamento comercial.

## 15. Decisões arquiteturais de produto

- **V1-DA-01 — Três ofertas independentes e combináveis:** estudo, maquete volumétrica e maquete completa; o segundo pilar é naturalmente derivado do primeiro, mas a maquete completa pode operar sozinha.
- **V1-DA-02 — Estudo não é projeto executivo:** rótulos, permissões, comercialização e relatório não podem sugerir aprovação técnica ou legal.
- **V1-DA-03 — Visualização não certifica engenharia:** maquete detalhada é apresentação, não validação estrutural ou urbanística.
- **V1-DA-04 — Evolução não destrutiva:** reusar a plataforma e preservar LEVE/PREMIUM, publicações e caminhos existentes.
- **V1-DA-05 — Contratos e versões:** qualquer conexão estudo↔maquete é explícita, versionada e rastreável.
- **V1-DA-06 — Integração por portões:** PR → CI → revisão → merge → deploy isolado → smoke → autorização seguinte.
- **V1-DA-07 — Engenharia futura, não pré-requisito:** modelos de especialidades e contratação de especialistas serão planejados quando houver capacidade financeira e justificativa de negócio.

## 16. Questões comerciais a validar sem bloquear o documento

1. Quais planos comerciais serão oferecidos: estudo avulso, maquete volumétrica vinculada, maquete completa por empreendimento, pacote conjunto?
2. Quais materiais mínimos são exigidos para uma maquete completa? Que trabalho manual fica incluído no preço?
3. Quais municípios e tipologias a V1 de estudos efetivamente atenderá no lançamento?
4. Quem pode solicitar, revisar e publicar estudos e maquetes?
5. Qual será o procedimento para aceitar insumos incompletos e comunicar itens ilustrativos?
6. Qual é o esforço operacional real para construir/atualizar cada experiência LEVE/PREMIUM?
7. Qual escopo de revisão técnica profissional será aplicável antes de compartilhar um estudo com cliente externo?
8. Qual é o mínimo viável de atendimento, suporte, termos contratuais e controle de arquivos de clientes?

Essas decisões devem ser respondidas por pilotos e inventário do sistema, não por suposição.

## 17. Próxima ação recomendada e limites de autorização

**Próxima ação documental:** aprovar este PRD V1 como definição de escopo comercial, inventariar as capacidades reais de maquete completa existentes e mapear dependências do lançamento. Manter os PRDs 0.1 e 0.2 sem substituição silenciosa.

**Próxima ação técnica:** confirmar CI do HEAD, resolver as pendências relevantes do Portão 1B apenas após autorização específica e organizar conferência de dados e limites do estudo preliminar. Em paralelo, auditar o fluxo comercial já existente da maquete completa, **sem alterar produção**.

**Proibição explícita neste documento:** não iniciar motores de engenharia especializada; não migrar dados; não refatorar módulo publicado; não fazer merge/deploy por interpretação implícita do novo escopo.

---

**Fim do PRD — Imobiliária 3D V1 Comercial, versão 1.0 (proposta).**


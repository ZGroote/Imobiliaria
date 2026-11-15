# PRD de módulo — Viabilidade construtiva
## Imobiliária 3D | Escopo executável e homologação da Fase 1

**Versão:** 1.0 — Proposta para revisão  
**Data:** 14/11/2026  
**Status:** Especificação de trabalho, **não** declaração de homologação  
**Branch de referência:** `feat/viabilidade`  
**Documentos relacionados:** `viabilidade/PRD.md` (visão 0.1 histórica), `PRD-PLATAFORMA-0.2.md` (visão estratégica), `viabilidade/README.md`, `viabilidade/CENTRAL.md`, auditorias e relatórios da Fase 0.

> **Fronteira:** Este módulo realiza triagem urbanística e geométrica preliminar. Não produz plantas executivas, não dimensiona instalações ou estruturas e não declara viabilidade legal aprovada. O núcleo poderá futuramente entregar dados para métodos arquitetônicos e de engenharia, mas sem introduzi-los nesta fase.

---

## 1. Objetivo e decisão de produto

Permitir que um usuário selecione um lote com informações conhecidas, associe parâmetros urbanísticos rastreáveis e obtenha **cenários preliminares reproduzíveis** de potencial construtivo, com volumes 3D, indicadores e uma lista transparente de restrições, premissas e pontos pendentes de verificação.

O propósito comercial inicial é reduzir o esforço de triagem e comparação de terrenos; os resultados não substituem o arquiteto responsável, a conferência do zoneamento cadastral, a topografia de campo e as aprovações aplicáveis.

## 2. Estado de referência e limites conhecidos

A Fase 0 consta como encerrada documentalmente no commit `51a72280` (14/11/2026). Esse fechamento não comprova homologação do motor.

Capacidades já registradas na branch, sujeitas a reprodução de testes:

- Cinco lotes iniciais e evolução para **sete lotes-piloto**.
- Base normativa estruturada para zonas de São Carlos, com fontes, conflitos e pendências.
- Motor Python/Shapely que gera opções de implantação, volumes e métricas.
- Visualizador Three.js com comparação e acesso a relatórios HTML.
- Relevo Copernicus GLO-30 nominal ~30 m como base de triagem, **não** topografia executiva nem MDT medido.
- Auditorias com **42 casos adversários** documentados, além de testes próprios do motor.
- Script central `viabilidade/conferir.py` para executar verificações sem gastar chamadas de IA.

**Pendências que não podem desaparecer do planejamento:**

1. Monotonicidade não garantida com recuos assimétricos e permeabilidade restritiva.
2. Monotonicidade problemática em cenários com garagem computável.
3. Confirmação humana da zona de lotes limítrofes e de restrições especiais.
4. Interpretações conflitantes ou incompletas em determinadas zonas, conforme `conferencia/CONFERENCIA.md`.
5. Relevo aproximado e não utilizado como validação de implantação executiva.
6. Reproduzir no commit efetivo os testes declarados nos relatórios; a evidência histórica não substitui o CI atual.

## 3. Usuários e resultados permitidos

| Usuário | Uso permitido |
|---|---|
| Corretor / proprietário | Comparação preliminar explicitamente rotulada |
| Construtora / incorporadora | Triagem, sensibilidade de cenários e estudo a encaminhar ao especialista |
| Arquiteto / engenheiro | Revisão de premissas, geometria e condicionantes |
| Administrador | Gerenciar escopos, versões, dados e acesso |

O sistema distinguirá: **dados verificados**, **dados informados pelo usuário**, **premissas padrão**, **inferências não confirmadas** e **informações ausentes**.

## 4. Escopo funcional

### 4.1 Entradas

- Identificador e polígono do lote; sistema de referência declarado.
- Frente/testada com critérios explícitos de qualidade.
- Zona urbanística e **origem da associação zona↔lote**, distinta da validade dos números da zona.
- Restrições especiais incidentes e fontes, quando conhecidas.
- Informações de relevo com resolução, fonte, precisão e ressalvas.
- Programa desejado, tipologia, unidades de referência, vagas, área privativa, eficiência e demais premissas.

**Regra de coordenadas:** o módulo utiliza SIRGAS 2000 / UTM 23S (EPSG:31983). Não usar diretamente `fx/fy` históricos em SAD69 / UTM 23S (EPSG:29193); qualquer transformação deve ser declarada e testada.

### 4.2 Processamento

- Normalizar e validar geometria de entrada, rejeitando ambiguidades irrecuperáveis.
- Determinar envelope com recuos e restrições conhecidos.
- Gerar alternativas geométricas e documentar sua heurística de seleção.
- Calcular métricas com a **mesma geometria exportada**, evitando divergência por arredondamento.
- Validar limites de CA, taxa de ocupação, alturas, recuos e permeabilidade implementados.
- Aplicar condicionantes com fonte; quando uma condicionante crítica for desconhecida, limitar explicitamente a conclusão.
- Registrar versão do motor, regras, entradas, premissas, incertezas, avisos e validações.

### 4.3 Saídas

- JSON de estudo versionado como contrato entre motor, visual e relatório.
- Opções volumétricas com geometria, unidades estimadas, área privativa e computável, vagas e alertas.
- Visualização 3D simplificada, com comparação de opções e indicação de limites.
- Relatório HTML/preliminar com fontes, status de conferência, hipóteses e ressalvas.
- Resultado de verificações e evidências associadas à revisão.

## 5. Requisitos funcionais e critérios de aceite

| ID | Requisito | Critério verificável |
|---|---|---|
| VF-001 | Geometria confiável | Polígono exportado é válido e respeita limites do lote e afastamentos aplicados nos casos homologados |
| VF-002 | Consistência geométrica-numérica | Métricas e unidades derivam da geometria efetivamente exportada; sem divergência por arredondamento |
| VF-003 | Regras rastreáveis | CA, TO, recuos, alturas e permissões usadas identificam fonte, versão ou premissa |
| VF-004 | Incerteza explícita | Dados de zona, lote ou restrições não verificados aparecem como pendentes e impedem conclusões indevidas |
| VF-005 | Cenários reproduzíveis | Mesmas entradas e versões produzem resultados iguais dentro de tolerância documentada |
| VF-006 | Testes adversários | Casos-limite (polígonos, nulidades, altura, permeabilidade, garagem) passam ou retornam falha classificada |
| VF-007 | Monotonicidade condicionada | Relaxamentos de restrição não reduzem o ótimo encontrado no domínio homologado; se heurística não garantir, declarar limitação e bloquear alegação de ótimo |
| VF-008 | Relatório consistente | Visual e relatório exibem métricas sem recalcular silenciosamente valores divergentes |
| VF-009 | Relevo com proveniência | Resolução, fonte e limite de precisão identificados; não usar MDS ~30 m como prova de cota de projeto |
| VF-010 | Controle de integração | Nenhum fluxo do sistema produtivo é alterado sem PR, CI, revisão, deploy isolado e smoke |
| VF-011 | Falhas explícitas de CI | Teste obrigatório ausente ou não executado causa falha, nunca sucesso silencioso |
| VF-012 | Revisão humana | Amostra de estudos é revisada por profissional habilitado e as divergências ficam registradas |

### 5.1 Quando uma alternativa não é encontrada

Distinguir: **geometricamente impossível sob hipóteses**, **heurística não encontrou**, **dados insuficientes** e **erro de execução**. Não apresentar `0` como se fosse a conclusão definitiva quando apenas faltou informação ou a busca foi insuficiente.

### 5.2 Otimização

As opções A–D são heurísticas de concepção, não prova de otimização global. A expressão “melhor aproveitamento” só pode ser usada com definição objetiva e método capaz de sustentá-la. Comparações devem preservar as soluções anteriormente viáveis quando uma restrição é afrouxada, ou registrar explicitamente a limitação.

## 6. Domínio de validade da Fase 1

O domínio será definido por conjunto concreto de:

- Município e vigência da legislação conferida;
- Tipologias suportadas, uso e métricas estimadas;
- Geometrias e orientações de lote aceitas;
- Faixas de área, declividade e outras condições geométricas testadas;
- Condições de garagem, ocupação e recuos;
- Disponibilidade das restrições cadastrais/ambientais relevantes;
- Precisão e origem dos dados territoriais.

Não inferir que suportar um lote triangular em teste implica suportar qualquer lote irregular. Casos fora do domínio devem retornar **não validado/encaminhar ao profissional**.

## 7. Modelo e contratos

Preservar os contratos existentes de `lote`, `zona`, `premissas`, `caixa_maxima`, `opcoes` e `incertezas`, implementados no README e no código. Evoluções precisam de versão explícita e compatibilidade verificada.

Preparar, **apenas como extensão futura de contrato**, referências opcionais a:

- `EngineeringMethod`: versão e método empregado;
- `ApplicabilityDomain`: pré-condições avaliadas;
- `CalculationRecord`: entradas e cálculos relevantes;
- `DesignDecision`: heurística e motivos de escolha;
- `ValidationResult`: verificações e status.

**Não migrar a base produtiva agora** e não exigir objetos completos de engenharia nesta fase. Conservar separados parâmetros canônicos e artefatos renderizados.

## 8. Fontes, legislação e topografia

A parte normativa deve registrar fonte oficial, artigo/anexo, data de vigência, atualizações e status de conferência. Normas conflitantes não devem ser resolvidas pelo modelo de linguagem sem confirmação apropriada.

A associação da zona ao lote possui status próprio e não deve ser tratada como confirmada só porque os números da zona foram conferidos. Casos de fronteira de zona, áreas especiais, restrições de loteamento e decretos inacessíveis continuam sujeitos a conferência.

Copernicus GLO-30 é adequado como referência regional e triagem, mas não substitui levantamento planialtimétrico necessário à elaboração do projeto. O relatório deve explicitar quando o relevo foi ignorado no volume e quando foi apenas apresentado visualmente.

## 9. Testes, auditoria e evidência

### 9.1 Testes mínimos

- Casos geométricos sintéticos: retângulo, triângulos, trapézio, lote em L, frente repetida, invalidade de polígono e condições degeneradas.
- Consistência geométrica: coordenadas, CRS, arredondamento, área, recuos, alturas e pavimentos.
- Propriedades: determinismo, invariantes legais, limites, monotonicidade onde exigida.
- Contas: CA, TO, área privativa, número de unidades por pavimento, vagas e garagens.
- Contratos: JSON legível por visual e relatório, sem campos obrigatórios faltantes.
- UI: leitura em desktop/mobile, campos `null` e dados inválidos, sem afetar estudo anterior.
- Casos reais: amostra de lotes com dados e restrições conferidos por profissional.

### 9.2 Gate de CI

O script `viabilidade/conferir.py` deve retornar falha se qualquer teste definido como obrigatório estiver ausente. Logs completos ficam em artefatos; a coordenação recebe resumo curto para economizar tokens. Conferir também status do Git e mudanças fora do módulo.

### 9.3 Auditoria independente

O auditor recebe contratos e casos de teste sem depender da explicação do autor do motor. Toda falha reproduzível gera caso de regressão. Relatórios antigos nunca prevalecem sobre a execução do HEAD atual.

## 10. Roadmap curto

**Gate 1A — Reconstruir a prova atual:** fixar commit, executar CI em ambiente reproduzível, verificar integridade dos artefatos e atualizar matriz de defeitos resolvidos/pendentes.

**Gate 1B — Fechar defeitos de correção relevantes:** monotonicidade de recuo assimétrico/permeabilidade; garagem computável; demais casos que possam afetar resultados ou rótulos incorretos. Correções pequenas, testes por defeito, sem refatoração geral injustificada.

**Gate 1C — Conferir dados-piloto:** validar zoneamento do lote, limitações topográficas e normas aplicáveis com profissional local; distinguir zona plausível de zona comprovada.

**Gate 1D — Homologação piloto:** executar estudos em casos representativos com revisão técnica independente, registrar divergências e aprovar um **domínio de uso limitado**, não um certificado universal de viabilidade.

**Gate 1E — Integração controlada (se autorizada):** PR → CI → revisão → merge → deploy isolado → smoke → decisão de publicação. Nada de Firebase, painel ou produção antes disso.

## 11. Indicadores

- Falhas críticas abertas por versão e por tipologia.
- Percentual de invariantes/testes reproduzidos no HEAD.
- Divergências entre cálculos e geometria exportada.
- Número de estudos revisados por profissional e taxa de correções.
- Proporção de casos classificadas corretamente como não verificáveis/fora do escopo.
- Tempo e custo por estudo concluído e revisado.
- Casos de regressão recorrente e cobertura dos domínios homologados.

Metas numéricas só serão aprovadas após medir o baseline real.

## 12. Riscos e dependências

| Risco | Tratamento |
|---|---|
| Geometria plausível com cálculos incorretos | Invariantes e reconciliação com geometria exportada |
| Fonte legal conflitante/desatualizada | Origem e revisão humana, bloqueio de conclusão |
| Topografia inadequada | Marcação de precisão, solicitação de levantamento |
| Hipóteses de garagem e unidade equivocadas | Premissas explícitas, limites e testes por pavimento |
| Heurística perder opção viável | Testes de monotonicidade e distinção entre busca e ótimo |
| Diferença entre zonas do mapa e do lote | Status de atribuição de zona separado dos parâmetros |
| Regressão do produto existente | Escopo isolado e gates conservadores |
| Gastos excessivos com agentes | CI determinístico, tarefas por frente e relatórios curtos |

## 13. Definição de pronto

Um estudo é **apto a revisão preliminar** quando entradas obrigatórias estão disponíveis, a execução reproduz, os invariantes do domínio suportado passam e todas as incertezas e ressalvas são apresentadas. Isso **não** equivale a projeto técnico pronto, licença ou aprovação legal.

A Fase 1 está **homologada para um domínio delimitado** somente depois de evidência reexecutável, revisão de profissional competente e decisão formal documentada. A Fase 0 “fechada” não implica atendimento automático desse gate.

## 14. Diretrizes de integração com o futuro núcleo de engenharia

- O motor de viabilidade é o **primeiro candidato a motor especializado**, mas não deve herdar prematuramente requisitos de projeto executivo.
- Expor contratos versionados de cenário, geometria e premissas antes de qualquer conversão em layout arquitetônico.
- Preservar múltiplas alternativas e suas decisões, não apenas o cenário selecionado.
- Registrar origem e limites dos cálculos para futuras comparações entre especialistas.
- Quando houver modelo compartilhado de projeto, usar importação explícita; não reescrever silenciosamente dados da Fase 0.
- A experiência 3D atual permanece separada da maturidade técnica do projeto; manter LEVE/PREMIUM.

## 15. Próxima ação autorizável

Somente planejamento/documentação e revisão de testes. Recomendar PR documental específico com este PRD e a visão estratégica; **sem alterações em motor, bancos de dados, publicação ou deploy**. A implementação da Fase 1 exige aprovação separada após revisão dos gates.

---

**Fim do PRD de Viabilidade 1.0 — proposta para revisão.**


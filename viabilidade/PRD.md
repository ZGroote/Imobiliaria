# PRD — Imobiliária 3D
## Plataforma de Inteligência Territorial, Viabilidade Construtiva e Concepção Paramétrica

**Versão:** 0.1 — Documento de visão e requisitos iniciais  
**Data:** 14/11/2026  
**Status:** Proposta para discussão e validação  
**Produto:** Imobiliária 3D  
**Natureza:** Expansão modular da plataforma existente

---

# 1. Resumo executivo

A proposta consiste em evoluir a Imobiliária 3D para uma plataforma capaz de analisar terrenos, estimar seu potencial construtivo, gerar empreendimentos conceituais em 3D e, futuramente, permitir a personalização de edificações e ambientes por profissionais e compradores.

A solução deverá integrar dados geográficos, topográficos, cadastrais e urbanísticos a um motor paramétrico de geração de edificações.

Inicialmente, o sistema produzirá estudos de viabilidade urbanística e volumetria externa simplificada, permitindo que construtoras e incorporadoras visualizem cenários de aproveitamento de terrenos antes de desenvolver projetos arquitetônicos completos.

A arquitetura deverá, entretanto, estar preparada para evoluir até a criação de plantas conceituais, unidades habitacionais, ambientes internos, áreas comunitárias e visitas virtuais.

Uma segunda aplicação estratégica será a personalização de residências em loteamentos, permitindo que compradores configurem propostas de casas de acordo com suas necessidades e as limitações do lote.

**Princípio central:** planejar a plataforma completa, implementar incrementalmente e validar cada etapa antes da expansão.

# 2. Problema e oportunidade

## 2.1 Problemas identificados

- A avaliação inicial de um terreno frequentemente depende de análises fragmentadas entre diferentes profissionais e ferramentas.
- É difícil comunicar visualmente o potencial construtivo de um terreno durante negociações.
- Estudos preliminares podem exigir trabalho manual significativo antes mesmo de haver interesse comercial confirmado.
- Compradores de terrenos têm dificuldade em visualizar as possibilidades de construção.
- Construtoras e loteadoras não dispõem necessariamente de um processo integrado que conecte estudo territorial, concepção de edificação, visualização 3D e atendimento comercial.

## 2.2 Oportunidade

Criar uma experiência integrada que conecte:

**Terreno → Viabilidade → Cenários de implantação → Concepção 3D → Personalização → Validação profissional → Experiência comercial.**

A plataforma não substituirá profissionais habilitados, levantamentos técnicos ou procedimentos municipais de aprovação.

Seu objetivo será acelerar estudos preliminares, facilitar negociações, ampliar a visualização de possibilidades e organizar propostas para posterior desenvolvimento técnico.

# 3. Objetivos do produto

## 3.1 Objetivos principais

1. Permitir a análise preliminar de aproveitamento construtivo de terrenos.
2. Gerar automaticamente cenários volumétricos em 3D.
3. Apoiar negociações imobiliárias por meio de estudos visualmente compreensíveis.
4. Criar uma arquitetura paramétrica extensível a diferentes tipologias construtivas.
5. Permitir a evolução dos volumes externos para ambientes internos e unidades habitacionais.
6. Oferecer, futuramente, um configurador residencial para compradores de terrenos.
7. Integrar a concepção de edificações à experiência de visita virtual existente na plataforma.

## 3.2 Objetivos de negócio

- Diferenciar terrenos anunciados na Imobiliária 3D.
- Atrair construtoras, incorporadoras e loteadoras.
- Criar oportunidades de comercialização de estudos de viabilidade e visualização.
- Aumentar o envolvimento de compradores com os imóveis e loteamentos apresentados.
- Construir uma base tecnológica reutilizável para novos produtos comerciais.

## 3.3 Não objetivos iniciais

O MVP não deverá:

- Produzir projetos executivos.
- Garantir aprovação legal ou municipal.
- Gerar plantas arquitetônicas completas.
- Dimensionar estruturas e fundações.
- Realizar projetos elétricos, hidráulicos ou complementares.
- Produzir quantitativos executivos ou orçamentos de obra garantidos.
- Substituir arquiteto, engenheiro, topógrafo ou outros profissionais responsáveis.
- Gerar automaticamente visitas internas mobiliadas.

# 4. Perfis de usuários

| Perfil | Necessidade principal |
|---|---|
| Administrador da plataforma | Gerenciar projetos, acessos, normas e publicações |
| Corretor imobiliário | Demonstrar potencial de terrenos em negociação |
| Proprietário de terreno | Compreender possibilidades preliminares de utilização |
| Construtora | Comparar cenários construtivos |
| Incorporadora | Estudar o aproveitamento de terrenos |
| Loteadora | Oferecer modelos de casas associados aos lotes |
| Arquiteto | Revisar, ajustar e desenvolver propostas conceituais |
| Engenheiro | Verificar condicionantes técnicas dentro de sua atribuição |
| Comprador | Visualizar e personalizar sua futura residência |

Os perfis deverão possuir permissões diferentes. Uma proposta gerada por um comprador não poderá ser automaticamente convertida em projeto aprovado.

# 5. Visão funcional da plataforma

A arquitetura deverá contemplar sete módulos principais.

## Módulo A — Inteligência territorial

Responsável por representar o terreno e suas características.

**Funcionalidades previstas:**

- Seleção de terreno no mapa.
- Importação de perímetro georreferenciado.
- Consulta ou inclusão de área e dimensões.
- Carregamento de imagens de satélite.
- Carregamento de modelos digitais de terreno.
- Cálculo de declividade e desníveis aproximados.
- Identificação de condições territoriais relevantes.
- Visualização 3D do relevo.
- Associação de documentos técnicos ao terreno.

**Regra importante:** imagens de satélite não deverão ser tratadas como fonte suficiente para determinar limites legais do imóvel. Os limites cadastrais e a precisão topográfica precisarão ser explicitamente identificados e validados.

## Módulo B — Inteligência urbanística e normativa

Responsável por transformar regras aplicáveis em parâmetros verificáveis.

**Funcionalidades previstas:**

- Identificação de município e zona urbanística.
- Cadastro de planos diretores, leis de zoneamento e códigos de obras.
- Registro de coeficientes de aproveitamento.
- Registro de taxas de ocupação e permeabilidade.
- Registro de recuos e afastamentos.
- Registro de limites de altura e pavimentos, quando aplicáveis.
- Registro de usos permitidos e condicionados.
- Registro de restrições ambientais, servidões e outras condicionantes.
- Identificação de regras conflitantes, ausentes ou não verificadas.
- Associação de fontes oficiais, artigos, datas e versões.

**Requisito crítico:** a IA poderá auxiliar na extração e interpretação de documentos normativos, mas parâmetros utilizados em conclusões de viabilidade deverão passar por validação apropriada.

Cada regra deverá possuir identificação da fonte e rastreabilidade.

## Módulo C — Motor de viabilidade construtiva

Responsável por avaliar possibilidades de aproveitamento físico e urbanístico.

**Funcionalidades previstas:**

- Cálculo de área potencialmente ocupável.
- Cálculo de envelopes construtivos.
- Estimativa de área computável e não computável.
- Testes de cenários de implantação.
- Simulação de diferentes números de edificações.
- Estimativa de pavimentos.
- Comparação de ocupação e aproveitamento.
- Verificação geométrica de afastamentos.
- Identificação de conflitos e restrições.
- Geração de resultados acompanhados de premissas.

O motor deverá distinguir os limites legais, as hipóteses de projeto e as estimativas comerciais.

Uma solução geometricamente viável não será automaticamente considerada legalmente aprovada.

## Módulo D — Gerador paramétrico de edificações

Responsável pela geração da geometria arquitetônica conceitual.

**Tipologias planejadas:**

- Torres residenciais.
- Edifícios comerciais e mistos.
- Prédios de apartamentos compactos.
- Conjuntos de kitnets.
- Casas isoladas.
- Casas geminadas.
- Sobrados.
- Condomínios horizontais.
- Empreendimentos com múltiplas edificações.

**Capacidades previstas:**

- Geração de volumes externos.
- Definição de altura e número de pavimentos.
- Configuração de implantação e orientação.
- Representação de coberturas.
- Definição preliminar de unidades.
- Composição modular de pavimentos.
- Geração futura de ambientes internos.
- Regeneração geométrica após mudanças de parâmetros.

O motor não deverá possuir dependência estrutural exclusiva de uma tipologia, como torres residenciais.

Cada tipologia deverá funcionar como especialização de uma estrutura comum de projeto, com regras próprias.

## Módulo E — Organização arquitetônica interna

Módulo planejado para uma fase posterior.

**Funcionalidades previstas:**

- Organização conceitual de pavimentos.
- Distribuição preliminar de unidades habitacionais.
- Definição de corredores e circulação.
- Posicionamento preliminar de escadas e elevadores.
- Separação de áreas comuns e privativas.
- Distribuição de cômodos.
- Representação de portas, janelas e paredes.
- Configuração de ambientes comunitários.
- Geração de modelos internos visitáveis.

A distribuição interna deverá ser validável, editável e compatível com parâmetros geométricos, requisitos de acessibilidade e demais exigências aplicáveis.

## Módulo F — Configurador residencial para loteamentos

Responsável pela personalização de propostas de casas.

**Funcionalidades planejadas:**

- Associação de lotes a empreendimentos de loteamento.
- Seleção de um lote disponível.
- Escolha de modelos residenciais.
- Definição de quantidade de quartos e suítes.
- Seleção de quantidade de pavimentos.
- Definição de área construída desejada.
- Seleção de garagem, varanda, área gourmet e outros ambientes.
- Personalização de layouts em níveis permitidos.
- Visualização do modelo em 3D.
- Comparação entre alternativas.
- Salvamento de propostas.
- Solicitação de avaliação profissional.
- Encaminhamento da proposta para a construtora ou loteadora.

**Dois modos de operação deverão ser previstos:**

**Modo catálogo controlado:** o comprador configura modelos e opções disponibilizados pela empresa.

**Modo concepção livre assistida:** o comprador define requisitos mais amplos e o sistema apresenta propostas conceituais sujeitas a validação.

A disponibilidade do segundo modo dependerá da maturidade do motor de geração e das verificações técnicas.

## Módulo G — Experiência 3D, apresentação e comercialização

Responsável por transformar projetos em apresentações compreensíveis.

**Funcionalidades previstas:**

- Visualização externa dos volumes.
- Navegação orbital e exploração do terreno.
- Comparação visual entre cenários.
- Exibição de métricas do empreendimento.
- Geração de maquetes conceituais.
- Visualização futura de áreas internas.
- Visitas virtuais a unidades.
- Visitas virtuais a ambientes comunitários.
- Publicação controlada de versões.
- Compartilhamento de propostas com interessados.
- Integração com fluxos comerciais da Imobiliária 3D.

A experiência deverá evoluir conforme o nível de detalhamento disponível, sem exigir que todo estudo seja convertido em uma maquete completa.

# 6. Modelo conceitual de dados

O modelo central deverá representar pelo menos as seguintes entidades:

| Entidade | Responsabilidade |
|---|---|
| Terrain | Dados físicos e geográficos do terreno |
| Parcel | Lote ou parcela cadastral |
| RegulationSet | Conjunto versionado de parâmetros normativos |
| Project | Projeto conceitual e seus responsáveis |
| ProjectRevision | Versão imutável de uma proposta |
| FeasibilityStudy | Estudo e premissas de viabilidade |
| Scenario | Alternativa de aproveitamento |
| SiteLayout | Implantação das edificações no terreno |
| Building | Edificação individual |
| Floor | Pavimento |
| Unit | Unidade habitacional ou comercial |
| Space | Ambiente interno ou comum |
| Component | Elemento arquitetônico parametrizado |
| GeometryArtifact | Modelo geométrico gerado |
| ValidationResult | Resultado das verificações |
| Review | Revisão por profissional habilitado |
| Publication | Versão disponibilizada comercialmente |

Essas entidades são uma proposta lógica inicial, não uma determinação antecipada de tabelas ou coleções de banco de dados.

Um projeto deverá permitir múltiplos cenários, cada cenário poderá possuir múltiplas edificações, e cada edificação poderá evoluir de um volume simplificado para uma composição interna mais detalhada.

Os dados paramétricos e suas versões serão a referência principal; os arquivos 3D serão artefatos derivados.

# 7. Níveis de detalhamento

A plataforma deverá admitir diferentes níveis de maturidade geométrica.

| Nível | Conteúdo | Aplicação |
|---|---|---|
| L0 | Terreno e restrições | Análise territorial |
| L1 | Envelopes e volumes externos | Viabilidade preliminar |
| L2 | Pavimentos e unidades simplificadas | Concepção arquitetônica |
| L3 | Ambientes e elementos internos | Estudo detalhado |
| L4 | Materiais, mobiliário e navegação | Experiência virtual |

O nível de detalhamento não deverá ser confundido com o perfil de desempenho.

Os padrões LEVE e PREMIUM já existentes na Imobiliária 3D deverão permanecer suportados, com avaliação posterior de como representar cada nível de detalhamento em diferentes dispositivos.

# 8. Fluxos principais

## Fluxo 1 — Estudo de viabilidade de terreno

1. Usuário seleciona ou cadastra um terreno.
2. Sistema carrega dados territoriais disponíveis.
3. Sistema identifica a legislação potencialmente aplicável.
4. Parâmetros normativos são conferidos.
5. Usuário seleciona a tipologia e as premissas desejadas.
6. Motor de viabilidade calcula restrições e envelopes.
7. Gerador paramétrico cria cenários.
8. Sistema apresenta volumes externos e métricas.
9. Usuário compara alternativas.
10. Estudo pode ser salvo e encaminhado para revisão ou negociação.

## Fluxo 2 — Evolução de empreendimento

1. Usuário seleciona cenário de massa.
2. Define pavimentos e hipóteses de unidades.
3. Sistema gera organização arquitetônica conceitual.
4. Profissional revisa a solução.
5. Sistema gera modelos de unidades e áreas comuns.
6. Projeto aprovado para apresentação é convertido em experiência virtual.
7. Versão comercial é publicada por fluxo controlado.

## Fluxo 3 — Personalização de casa

1. Comprador seleciona lote.
2. Sistema apresenta restrições conhecidas.
3. Comprador escolhe modelo ou inicia configuração.
4. Define ambientes e requisitos.
5. Motor gera ou adapta a proposta.
6. Sistema verifica incompatibilidades detectáveis.
7. Comprador visualiza e ajusta o resultado.
8. Proposta é salva.
9. Construtora e profissional habilitado recebem a solicitação.
10. A proposta segue para revisão e eventual desenvolvimento técnico.

# 9. Requisitos funcionais do MVP

O primeiro MVP será restrito a estudos volumétricos externos.

| ID | Requisito | Prioridade |
|---|---|---|
| RF-001 | Importar perímetro de terreno | P0 |
| RF-002 | Carregar e representar relevo disponível | P0 |
| RF-003 | Cadastrar parâmetros urbanísticos validados | P0 |
| RF-004 | Calcular envelope construtivo preliminar | P0 |
| RF-005 | Gerar volume externo paramétrico | P0 |
| RF-006 | Testar cenários com múltiplos volumes | P0 |
| RF-007 | Apresentar métricas e restrições | P0 |
| RF-008 | Salvar cenário e premissas | P0 |
| RF-009 | Registrar fontes normativas e versões | P0 |
| RF-010 | Identificar dados ausentes e incertezas | P0 |
| RF-011 | Gerar resumo de estudo compartilhável | P1 |
| RF-012 | Comparar cenários lado a lado | P1 |
| RF-013 | Exportar relatório preliminar | P1 |
| RF-014 | Associar estudo a imóvel da plataforma | P1 |

P0 representa requisito essencial para o primeiro MVP. P1 representa prioridade complementar, não necessariamente obrigatória para o primeiro teste técnico.

# 10. Requisitos não funcionais

## 10.1 Confiabilidade

- Cálculos fundamentais deverão ser determinísticos.
- Todas as premissas utilizadas deverão ser rastreáveis.
- Resultados deverão diferenciar dados confirmados e estimativas.
- Estudos deverão preservar as versões das regras utilizadas.

## 10.2 Segurança e permissões

- Controle de acesso por organização, usuário e projeto.
- Isolamento de projetos entre clientes.
- Registro de modificações e aprovações.
- Publicação somente por usuários autorizados.
- Proteção contra acesso indevido a propostas privadas.

## 10.3 Desempenho

- Processos geométricos pesados não deverão bloquear a interface.
- O sistema deverá permitir geração assíncrona de artefatos, com consulta de status.
- Modelos deverão utilizar níveis de detalhe adequados à plataforma de visualização.
- Metas quantitativas de tempo e capacidade serão estabelecidas após medições da prova de conceito.

## 10.4 Extensibilidade

- Inclusão de novas tipologias sem reescrever o modelo central.
- Separação entre lógica normativa, geometria e visualização.
- Contratos estáveis e versionados entre módulos.
- Possibilidade futura de integração com ferramentas CAD/BIM.
- Capacidade de regenerar modelos a partir de parâmetros persistidos.

## 10.5 Auditabilidade

Cada estudo deverá manter:

- Identificação do terreno.
- Fonte e precisão dos dados geográficos.
- Parâmetros urbanísticos utilizados.
- Fonte e versão das normas.
- Hipóteses adotadas.
- Versão do motor de cálculo.
- Resultados de validação.
- Histórico de revisões.

# 11. Arquitetura técnica proposta

A solução deverá evoluir por módulos especializados:

**Camada de dados territoriais:** ingestão, normalização e armazenamento de informações geográficas e cadastrais.

**Camada normativa:** gestão de documentos, regras estruturadas, versões e validações.

**Camada de cálculo:** avaliações geométricas, envelopes e cenários de viabilidade.

**Camada de geração paramétrica:** produção de edificações e componentes a partir de parâmetros.

**Camada de IA:** assistência na interpretação, coleta de requisitos, explicação e exploração de alternativas.

**Camada de visualização:** produção e disponibilização de artefatos para experiências 3D.

**Camada de governança:** permissões, revisão, histórico e publicação.

A IA não deverá decidir sozinha que uma proposta atende integralmente à legislação ou aos requisitos técnicos.

A escolha das tecnologias, formatos de geometria e serviços deverá ocorrer após análise da infraestrutura já existente, priorizando compatibilidade e baixo risco de integração.

# 12. Integração com a Imobiliária 3D existente

A implantação deverá respeitar o comportamento comprovado dos fluxos já publicados.

Diretrizes:

1. O novo módulo deverá iniciar isolado dos fluxos produtivos de imóveis.
2. O sistema de publicação existente não deverá ser substituído prematuramente.
3. Os padrões LEVE e PREMIUM deverão continuar suportados.
4. Mudanças estruturais deverão possuir provas de compatibilidade.
5. Cada etapa relevante deverá passar por PR, CI, revisão e validação.
6. A implantação inicial deverá ocorrer em ambiente controlado.
7. Integrações com anúncios reais serão liberadas somente após testes.
8. Deverá haver plano de reversão para mudanças que afetem produção.

A visão de longo prazo não constitui autorização para refatorações imediatas no sistema existente.

# 13. Roadmap

## Fase 0 — Pesquisa e arquitetura

**Objetivo:** validar a base técnica e os dados disponíveis.

Entregáveis:

- Inventário das capacidades atuais.
- Avaliação da precisão dos dados de relevo.
- Definição do modelo conceitual de projeto.
- Escolha de município e terrenos-piloto.
- Levantamento das regras aplicáveis.
- Identificação de riscos técnicos e jurídicos.
- Especificação dos contratos entre módulos.

**Critério de saída:** dados e premissas suficientes para gerar uma primeira implantação volumétrica verificável.

## Fase 1 — MVP de viabilidade externa

**Objetivo:** demonstrar o potencial construtivo de um terreno.

Entregáveis:

- Integração dos dados do terreno.
- Regras urbanísticas estruturadas.
- Envelope construtivo.
- Gerador de volumes.
- Cenários de uma ou mais edificações.
- Métricas comparativas.
- Visualização 3D.
- Persistência versionada dos estudos.

**Critério de saída:** geração reproduzível de estudos preliminares, revisados em conjunto com profissional habilitado, para casos de teste selecionados.

## Fase 2 — Novas tipologias

**Objetivo:** ampliar o motor paramétrico.

Entregáveis:

- Casas isoladas.
- Casas geminadas.
- Sobrados.
- Kitnets.
- Condomínios horizontais.
- Bibliotecas de regras por tipologia.

**Critério de saída:** demonstração de reutilização efetiva do núcleo geométrico sem duplicação excessiva de lógica.

## Fase 3 — Unidades e ambientes

**Objetivo:** introduzir organização arquitetônica interna.

Entregáveis:

- Pavimentos.
- Unidades habitacionais.
- Circulação simplificada.
- Ambientes internos.
- Áreas comunitárias.
- Revisão e ajustes de profissionais.

**Critério de saída:** geração de configurações internamente coerentes para tipologias-piloto e capacidade de revisão humana.

## Fase 4 — Configurador de loteamentos

**Objetivo:** permitir personalização residencial por compradores.

Entregáveis:

- Cadastro de loteamentos.
- Associação de lotes e modelos de casas.
- Configurador de requisitos.
- Regras de personalização.
- Geração de propostas.
- Encaminhamento para revisão técnica e comercial.

**Critério de saída:** compradores conseguirem gerar propostas rastreáveis, sem alterações não autorizadas nos modelos-base da empresa.

## Fase 5 — Experiências internas e visitas 3D

**Objetivo:** transformar propostas conceituais em experiências visitáveis.

Entregáveis:

- Modelos internos navegáveis.
- Ambientes comunitários.
- Materiais e acabamentos.
- Mobiliário opcional.
- Configurações de apresentação.
- Integração com publicação comercial.

**Critério de saída:** geração e publicação controladas de experiências 3D, com níveis de desempenho adequados.

## Fase 6 — Inteligência econômica e integrações avançadas

**Objetivo:** adicionar suporte a decisões de investimento e desenvolvimento técnico.

Possibilidades:

- Custos paramétricos preliminares.
- Comparação econômica de cenários.
- Estimativa de área vendável.
- Indicadores de incorporação.
- Integrações CAD/BIM.
- Exportação estruturada para profissionais.
- Assistentes de IA especializados.

# 14. Métricas de sucesso

As metas numéricas deverão ser definidas após a linha de base dos primeiros pilotos.

**Métricas técnicas:**

- Percentual de estudos reproduzíveis.
- Taxa de regras corretamente aplicadas nos casos de teste.
- Quantidade de ajustes necessários após revisão profissional.
- Tempo de geração de cenário.
- Frequência de erros geométricos.
- Desempenho de visualização por dispositivo.

**Métricas de produto:**

- Estudos concluídos.
- Cenários comparados por usuário.
- Taxa de utilização dos estudos em negociações.
- Propostas salvas e compartilhadas.
- Retorno de usuários profissionais.

**Métricas futuras:**

- Personalizações residenciais realizadas.
- Propostas encaminhadas para revisão.
- Conversão de proposta em atendimento comercial.
- Conversão de atendimento em contratação ou compra, quando mensurável.

# 15. Riscos e medidas de mitigação

| Risco | Mitigação |
|---|---|
| Dados topográficos insuficientes | Indicar precisão e exigir levantamento apropriado quando necessário |
| Legislação incompleta ou desatualizada | Fontes, versionamento e revisão |
| Cenários visualmente plausíveis, mas inviáveis | Motor de validação e identificação explícita de premissas |
| Interpretação incorreta da IA | Verificação determinística e humana |
| Complexidade excessiva do gerador | Desenvolvimento incremental por tipologia |
| Desempenho inadequado | Artefatos derivados e perfis de visualização |
| Uso comercial indevido dos resultados | Avisos, permissões e revisão antes da publicação |
| Impacto na plataforma existente | Isolamento, testes e implantação controlada |
| Custos operacionais elevados | Medição por projeto e limites de processamento |

# 16. Critérios de aceitação do primeiro MVP

O MVP poderá ser considerado pronto para uma validação piloto quando:

1. Um terreno com geometria conhecida puder ser carregado corretamente.
2. O relevo puder ser representado com indicação de origem e precisão.
3. Um conjunto de normas verificadas puder ser associado ao terreno.
4. O sistema conseguir calcular um envelope coerente com os parâmetros implementados.
5. O sistema conseguir gerar e visualizar ao menos três cenários volumétricos distintos quando geometricamente possíveis.
6. Configurações que violem restrições implementadas forem sinalizadas ou rejeitadas.
7. O estudo registrar as premissas utilizadas.
8. Os resultados forem reproduzíveis.
9. Um profissional puder revisar as premissas e o estudo.
10. O novo módulo funcionar sem comprometer os fluxos produtivos existentes.

O atendimento aos critérios não equivalerá à certificação legal de um empreendimento.

# 17. Decisões arquiteturais propostas

**DA-001 — Núcleo paramétrico reutilizável:** adotar um modelo comum para terrenos, edificações e componentes.

**DA-002 — Separação entre dados e representação:** modelos 3D serão gerados a partir de parâmetros estruturados.

**DA-003 — Validação independente da IA:** verificações normativas e geométricas não dependerão exclusivamente de respostas probabilísticas.

**DA-004 — Suporte a diferentes níveis de detalhamento:** estudos externos poderão evoluir para ambientes internos.

**DA-005 — Histórico não destrutivo:** mudanças resultarão em revisões rastreáveis.

**DA-006 — Extensão por tipologias:** torres, casas, kitnets e outras construções utilizarão módulos específicos sobre um núcleo compartilhado.

**DA-007 — Papéis e aprovações:** compradores, empresas e profissionais terão diferentes níveis de autoridade.

**DA-008 — Preservação do legado funcional:** não remover nem substituir capacidades da Imobiliária 3D sem validação de dependências e impacto.

**DA-009 — Publicação separada da geração:** criar um modelo não implica autorização para publicá-lo.

**DA-010 — Verificação antes de promessa comercial:** estudos serão apresentados com limitações explícitas, evitando alegações de aprovação ou exequibilidade não comprovadas.

# 18. Questões em aberto

As seguintes decisões exigirão pesquisa e validação antes do desenvolvimento das respectivas funcionalidades:

1. Quais municípios serão atendidos inicialmente?
2. Quais fontes cartográficas e topográficas possuem precisão suficiente?
3. Como obter e validar perímetros cadastrais?
4. Qual subconjunto da legislação será suportado no primeiro piloto?
5. Quais tipologias terão maior prioridade comercial?
6. Qual motor geométrico apresenta melhor compatibilidade com a plataforma atual?
7. Como será realizada a edição profissional das propostas?
8. Quais alterações o comprador poderá fazer livremente?
9. Quais revisões serão obrigatórias antes de publicação?
10. Como será estruturado o modelo de receita?
11. Quais formatos de exportação serão necessários?
12. Quais métricas deverão orientar a decisão de avançar para cada fase?

# 19. Próxima ação recomendada

A primeira atividade não deverá ser a implementação de um gerador completo.

Deverá ser uma investigação técnica controlada contendo:

- Levantamento da arquitetura e dos componentes 3D existentes.
- Verificação das fontes de relevo disponíveis.
- Escolha de um terreno-piloto.
- Identificação das normas pertinentes.
- Definição do modelo mínimo de dados paramétricos.
- Prototipagem isolada de um envelope e de volumes externos.
- Revisão dos resultados e das limitações por profissional competente.

**Resultado esperado:** comprovar a viabilidade técnica e comercial do núcleo antes de expandir para geração arquitetônica interna, configuradores e experiências virtuais completas.

---

# 20. Visão de longo prazo

A Imobiliária 3D poderá evoluir de uma plataforma de apresentação de imóveis para um ecossistema de inteligência e concepção imobiliária.

Nesse ecossistema, terrenos poderão ser analisados, empreendimentos poderão ser concebidos, unidades poderão ser organizadas e compradores poderão visualizar e personalizar propostas habitacionais antes da construção.

O diferencial pretendido não será apenas a geração automática de geometria tridimensional, mas a integração entre dados territoriais, regras urbanísticas, concepção paramétrica, revisão profissional e experiência comercial.

**Diretriz final:** construir uma plataforma capaz de crescer em profundidade funcional, sem comprometer a confiabilidade, a segurança e a estabilidade da Imobiliária 3D já existente.

*Fim do PRD — versão 0.1.*


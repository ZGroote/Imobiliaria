# PVF-G0 — Inventário e Contratos da Pré-viabilidade Física

**Data:** 16/11/2026  
**Galho:** `viabilidade/projetista-g0` (somente documentação em `viabilidade/pre-fisica/`; escrito numa cópia temporária na worktree da viabilidade)  
**Status:** inventário PVF-G0. Sem código de produto, sem alteração no `motor/`, painel, Firestore ou produção.  
**Base lida:** `viabilidade/PRD-PRE-VIABILIDADE-FISICA-0.1.md`, `viabilidade/projetista/validador.py`, `viabilidade/projetista/esquema.py`, `viabilidade/motor/motor.py`, `viabilidade/terreno/RELEVO.md`, `viabilidade/terreno/preparar_relevo.py`, `viabilidade/terreno/novo_lote.py`.

---

## 1. O que já existe no repositório e se serve

| Tema | O que existe (`arquivo:função`) | Entrada → Saída | Serve para a pré-viabilidade física? |
|---|---|---|---|
| **Volumes, pavimentos, alturas e áreas** | `viabilidade/motor/motor.py`: `_altura`, `_volume`, `_avaliar`, `gerar_estudo` | `(lote, zona, premissas)` → `estudo.json` (volumes `base_utm`, `z0_m`, `altura_m`, `pavimentos`, `uso`, `metricas`) | **Sim (base volumétrica).** Serve como ponto de partida sem alterar `motor.py`. Não traz pilares, vãos, sistema estrutural nem cargas. |
| **Estados de verificação do Projetista** | `viabilidade/projetista/validador.py`: `validar`, `_faces`, `medir_areas`; `viabilidade/projetista/esquema.py`: `conferir_estrutura`, `selar`, `sha256` | `(DesignRevision, Site, RuleSetReference)` → lista de `ValidationFinding` (`conforme`, `violacao`, `nao_verificado`, `erro_tecnico`) | **Sim (estender, não duplicar).** Falta: (a) estado `NAO_APLICAVEL` com justificativa; (b) campo `domain` em `ValidationFinding`; (c) **síntese global** (`HIPOTESE_PRELIMINAR`, `CONDICIONAL_COM_PENDENCIAS`, `INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS`, `VERIFICADO_NO_ESCOPO_DECLARADO`) — hoje `DesignRevision.status` em `esquema.py:conferir_estrutura` só aceita `RASCUNHO` ou `REQUER_REVALIDACAO`. |
| **Relevo e topografia** | `viabilidade/terreno/preparar_relevo.py`: `baixar`, `auditar_local`; `viabilidade/terreno/novo_lote.py`: `Cadastro.altura`, `Cadastro.gerar` (usa `relevo.resumir`) | Raster Copernicus GLO-30 (~30 m, EGM2008) → `lote["relevo"]` (`cota_min_m`, `cota_max_m`, `declividade_pct`) + ressalva em `observacoes` | **Parcial (só triagem).** `motor.py` hoje ignora relevo (`z = 0`). Serve para popular `TerrainSurvey` com proveniência, mas **não serve** para corte/aterro, arrimo ou cota de fundação. |
| **Sondagem, SPT, solo, nível d'água** | **Não achei** no código (apenas menção conceitual em `viabilidade/PRD-PLATAFORMA-0.2.md`). | — | **Não existe.** Precisa ser criado do zero a partir do PVF-G3. |
| **Custo / m²** | **Não achei** custo/m² ou CUB no código. `viabilidade/motor/motor.py:_avaliar` tem apenas `preco_venda_m2_privativo` (padrão `None`) → `vgv_estimado`. | `area_privativa_m2 × preco_venda_m2_privativo` → `vgv_estimado` | **Não serve para custo.** Módulo econômico fica sem base no repositório até o PVF-G5. |

---

## 2. Matriz normativa (ABNT)

> **Aviso de governança:** todas as normas abaixo são **pagas** no catálogo da ABNT (texto integral não é aberto). Títulos e anos abaixo foram conferidos em fontes públicas abertas em 16/11/2026; a **vigência formal e o texto completo** devem ser confirmados por profissional habilitado antes de qualquer cálculo em produção.

| Norma | Título e ano conferidos | Para que serve no PRD | Paga? | O que o PVF-G1 precisa dela |
|---|---|---|---|---|
| **ABNT NBR 6120:2019** | *Ações para o cálculo de estruturas de edificações* (2019) | Cargas permanentes e variáveis (sobrecargas de uso) por ambiente/pavimento. | Sim | Apenas **referência de catálogo** (marcar ações como `nao_verificado` no PVF-G1). Cálculo entra só no PVF-G2. |
| **ABNT NBR 6118:2023** *(Emenda 1/2026)* | *Projeto de estruturas de concreto — Procedimento* (2023; Emenda 1 em 2026) | Critérios de dimensionamento e estabilidade de estruturas de concreto armado. | Sim | Apenas identificação de método pendente (`nao_verificado`). Sem cálculo no PVF-G1. |
| **ABNT NBR 6122:2022** *(Emenda 1/2022)* | *Projeto e execução de fundações* (2022) | Critérios de fundações superficiais/profundas, segurança e interação solo–estrutura. | Sim | Apenas bloqueio de conclusão positiva sem método/sondagem (`nao_verificado`). |
| **ABNT NBR 6484:2020** | *Solo — Sondagem de simples reconhecimento com SPT — Método de ensaio* (2020) | Padronização de boletim SPT, medidas de N-SPT e registro de nível d'água. | Sim | Apenas definição de pendência geotécnica no PVF-G1. Esquema do boletim entra no PVF-G3. |
| **ABNT NBR 6123:2023** *(errata 2025)* | *Forças devidas ao vento em edificações* (2023) | Ações horizontais de vento em torres e estabilidade global. | Sim | Apenas marcar ações horizontais como `nao_verificado` quando houver torre/edifício. |
| **ABNT NBR 8681:2025** | *Ações e segurança nas estruturas — Procedimento* (2025) | Combinações de ações e estados-limite últimos/de serviço. | Sim | Apenas marcar combinações de ações como `nao_verificado` até existir método no PVF-G2/G4. |

---

## 3. Dados reais disponíveis e direitos de uso

### 3.1 Topografia aberta (inventariada em `viabilidade/terreno/RELEVO.md`)
- **Copernicus GLO-30 (AWS `copernicus-dem-30m`, ~30 m / 1″):** recorte urbano de São Carlos já baixado e validado em `viabilidade/terreno/dados/copernicus-glo30-sao-carlos.tif`. Acesso público sem login; uso permitido inclusive comercialmente mediante atribuição obrigatória (`preparar_relevo.py:ATRIBUICAO`). É **MDS** (inclui árvores/edificações): serve apenas para triagem de entorno, nunca como cota de projeto.
- **FABDEM V1-2 (~30 m, MDT estimado):** licença **CC BY-NC-SA 4.0** — **não usar** em produto comercial sem licença separada.
- **ALOS AW3D30 (~30 m, MDS):** exige conta e notificação prévia para uso comercial.
- **Levantamento planialtimétrico executivo:** não existe base aberta com precisão de projeto; depende de levantamento contratado pelo cliente/incorporadora.

### 3.2 Sondagem geotécnica (SPT)
- **Não existe base pública aberta** de sondagens por lote.
- **Origem e titularidade:** o boletim de sondagem (NBR 6484) é contratado pelo **proprietário ou incorporadora** junto a empresa de geotecnia, com responsável técnico (ART). O cliente/contratante é o dono do laudo; os dados são confidenciais e **não podem** ser inferidos por mapa nem republicados sem autorização expressa.

---

## 4. Contrato mínimo do PVF-G1 (encaixado em `projetista/0.1.0`)

Para não duplicar contratos nem validadores, o PVF-G1 estende `viabilidade/projetista/esquema.py` e `viabilidade/projetista/validador.py` de forma retrocompatível:

1. **Síntese por domínio + síntese global (`DomainVerification` e `FeasibilityAssessment`):**
   - Cada `ValidationFinding` recebe `domain` (`geometrico`, `urbanistico`, `arquitetonico`, `estrutural`, `geotecnico`, `economico`).
   - O `validador.py` passa a aceitar o 5º estado `nao_aplicavel` (com `reason` obrigatório).
   - O resumo da revisão (`DesignRevision.assessment`) consolida os 6 domínios e calcula a síntese global conservadora:
     - `INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS` se qualquer domínio tiver `violacao`;
     - `CONDICIONAL_COM_PENDENCIAS` se não houver violação, mas algum domínio aplicável estiver `nao_verificado`;
     - `HIPOTESE_PRELIMINAR` se ainda houver premissas sem fonte normativa mínima;
     - `VERIFICADO_NO_ESCOPO_DECLARADO` apenas se **todos** os domínios do escopo declarado estiverem `conforme` (ou `nao_aplicavel` justificado) e revisados.

2. **Campos mínimos de grandeza (PRD seção 7) no `ValidationFinding`:**

| Campo pedido no PRD (seção 7) | Já existe em `ValidationFinding` (`esquema.py`)? | Ajuste mínimo no PVF-G1 |
|---|---|---|
| `value`, `unit`, `limit` | Sim (`measured`, `unit`, `limit`) | Manter; exigir `null` + `reason` quando ausente. |
| `source_id`, `validation_status` | Sim (`source.reference`, `status`) | Adicionar `nao_aplicavel` aos valores válidos de `status`. |
| `quantity_kind`, `derivation_or_method` (`method_version`), `assumptions`, `source_version`, `confidence_or_uncertainty`, `calculated_at`, `engine_version`, `scope`, `reason`, `required_actions` | **Faltam** | Adicionar como campos estruturados no `ValidationFinding` (ou bloco `metadata` obrigatório no PVF-G1), sem quebrar os campos já consumidos pelo Projetista. |

---

## 5. Respostas propostas às 7 decisões da seção 16

| # | Decisão aberta (PRD seção 16) | Recomendação proposta | Quem decide |
|---|---|---|---|
| 1 | Tipos de empreendimento no domínio inicial | **Edifícios residenciais multifamiliares com pavimento-tipo** (mesmo domínio do Projetista); casas térreas e sobrados fora do primeiro portão. | **Usuário (produto)** |
| 2 | Dados reais de topografia/sondagem e direitos | Topografia: **Copernicus GLO-30** só para triagem (com atribuição). Sondagem: **upload/cadastro opcional pelo cliente** com controle de acesso; ausência = `nao_verificado`. | **Usuário + jurídico** |
| 3 | Catálogo preliminar de estruturas e premissas | **Concreto armado convencional** em faixas preliminares apenas no PVF-G2, com parâmetros revisados por engenheiro calculista. | **Engenheiro calculista habilitado** |
| 4 | Representar cargas, apoios, subsolos e NA sem conflitar com o Projetista | Vincular por **`revision_id` + `element_ids` estáveis** do esquema `projetista/0.1.0`; qualquer mudança no `content_sha256` da geometria invalida automaticamente cargas/geotecnia. | **Técnico (arquitetura)** |
| 5 | Verificações técnicas por rótulo comercial | **Trava conservadora:** sem sondagem ou método estrutural habilitado, nenhum rótulo pode passar de `CONDICIONAL_COM_PENDENCIAS`. | **Usuário + responsável técnico** |
| 6 | Quem pode inserir, revisar, aprovar e exportar | Operador/arquiteto insere geometria; **apenas profissional habilitado** pode marcar revisão estrutural/geotécnica como `verified: true`; exportação sempre leva aviso preliminar. | **Usuário + governança** |
| 7 | Módulo econômico na mesma fase ou depois | **Depois (PVF-G5)** — só após validar estimativas físicas (PVF-G2..G4), para não gerar faixa de custo sem base técnica comparável. | **Usuário (negócio)** |

---

## 6. Riscos e ordem dos portões em paralelo com o Projetista

### 6.1 Riscos prioritários
- Todos os 8 riscos da seção 15 do `PRD-PRE-VIABILIDADE-FISICA-0.1.md` se aplicam (destaque para não converter peso total em capacidade de fundação e nunca transformar N-SPT em capacidade direta).
- **Risco novo de arquitetura:** duplicar esquema e validador entre `viabilidade/projetista/` e `viabilidade/pre-fisica/`. Mitigação: o PVF-G1 deve **estender** `esquema.py` e `validador.py`, mantendo um único contrato.

### 6.2 Ordem dos portões (PVF-G1..G3) e paralelismo
1. **PVF-G1 (em paralelo com PA-G1/G2 do Projetista):** implementar classificação por 6 domínios, estado `nao_aplicavel`, síntese global conservadora e campos mínimos de grandeza em `esquema.py`/`validador.py`, com suíte adversária (caso sem sondagem nunca vira `VERIFICADO`).
2. **PVF-G2 (após PA-G2/G3 do Projetista estabilizarem geometria de pavimento/torre):** estimador preliminar e dimensional (`kN`, `kN/m²`) de ações permanentes/variáveis por pavimento, com invalidação automática por `content_sha256`.
3. **PVF-G3 (pode rodar em paralelo ao PA-G3, independente do PVF-G2):** cadastro versionado de boletins SPT (`GeotechnicalInvestigation`, `Borehole`, `SoilLayer`, `GroundwaterObservation`), **sem** cálculo automático de capacidade de carga (reservado ao PVF-G4 com método validado por engenheiro).

# Fábrica de miniaturas — contrato da automação

Estado: **arquitetura proposta para a próxima frente de produto**. Este documento não muda o
pipeline atual, não publica nada e não aposenta nenhum padrão. Ele define o contrato que os próximos
PRs devem implementar, em passos pequenos e provados.

## Objetivo

Transformar a produção de maquete, planta e visita 3D em uma fábrica reproduzível:

```text
material de entrada
        ↓
 validação
        ↓
 fonte normalizada
        ↓
 geometria / planta / materiais
        ↓
 ┌───────────────┬────────────────────┐
 │               │                    │
 ▼               ▼                    ▼
LEVE          PREMIUM              renders
 │               │                    │
 └───────────────┴──────────┬─────────┘
                            ↓
                         gates
                            ↓
                         build
                            ↓
                        preview
```

A meta de **100% de automação** tem um significado operacional preciso:

> Um imóvel que satisfaz o contrato de entrada atravessa da entrada ao preview sem intervenção
> humana. O humano trabalha somente em **exceções declaradas**, nunca em passos implícitos do
> caminho normal.

Isso não significa inventar dados ausentes, adivinhar planta, origem ou medidas. Entrada insuficiente
deve terminar em `BLOQUEADO`, com motivo legível.

## O que existe hoje

O repositório já tem partes importantes da fábrica; o trabalho agora é conectá-las por contrato.

| Parte | Estado atual | Automação hoje |
|---|---|---|
| Cadastro do imóvel | `padrao/cidades/*.json` + dados de unidade/planta | estruturado |
| Entry point da maquete | `pagina_maquete.py` | monta a base atual; no Cedros desvia para o PREMIUM aprovado de `padrao_atual.py` |
| Modelos LEVE Blender | `modelar_montes.py`, `modelar_castanheiras.py` | reproduzíveis, mas específicos por empreendimento |
| Exportação Blender | `blender_maquete_base.py` | automatizada |
| PREMIUM Cedros | `padrao_atual.py` | montagem determinística |
| Fonte PREMIUM | `source.json` privado, manifesto em `tools/artefatos-privados.json` | recuperação automática e verificada |
| UV PREMIUM | `unwrap-v3.py`, `unwrap-exterior.py` | scriptado |
| Bake PREMIUM | `bake-v3.py`, `bake-exterior.py` | scriptado, exige Blender |
| Denoise/encode | `denoise-*.py`, `encode_lightmaps.py` | scriptado |
| QA visual | `qa_visual.py`, `qa_padrao_atual.py` e sondas específicas | scriptado, ainda espalhado |
| Build por imóvel | `pipeline/build_imovel.py` | determinístico, imutável, com manifest |
| Preview/publicação | pipeline de build/preview/promoção já provado | automatizável, aprovação continua humana |

O gargalo não está na montagem final. Está antes dela: converter o material bruto em uma fonte 3D
normalizada e repetível ainda depende de código/decisões específicas de cada empreendimento.

### Duas linhas atuais que não devem ser confundidas

**LEVE** e **PREMIUM continuam ativos.** A fábrica deve gerar os dois a partir de uma mesma entrada
canônica sempre que o imóvel tiver material suficiente.

A hipótese de qualidade progressiva (`Padrão → Alta`) fica compatível com esta arquitetura, mas
**não entra nos primeiros PRs**. Primeiro a fábrica aprende a produzir os dois resultados atuais.
Depois podemos trocar:

```text
fonte → LEVE
      → PREMIUM
```

por:

```text
fonte → base comum
      → pacote padrão
      → pacote alta
```

sem refazer o contrato de entrada nem os jobs de preparação.

---

# 1. Contrato de entrada

A fábrica não começa em Blender. Começa numa ficha auditável do material recebido.

Formato conceitual:

```text
imovel/
  entrada.json
  planta/
  referencias/
  fotos/
  anexos/
```

O nome físico das pastas pode mudar quando implementarmos. O contrato lógico é este.

## Campos mínimos

`entrada.json` deve conseguir apontar, sem duplicar o cadastro principal, para:

- `propertyId` / id do imóvel na plataforma;
- `pipelineUnitId`;
- cidade;
- origem de cada material;
- autorização/classificação de uso;
- planta escolhida;
- escala ou medidas de referência;
- empreendimento/unidade;
- quais resultados são pedidos:
  - LEVE;
  - PREMIUM;
  - renders;
- versão do contrato.

O contrato **não carrega segredos** e não deve copiar material privado para o git.

## Validador de entrada

Primeiro job da fábrica:

```text
VALIDAR_ENTRADA
```

Saída:

```text
OK
```

ou:

```text
BLOQUEADO
- planta ausente
- escala não confirmada
- origem da referência não classificada
- unidade não existe no cadastro
```

Nenhum job caro roda antes disso.

Casos como `mirra-114` devem cair aqui ou numa trava equivalente **antes** de Blender, bake, preview
ou publicação.

---

# 2. Fonte canônica

Hoje parte da fonte vive no cadastro e parte é recriada por scripts específicos.

O alvo é uma representação intermediária por imóvel que contenha somente fatos necessários para
geração, por exemplo:

```text
fonte_normalizada/
  arquitetura.json
  planta.json
  implantacao.json
  materiais.json
  moveis.json
  referencias.json
```

Isto é uma **interface entre preparação e renderização**, não necessariamente o formato final em
disco.

Propriedades obrigatórias:

- versionada por schema;
- determinística quando os inputs não mudam;
- sem URLs/arquivos de terceiros sem classificação;
- com hashes das entradas;
- sem decisões escondidas em código específico do empreendimento;
- capaz de alimentar LEVE e PREMIUM.

Quando uma informação não for conhecida, o formato deve registrar `desconhecido`/ausência; não
inventar valor para satisfazer o gerador.

---

# 3. Jobs da fábrica

Cada etapa deve virar um job com contrato explícito.

| Ordem | Job | Entrada | Saída principal | Pode ser cacheado? |
|---:|---|---|---|---|
| 01 | `validar_entrada` | material recebido + cadastro | relatório de validade | sim |
| 02 | `normalizar_fonte` | entrada válida | fonte canônica | sim |
| 03 | `gerar_geometria` | fonte canônica | geometria/modelo base | sim |
| 04 | `validar_geometria` | geometria | métricas + gates | sim |
| 05 | `gerar_leve` | geometria + cadastro | pacote LEVE | sim |
| 06 | `preparar_premium` | geometria | fonte/UV de bake | sim |
| 07 | `bake_premium` | fonte de bake | atlas bruto | sim |
| 08 | `denoise_encode` | atlas bruto | lightmaps entregáveis | sim |
| 09 | `gerar_premium` | geometria + lightmaps | pacote PREMIUM | sim |
| 10 | `gerar_renders` | pacote(s) | miniatura/planta/renders | sim |
| 11 | `qa` | todos os resultados | relatório único | sim |
| 12 | `build_imovel` | resultados aprovados pelo QA | build imutável + manifest | já existe |
| 13 | `preview` | build imutável | URL de preview | sim, por build |

Não precisamos implementar todos de uma vez. A tabela é o destino.

## Contrato mínimo de um job

Todo job futuro deve expor:

- `jobType`;
- versão do job;
- hashes dos inputs;
- status;
- início/fim/duração;
- outputs com tamanho e SHA-256;
- log;
- erro estruturado;
- indicação de retry seguro;
- dependências de software usadas.

Estados:

```text
pending
running
succeeded
blocked
failed
cancelled
```

`blocked` é diferente de `failed`:

- **blocked**: falta decisão/material/autoridade humana;
- **failed**: o job tinha tudo de que precisava e quebrou.

---

# 4. Cache e invalidação

Regra central:

> Não regenerar o que não mudou.

A chave de cache de cada job deve ser derivada de:

```text
jobType
+ versão do job
+ hashes dos inputs
+ configuração relevante
```

Exemplos:

### Mudou somente ficha comercial

Não deve invalidar:

- geometria;
- UV;
- bake;
- lightmap.

Pode invalidar:

- HTML/ficha;
- render textual, se houver;
- build final.

### Mudou móvel

Deve invalidar somente o que depende do layout mobiliado.

No PREMIUM atual, mover geometria que participa do bake pode invalidar o mapa interno; o job deve
declarar essa dependência, não escondê-la.

### Mudou geometria

Invalida:

```text
geometria
→ UV
→ bake
→ lightmaps
→ pacotes
→ renders
→ build
```

O grafo de dependências deve decidir isso, não uma lista manual de comandos.

---

# 5. Determinismo e identidade

O `build_imovel.py` já prova uma regra que deve subir para toda a fábrica:

> O artefato é identificado pelo conteúdo, não pela hora em que foi produzido.

Para cada job que puder ser determinístico:

- mesma entrada + mesma versão = mesmos bytes;
- outputs guardam SHA-256;
- pasta existente nunca é sobrescrita silenciosamente;
- divergência com a mesma identidade é erro.

Nem todo output será byte a byte determinístico no primeiro dia — Blender/render podem carregar
fontes de variabilidade. Nesses casos o job deve registrar explicitamente o nível de garantia:

- `byte_exact`;
- `structurally_equal`;
- `visual_threshold`;
- `non_deterministic`.

A meta é reduzir o último grupo ao mínimo.

---

# 6. Ambientes de execução

A fábrica tem pelo menos quatro ambientes técnicos diferentes hoje:

1. Python normal do projeto;
2. Python/venv do bake (`requirements-bake.txt`);
3. Blender 5.2.2 LTS;
4. browser/Chrome/Playwright para QA.

Nenhum job deve presumir que “a máquina do João tem isso instalado”.

Cada job deve declarar:

- executável necessário;
- versão;
- dependências;
- como verificar o ambiente antes de começar.

No início a fábrica pode rodar **localmente**, numa única máquina. O contrato já deve permitir
migrar depois para worker/BuildJob sem reescrever o pipeline.

---

# 7. Artefatos privados

As fontes PREMIUM atuais provam o padrão:

- git guarda manifesto/metadados;
- arquivo grande/insubstituível mora no repositório privado de artefatos;
- SHA-256 do nosso manifesto é a autoridade;
- recuperação não sobrescreve trabalho local divergente;
- arquivo recuperado fica fora do git.

A fábrica deve reutilizar esse modelo para qualquer fonte privada grande.

Não transformar o repositório de artefatos em uma pasta sem contrato. Todo novo artefato precisa de:

- imóvel;
- tipo;
- versão;
- bytes;
- SHA-256;
- origem;
- data;
- relação com o job que o produziu.

---

# 8. QA único por imóvel

Hoje os gates estão distribuídos por vários scripts. A fábrica deve manter as sondas especializadas,
mas produzir **um relatório de QA do imóvel**.

Exemplo conceitual:

```json
{
  "property": "monte-dos-cedros-37",
  "leve": "passed",
  "premium": "passed",
  "mobile": "passed",
  "planta": "passed",
  "visita": "passed",
  "links": "passed",
  "assets": "passed"
}
```

O relatório deve distinguir:

- gates automáticos;
- checks não executados;
- checks manuais ainda necessários.

Nunca transformar “não medido” em “passou”.

## Gate para preview

O preview só nasce se:

- entrada válida;
- jobs obrigatórios concluídos;
- hashes conferidos;
- QA automático obrigatório verde.

A aprovação comercial/visual humana acontece **depois**, no preview.

---

# 9. Exceções humanas

A fila humana precisa ser explícita.

Categorias iniciais:

- `INPUT_MISSING` — material faltante;
- `ORIGIN_UNCONFIRMED` — origem/autorização pendente;
- `PLANT_SCALE_UNKNOWN` — sem escala confiável;
- `GEOMETRY_REVIEW` — reconstrução não passou gates;
- `VISUAL_REVIEW` — passou tecnicamente, precisa avaliação visual;
- `BAKE_REVIEW` — artefatos de luz;
- `UNSUPPORTED_CASE` — o contrato atual não representa o imóvel.

Toda exceção deve guardar:

- em qual job parou;
- motivo;
- evidência;
- ação humana pedida;
- inputs que mudaram depois da resolução.

Não usar “editar o arquivo e rodar de novo” como estado do sistema.

---

# 10. Relação com BuildJob e o painel

Não vamos começar pelo backend.

Primeiro o runner local deve provar o contrato. Depois o mesmo grafo vira o futuro `BuildJob`.

Destino conceitual:

```text
agency
  ↓
request
  ↓
property
  ↓
BuildJob
  ├─ validar
  ├─ gerar
  ├─ QA
  └─ build
        ↓
     preview
        ↓
   aprovação
        ↓
   publicação
```

A aprovação continua humana. A geração deixa de depender de uma pessoa executar a sequência certa.

---

# 11. O que NÃO entra nesta primeira frente

Para manter o escopo controlado:

- não refazer Engine V2 do mapa;
- não fundir LEVE/PREMIUM agora;
- não criar serviço em nuvem antes de o runner local funcionar;
- não criar UI de gerenciamento antes do contrato dos jobs;
- não alterar publicação de produção;
- não reescrever a geometria atual só para “ficar genérica”;
- não tentar resolver automaticamente material insuficiente.

---

# 12. Sequência de implementação

## M0 — contrato e inventário

Este documento.

Gate: nenhuma mudança funcional.

## M1 — runner local e relatório

Criar um runner que:

1. recebe `propertyId/pipelineUnitId`;
2. executa jobs pequenos registrados;
3. grava status, hashes, duração e logs;
4. não publica.

Primeiro runner pode chamar scripts existentes sem refatorá-los.

**Aceite:** rodar Cedros e produzir um relatório sem mudar os bytes atuais.

## M2 — LEVE sem intervenção

Inventário e contrato detalhado: [m2-fonte-leve.md](m2-fonte-leve.md).

Tirar do caminho normal as escolhas específicas codificadas por empreendimento.

Meta:

```text
entrada válida → geometria → LEVE → QA
```

sem editar script.

Cedros, Colinas e Castanheiras são os três casos de regressão.

## M3 — PREMIUM reproduzível por job

Encapsular:

```text
recuperar fonte
→ unwrap
→ bake
→ denoise
→ encode
→ montar
→ QA
```

Primeiro para Cedros, sem alterar o padrão aprovado.

O job deve reutilizar cache se os hashes de geometria/lightmap já conferirem.

## M4 — build + preview

Conectar o runner ao `build_imovel.py` e ao preview existente.

Ainda manualmente disparado, mas sem comandos intermediários humanos.

## M5 — lote piloto de 30 imóveis

Três ondas de 10.

### Onda 1

Objetivo: catalogar exceções humanas.

### Onda 2

Objetivo: automatizar as exceções repetidas da onda 1.

### Onda 3

Objetivo: medir a fábrica estabilizada.

Métricas obrigatórias:

- tempo total por imóvel;
- tempo humano por imóvel;
- tempo de máquina;
- % que chega ao preview sem intervenção;
- % bloqueado;
- motivos de bloqueio;
- retries;
- custo de CPU/GPU;
- bytes LEVE/PREMIUM;
- tempo de QA;
- retrabalho;
- falhas mobile.

A métrica principal não é “quantos scripts existem”.

É:

> **quantos imóveis válidos chegam ao preview sem intervenção humana e quanto tempo humano os
> demais consomem.**

---

# 13. Primeira implementação autorizada depois deste documento

O próximo PR funcional deve ser **M1: runner local + relatório**, e só isso.

Regras:

- usar os scripts atuais como estão sempre que possível;
- não mover Blender/bake para serviço;
- não publicar;
- não alterar bytes do Cedros;
- começar com jobs de leitura/validação e montagem já determinística;
- registrar duração/hashes/status desde o primeiro dia;
- se uma etapa atual exigir intervenção humana, registrar `blocked` em vez de escondê-la.

O Cedros é o primeiro fixture porque tem LEVE, PREMIUM, build e hashes públicos de referência.
Colinas e Castanheiras entram como regressões de LEVE.

## Aceite de M1

Um comando único, ainda local, deve produzir algo equivalente a:

```text
property: monte-dos-cedros-37

validar_entrada      succeeded
resolver_fontes      succeeded
gerar_leve           succeeded / cached
verificar_premium    succeeded / cached
qa                    succeeded
build_imovel          succeeded / cached

build: 34331f1ceb9d
preview: não executado
```

e um arquivo de relatório legível por máquina.

O comando não precisa recalcular o bake no M1. O objetivo é provar **orquestração, identidade e
estado**, antes de automatizar a parte cara.

# Documentação: onde está a verdade atual

Índice curto, de 26/09/2026. Os documentos **vivos** são mantidos e descrevem o estado atual. Os
**registros históricos** têm um aviso no topo, descrevem o que valia na data deles e não são
atualizados. Os arquivos não foram movidos, porque vários são citados pelo caminho em código,
configuração e scripts.

## Estado atual

| Assunto | Onde |
|---|---|
| Visão geral, instalar, testar e montar o piloto | [README.md](README.md) |
| Dependências por ambiente e comandos de verificação | [DEPENDENCIAS.md](DEPENDENCIAS.md) |
| O que o CI roda em todo PR | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Painel: decisões (D1–D11), onde cada dado mora, modelo do Firestore, autorização | [tasks/painel/proposta.md](tasks/painel/proposta.md) §1–§4 |
| Regras do Firestore e do Storage, e seus testes | [firebase/firestore.rules](firebase/firestore.rules), [firebase/storage.rules](firebase/storage.rules), [firebase/tests/regras.test.mjs](firebase/tests/regras.test.mjs); o que é cada arquivo: [firebase/README.md](firebase/README.md) |
| Índices do Firestore | [firebase/firestore.indexes.json](firebase/firestore.indexes.json) |
| Publicação de imóveis: cache, preview por imóvel, promoção e reversão ("build once, promote the exact artifact") | [tasks/painel/proposta.md](tasks/painel/proposta.md) §6–§9; código em `pipeline/build_imovel.py` e `pipeline/publicar_imovel.py` |
| **Estado de produção** (regras, índices, painel, sites, contas, dados) e a ordem de deploy | [tasks/painel/proposta.md](tasks/painel/proposta.md) §14 |
| Último checkpoint: produção, gates, pendências deliberadas e próximos trilhos (26/09) | [tasks/checkpoints/estabilizacao-2026-09-26.md](tasks/checkpoints/estabilizacao-2026-09-26.md) |
| Mapa 3D: o contrato de cidade e os portões de aceite | [PADRAO.md](PADRAO.md) |
| Mapa 3D: o passo a passo, do arquivo baixado ao HTML | [PIPELINE.md](PIPELINE.md) |
| Fontes da base 1.5 (renderizador modular e miniaturas) | [v1.5/LEIA-ME.md](v1.5/LEIA-ME.md) |
| Maquete, planta e visita: o padrão aprovado | [v1.5/miniaturas/README.md](v1.5/miniaturas/README.md), [v1.5/miniaturas/PADRAO-ATUAL.md](v1.5/miniaturas/PADRAO-ATUAL.md) e, para agentes, [v1.5/miniaturas/AGENTS.md](v1.5/miniaturas/AGENTS.md) |
| Terceiros: código e mídia (inventário, não regularização), proveniência dos dados, dados privados de clientes, arquivos grandes, scripts avulsos, renderizadores de cidade (quem é ativo, referência ou demo) e o levantamento de higiene do repositório | [THIRD_PARTY.md](THIRD_PARTY.md), [tasks/higiene-repositorio/proveniencia.md](tasks/higiene-repositorio/proveniencia.md), [tasks/higiene-repositorio/dados-privados.md](tasks/higiene-repositorio/dados-privados.md), [tasks/higiene-repositorio/arquivos-grandes.md](tasks/higiene-repositorio/arquivos-grandes.md), [tasks/higiene-repositorio/scripts.md](tasks/higiene-repositorio/scripts.md), [tasks/higiene-repositorio/renderizadores.md](tasks/higiene-repositorio/renderizadores.md), [tasks/higiene-repositorio/levantamento.md](tasks/higiene-repositorio/levantamento.md) |
| Backlog do produto (versão 1.0) | [tasks/v1.0/](tasks/v1.0/README.md): **vivo**, reconciliado em 26/09 com o que o Trilho B entregou ([todo.md](tasks/v1.0/todo.md): cada item marcado cita o PR) |

## Registros históricos

Não descrevem o estado atual. Servem para entender por que as coisas são como são.

| Documento | O que é |
|---|---|
| [REVISAO-1.5.md](REVISAO-1.5.md) | Revisão da base 1.5 em 21/09/2026. As falhas de teste citadas foram resolvidas |
| [tasks/modularizacao/](tasks/modularizacao/plan.md) | Plano, execução e aceite da modularização, concluída em 18/09/2026 ([aceite-final.md](tasks/modularizacao/aceite-final.md)) |
| [tasks/plan.md](tasks/plan.md), [tasks/todo.md](tasks/todo.md) | Plano de proporção e ocupação dos quarteirões (09/09/2026), sem acompanhamento nestes arquivos |
| [tasks/v1.0/verificacao-dev.1.md](tasks/v1.0/verificacao-dev.1.md), [tasks/v1.0/verificacao-t02.md](tasks/v1.0/verificacao-t02.md) | Verificações da base 1.0.0-dev.1 e do T02, na data delas |
| [relatorios/estudo-peso-miniaturas-2026-09-22.md](relatorios/estudo-peso-miniaturas-2026-09-22.md) | Estudo de carga das miniaturas (22/09/2026) |
| [relatorios/revisao-cronologia/](relatorios/revisao-cronologia/versao-completa.md) | Cronologia e estudo do projeto (22–23/09/2026). O `versao-completa.md` **não** leva aviso no topo: `gerar_completa.py` o lê linha a linha para montar o documento |
| [experimentos/mirante-7-2026-09-22/ESTUDO.md](experimentos/mirante-7-2026-09-22/ESTUDO.md) | Ensaio de produção da miniatura Mirante 7 (22/09/2026). Só o texto e os tempos: o material de terceiro saiu em 26–27/09 |

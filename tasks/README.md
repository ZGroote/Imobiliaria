# Planos e continuidade — 04/10/2026

Este é o índice de continuidade. O diagnóstico anterior está em
[avaliação](../relatorios/avaliacao-atual-2026-10-04.md); as correções e verificações
da consolidação estão em [organização](organizacao-2026-10-04.md).

## Plano Diretor

| Marco | Situação e próximo trabalho |
|---|---|
| M0 / base | Checkpoint [30/09](checkpoints/m0a-2026-09-30.md) registrado; CV descontinuado como caminho futuro, retirada final ainda pendente |
| M1-A/B/C | Contrato, captura e aberturas aceitos (#75–78) |
| M1-D/E/F entregues | Snapshots imutáveis, leitura fixada no pedido e E2E controlado aceitos (#79–81) |
| Objetivos originais D/E/F | Fotos vinculadas, contexto real completo do painel e captura real por telefone até 3D ainda sem comprovação completa; registrar decisão de escopo sem reabrir os PRs aceitos |
| M1.1-B/C | Mobile e cômodo composto integrados pelo #83 |
| M1.1-A / homologação | Executar cinco sessões em aparelhos físicos, registrar tempo, dúvidas, correções, perda de estado e ciclo até 3D; os ensaios locais não fecham esse aceite |
| M1.2 | Concluir retirada do CV depois da homologação, conforme a continuidade do diretor |
| M2 operacional | Fundação de BuildJob existente; falta identidade/transação, worker, lease/heartbeat, retry/cancelamento, reconciliação e prova de falhas/concorrência |
| M3 urbano | Comparar V1, V2 e híbrido com o mesmo protocolo, investigar início lento e registrar a escolha |
| M4 | Implementar e implantar gradualmente a arquitetura escolhida no M3 |
| M5 | Piloto real em ondas 10+10+10; medir tempo humano/máquina, custo, bloqueios, retrabalho e falhas mobile |

O Plano Diretor original é o documento local `Plano_Diretor_Imobiliaria_v2.docx`,
SHA-256 `4242212e45ba73f809e882d79bc273176eb37f5729e4f8fcb8bfdaf34111c5bb`.
Os documentos de cada entrega conservam seu escopo aceito. Este índice explicita as
metas originais que continuam sem prova.

## Outros roteiros

| Roteiro | Situação |
|---|---|
| [Fábrica](miniaturas/fabrica.md) M1 | Runner local e relatório implementados |
| Fábrica M2 | Fonte LEVE implementada nos três perfis piloto; tem significado diferente do M2 operacional acima |
| Fábrica M3/M4/M5 | PREMIUM por jobs pendente; build existe, ligação do runner ao preview pendente; lote real de 30 pendente |
| [Modularização](modularizacao/aceite-final.md) | Concluída em 18/09; não reabrir os checklists históricos |
| [Produto v1.0](v1.0/todo.md) | T01/T02 concluídos; T03 Storage parcial; T04 por imóvel entregue/mapa condicional; T05–T07 links, ficha e OG pendentes; T08–T13 exigem aceite/carga/mobile; T14 offline e T15 release estável pendentes |
| [Plano urbano de 09/09](plan.md) | Registro histórico; etapas locais de integração documentadas em `modelos_urbanos/v1/integracao/`; biblioteca final e desempenho ainda exigem aceite |

## Ordem de trabalho

1. Concluir a consolidação local e manter os testes verdes.
2. Homologar M1.1 nos cinco casos físicos; reconciliar fotos/contexto real e fechar o marco.
3. Concluir M1.2 e implementar M2 em incrementos verificáveis.
4. Usar as medições de qualidade progressiva para reduzir o custo de entrada/luz no celular.
5. Executar comparação urbana M3, implementar M4 e conduzir M5 com imóveis reais.

Experimentos gráficos continuam hipóteses até terem medição e aceite de dispositivo.
Não há autorização de publicação de produção associada a este índice.

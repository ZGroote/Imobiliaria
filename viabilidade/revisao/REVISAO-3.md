# Revisão 3 — confirmação final do 1B
Alvo: HEAD `13378643`, motor 0.8.3 (`dc342d0c`), tela/relatório `431a4a83`, licença `5ccdf641`; 15/11/2026.
**Não recomendo fechar o portão 1B (código): resta injeção de HTML no relatório via `volumes[].pavimentos`; motor, precisão e licença passaram.**

- Motor atual: **94/94 pares** (70 da varredura + 24 direcionados), incluindo os **12 anteriormente falhos**, sem perdas de unidades ou privativa acima de **0,10 m²** no empate; zero falhas nos invariantes dos 188 estudos.
- Causa revisada: `_excede_ajustavel` encaminha também TO/permeabilidade ao ajuste; `_avaliar` compara regiões e patamares menores de vagas; `_computavel_para_ajuste` evita parar pelo tamanho da garagem. Não há exceção por ID dos casos.
- Aviso explícito de não monotonia presente nos **94/94 estudos** em que garagem é computável e `vagas_por_unidade > 0`. Isso não prova monotonia fora da amostra.
- Os dois `xss-numerico-*` anteriores são recusados com `ValueError` identificando o campo, sem criar HTML. A validação ocorre antes da geração, inclusive sem opções.
- **Alta — correção de segurança incompleta:** `relatorio.py:336` interpola `{pavs}` diretamente no `<title>` do SVG; `validar_numeros_relatorio()` não verifica pavimentos dos volumes.
- Caso: trocar `opcoes[0].volumes[0].pavimentos` por `</title></polygon></svg><img src=x onerror=alert(1)><svg><title>`. Esperado: recusa ou texto escapado. Obtido: relatório gerado com **2 tags `img onerror` ativas**, confirmado por parser; execução no Chrome pendente para a central.
- Entrada/saída: `tarefa3/casos/xss-pavimentos.json` e `.html`; evidência em `tarefa3/evidencias/confirmacao.json`. A menor correção é validar esse número e escapar a interpolação; acrescentar este caso à regressão.
- O teste genérico entregue pelo Visual, em `relatorio/test_relatorio.py:411–418`, substitui somente valores que **já são strings**. Não cobre todos os números como pedia a tarefa 13; por isso deixa passar o caso acima. A mutação equivalente em memória passou, confirmando essa lacuna de cobertura.
- **130/130 métricas** das 26 opções/8 estudos conferem entre as expressões reais do painel atual, relatório regenerado e JSON, normalizando TO percentual. CA conserva as casas; checagem sem DOM, em `tarefa3/evidencias/metricas.json`.
- `vendor/LICENSE-three.txt` existe; SHA `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` confere com o manifesto. Bundle também confere; gerador copia a licença e registra seu hash.

Comandos executados, a partir da raiz:
`python -I -B -X utf8 viabilidade/revisao/revisar.py varredura --atual`
`python -I -B -X utf8 viabilidade/revisao/revisar.py direcionados --atual`
`python -I -B -X utf8 viabilidade/revisao/tarefa3/confirmar.py` — saída **1**, deliberada pela injeção restante, após salvar as demais verificações.
`node viabilidade/revisao/tarefa3/metricas.cjs` — passou; `node --check viabilidade/revisao/tarefa3/browser.cjs` — passou.
Evidências novas só em `tarefa3/`; `evidencias/12-pares.json` identifica os casos antigos dentro dos 94, sem duplicar sua execução. `versao.json` registra motor, commit e hashes; checkout difere do Git apenas por CRLF.

Para a central: `node viabilidade/revisao/tarefa3/browser.cjs` testa o novo caso no Chrome, sem servidor, salva os alertas e deve falhar enquanto houver injeção.
O teste Python original parou na limpeza de pasta temporária (`WinError 5`); não foi reexecutado com permissão. Central pode rodar `python -I -B -X utf8 viabilidade/relatorio/test_relatorio.py`.
Os 71 casos sem alertas no Chrome são confirmação anterior da central, informada na tarefa; não cobrem este novo payload. Não repeti Chrome, suíte completa do motor ou build do bundle.
Sem commit. Ficaram alterações em `revisar.py`, este parecer e `tarefa3/`; pasta temporária bloqueada fica ignorada em `tarefa3/tmp/`. Risco restante: relatório aceita HTML ativo vindo de um campo numérico não validado.

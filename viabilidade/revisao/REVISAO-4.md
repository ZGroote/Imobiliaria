# Revisão 4 — confirmação do conserto da injeção (feita pela central)

15/11/2026, HEAD `a7be004a`. O Revisor (Codex) não executou a TAREFA-4: o filtro de segurança do Codex recusou o pedido ("bypassing security controls"). A central fez a confirmação, que é teste defensivo do próprio código.

- `tarefa3/casos/xss-pavimentos.json` regerado com o código atual: **recusado** (`ValueError: opcoes[0].volumes[0].pavimentos deve ser número finito.`). O `tarefa3/browser.cjs` ainda acusa 2 tags porque abre o HTML **gravado antes** do conserto: não é defeito atual.
- Sondagens novas no `estudo-exemplo`, com `<img src=x onerror=alert(1)>`: chave extra em `lote` → gerado, 0 tags ativas; chave extra em `metricas` → recusado; payload como **nome de chave** em `lote` e em `zona.parametros` → 0; incerteza nova → 0; `frente` ausente + `observacoes` com payload → 0.
- `test_relatorio.py::test_payload_em_todas_as_folhas_dos_oito_estudos` troca **toda folha** (qualquer tipo, inclusive números, booleanos e null): 6.519 mutações, 5.029 recusas, 1.490 HTML sem tag ativa.
- Tela: `testar.cjs` com 3 mutações, zero `dialog`; os 71 casos da revisão 2 carregados na tela: 0 alertas.

**Parecer da central:** a parte de código do Portão 1B pode ser fechada. Continuam abertos os portões 1C (conferência por profissional; pacote pronto em `conferencia/PACOTE-ARQUITETO.md`), 1D e 1E.

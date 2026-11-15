# Tarefa 6 — Visual

- A tela e o relatório identificam a revisão pelo SHA-256 dos bytes do estudo e pela versão do motor.
- O link de impressão confere o hash do relatório; revisões divergentes geram aviso.
- Aviso de volume hipotético fica visível na tela junto da maquete e perto das figuras impressas.
- Alertas existentes seguem no fluxo da maquete, sem depender de hover.
- Testes: `python -I -X utf8 viabilidade/relatorio/test_relatorio.py` (5 passaram) e `node --check viabilidade/visual/testar.cjs` (passou).
- HTMLs em `relatorio/saida/` não foram regenerados; a central pode regenerá-los após o motor.

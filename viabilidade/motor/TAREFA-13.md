# Tarefa 13 do Motor: um comando do lote ao relatório (V1-001)

**Quem:** Codex (Motor).
**Galho:** `feat/viabilidade-lote` (já em checkout).
**Onde mexer:** só em `viabilidade/motor/`.
**Não fazer:**
- não commitar;
- não alterar `motor.py`, `gerar.py`, o terreno, o relatório, a tela nem o `conferir.py`.

## Por quê

Agora existem as três peças, cada uma com o seu comando:
- `terreno/novo_lote.py`: lote do cadastro → lote do contrato (veja `terreno/RELATORIO-4.md`);
- `motor/gerar.py`: lote + zona → estudo;
- `relatorio/relatorio.py --estudo --saida`: estudo → HTML.

O usuário quer **um comando só**.

## O que fazer

`viabilidade/motor/estudar.py`

```
python -I -X utf8 viabilidade/motor/estudar.py --base completo --indices 30516 --zona SC-Z4 --pasta <destino>
  [--premissas premissas.json]
```

1. **Encadear as três peças.**
   - Importe as funções, não chame subprocesso, se o código deixar sem gambiarra. Se não der, use subprocesso e diga o porquê.
   - Grave na `<pasta>`:
     - `lote.json`;
     - `estudo.json`;
     - `relatorio.html`;
     - `resumo.txt` (5 a 10 linhas: lote, área, zona "informada, não conferida", domínio, quantas opções, quantas ausentes com o motivo, revisão do estudo = 12 primeiros caracteres do sha256 do `estudo.json`).
2. **Pasta de destino.**
   - Não sobrescreva uma pasta que já tem arquivos: erro claro.
   - Se uma etapa falhar, apague o que essa execução criou (nada de pasta meio pronta) e mostre a mensagem de erro da etapa que falhou (a do `novo_lote` já diz o motivo).
3. **Revisão.** O `relatorio.html` tem que trazer a mesma revisão do `estudo.json`, como na tarefa 6 do Visual (`<meta name="estudo-sha256">`). Confira no teste.
4. **Teste.** `viabilidade/motor/test_estudar.py`, rodando numa pasta temporária:
   - (a) `completo/30516` com `SC-Z4` sai com as mesmas opções e métricas de `motor/exemplos/pilotos/SC-completo-30516.json`, ignorando campos de origem do lote;
   - (b) um lote fora dos pilotos sai completo, com os 4 arquivos;
   - (c) recusas que não deixam pasta: índice inexistente, zona inexistente, pasta já com arquivos;
   - (d) a revisão bate entre o estudo e o relatório.
5. **Tempo** de ponta a ponta para um lote: anote no relatório.

Rode `python -I -X utf8 viabilidade/motor/test_estudar.py` e `python -I -X utf8 viabilidade/motor/test_motor.py`; os dois têm que passar.

## Relatório

`viabilidade/motor/RELATORIO-13.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Motor tarefa 13 pronta"`.

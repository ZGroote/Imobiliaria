# Tarefa 5 do Visual — Portão 1B (tela e relatório)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b` (já está nele). **Autorizado pelo usuário em 15/11.**
Mexa só em `viabilidade/visual/` e `viabilidade/relatorio/`. Não commite.
**Em paralelo**, o Codex do motor mexe em `viabilidade/motor/` e no `README.md`: não toque neles.

Leia: `viabilidade/VERIFICACAO-1A.md` (VF-009, §5.1), `viabilidade/PRD-V1-COMERCIAL.md` §4.2 e o contrato v5 abaixo (o motor 0.8.0 vai gerar; os JSONs v4 atuais não têm esses campos e **têm que continuar funcionando**).

## Contrato v5 (campos opcionais novos)

```json
"opcoes_ausentes": [{"id": "C", "nome": "Lâmina baixa",
  "motivo": "impossivel" | "busca_inconclusiva" | "dados_insuficientes" | "erro", "detalhe": "..."}],
"criterio_escolha": {"ordem": ["..."], "texto": "frase curta"}
```

Rótulos em pt-BR: impossível pelas regras informadas · a busca não encontrou (não está provado que não existe) · faltam dados · erro de cálculo.

## O que fazer

1. **Relevo na tela (VF-009)** — `visual/index.html`: quando `lote.relevo` existir, mostrar cota mínima/máxima, declividade, fonte e resolução, **mais o aviso fixo**: "Relevo aproximado (modelo de superfície de ~30 m): não substitui levantamento topográfico; a maquete assenta os volumes em terreno plano." Sem `lote.relevo`, mantenha a frase atual.
2. **Opções ausentes (PRD §5.1 / V1 §4.2)** — na tela e no relatório, listar cada `opcoes_ausentes` com o rótulo do motivo e o detalhe, no mesmo fluxo dos alertas (nada escondido em hover). Sem o campo (v4), continua como hoje (frase das `incertezas`).
3. **Critério de escolha (§5.2)** — onde aparecer qualquer destaque da opção principal, mostrar `criterio_escolha.texto`. Sem o campo, não destaque nada como "melhor".
4. **Relatório** — `relatorio/relatorio.py`: aviso fixo de precisão do relevo no bloco de relevo (mesmo texto do item 1), **sempre** que houver relevo, sem depender de `lote.observacoes`; opções ausentes e critério como na tela. `test_relatorio.py` com testes novos: v4 sem os campos, v5 com os 4 motivos, aviso do relevo presente.
5. **Teste do navegador** — amplie `visual/testar.cjs` para: relevo com aviso, os 4 motivos, arquivo v4 sem os campos. Você não consegue abrir o Chrome no sandbox: só `node --check`. A central roda.

Para testar antes do motor novo, crie fixtures v5 em `visual/` ou `relatorio/` (cópias de pilotos com os campos acrescentados à mão).

## Relatório

`viabilidade/visual/RELATORIO-5.md`, até 12 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 5 pronta"`.

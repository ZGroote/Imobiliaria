# Tarefa 12 do Visual — mostrar o domínio de validade (contrato v5, campo `dominio`)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/` e `viabilidade/relatorio/`. Não commite (só você não commita; a central commita).
Em paralelo, o Motor está criando o campo na `viabilidade/motor/TAREFA-11.md` (leia o formato lá). Não toque em `viabilidade/motor/`.

```json
"dominio": {"status": "dentro" | "fora" | "dados_insuficientes", "motivos": ["..."], "versao": "dominio-0.8"}
```

1. **Tela:** um selo junto do resumo do estudo:
   - `dentro`: "Dentro do domínio testado do motor (dominio-0.8)", discreto;
   - `fora`: **destaque de alerta** "Fora do domínio testado: resultado não validado; encaminhar a profissional", com os motivos listados;
   - `dados_insuficientes`: alerta com os motivos.
   Sem o campo (arquivos antigos), nada aparece.
2. **Relatório:** o mesmo selo na capa; com `fora`, também no rodapé de cada página.
3. **Testes:** fixtures com os 3 estados + sem o campo, em `test_relatorio.py` e `testar.cjs` (celular e desktop: o alerta `fora` aparece sem rolar).
4. `python -I -X utf8 viabilidade/relatorio/test_relatorio.py` e `node --check`. O Chrome a central roda.

Relatório: `viabilidade/visual/RELATORIO-12.md`, até 6 linhas, com a lista dos arquivos alterados. Depois: `maestri ask "Claude Code" "Visual tarefa 12 pronta"`.

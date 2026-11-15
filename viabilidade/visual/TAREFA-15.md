# Tarefa 15 do Visual: origem da zona em lote novo

**Quem:** Codex (Visual).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/visual/` e `viabilidade/relatorio/`.
**Não fazer:**
- não commitar;
- não tocar em `motor/` nem em `terreno/` (estão sendo mexidos).

## Problema

Lotes novos (`terreno/novo_lote.py`, veja `terreno/RELATORIO-4.md`) chegam com `zona_origem` de dois tipos novos:
- `"informada_pelo_usuario"`;
- em breve, `"sugerida_pelo_mapa"`, com um bloco `lote.zona_sugestao` (`metodo`, `proporcao_por_zona`, `distancia_divisa_m`, `alternativas`, `motivo_duvida`).

Hoje a tela (`index.html`, por volta da linha 205) mostra "origem não informada ou não reconhecida" para esses lotes.

## O que fazer

1. **Rótulos na tela e no relatório:**
   - `informada_pelo_usuario`: "zona informada por quem pediu o estudo · não conferida";
   - `sugerida_pelo_mapa`: "zona sugerida pela leitura automática do mapa do Plano Diretor · não conferida", mais as alternativas e o motivo de dúvida quando houver.
   - O aviso fica no mesmo destaque amarelo de hoje, visível no celular sem rolar.
   - Nenhum dos dois estados pode aparecer como conferido.
2. **Validação.** `zona_sugestao` é opcional. Se vier, valide o tipo como os outros campos e escape tudo, como na tarefa 14: os textos vêm de fora.
3. **Testes.**
   - `test_relatorio.py`: os 2 rótulos; `zona_sugestao` com texto malicioso; o teste das 6.519 folhas continua passando.
   - `testar.cjs`: carregar um estudo com cada origem e conferir o texto.
   - Faça as fixtures a partir de um piloto, trocando só a origem.

Rode `python -I -X utf8 viabilidade/relatorio/test_relatorio.py` e `node viabilidade/visual/testar.cjs`, se o seu sandbox abrir o Chrome; senão, rode só `node --check`, que a central roda o resto.

## Relatório

`viabilidade/visual/RELATORIO-15.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 15 pronta"`.

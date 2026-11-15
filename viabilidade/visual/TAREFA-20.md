# Tarefa 20 do Visual: página de resultados da varredura

**Quem:** Visual.
**Galho:** `viabilidade/lote-livre` (não troque de galho).
**Onde mexer:** só em `viabilidade/visual/`.
**Não fazer:**
- não commitar;
- não mexer no motor nem no terreno.

## Contexto

`motor/varrer.py` (veja `motor/RELATORIO-20.md`) grava numa pasta:
- `varredura.csv`, em UTF-8 com BOM, com as colunas de `COLUNAS` no `varrer.py`;
- `RESUMO.md`;
- `lotes/<índice>/estudo.json` e `relatorio.html`.

## O que fazer

1. **`visual/varredura.html?pasta=<caminho relativo>`** lê o `varredura.csv` da pasta. Valide o caminho como na tarefa 17: só caminho relativo e da mesma origem.
2. **Tabela.**
   - Uma linha por lote, já na ordem do CSV, ordenável por coluna e com filtro por status (estudo / recusa / erro) e por zona.
   - Cada lote estudado tem o link "abrir maquete", que abre `index.html?estudo=<pasta>/lotes/<índice>/estudo.json`.
   - Recusas e erros mostram o motivo inteiro.
3. **Aviso fixo no topo,** visível no celular sem rolar:

   "Varredura automática: zona e áreas especiais sugeridas pela leitura do mapa, não conferidas. Não é lista de lotes à venda nem garantia de aprovação."

   Mostre também as contagens: estudados, recusados e erros.
4. **Segurança.** Todo texto do CSV vem de fora: escape tudo, e nada de `innerHTML` com dado. O parser de CSV tem que tratar aspas e vírgulas dentro do motivo. Use um parser pequeno próprio ou um já presente no repositório, sem biblioteca nova pela internet.
5. **Teste no `testar.cjs`.**
   - Gere uma varredura pequena (raio de 40 m no 30516, como o `test_varrer.py`) numa pasta temporária dentro de `visual/`, apagada no fim.
   - Confira: contagens, link que abre a maquete certa, ordenação e filtro.
   - Um CSV adulterado com `<img onerror>` no motivo não executa nada.
   - `?pasta=https://...` é recusado.

Rode `node --check`. Se conseguir, rode também o Chrome (`VISUAL_URL=http://127.0.0.1:8787/viabilidade/visual/`).

## Relatório

`viabilidade/visual/RELATORIO-20.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 20 pronta"`.

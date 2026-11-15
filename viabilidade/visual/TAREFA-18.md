# Tarefa 18 do Visual: VGV pelo preço digitado na tela

**Quem:** Visual.
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/visual/`.
**Não fazer:**
- não commitar;
- não mexer no motor nem no relatório.

## Por quê

Quase todo estudo sai com "VGV estimado: Informe o preço", porque `premissas.preco_venda_m2_privativo` vem nulo. Quem olha a tela quer testar preços na hora.

## O que fazer

1. **Campo "Preço por m² privativo (R$)"** perto do resumo, vazio por padrão.
   - Ao digitar, cada opção mostra "VGV estimado (preço digitado na tela)" = área privativa da opção × preço.
   - O valor do JSON nunca é alterado. A revisão do estudo continua a mesma, e o rótulo deixa claro que o preço veio da tela, não do estudo.
2. **Se o estudo já traz preço:** mostre o do estudo e use o campo só como simulação. Os dois ficam visíveis, cada um com o seu rótulo.
3. **Validação.**
   - Aceite "8.500", "8500" e "8500,50".
   - Recuse negativo, zero, texto e valor absurdo (acima de R$ 200 mil/m²), com mensagem curta.
   - Use `Intl` pt-BR para formatar.
4. **Teste (`testar.cjs`):**
   - digitar um preço → VGV de cada opção = área privativa × preço (tolerância de R$ 1);
   - comparação lado a lado também mostra o VGV;
   - preço inválido → mensagem;
   - a revisão não muda.

Rode `node --check viabilidade/visual/testar.cjs`; se conseguir, rode o Chrome também (servidor: `VISUAL_URL=http://127.0.0.1:8787/viabilidade/visual/`, já no ar).

## Relatório

`viabilidade/visual/RELATORIO-18.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 18 pronta"`.

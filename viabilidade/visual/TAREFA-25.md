# Vitrine com os terrenos vazios: teste solto dos números e estudo completo sem garagem (Visual, 17/11)

**Onde:** direto na worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Mexa só em `viabilidade/visual/vitrine.html`, `viabilidade/visual/index.html` e no `testar.cjs`. Não commite: a central commita.

## O que mudou

A pasta `viabilidade/projetista/vitrine/` agora tem os **6 terrenos vazios** (tarefa 32 do Terreno + tarefa 15 do Motor). Quatro deram prédio (`status: ok`) e dois pequenos (414 e 426 m²) saíram com `status` de falha e um `motivo` ("o pavimento mínimo do gerador não cabe..."). Nenhum terreno é o mesmo de antes; o antigo terreno 6 e a frase "altura máxima" sumiram. O `limitante` agora fala em "Parou no CA máximo do terreno..." e às vezes em "outorga onerosa".

## O que fazer

1. **`testar.cjs` sem amarrar terreno nem frase.** Leia o `indice.json` e os `resumo.json` e confira que o que a ficha mostra é **o texto que está no arquivo**: o `limitante` da versão escolhida aparece no bloco "Por que parou aqui"; vagas `null` mostram a `nota`; nenhum "null"/"NaN" na ficha. Nada de número, de "terreno 6" ou de frase escrita à mão no teste.
2. **Terreno que falhou:** aparece no mapa e na lista com o `motivo` (texto do arquivo), sem quebrar a página e sem botão de estudo. Se já for assim, só teste.
3. **`index.html` aceitando vagas `null`.** O link "abrir estudo completo" do estudo sem térreo quebra porque o `index.html` exige vagas com número. Onde vier `valor: null` com `nota`, mostre a nota ("sem garagem") e siga. Os testes do `index.html` que exigiam número finito passam a aceitar `null` **só** quando há `nota`; sem nota, continua erro.
4. Faixa "Estudo preliminar" continua. Nenhuma conta nova no navegador.

## Prova

- `testar.cjs` passa inteiro, com os ladrilhos bloqueados, sem erro no console e sem rolagem lateral no celular.
- Abrir o estudo completo (sem térreo) de um terreno `ok` pela vitrine funciona: print `viabilidade/visual/evidencias/tarefa25-estudo.png`.
- Print `viabilidade/visual/evidencias/tarefa25-vitrine.png` (desktop, ficha de um terreno `ok`).
- Relato curto em `viabilidade/visual/RELATORIO-25.md`.
- Ao terminar: `maestri ask "Claude Code" "Visual tarefa 25 pronta"`.

## Regras

- Não toque em `motor/`, `terreno/`, `projetista/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de dependência nova. Não publique nada.

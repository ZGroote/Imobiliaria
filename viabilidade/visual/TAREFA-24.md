# Vitrine: "por que parou" e "sem garagem" na ficha (Visual, 17/11)

**Onde:** direto na worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Mexa só em `viabilidade/visual/vitrine.html` e no `testar.cjs`. Não commite: a central commita.

## Problema

O `resumo.json` (tarefa 14 do Motor) ganhou dois campos que a ficha da `vitrine.html` ainda não mostra:

1. **`limitante`** em `numeros` e em `numeros_terreo`: `{"andares": "...", "unidades": "..."}`, frases prontas em português ("O recuo cresce com a altura: o andar entre 6 e 9 m não cabe...", "Chegou na altura máxima do terreno (64,5 m)...").
2. **Vagas sem térreo:** `vagas = {"valor": null, "unidade": "vagas", "nota": "estudo sem térreo: sem garagem"}`. Hoje a ficha mostraria "null vagas" ou "— vagas".

## O que fazer

1. Abaixo dos números, um bloco curto **"Por que parou aqui"** com as duas frases do `limitante` da versão escolhida (sem térreo / com térreo). Trocar o botão do térreo troca as frases junto. Sem `limitante`, o bloco não aparece. Copie o texto como vem: não reescreva nem invente.
2. Número com `valor: null`: mostre a `nota` no lugar do número ("sem garagem"), nunca "null", "NaN" ou "0".
3. A faixa "Estudo preliminar" continua. Nenhuma conta nova no navegador.

## Prova

- `testar.cjs` com os ladrilhos bloqueados: terreno 1 sem térreo mostra a frase do recuo e "sem garagem"; com térreo, as vagas viram número; o terreno 6 mostra a frase da altura máxima; nenhum texto "null"/"NaN" na ficha; sem erro no console; celular sem rolagem lateral. Os testes de antes continuam passando.
- Print `viabilidade/visual/evidencias/tarefa24-ficha.png` (desktop, terreno 1, sem térreo).
- Relato curto em `viabilidade/visual/RELATORIO-24.md`.
- Ao terminar: `maestri ask "Claude Code" "Visual tarefa 24 pronta"`.

## Regras

- Não toque em `motor/`, `terreno/`, `projetista/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de dependência nova. Não publique nada.
- A vitrine vai mudar de terrenos em breve (lotes vazios, tarefa 32 do Terreno): não amarre o teste a números, só às frases e ao formato.

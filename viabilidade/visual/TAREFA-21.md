# Visualizador: cores da prévia do projetista + painel da avaliação (Visual, 17/11)

**Onde:** direto na worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Você tem acesso a ela pelo `--add-dir`. Mexa só em `viabilidade/visual/` dessa worktree. **Não mexa** no `index.html` da worktree `imobiliaria-viabilidade`: ele faz parte da pilha de PRs #125 a #128. Não commite: a central commita.

Os agentes Claude estão mexendo em `viabilidade/projetista/*.py`: não toque neles.

## Contexto

O Projetista gera um pavimento, e o `viabilidade/projetista/para_vista.py` transforma esse pavimento num estudo que este `index.html` já abre (`?estudo=`). Os exemplos do piloto 22421 estão prontos em `viabilidade/projetista/exemplo-22421/`:

- `estudo-previa.json`: a prévia. Tem uma opção `projetista`, com volumes de `uso` igual a `unidade`, `circulacao` e `nucleo`. Logo virão também `hall` e `garagem`.
- `avaliacao-01.json`: a avaliação selada da revisão 01. Use só estas chaves de `sintese`: `sintese` (por exemplo `HIPOTESE_PRELIMINAR`), `regra_da_precedencia`, `dominios` (cada um com `estado`, `no_escopo`, `contagem`, `pendentes` e `required_actions`), `motivos_trava`, `fora_do_escopo` e `aviso`. O resto do formato vai mudar.

Hoje todos esses volumes saem no mesmo verde (linha ~388), e não dá para distinguir unidade, corredor e núcleo.

## O que fazer

1. **Cores por `uso`:** `unidade`, `circulacao`, `nucleo` e `hall` ganham cores próprias e discretas, coerentes com a paleta atual. O que já existe continua igual: `garagem` e subsolo em lilás, `embasamento` em cinza, parede cega em azul e o resto no verde de hoje. Ponha na legenda só os usos que aparecem no estudo aberto. **Os estudos antigos do motor têm que sair idênticos.** Rode a medição ou a varredura que você já usa e mostre isso.
2. **Painel da avaliação, opcional:** `?estudo=...&avaliacao=<arquivo>`.
   - Valide o arquivo antes de usar, com mensagem clara se ele for inválido, como no `validar`.
   - Mostre a síntese em destaque, a regra que decidiu, a tabela de domínios (estado, se está no escopo, o que está pendente e o que fazer), os motivos de trava e o aviso **sempre visível**.
   - Sem `avaliacao=`, o visualizador fica exatamente como hoje.
   - Nunca escreva "viável" nem "aprovado". Use só os nomes de estado que vierem no arquivo.
3. **Não confira o selo no navegador**: isso é do Python. Diga no painel: "Selo não conferido aqui; confira com `avaliacao_valida`".

## Prova

- Os prints com e sem `avaliacao=` do 22421 e um print de um estudo antigo do motor sem mudança, em `viabilidade/visual/evidencias/` desta worktree.
- Os testes que você já tem (`testar.cjs` ou similar) passando.

## Regras

- Nada de rede externa; um servidor local para os prints pode. Não mexa em `.github/`, config, hook nem fora de `viabilidade/visual/` da worktree do projetista.
- Relato curto em `viabilidade/visual/RELATORIO-21.md`, nessa worktree.
- Ao terminar: `maestri ask "Claude Code" "Visual tarefa 21 pronta"`.

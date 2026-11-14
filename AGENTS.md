# Regras para os agentes (Codex e Claude)

Vale para os dois. O Codex lê este arquivo direto; o Claude lê pelo `CLAUDE.md`, que importa este.

## Idioma

Responder em português do Brasil, em linguagem simples.

## Ao começar

Rode:

```
python -I tools/quem_mexeu.py
```

Ele mostra o que está solto no git (mexido e não commitado) e qual agente, Codex ou Claude, mexeu por último em cada arquivo, em qual conversa. Se o outro agente deixou trabalho pendente nos arquivos que você vai tocar, avise o usuário antes de mexer.

## Commits

Todo commit feito por agente termina com a assinatura dele:

- Codex: `Co-Authored-By: Codex <noreply@openai.com>`
- Claude: `Co-Authored-By: Claude <noreply@anthropic.com>` (ou a linha com o nome do modelo)

O hook `tools/git-hooks/prepare-commit-msg` coloca a assinatura sozinho quando reconhece o agente. Escreva mesmo assim: o hook é a rede, não a regra.
Ele roda de `.git/hooks/` (vale para todas as worktrees). Mudou o hook? Copie de novo:

```
cp tools/git-hooks/prepare-commit-msg .git/hooks/
```

## Ao terminar

Não deixe arquivo solto calado: commite (se o usuário autorizou) ou diga no fim da conversa o que ficou sem commit.

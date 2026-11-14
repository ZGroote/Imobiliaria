# Estado da central (pra retomar)

Atualizado: 14/11/2026, ~13h. Galho `feat/viabilidade` (worktree `Desktop/imobiliaria-viabilidade`), enviado ao GitHub a cada entrega. O usuário autorizou commit + push por entrega. O repo está PÚBLICO e o usuário vai voltar a privado no fim.

## Equipe (andar "Viabilidade" no Maestri, banda "Equipe Viabilidade")

| IA | Modelo / conta | Situação |
|---|---|---|
| Lei | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 (retoma por `lei/TAREFA.md` + arquivos) |
| Terreno | Codex Astra high / trabalho | Livre. TAREFA-2 entregue e commitada (7 pilotos, v4) |
| Motor | Claude **Sonnet** high / jaogroote | Livre. TAREFA-3 entregue (v0.5.0, defeitos da auditoria). Pendentes dele: MÉDIA 10 (teto de altura/subsolo), 13, BAIXA 16, lentidão (cache de `_centros`) |
| Visual | Codex **Luna** medium / trabalho (18% da semana) | **Trabalhando** na `visual/TAREFA-2.md` (7 pilotos, CA null, incertezas) |
| Produto | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 |
| Conferencia | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 |
| Relatorio | Antigravity (Gemini 4 Argon), **cópia isolada** `Desktop/imobiliaria-viabilidade-gemini`, galho `exp/viabilidade-gemini` | **Trabalhando** em `viabilidade/relatorio/TAREFA.md` (lá): relatório HTML de 1 página por opção. A central revisa e traz pro principal só o que prestar (copiar a pasta `relatorio/`, nunca merge do galho) |
| Auditor | Antigravity (Gemini 4 Argon) | **Trabalhando** na `auditoria/TAREFA-2.md` (conferir consertos do motor v0.5.0) |

Regra de modelos (aprovada 14/11): pesquisa e conferência no Antigravity (cota Gemini/Claude/GPT dele); programação em Claude/Codex; central no Opus. Antigravity não assina commit: só escreve na pasta dele e a central commita. Ajudantes (subagentes) só quando houver partes separadas. Esforço (usuário, 14/11): **médio** no simples (ajuste de tela, pesquisa curta, tarefa bem definida); **alto** no Motor, Auditor, Conferência e em investigação de defeito.

## Ao chegar um relatório

Rodar `python -I -X utf8 viabilidade/conferir.py` (testes de todas as frentes + arquivos soltos, sem gastar IA; só abrir o relatório se algo falhar), commitar só a pasta da frente, `git push`, atualizar `maestri floor status --floor "Viabilidade"`.

## Pendências da central

1. **Auditor/QA**: FEITO no Antigravity (Gemini), não no Codex. O "AI: Out of credits" na barra do Antigravity é só rótulo: ele responde. O Antigravity também tem cota de modelos Claude e GPT, que dá pra usar pra poupar Claude e Codex.
2. **Economia de uso**: APROVADA e aplicada em 14/11 (ver regra acima). Falta trocar o Motor pro Sonnet quando ele entregar. IAs Claude → Sonnet (Opus só na central); ajudantes só quando necessário e em Haiku; Codex Luna pra tela/ajuste e Astra pro Auditor; esforço médio no rotineiro (o usuário tinha pedido alto em tudo, então só mudar o esforço se ele confirmar). Trocar cada IA só quando ela entregar (reabrir = perde a conversa, retoma pelo TAREFA.md).
3. Esperando Auditor (AUDITORIA-2.md) e Visual (TAREFA-2).
4. Quando o Terreno entregar os lotes do Eixo e da Z2: Motor roda os 7 pilotos e o Visual mostra.
5. Pra conferência humana (arquiteto de São Carlos): Z5A/Z5B, Z6B, Z6E; zona dos lotes 22421 (fronteira Z1/Z2) e 22426 (Z1 ou Eixo); decretos com link quebrado (`BLOQUEIOS.md`).

## Economia (14/11, revisão externa aplicada)

- Tarefa nova pra uma IA que terminou: mandar `/clear` antes (sessão limpa = mais barato); o contexto mora no TAREFA.md e no README.
- Relatório da IA: 1 linha + `RELATORIO.md` na pasta (regra no README).
- IA parada não gasta: só mandar tarefa quando a dependência estiver resolvida.
- Lembrete automático da central: de hora em hora (as IAs acordam a central quando entregam).
- **Repo público:** o usuário decidiu (14/11) manter público. Commit + push a cada entrega.

## Armadilhas já vistas

- Mensagem longa pelo `maestri ask` chega cortada no Codex: gravar em arquivo e mandar "leia o arquivo".
- Codex às vezes fica na tela de um ajudante (sem entrada): limpar com Ctrl+U, ← abre a lista de agentes, Enter na sessão "Ready".
- Aprovar permissão de outra IA é com o usuário (o classificador bloqueia a central).
- No Git Bash, `/effort` vira caminho do Windows: `MSYS_NO_PATHCONV=1`.
- Texto cinza na caixa do Claude é sugestão automática, não pedido.

- **Commitar tudo que ficar pronto** (pedido do usuário): ao chegar entrega, testar, commitar e dar push na hora.

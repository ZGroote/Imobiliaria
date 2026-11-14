# Estado da central (pra retomar)

Atualizado: 14/11/2026, ~13h. Galho `feat/viabilidade` (worktree `Desktop/imobiliaria-viabilidade`), enviado ao GitHub a cada entrega. O usuário autorizou commit + push por entrega. O repo está PÚBLICO e o usuário vai voltar a privado no fim.

## Equipe (andar "Viabilidade" no Maestri, banda "Equipe Viabilidade")

| IA | Modelo / conta | Situação |
|---|---|---|
| Lei | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 (retoma por `lei/TAREFA.md` + arquivos) |
| Terreno | Codex Astra high / trabalho | **Trabalhando** na `terreno/TAREFA-2.md` (contrato v4 + lotes no Eixo e na Z2) |
| Motor | Claude Opus / jaogroote | **Trabalhando**: opção D piorou quando o recuo AFROUXOU (38→37). Ao entregar: reabrir no **Sonnet** (`--command "claude --model sonnet"`) |
| Visual | Codex **Luna** medium / trabalho | Livre. Trocado do Astra em 14/11 |
| Produto | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 |
| Conferencia | Antigravity (Gemini 4 Argon) | Livre. Trocada do Claude em 14/11 |
| Auditor | Antigravity (Gemini 4 Argon) | **Trabalhando** em `auditoria/TAREFA.md`: tentar quebrar o motor |

Regra de modelos (aprovada 14/11): pesquisa e conferência no Antigravity (cota Gemini/Claude/GPT dele); programação em Claude/Codex; central no Opus. Antigravity não assina commit: só escreve na pasta dele e a central commita. Ajudantes (subagentes) só quando houver partes separadas. Esforço (usuário, 14/11): **médio** no simples (ajuste de tela, pesquisa curta, tarefa bem definida); **alto** no Motor, Auditor, Conferência e em investigação de defeito.

## Ao chegar um relatório

Conferir (rodar o teste da frente), commitar só a pasta da frente, `git push`, atualizar `maestri floor status --floor "Viabilidade"`.

## Pendências da central

1. **Auditor/QA**: FEITO no Antigravity (Gemini), não no Codex. O "AI: Out of credits" na barra do Antigravity é só rótulo: ele responde. O Antigravity também tem cota de modelos Claude e GPT, que dá pra usar pra poupar Claude e Codex.
2. **Economia de uso**: APROVADA e aplicada em 14/11 (ver regra acima). Falta trocar o Motor pro Sonnet quando ele entregar. IAs Claude → Sonnet (Opus só na central); ajudantes só quando necessário e em Haiku; Codex Luna pra tela/ajuste e Astra pro Auditor; esforço médio no rotineiro (o usuário tinha pedido alto em tudo, então só mudar o esforço se ele confirmar). Trocar cada IA só quando ela entregar (reabrir = perde a conversa, retoma pelo TAREFA.md).
3. Quando o Terreno entregar os lotes do Eixo e da Z2: Motor roda os 7 pilotos e o Visual mostra.
4. Pra conferência humana (arquiteto de São Carlos): Z5A/Z5B, Z6B, Z6E; zona dos lotes 22421 (fronteira Z1/Z2) e 22426 (Z1 ou Eixo); decretos com link quebrado (`BLOQUEIOS.md`).

## Armadilhas já vistas

- Mensagem longa pelo `maestri ask` chega cortada no Codex: gravar em arquivo e mandar "leia o arquivo".
- Codex às vezes fica na tela de um ajudante (sem entrada): limpar com Ctrl+U, ← abre a lista de agentes, Enter na sessão "Ready".
- Aprovar permissão de outra IA é com o usuário (o classificador bloqueia a central).
- No Git Bash, `/effort` vira caminho do Windows: `MSYS_NO_PATHCONV=1`.
- Texto cinza na caixa do Claude é sugestão automática, não pedido.

- **Commitar tudo que ficar pronto** (pedido do usuário): ao chegar entrega, testar, commitar e dar push na hora.

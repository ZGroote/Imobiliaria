# Estado da central (pra retomar)

Atualizado: 14/11/2026, fim da tarde. Galho `feat/viabilidade` (worktree `Desktop/imobiliaria-viabilidade`), enviado ao GitHub a cada entrega. O usuário autorizou commit + push por entrega. O repo está PÚBLICO e o usuário vai voltar a privado no fim.

## Equipe (andar "Viabilidade" no Maestri, banda "Equipe Viabilidade")

| IA | Conta | Situação |
|---|---|---|
| Lei (Claude) | Padrão | Livre. Rodada 2 entregue e commitada |
| Terreno (Codex) | trabalho | **Trabalhando** na `terreno/TAREFA-2.md` (contrato v4 + lotes no Eixo e na Z2) |
| Motor (Claude) | jaogroote | **Trabalhando**: opção D perdeu 1 unidade quando o recuo AFROUXOU (38→37, 2.304→2.242 m²). Pedi a causa + teste de monotonia |
| Visual (Codex) | trabalho | Livre. Ajustes 2 entregues e commitados |
| Produto (Claude) | Padrão | Livre desde a 1ª entrega |
| Conferencia (Claude) | jaogroote | Livre. Conferência commitada (nenhum número errado) |

## Ao chegar um relatório

Conferir (rodar o teste da frente), commitar só a pasta da frente, `git push`, atualizar `maestri floor status --floor "Viabilidade"`.

## Pendências da central

1. **Auditor/QA (Codex)**: aprovado pelo usuário. Recrutar na conta Codex "Padrão" quando liberar (~17:36 de 14/11) com `--command "codex -c model_reasoning_effort=high"`. Papel: ler motor.py e tentar quebrar (lote triangular, minúsculo, zona sem limite, monotonia). Escreve só em `viabilidade/auditoria/`. Esperar o Motor fechar a opção D antes.
2. **Economia de uso**: proposta feita, AGUARDANDO resposta do usuário. IAs Claude → Sonnet (Opus só na central); ajudantes só quando necessário e em Haiku; Codex Luna pra tela/ajuste e Astra pro Auditor; esforço médio no rotineiro (o usuário tinha pedido alto em tudo, então só mudar o esforço se ele confirmar). Trocar cada IA só quando ela entregar (reabrir = perde a conversa, retoma pelo TAREFA.md).
3. Quando o Terreno entregar os lotes do Eixo e da Z2: Motor roda os 7 pilotos e o Visual mostra.
4. Pra conferência humana (arquiteto de São Carlos): Z5A/Z5B, Z6B, Z6E; zona dos lotes 22421 (fronteira Z1/Z2) e 22426 (Z1 ou Eixo); decretos com link quebrado (`BLOQUEIOS.md`).

## Armadilhas já vistas

- Mensagem longa pelo `maestri ask` chega cortada no Codex: gravar em arquivo e mandar "leia o arquivo".
- Codex às vezes fica na tela de um ajudante (sem entrada): limpar com Ctrl+U, ← abre a lista de agentes, Enter na sessão "Ready".
- Aprovar permissão de outra IA é com o usuário (o classificador bloqueia a central).
- No Git Bash, `/effort` vira caminho do Windows: `MSYS_NO_PATHCONV=1`.
- Texto cinza na caixa do Claude é sugestão automática, não pedido.

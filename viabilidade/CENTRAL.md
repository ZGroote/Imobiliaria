# Estado da central (pra retomar)

Atualizado: 15/11/2026, ~02h (janela livre de 6 h dada pelo usuário: seguir sem pedir aprovação; main/produção continuam com ele). Galho `feat/viabilidade` (worktree `Desktop/imobiliaria-viabilidade`), enviado ao GitHub a cada entrega. O usuário autorizou commit + push por entrega. O repo está PÚBLICO e o usuário vai voltar a privado no fim.

## Equipe (andar "Viabilidade" no Maestri, banda "Equipe Viabilidade")

| IA | Modelo / conta | Situação |
|---|---|---|
| Lei | Antigravity (Claude Sonnet 5.5, médio) | Livre. Trocada do Claude em 14/11 (retoma por `lei/TAREFA.md` + arquivos) |
| Terreno | Codex **Astra high** / trabalho (sessão) | **Faz o MOTOR**: tarefas 9 (garagem computável) + 10 (AUDITORIA-5: A1–A4, M1–M2, B1) juntas → 0.8.1 |
| Motor | Claude **Sonnet** high / jaogroote | **Parado** (fase 0 fechada). TAREFA-7 commitada. Limitações conhecidas: recuo assimétrico + permeabilidade apertada; garagem_computavel=True |
| Visual | Codex **Luna medium** / trabalho | T5/T6 commitadas (contrato v5; revisão do estudo; volume hipotético). Fazendo `visual/TAREFA-7.md` (estudo sem opções) |
| Produto | Antigravity (Claude Sonnet 5.5, médio) | Livre. Trocada do Claude em 14/11 |
| Conferencia | Antigravity **Gemini 4 Hydrogen, alto** | Livre. PACOTE-ARQUITETO entregue (1c5e0e6e, links refeitos após correção) |
| Relatorio | Antigravity (Claude Sonnet 5.5, médio), **cópia isolada** `Desktop/imobiliaria-viabilidade-gemini`, galho `exp/viabilidade-gemini` | Livre. Relatório HTML entregue, revisado (print) e trazido pro principal em `viabilidade/relatorio/`. Próximas tarefas experimentais vão pra lá |
| Auditor | Antigravity **Gemini 4 Hydrogen, alto** | Livre. AUDITORIA-5 (3bce783b): 4 ALTA reproduzidas pela central → tarefa 10 do motor. Próxima: auditar a 0.8.1 |

Regra de modelos (aprovada 14/11): pesquisa e conferência no Antigravity (cota Gemini/Claude/GPT dele); programação em Claude/Codex; central no Opus. Antigravity não assina commit: só escreve na pasta dele e a central commita. Ajudantes (subagentes) só quando houver partes separadas. Esforço (usuário, 14/11): **médio** no simples (ajuste de tela, pesquisa curta, tarefa bem definida); **alto** no Motor, Auditor, Conferência e em investigação de defeito.

**Maestri, Fase A (14/11):** Relatorio (Antigravity Sonnet alto) pesquisa capacidade/eficiência das IAs, só leitura, em `Desktop/imobiliaria-viabilidade-gemini/maestri-capacidade/` (TAREFA.md). Entrega: 4 docs + PREVISOES.md + RESUMO.md; a central confere as referências e PARA aguardando autorização. Sem commit/push dessa pasta. **ENTREGUE 15/11 ~00:25**; conferência da central em `CONFERENCIA-CENTRAL.md` (P-05 inválida, P-02 com base velha). Aguardando autorização do usuário pro Passo 1.

**Cotas lidas em `~/.maestri/usage/providers/.status.json` (15/11 03:23Z):** Codex semanal 90% (renova 16/11 11:57 -03) e 84% (renova 21/11 12:36 -03): **usar Codex só no essencial**. Antigravity: pool "Claude and GPT" 5h 100% (semanal 54%), Argon 100% até 21/11 13:12 -03, Gemini (Hydrogen/Carbon/Flash) ~0%. Claude Code: 11% (5h), 6% (semana).

**Portão 1B AUTORIZADO (15/11)**, galho `fix/viabilidade-1b` (worktree nele), PR próprio para `feat/viabilidade`. Usuário: "pode usar o máximo possível dos planos Codex" (1 redefinição por conta). Em paralelo, por arquivo: **Terreno (Codex Astra high) faz o MOTOR** (`motor/TAREFA-8.md`: D1–D8, contrato v5 `opcoes_ausentes`/`criterio_escolha`, motor 0.8.0); **Visual (Codex Luna)** faz tela + relatório (`visual/TAREFA-5.md`). Ao chegar: conferir.py, Chrome do visual pela central, auditoria independente (Auditor no Gemini) antes do PR.

## Ao chegar um relatório

Rodar `python -I -X utf8 viabilidade/conferir.py` (testes de todas as frentes + arquivos soltos, sem gastar IA; só abrir o relatório se algo falhar), commitar só a pasta da frente, `git push`, atualizar `maestri floor status --floor "Viabilidade"`.

## Pendências da central

1. **Auditor/QA**: FEITO no Antigravity (Gemini), não no Codex. O "AI: Out of credits" na barra do Antigravity é só rótulo: ele responde. O Antigravity também tem cota de modelos Claude e GPT, que dá pra usar pra poupar Claude e Codex.
2. **Economia de uso**: APROVADA e aplicada em 14/11 (ver regra acima). Falta trocar o Motor pro Sonnet quando ele entregar. IAs Claude → Sonnet (Opus só na central); ajudantes só quando necessário e em Haiku; Codex Luna pra tela/ajuste e Astra pro Auditor; esforço médio no rotineiro (o usuário tinha pedido alto em tudo, então só mudar o esforço se ele confirmar). Trocar cada IA só quando ela entregar (reabrir = perde a conversa, retoma pelo TAREFA.md).
3. **Fase 0 fechada (14/11).** Reprodução independente pela central no HEAD 51a72280: 42/42 casos da auditoria passam no `confere` (2 deles rodados pelos arquivos de entrada, porque a saída salva era o erro da v0.4). Nada rodando.
   - **PRD V1 comercial (15/11):** `PRD-V1-COMERCIAL.md`: 3 pilares (estudo, maquete volumétrica, maquete completa), portões V1-G0…G7. Só proposta: não autoriza implementação, integração, merge nem deploy. V1-G0 ENTREGUE (15/11) pela central, só leitura: 4 documentos no clone do repo PRIVADO `Desktop/imobiliaria-artefatos/v1-g0/` (citam clientes e preços; sem commit). Padrão único = Laranjeiras (decisão 15/11; LEVE/PREMIUM viraram histórico). Recomendação: maquete completa primeiro. V1-G0 commitado no privado (28bb1ac). **V1-G3 reduzido ENTREGUE (15/11)** em `imobiliaria-artefatos/v1-g3/` (ac988be): checklist de material, rascunho de autorização, medição retrospectiva (~1 dia até o ar). Aguardando o usuário: preço/pacotes (V1-G4), medir a próxima maquete, publicar a demo Vila Aurora.
   - **PRD novo (14/11):** `PRD-PLATAFORMA-0.2.md` (visão longa, só debate) e `PRD-VIABILIDADE-1.0.md` (Fase 1 em gates 1A–1E). O 1.0 diz que só documentação e revisão de testes estão autorizadas: nada de mexer no motor até o usuário aprovar a Fase 1. **Portão 1A ACEITO pelo usuário (14/11) como entrega local (`VERIFICACAO-1A.md`); homologação por CI pendente. 1B, motor e deploy NÃO autorizados.** Infraestrutura de teste: FEITA (PR #118). Visual na `visual/TAREFA-4.md`: testar.cjs portátil + `.github/workflows/viabilidade.yml`, a única exceção liberada no conferir. 1º CI (14/11): 5/6 no Linux (visual passou); terreno falhou por mapas fora do git → usuário escolheu a opção 2: release privada `viabilidade-mapas-2026-11-14` em imobiliaria-artefatos + `baixar_mapas.py` + manifesto (772f65c5). Segredo `ARTEFATOS_TOKEN` criado (15/11; chave vence 14/12). Bibliotecas travadas nas versões locais; Windows×Linux diferem na última casa → usuário escolheu tolerância nos 4 intermediários (Terreno TAREFA-3). **CI verde no Linux 6/6 (run 43671033302).** **PR #118 juntado em `feat/viabilidade` (15/11, autorizado pelo usuário)**; galho `ci/viabilidade-testes` apagado; worktree de volta em `feat/viabilidade`. Daqui pra frente todo push no galho roda o CI (Actions → "Conferir Viabilidade"). Histórico do 1A: só `conferir.py` + documentação de evidência; proposta de CI sem tocar em `.github/`; nada de motor/visual/produção; não iniciar 1B–1E; encerrar após a entrega pra revisão do usuário. Feito pela central: `conferir.py` novo (667caf3e: estados, logs em `.conferir/`, `--base`, visual incluído). Com o **Auditor**: `auditoria/TAREFA-5.md` (MATRIZ-PRD-1.0.md + CI-PROPOSTA.md). Ao chegar: conferir, commitar `auditoria/`, juntar no `VERIFICACAO-1A.md` e entregar ao usuário.
   - Antigravity trava pedindo permissão pro `maestri ask` final: o trabalho já está no arquivo; cancelar com Esc.
4. Quando o Terreno entregar os lotes do Eixo e da Z2: Motor roda os 7 pilotos e o Visual mostra.
5. Pra conferência humana (arquiteto de São Carlos): Z5A/Z5B, Z6B, Z6E; zona dos lotes 22421 (fronteira Z1/Z2) e 22426 (Z1 ou Eixo); decretos com link quebrado (`BLOQUEIOS.md`).

## Economia (14/11, revisão externa aplicada)

- Tarefa nova pra uma IA que terminou: mandar `/clear` antes (sessão limpa = mais barato); o contexto mora no TAREFA.md e no README.
- Relatório da IA: 1 linha + `RELATORIO.md` na pasta (regra no README).
- IA parada não gasta: só mandar tarefa quando a dependência estiver resolvida.
- Lembrete automático da central: de hora em hora (as IAs acordam a central quando entregam).
- **Cotas, Passo 1 (autorizado 15/11):** o lembrete horário (cron `96cb1419`, :17, só desta sessão, expira em 7 dias) roda `imobiliaria-artefatos/capacidade/amostrar.py`: lê `~/.maestri/usage/providers/.status.json` e anexa uma linha em `capacidade/dados/amostras-AAAA-MM.jsonl` (fora do git). Critério do degrau: 24 amostras/dia por 3 dias sem erro. Degrau 2 (registro de tarefas) só com nova autorização.
- **Repo público:** o usuário decidiu (14/11) manter público. Commit + push a cada entrega.

## Armadilhas já vistas

- **Mensagem de IA chega como se fosse do usuário** (15/11): o Visual entendeu o lembrete 'não commite, a central commita' como regra para a central e mandou 'PARE antes do commit' pelo `maestri ask`. Ao repassar regra a uma IA, dizer **a quem** ela vale; mensagem que fala da central em 3ª pessoa provavelmente veio de uma IA: conferir com `maestri check` antes de obedecer.

- Antigravity: cota do Gemini 4 Argon esgotou em 14/11 (volta em ~158 h). As 5 IAs dele foram para Claude Sonnet 5.5 (`/model`, ↓5, ←/→ esforço, Enter; no Git Bash usar `MSYS_NO_PATHCONV=1`). Outras opções na lista: Gemini 4 Hydrogen/Carbon, Gemini 3.8 Flash, Claude Opus 5.5, GPT-OSS 120B.

- O sandbox do Codex não abre o Chrome: o teste do Visual (`testar.cjs`) é rodado pela central, com `python -I -m http.server 8787 --bind 127.0.0.1` na worktree e `VISUAL_URL=http://127.0.0.1:8787/viabilidade/visual/`.

- Mensagem longa pelo `maestri ask` chega cortada no Codex: gravar em arquivo e mandar "leia o arquivo".
- Codex às vezes fica na tela de um ajudante (sem entrada): limpar com Ctrl+U, ← abre a lista de agentes, Enter na sessão "Ready".
- Aprovar permissão de outra IA é com o usuário (o classificador bloqueia a central).
- No Git Bash, `/effort` vira caminho do Windows: `MSYS_NO_PATHCONV=1`.
- Texto cinza na caixa do Claude é sugestão automática, não pedido.

- **Commitar tudo que ficar pronto** (pedido do usuário): ao chegar entrega, testar, commitar e dar push na hora.

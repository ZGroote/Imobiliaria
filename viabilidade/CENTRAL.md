# Estado da central (pra retomar)

Atualizado: 15/11/2026, ~02h (janela livre de 6 h dada pelo usuário: seguir sem pedir aprovação; main/produção continuam com ele). Galho `feat/viabilidade` (worktree `Desktop/imobiliaria-viabilidade`), enviado ao GitHub a cada entrega. O usuário autorizou commit + push por entrega. O repo está PÚBLICO e o usuário vai voltar a privado no fim.

## Equipe (andar "Viabilidade" no Maestri, banda "Equipe Viabilidade")

| IA | Modelo / conta | Situação |
|---|---|---|
| Lei | Antigravity (Claude Sonnet 5.5, médio) | Livre. Trocada do Claude em 14/11 (retoma por `lei/TAREFA.md` + arquivos) |
| Terreno | Codex **Astra high** / trabalho (sessão) | **Faz o MOTOR**. Livre (0.8.3 no 1B) |
| Motor | Claude **Sonnet** high / jaogroote | **Parado** (fase 0 fechada). TAREFA-7 commitada. Limitações conhecidas: recuo assimétrico + permeabilidade apertada; garagem_computavel=True |
| Visual | Codex **Astra high** (sessão) / trabalho | Livre. T13–T14 (segurança do relatório) no 1B |
| Produto | Antigravity (Claude Sonnet 5.5, médio) | Livre. Trocada do Claude em 14/11 |
| Conferencia | Antigravity **Gemini 4 Hydrogen, alto** | Livre. PACOTE-ARQUITETO entregue (1c5e0e6e, links refeitos após correção) |
| Relatorio | Antigravity (Claude Sonnet 5.5, médio), **cópia isolada** `Desktop/imobiliaria-viabilidade-gemini`, galho `exp/viabilidade-gemini` | Livre. Relatório HTML entregue, revisado (print) e trazido pro principal em `viabilidade/relatorio/`. Próximas tarefas experimentais vão pra lá |
| Auditor | Antigravity **Gemini 4 Hydrogen, alto** | Livre. AUDITORIA-5 (3bce783b): 4 ALTA reproduzidas pela central → tarefa 10 do motor. Próxima: auditar a 0.8.1 |
| Revisor | Codex **Astra high** / trabalho (era Padrão; trocado pelo limite de 5 h) | Livre. REVISAO-1..3 entregues; a TAREFA-4 foi recusada pelo filtro de segurança do Codex (a central fez a REVISAO-4) |

Regra de modelos (aprovada 14/11): pesquisa e conferência no Antigravity (cota Gemini/Claude/GPT dele); programação em Claude/Codex; central no Opus. Antigravity não assina commit: só escreve na pasta dele e a central commita. Ajudantes (subagentes) só quando houver partes separadas. Esforço (usuário, 14/11): **médio** no simples (ajuste de tela, pesquisa curta, tarefa bem definida); **alto** no Motor, Auditor, Conferência e em investigação de defeito.

**Maestri, Fase A (14/11):** Relatorio (Antigravity Sonnet alto) pesquisa capacidade/eficiência das IAs, só leitura, em `Desktop/imobiliaria-viabilidade-gemini/maestri-capacidade/` (TAREFA.md). Entrega: 4 docs + PREVISOES.md + RESUMO.md; a central confere as referências e PARA aguardando autorização. Sem commit/push dessa pasta. **ENTREGUE 15/11 ~00:25**; conferência da central em `CONFERENCIA-CENTRAL.md` (P-05 inválida, P-02 com base velha). Aguardando autorização do usuário pro Passo 1.

**Cotas lidas em `~/.maestri/usage/providers/.status.json` (15/11 03:23Z):** Codex semanal 90% (renova 16/11 11:57 -03) e 84% (renova 21/11 12:36 -03): **usar Codex só no essencial**. Antigravity: pool "Claude and GPT" 5h 100% (semanal 54%), Argon 100% até 21/11 13:12 -03, Gemini (Hydrogen/Carbon/Flash) ~0%. Claude Code: 11% (5h), 6% (semana).

**Portão 1B (código) FECHADO (15/11)**: PR #120 juntado em `feat/viabilidade` (3e4dd5b7), CI Linux verde (8m22s). Motor 0.8.3 (monotonia em 94 pares; garagem computável com aviso; opções ausentes classificadas; domínio de validade), contrato v5, tela/relatório (revisão do estudo, three local sem CDN, injeção corrigida com teste de 6.519 mutações). Revisões: AUDITORIA-5, REVISAO-1..4. **Próximo:** 1C depende do arquiteto (pacote pronto em `conferencia/PACOTE-ARQUITETO.md`); 1E: ver abaixo.

**Portão 1E (integração) — autorizado pelo usuário em 15/11.**
- **PR #121** `feat/viabilidade` → `main`, juntado em **186a0fd8**.
  - Só entram `viabilidade/` e o workflow próprio, mais duas classificações nos testes da main.
  - `tests/test_tamanho_versionado.py`: exceção para o tif Copernicus (1,9 MB).
  - `tests/test_dados_privados.py`: libera `viabilidade/terreno/dados/` e `viabilidade/visual/evidencias/`, com OK do usuário.
  - O `conferir.py` aceita essas 2 mudanças fora do módulo.
  - CI 4/4 verde (Node+Python, Painel, Emulador, conferir).
- **Deploy isolado:** canal `viabilidade-1e` do site `imobilaria-deccb-miniaturas`, que não é produção.
  - Endereço: https://imobilaria-deccb-miniaturas--viabilidade-1e-uewepmnh.web.app/visual/
  - Expira em 22/11 às 09:24.
  - Leva 20 arquivos: tela, three local, exemplo, 7 pilotos e 8 relatórios.
  - Responde com `noindex`.
  - O pacote foi montado fora do repositório (scratchpad, `viab-1e/`), no mesmo molde da apresentação.
- **Smoke:**
  - `testar.cjs` com `VISUAL_URL` apontando para o canal: PASS no desktop e no celular.
  - Os 20 arquivos no ar têm o mesmo sha256 dos locais.
  - O site no ar continua com 404 em `/visual/`.
- **Reversão:** reverter 186a0fd8 ou apagar o canal.
- **Falta a decisão de publicação, que é do usuário:** domínio, caminho e quem acessa.
- **Veredito da revisão (15/11): integração ACEITA; publicação pública BLOQUEADA.** Ordens:
  1. Preservar o canal isolado sem alterá-lo.
  2. Não publicar `/visual/` no domínio principal.
  3. Inspecionar os arquivos liberados nas exceções de privacidade.
     - **FEITO:** `conferencia/INSPECAO-PRIVACIDADE-1E.md`. São 89 arquivos, vistos um a um, com metadados e sha256. Nada privado.
  4. Avançar no 1C com o arquiteto e registrar as limitações que ficarem.
     - O pacote está pronto. Falta enviar; perguntei ao usuário quem envia.
  5. Voltar para a decisão de publicação depois dessas evidências.
- **Atenção:** reverter o merge ≠ desfazer o deploy. São operações diferentes; não executar nenhuma das duas sem ordem.
- **Documento explicativo** do sistema, para o usuário: https://claude.ai/artifact/2epdS1PHAF7EBNZpxcEhC5

**Trava de privacidade fechada (15/11, PR #123 → main a53f25aa).**
- As imagens da viabilidade passam por sha256 (`conferencia/imagens-inspecionadas.json`), não por pasta.
- Imagem nova ou alterada derruba o CI.
- Inspeção independente (Revisor, `revisao/REVISAO-5.md`): sem dado pessoal.
- Ressalvas para o usuário:
  - base de republicação dos mapas municipais;
  - lotes localizáveis (sem vínculo com cliente verificado).

**Lote livre (galho `feat/viabilidade-lote`, PR #122 em rascunho → `feat/viabilidade`).** 1C: o usuário vai ao arquiteto pessoalmente.
- Terreno T4 `novo_lote.py`: qualquer feição ou remembramento, com zona informada (5911fc3a).
- Motor T13 `estudar.py`: um comando do lote ao relatório (f6d6bb6d).
- Em andamento:
  - Terreno T5: zona sugerida pelo mapa;
  - Visual T15: rótulos das origens novas da zona;
  - Motor T14: `test_motor` abaixo de 120 s.
- **Lacuna conhecida:** lote novo não traz áreas especiais (aeroporto/AIA/AEI), então perde o alerta. Próxima tarefa do Terreno depois da T5.
- **Ritmo:** 3 a 4 frentes em paralelo; entre entregas, conferir só a frente que entregou; o completo fica no CI.
- **Entregas no galho até agora:** Terreno T5 zona auto (a9b98cd0), T6 áreas especiais (46c9f4a9), T7 `--ponto` (995f6739); Visual T15 (364a1024) e T16 acessibilidade (93378d7c); Motor T14 test_motor de 430 s para ~90 s (04c78042).
- **Contas (15/11, tarde):** os dois Codex estão esgotando ("trabalho" 99% na semana; "Padrão" 93% na janela de 5 h). O usuário pediu para usar mais Claude e Antigravity.
  - Terreno: Claude Code jaogroote.
  - Motor: Claude Code jaogroote.
  - Visual: Claude Code Padrão.
  - Revisor: Antigravity (Gemini 4 Hydrogen).
  - Os agentes reiniciados perdem o contexto: mandar o papel e onde estão os RELATORIO na primeira mensagem.
  - **Armadilha:** comando `/` não enviado (por exemplo `/status`) fica na caixa de entrada e gruda na mensagem seguinte. Conferir com `maestri check` se a tarefa começou ("Working" ou "esc to interrupt").

**PR #124 (`viabilidade/lote-livre` → main), 15/11.**
- Substitui o #122, que mostrava 105 arquivos de outras frentes porque o `feat/viabilidade` estava 12 commits atrás da main.
- Galho limpo a partir da main, commits em linha. Fora de `viabilidade/`, só o gatilho do CI.
- **Ordem do usuário para o merge:**
  1. CI verde no HEAD final;
  2. Revisor e Auditor entregues;
  3. achado ALTA corrigido e CI de novo;
  4. pedir autorização. Sem publicação em produção.
- **REVISAO-6 (Revisor):** sem quebra.
  - Achado 2 corrigido (Motor T17).
  - Achado 1 (área especial vazia sem menção) e Observação 3 (80% recusados por frente) estão na Terreno T10.
- **CI quebrou por scipy:** removido na Terreno T9 (4965cec9).
- **Rodada de 15/11 (tarde):**
  - AUDITORIA-6b (92ba6da6): 1 ALTA (ressalva sumia quando outro anexo acusava; leis de 2018/2019 fora dos mapas) → corrigida na Terreno T13, feita pelo Motor (007a4a42).
  - REVISAO-7 (e7a79f13): sem ALTA; os 4 ALTA anteriores conferidos (3 fechados, 1 parcial) → Terreno T14 (9 m do art. 80, contorno da subárea, cache entre processos).
  - Terreno T12 (fc1b070e): frente presumida pela borda da quadra (`regra: borda_de_quadra`).
  - Motor T21 (59a1b20c): um alerta só por opção para as áreas não verificadas; texto próprio da frente pela borda da quadra.
  - Terreno T14 (3cc2e9b5): 9 m do art. 80 no cálculo para lote dentro do tracejado; contorno da subárea pelo tracejado; cache tolerante a dois processos.
  - AUDITORIA-7 parte 1 (perguntas 4 e 5; arquivo sem commit até a parte 2): alertas agrupados OK; MÉDIA 75931 (frente pelo miolo da quadra) e BAIXA TopologyException → Terreno T15, feita pelo Visual (conta Padrão).
  - Motor T22: `conferir.py` jogava o stderr do http.server num cano não lido; no Windows enchia e travava o visual (no CI passa). Corrigido: `conferir.py` 8/8 no Windows.
  - Terreno T15 (db9eda3c, feita pelo Visual): frente principal pela borda = a mais perto do asfalto; vizinho inválido passa por make_valid.
  - **ALTA nova (RELATORIO-16, 69da7562):** os anexos 02/05/06/07 estão ~44 m a leste + escala/rotação N-S (erro 40–75 m); cadastro e malha batem com o OSM. Os 3,53 m eram só resíduo de 5 vértices do perímetro. Efeito: 74451 ganhou os 9 m sem estar na subárea; 75352 muda de Z2 para recusado. Central conferiu na sobreposição (c02p.png). → Terreno T17 (Visual): ≥12 cruzamentos por anexo, afim direta 31983→pixel, teste com 8 cruzamentos de verificação, cache com os JSON na chave. **Bloqueia o merge do #124.**
  - **Terreno T17 entregue (21b1330c):** afim direta por 21 cruzamentos; RMSE 2,9–3,2 m (máx. 6,2), 8 de verificação fora do ajuste a ≤6,8 m (antes 45–101 m). 74451 sai da subárea; 77015/77022/77375 dentro, 80172 fora; ponto do Auditor igual; 75352 recusado (divisa a 9,2 m); 22421 perde a Z2 das alternativas. Código revisado pela central. Resta texto velho "3,53 m" nos pilotos, `lei/FONTES.md` e pacote do arquiteto (tarefa à parte).
  - Motor T23 (Visual): 3 expectativas do `test_estudar.py` pós-T17 (conferir deu 7/8 só por isso). Entregue; `conferir.py` **8/8** na central. **ALTA do RELATORIO-16 fechada.** Falta pro merge: CI verde no HEAD e a parte 2 da AUDITORIA-7 (perguntas 1–3, travada no prompt de permissão do Auditor, que é do usuário).
  - CI verde em 61a1c88c (CI + Conferir Viabilidade). Terreno T18 (2bb1aea3) em andamento: os 7 pilotos foram lidos à mão em 14/11 com o ajuste antigo (40–100 m de erro); reconferir no lugar novo e trocar o texto "3,53 m". Se alguma zona anotada estiver errada, é achado que bloqueia o merge.
  - **T18 entregue:** os 7 pilotos conferem no lugar novo (nenhuma zona errada); 22421 de 0 → 12,9 m da divisa Z1/Z2, 22426 a ~3 m do traço do Eixo. Pacote do arquiteto e `lei/FONTES.md` com os erros novos. Pendência BAIXA, pós-merge: o `metodo` de `lotes-piloto.json` vem de `dados/zonas-anotar.py` com SHA256 fixo no teste; acrescentar a reconferência lá exige mexer em `dados/` e nos `ORIGINAIS`. Revisor T8 (df3edc7f) em andamento.
  - **REVISAO-8 (d6ba9791): aprovado, sem achados.** **AUDITORIA-7 completa: sem ALTA.** A MÉDIA (75931) e a BAIXA (TopologyException) eram da parte 1, no HEAD d9d48598, e já estão corrigidas pela T15 (central conferiu: frente principal do 75931 = [9, 0], 12,014 m). Pendência BAIXA, pós-merge: altura do art. 80 medida de z=0 e só por pavimentos (platibanda, caixa d'água, nível da via), já avisada no relatório. `conferir.py` 8/8. **Passos 1–3 da ordem do usuário cumpridos; falta o CI do HEAD final e a autorização do usuário para o merge na main (sem produção).**
  - Auditor parado no pedido de permissão do `maestri ask` final: cancelar é do usuário (o Esc da central foi bloqueado). Parte 2 (perguntas 1–3) sai depois.
  - **JUNTADO NA MAIN (15/11 20:51Z, autorizado pelo usuário só para integração):** merge **633ddaeb**, CI verde. Sem deploy (o repo não tem deploy automático). **NÃO autorizado:** deploy, produção, publicação de resultados.
- **Galho pós-merge `viabilidade/pos-124` (da main 633ddaeb), 15/11.** As 2 BAIXA que ficaram para depois do merge:
  - Terreno T19: `reconferencia` nos pilotos, fora do hash de `ORIGINAIS` (o `metodo` original fica como registro de 14/11).
  - Motor T24: altura do art. 80. Primeiro achar na lei como o gabarito é medido; senão, premissa `acrescimo_topo_m` + alerta de folga.
  - **T19 entregue (b236fec4):** reconferência só em `dados/anotacoes-zonas.json` (opção 2: no lote quebrava a linha de base do motor).
  - **T24 entregue (e3ecfafd):** COE art. 3º-IV mede do piso ao forro sem caixa d'água; art. 80 não diz a origem. Premissa `acrescimo_topo_m` 1,5 m só no gabarito de área especial + alerta de folga. Pilotos e linha de base iguais.
  - **T20 (medida):** 500 sorteados → 34% aceitos; sem frente 31% (periferia: malha de asfalto não cobre); zona incerta 22%; vizinho inválido 6,6%. Os 20 da REVISAO-6: sem frente de 80% para 25%.
  - **Decisão (com 2ª opinião do ChatGPT, portal `chatgpt.com`):** Terreno T21 = make_valid no vizinho + rua do OSM como 2ª fonte de frente com salvaguardas (tipo de via, paralelismo, ligada à rede, alerta em ambiguidade, `regra: rua_osm`). Testada de 5 m fora. Margem de 10 m fica. Motor T25 = investigar os 29 "cor sem zona segura" (só leitura).
  - **T25 entregue:** os 29 "cor sem zona" são texto do mapa por cima da zona (15) ou recusa certa (campus, branco, fora do mapa). Conserto A+B daria só 6/500 a mais (a divisa de 10 m pega o resto); **adiado** (zona errada é pior que recusar; ganho 1,2%). Fica na fila se a cobertura voltar a ser prioridade.
  - Terreno T21: OSM em `dados/osm-vias-sao-carlos.json.gz` (gzip, < 1 MiB, sem mexer no teste de tamanho da main). Motor T26: investigar se o relevo Copernicus (DSM, 30 m) serve.
  - **T26 entregue:** Copernicus (DSM 30 m) serve só pra triagem (declive ≥10% em 10% dos aceitos); nível absoluto carrega +5 m de prédio; lote − rua é estável (72% dentro de 1 m entre fontes). 77015 −3 a −5 m, 77022 +3 a +5 m da rua. Fonte melhor aberta: não há com licença (MDE-SP sem licença declarada). → Motor T27: só alerta (declive ≥10% ou |lote−rua| ≥2 m), conta não muda. Depois: Terreno grava `relevo.desnivel_lote_rua_m` no novo_lote (após a T21).
  - **REVISAO-9:** T19 e T24 aprovadas; 1 BAIXA (`acrescimo_topo_m` inválido passa calado sem gabarito) → Motor T28.
  - **T27 entregue:** alerta de relevo (declive ≥10% ou |lote−rua| ≥2 m), conta igual; mudou só o piloto 37607 e o SHA dele na linha de base.
  - **T21 entregue:** vizinho inválido consertado + rua do OSM como 2ª fonte de frente. Sorteio de 500: aceitos 171 → 214 (34,2% → 42,8%); rua_osm 31, 2 duvidosos na foto (44140, 53547), 1 estrada de terra (61394). Pilotos e T15 iguais. conferir 8/8. Fonte/licença OSM no `terreno/LOTES.md` (FONTES.md é só de leis).
  - → Motor T28 (alerta próprio pra `rua_osm` + BAIXA da REVISAO-9); Terreno T22 (grava `relevo.desnivel_lote_rua_m` no lote novo).
  - **T28 entregue:** alerta próprio pra frente `rua_osm`; `acrescimo_topo_m` validado sempre (BAIXA da REVISAO-9 fechada). Pilotos iguais. `test_estudar` só falha pelo campo novo da T22 em andamento (lista de alertas do lote novo) → ajuste pedido ao Motor.
  - **T22 entregue:** lote novo grava `relevo.desnivel_lote_rua_m` (DSM no centroide − mediana do asfalto a ≤25 m da frente). 26/214 aceitos (12%) com |desnível| ≥2 m ganham o aviso da T27; 53 sem asfalto perto ficam sem o campo. 77015 −5,0, 77022 +5,2. `lotes-piloto.json` NÃO ganhou o campo (30516 e 22421 dariam −2,4 → aviso): pilotos ficam como referência fixa. conferir 8/8.
  - **Retomada 15/11:** amostra ok (5 provedores); conferir 8/8; sem entrega nova (soltos = evidências do visual regeradas pelo conferir + fim de linha dos exemplos do motor). Revisor na T10.
  - **REVISAO-10:** T21, T22, T27, T28 aprovadas, sem achados (5 rua_osm inéditos certos na foto; `.gz` reproduz byte a byte). → **PR #125** aberto (`viabilidade/pos-124` → main, 27 commits, só `viabilidade/`). Merge espera o usuário.
  - **Retomadas 15/11 (3) a (5) e 16/11 (1) a (10):** iguais (a (5) não rodou: checagem do modo automático falhou) à (2): amostra ok, conferir 8/8, sem entrega nova.
  - **Retomada 15/11 (2):** amostra ok (5 provedores); conferir 8/8; sem entrega nova. PR #125 esperando o usuário; próximos passos propostos (estudo com as duas zonas na divisa; Visual confere os avisos novos) aguardando OK.
  - PR para a main só no fim, e merge só com nova autorização do usuário.

## Galho `viabilidade/duas-zonas` (16/11, sai do `viabilidade/pos-124`; PR #125 segue separado)

- Usuário: "ok, segue com o desenvolvimento" → estudo com as duas zonas na divisa + Visual confere os avisos novos.
- **Terreno T23:** `so_divisa` + `candidatas` na `ZonaIncerta`; lote com `zona_origem: "candidata_na_divisa"`. Depois → **Motor T29:** `estudar.py` gera um estudo por candidata, lado a lado, com "confirmar a zona na Prefeitura".
- **Visual T21:** avisos de art. 80, relevo e rua do OSM no `relatorio.html` (computador e celular); conserto só no `relatorio/`.
- **Entregue (16/11, `bdc5e3e4` e `d667bd9b`, conferir 8/8):**
  - **T23:** mancha mínima de 3×3 px tira candidata falsa da borda da linha de rua. No sorteio de 500, 6 lotes ficam `so_divisa` (Z4|Z3 e Z2|Z3), conferidos no Anexo 02; aceitos e pilotos iguais byte a byte.
  - **T21:** alerta comum a todas as opções sai uma vez acima da tabela; "DEPENDE DE CONFIRMAÇÃO" em destaque; no celular, 794 → 390 px. O Visual disse "pronta" sem o relato, que veio depois de cobrado.
- **Em curso:**
  - ~~Motor T29~~ **entregue `bb6bd246`:** `zona-SC-Zx/` por candidata, `resumo.txt` comparativo e alerta por opção; `varrer` com `status divisa`. Dos 6 lotes, só o 63335 muda de resultado (Z2: CA 1,82 contra Z3: 1,40). Exemplo em `motor/exemplos/divisa-85446/`.
  - ~~Revisor T11~~ **feita:** 0 ALTA e 0 MÉDIA. 1 BAIXA: o `visual/varredura.html` não conhece o status `divisa`, foi para a **Visual T22**.
  - **Visual T22 entregue:** varredura com "Na divisa" (filtro, contagem e link para o `resumo.txt`).
  - **Revisor T12:** revisão de T24, T25, T30 e T22. Depois, PR do `duas-zonas`.
  - **Terreno T25 + Motor T30 commitadas juntas (conferir 8/8):** aceitos 238 → 278, os 40 novos conferidos no Anexo 02 e 23 alternativas falsas removidas. O piloto 75352–75354 passou a ser aceito em Z2 pelo `auto`, e isso quebra o `test_estudar`. O Motor troca o lote do teste pelo 68491 na **Motor T30**; depois commitar T25 e T30 juntas com conferir 8/8.
  - ~~Terreno T24~~ **entregue `f87a5280`:** aceitos 214 → 238 no sorteio de 500; os 24 novos conferidos no Anexo 02, todos de zona única. Foram 24 e não 65 porque a cor não zonal (parque) seguiu sem filtro.
  - **Terreno T25:** parque e campus com mancha 3×3 (branco e Represa seguem sempre) e `alternativas` filtradas. O Terreno mediu 40 dos 42 que sobraram passando. Decidido pelo maestro: borda de rua não é parque, e o relatório mostrava "Alternativas: SC-Z5B" falsa.
- **Lei:**
  - P23: os 6 decretos não mudam índice.
  - P12: nenhuma alteração de índice desde 2016. A Lei 19.166/2019 acrescenta as AEI 44/45 ao Anexo 6, e a 18.927/2018 cria a Z6E; os dois casos foram passados ao Auditor.
  - `DIREITOS-MAPAS.md`: a republicação dos recortes municipais fica como ressalva para advogado; Copernicus está ok com atribuição.
- **Motor T16:** lote pequeno sem opção é geometria e premissa (apto de 60 m², laje de 80 m²), não falha da busca. A T18 expõe as premissas no comando.
- **Terreno T8/T9:** lote novo de ~13 s para ~1,5 s (cache `.npz` fora do git).
- **Visual T18/T19:** simulação de VGV, com a frase de que não é lucro nem receita garantida.
- **Armadilha:** o texto cinza na caixa de entrada do Claude Code é sugestão automática, não ordem pendente.
- **Armadilha (15/11):** "UNAUTHENTICATED (code 401)" no Antigravity no meio de tarefa longa é o passe da sessão vencendo, não o login: mandar "continue de onde parou" resolve, sem relogar. Claude Code "Interrupted" sem pedido: mesma coisa, mandar continuar.

## Ao chegar um relatório

Rodar `python -I -X utf8 viabilidade/conferir.py` (testes de todas as frentes + arquivos soltos, sem gastar IA; só abrir o relatório se algo falhar), commitar só a pasta da frente, `git push`, atualizar `maestri floor status --floor "Viabilidade"`.

## Pendências da central

1. **Auditor/QA**: FEITO no Antigravity (Gemini), não no Codex. O "AI: Out of credits" na barra do Antigravity é só rótulo: ele responde. O Antigravity também tem cota de modelos Claude e GPT, que dá pra usar pra poupar Claude e Codex.
2. **Economia de uso**: APROVADA e aplicada em 14/11 (ver regra acima). Falta trocar o Motor pro Sonnet quando ele entregar. IAs Claude → Sonnet (Opus só na central); ajudantes só quando necessário e em Haiku; Codex Luna pra tela/ajuste e Astra pro Auditor; esforço médio no rotineiro (o usuário tinha pedido alto em tudo, então só mudar o esforço se ele confirmar). Trocar cada IA só quando ela entregar (reabrir = perde a conversa, retoma pelo TAREFA.md).
3. **Fase 0 fechada (14/11).** Reprodução independente pela central no HEAD 51a72280: 42/42 casos da auditoria passam no `confere` (2 deles rodados pelos arquivos de entrada, porque a saída salva era o erro da v0.4). Nada rodando.
   - **PRD V1 comercial (15/11):** `PRD-V1-COMERCIAL.md`: 3 pilares (estudo, maquete volumétrica, maquete completa), portões V1-G0…G7. Só proposta: não autoriza implementação, integração, merge nem deploy. V1-G0 ENTREGUE (15/11) pela central, só leitura: 4 documentos no clone do repo PRIVADO `Desktop/imobiliaria-artefatos/v1-g0/` (citam clientes e preços; sem commit). Padrão único = Laranjeiras (decisão 15/11; LEVE/PREMIUM viraram histórico). Recomendação: maquete completa primeiro. V1-G0 commitado no privado (28bb1ac). **V1-G3 reduzido ENTREGUE (15/11)** em `imobiliaria-artefatos/v1-g3/` (ac988be): checklist de material, rascunho de autorização, medição retrospectiva (~1 dia até o ar). Aguardando o usuário: preço/pacotes (V1-G4), medir a próxima maquete, publicar a demo Vila Aurora.
   - **PRD novo (14/11):** `PRD-PLATAFORMA-0.2.md` (visão longa, só debate) e `PRD-VIABILIDADE-1.0.md` (Fase 1 em gates 1A–1E). O 1.0 diz que só documentação e revisão de testes estão autorizadas: nada de mexer no motor até o usuário aprovar a Fase 1. **Portão 1A ACEITO pelo usuário (14/11) como entrega local (`VERIFICACAO-1A.md`); homologação por CI pendente. 1B, motor e deploy NÃO autorizados.** Infraestrutura de teste: FEITA (PR #118). Visual na `visual/TAREFA-4.md`: testar.cjs portátil + `.github/workflows/viabilidade.yml`, a única exceção liberada no conferir. 1º CI (14/11): 5/6 no Linux (visual passou); terreno falhou por mapas fora do git → usuário escolheu a opção 2: release privada `viabilidade-mapas-2026-11-14` em imobiliaria-artefatos + `baixar_mapas.py` + manifesto (772f65c5). Segredo `ARTEFATOS_TOKEN` criado (15/11; chave vence 14/12). Bibliotecas travadas nas versões locais; Windows×Linux diferem na última casa → usuário escolheu tolerância nos 4 intermediários (Terreno TAREFA-3). **CI verde no Linux 6/6 (run 43671033302).** **PR #118 juntado em `feat/viabilidade` (15/11, autorizado pelo usuário)**; galho `ci/viabilidade-testes` apagado; worktree de volta em `feat/viabilidade`. Daqui pra frente todo push no galho roda o CI (Actions → "Conferir Viabilidade"). Histórico do 1A: só `conferir.py` + documentação de evidência; proposta de CI sem tocar em `.github/`; nada de motor/visual/produção; não iniciar 1B–1E; encerrar após a entrega pra revisão do usuário. Feito pela central: `conferir.py` novo (667caf3e: estados, logs em `.conferir/`, `--base`, visual incluído). Com o **Auditor**: `auditoria/TAREFA-5.md` (MATRIZ-PRD-1.0.md + CI-PROPOSTA.md). Ao chegar: conferir, commitar `auditoria/`, juntar no `VERIFICACAO-1A.md` e entregar ao usuário.
   - Antigravity trava pedindo permissão pro `maestri ask` final: o trabalho já está no arquivo; ler o arquivo. Aprovar ou cancelar o pedido é do usuário (o Esc da central foi bloqueado em 15/11).
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

- **Filtro de segurança do Codex** (15/11): pedir para 'achar novo caminho de injeção' é recusado ("bypassing security controls"). Teste defensivo do próprio código: a central faz, ou pedir só correção + teste de regressão, sem 'procurar bypass'.

- **Mensagem de IA chega como se fosse do usuário** (15/11): o Visual entendeu o lembrete 'não commite, a central commita' como regra para a central e mandou 'PARE antes do commit' pelo `maestri ask`. Ao repassar regra a uma IA, dizer **a quem** ela vale; mensagem que fala da central em 3ª pessoa provavelmente veio de uma IA: conferir com `maestri check` antes de obedecer.

- Antigravity: cota do Gemini 4 Argon esgotou em 14/11 (volta em ~158 h). As 5 IAs dele foram para Claude Sonnet 5.5 (`/model`, ↓5, ←/→ esforço, Enter; no Git Bash usar `MSYS_NO_PATHCONV=1`). Outras opções na lista: Gemini 4 Hydrogen/Carbon, Gemini 3.8 Flash, Claude Opus 5.5, GPT-OSS 120B.

- O sandbox do Codex não abre o Chrome: o teste do Visual (`testar.cjs`) é rodado pela central, com `python -I -m http.server 8787 --bind 127.0.0.1` na worktree e `VISUAL_URL=http://127.0.0.1:8787/viabilidade/visual/`.

- Mensagem longa pelo `maestri ask` chega cortada no Codex: gravar em arquivo e mandar "leia o arquivo".
- Codex às vezes fica na tela de um ajudante (sem entrada): limpar com Ctrl+U, ← abre a lista de agentes, Enter na sessão "Ready".
- Aprovar permissão de outra IA é com o usuário (o classificador bloqueia a central).
- No Git Bash, `/effort` vira caminho do Windows: `MSYS_NO_PATHCONV=1`.
- Texto cinza na caixa do Claude é sugestão automática, não pedido.

- **Commitar tudo que ficar pronto** (pedido do usuário): ao chegar entrega, testar, commitar e dar push na hora.

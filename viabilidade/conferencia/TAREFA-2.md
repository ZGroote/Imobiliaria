# Tarefa 2 da Conferência — pacote para o arquiteto (preparação do Portão 1C)

**Quem:** Conferência (Antigravity). Escreva **só** em `viabilidade/conferencia/`. Não altere lei, motor, terreno, visual. Não commite.
**Regras de acesso a dado público:** só o que a fonte oferece abertamente; nada de forçar URL, burlar bloqueio ou contornar login. Fonte bloqueada: registre endereço, tipo de bloqueio e o que ficou pendente (regra do `README.md`).

## Objetivo

O Portão 1C do `PRD-VIABILIDADE-1.0.md` exige que um **arquiteto ou engenheiro de São Carlos** confira zonas, lotes e normas. Hoje as pendências estão espalhadas por `conferencia/CONFERENCIA.md`, `BLOQUEIOS.md`, `lei/zonas.json`, `lei/zona-dos-pilotos.json` e `terreno/lotes-piloto.json` (todos com `zona_conferida: false`). Monte **um pacote único** que um profissional consiga responder em uma reunião de 1 hora.

## Entregas

1. `viabilidade/conferencia/PACOTE-ARQUITETO.md`, em português simples, para quem **não** conhece o projeto:
   - **O que é o estudo** (1 parágrafo) e o que **não** é (não é projeto nem aprovação).
   - **Perguntas numeradas**, cada uma com: o que o sistema assumiu hoje, a fonte (lei, artigo, anexo, link), por que há dúvida e as respostas possíveis (sim / não / outro valor). Agrupe em:
     - (a) zona de cada um dos 7 lotes-piloto (endereço/quadra/lote, zona assumida, como foi lida);
     - (b) parâmetros duvidosos por zona: Z5A/Z5B, Z6B, Z6E e o que mais estiver em `CONFERENCIA.md`;
     - (c) regras de recuo por altura (h/8 e vigência), garagem computável, permeabilidade, parede cega (COE art. 70);
     - (d) áreas especiais dos pilotos (aeronáutica/DECEA, AIA, AEI);
     - (e) decretos com link quebrado (`BLOQUEIOS.md`).
   - No fim, uma **tabela-resposta** em branco (pergunta | resposta | fonte que o profissional usou | assinatura/data), para ser preenchida.
2. `viabilidade/conferencia/pacote-arquiteto.json`: as mesmas perguntas, estruturadas `{id, grupo, pergunta, assumido_hoje, fontes[], opcoes[], afeta: ["lote:..."|"zona:..."]}`. Assim, quando as respostas voltarem, a central sabe o que muda no `zonas.json` e nos lotes.
3. Confira cada link citado (abre? é a versão vigente?). Link quebrado vai para uma seção "fontes inacessíveis", no formato da regra acima.

**Não invente resposta.** Onde você mesmo achar a resposta numa fonte oficial acessível, registre como "indício encontrado: …", mas a pergunta continua para o profissional.

Ao terminar, não precisa mandar mensagem: a central confere os arquivos.

# PA-G0: descoberta e contratos do Projetista (16/11)

O usuário aprovou **só o PA-G0** do `viabilidade/PRD-PROJETISTA-0.1.md`. Isso quer dizer **só documento**: nada de código de produto, protótipo, mudança no `motor/`, painel, Firestore ou produção.

- Worktree: `C:/Users/respawn/Desktop/imobiliaria-projetista`.
- Galho: `viabilidade/projetista-g0`, saído da main (`633ddaeb`).
- **Não trabalhe** em `Desktop/imobiliaria-viabilidade`: outros agentes estão lá.

Leia o PRD inteiro antes de começar, e também `viabilidade/PRD-VIABILIDADE-1.0.md` e `viabilidade/PRD-V1-COMERCIAL.md`.

## O que entregar em `viabilidade/projetista/PA-G0.md`

1. **Casos de uso concretos.** Três ou quatro, com números de verdade.
   - Um deles deve ser um lote real do sorteio da viabilidade que hoje gera estudo: diga o lote, o envelope e o que o usuário quer ("6 aptos de ~60 m² por andar").
   - Inclua um caso que **não cabe**.
2. **Inventário do que já existe**, lendo o código, com arquivo e função:
   - **Motor:** o que o `motor/motor.py` já entrega e que serve de envelope para o projetista. Por exemplo: `caixa_recuada`, recuos por pavimento, gabarito, CA, as caixas de volume das opções e o `estudo.json`.
   - **Hoje:** como o motor chega ao número de unidades. Se for área ÷ área-alvo, diga onde está.
   - **Peças de planta e 3D no repositório principal:** procure, por exemplo, o extrator de planta, `tools/gerar_planta_aleatoria.mjs`, a montagem do interior a partir da planta no mapa 3D e no LIV, "mobiliar pela planta", e a unidade em lote de lançamento.
   - Para cada peça: o que faz, que formato de dado usa, e se dá para reaproveitar, adaptar ou se não serve.
3. **Definições operacionais a fechar:**
   - área privativa, útil e computável, com a fonte de cada uma: lei de São Carlos, NBR 12721 ou o que houver na pasta `viabilidade/lei/`;
   - cota interna ou externa;
   - espessura de parede padrão.
   - Onde não houver fonte, marque **"a decidir"**. Não invente.
4. **Esquema canônico proposto**, em JSON comentado ou tabela, com as entidades da seção 6 do PRD:
   - unidades, coordenadas, tolerâncias, IDs estáveis e versão;
   - como ele se liga ao `estudo.json` atual por um adaptador, **sem mudar** o contrato da viabilidade.
5. **Onde guardar os projetos** sem tocar no Firestore de produção, com opções e uma recomendação.
6. **Ordem dos portões.** O PRD manda fazer primeiro o editor manual (PA-G1). A central sugeriu fazer antes um **gerador esquemático de pavimento** em cima do envelope do motor (PA-G2 e o começo do PA-G4), porque ele melhora logo a contagem de unidades da viabilidade.
   - Compare as duas ordens: custo, risco e o que cada uma entrega primeiro.
   - Recomende uma.
7. **Domínio do primeiro portão:** que tipo de lote e de edifício entra e qual fica fora.
   - Diga se casa térrea ou sobrado em lote pequeno entra ou não. Hoje esses lotes de 88 a 110 m² dão 0 opção no motor.
8. **Riscos** (os do PRD e os novos que você achar), **perguntas em aberto para o usuário** (no máximo 6, objetivas) e **critério de saída do PA-G0**.

## Regras

- Português simples, numerado, sem enrolação. Tabela onde ajudar.
- Toda afirmação sobre o código tem arquivo:função.
- Pode ler qualquer arquivo dos dois repositórios. Escrever, só em `viabilidade/projetista/`.
- **Não cite cliente nem preço:** o repositório é público.
- Não commite.

Ao terminar: `maestri ask "Claude Code" "Produto tarefa PA-G0 pronta"`.

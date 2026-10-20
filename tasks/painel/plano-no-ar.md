# Plano da conta e vagas no ar (especificação)

Proposta de 20/10/2026, revisada no mesmo dia com as respostas do usuário. **Só documento: nada
implementado, nada no ar.** Escrita sobre a pilha #86→#91 (`feat/cloud-run-preparo`, `dc3e121`),
junto com a do [robô do M2](m2-worker.md).

Decisões do usuário (20/10), resumidas:

- as maquetes ficam no ar enquanto o valor é pago, e isso depende do plano do cliente;
- na imobiliária, o plano é mensal;
- em caso de cancelamento ou inadimplência, a maquete pode ser retirada a qualquer momento. Quem
  faz isso é ele, pelo painel;
- o cliente também tira do ar pelo **botão de estado**. O plano tem um número de vagas online, e
  o cliente pode tirar qualquer casa para pôr outra no lugar;
- **o intervalo:** "a partir do momento que a pessoa desligou uma vaga para pôr outro imóvel,
  deve ter um intervalo de 1 h, apenas para não dar nenhum conflito ou esbarrar em um limite";
- do lado do cliente, **só o gerente** mexe no botão;
- depois de um cancelamento, **os arquivos ficam salvos por 90 dias**.

---

## 0. Resumo

1. **Cada conta tem um plano:** quantas vagas online, o ciclo (mensal na imobiliária) e a
   situação (ativo, suspenso ou cancelado). Só o admin mexe.
2. **O botão de estado** (`vitrine/{slug}.online`, PR #88) passa a ocupar e liberar vagas:
   - **tirar do ar:** sempre e na hora. A vaga fica livre, **mas só aceita outro imóvel 1 h
     depois**;
   - **pôr no ar:** numa vaga livre há pelo menos 1 h, ou que nunca foi usada.

   O intervalo vale para todo mundo, inclusive o admin; ele serve justamente para não haver
   conflito. Se houver urgência, o admin aumenta o número de vagas do plano.
3. **Quem mexe:** do lado do cliente, só o **gerente**. A equipe também mexe, como hoje.
4. **Inadimplência ou cancelamento:** o admin suspende ou cancela a conta no painel, num clique.
   Todos os imóveis dela saem do ar na hora, e o botão trava até reativar.
5. **Depois do cancelamento, os arquivos ficam 90 dias no site, fora do ar.** Se o cliente
   voltar nesse prazo, é só pôr no ar de novo. Passados os 90 dias, o robô retira os arquivos do
   site (§3).
6. **Nada disso gera build.** O "no ar" é o interruptor ao vivo de hoje: a página do imóvel cobre
   a tela, e o ponto some do mapa geral.
7. **Publicar não fura o limite.** Se o gerente aprova um imóvel novo e não há vaga livre, o robô
   publica, mas o deixa **fora do ar**, e o painel avisa: "sem vaga livre: tire outro do ar e,
   1 h depois, ponha este".

---

## 1. Onde mora e quem muda

- **O plano**, em `agencies/{id}.plano`:

  ```ts
  { vagas: number,                                       // inteiro >= 0: quantos imóveis online
    ciclo: 'mensal' | 'por_empreendimento',              // construtora pode ter outro ciclo
    situacao: 'ativo' | 'suspenso' | 'cancelado',
    canceladoEm?: Timestamp }                            // conta os 90 dias
  ```

  Só o `platform_admin` grava, como o resto da conta (as regras de `agencies` já são assim). Cada
  mudança tem AuditLog.
- **As vagas**, um documento por vaga: `vagas/{agencyId}/slots/{n}`, com `n` de 0 até
  `plano.vagas - 1`:

  ```ts
  { slug: string | null,            // o imóvel que ocupa a vaga, ou null se está livre
    livreDesde: Timestamp | null,   // quando a vaga foi liberada; null = nunca usada
    updatedAt: Timestamp }
  ```

  - **Por que um documento por vaga:** as regras do banco não sabem contar nem percorrer uma
    lista. Com uma vaga por documento, cada regra olha só uma vaga e confere o intervalo dela.
  - **No `vitrine`, um campo novo, `vaga: n`**, diz qual vaga o imóvel ocupa. As regras conferem
    as duas pontas no mesmo batch. Um imóvel não ocupa duas vagas, e uma vaga não guarda dois
    imóveis.

**As regras novas do `vitrine`** (resumo):

| Mudança | Exige |
|---|---|
| pôr no ar (`online` de `false` para `true`) | conta com o plano `ativo`; o imóvel já publicado (`publishedBuild`); a vaga `n` existe (`n < plano.vagas`), está livre e o `livreDesde` dela é nulo ou de pelo menos 1 h atrás; no mesmo batch, a vaga passa a guardar este slug |
| tirar do ar (`online` de `true` para `false`) | no mesmo batch, a vaga dele volta a `slug: null` e `livreDesde` = agora. Sempre permitido |
| preço e situação (disponível, vendido...) | igual a hoje; não mexe em vaga |
| quem | a equipe, ou o **gerente** da imobiliária do imóvel (como hoje; o corretor não) |

- **O painel escolhe a vaga sozinho.** O cliente não vê número de vaga, só "3 de 5 vagas em
  uso" e, quando todas as livres estão no intervalo, "próxima vaga livre em 42 min".
- **Plano reduzido** (o admin baixa de 5 para 3 vagas): as vagas acima do novo número não
  aceitam ninguém novo. Quem já está nelas continua no ar até sair, e o painel mostra ao admin
  "2 imóveis acima do plano".

**Atenção a uma regra de hoje:** "sem documento no `vitrine`, o imóvel está no ar"
(`painel/src/lib/vitrine.ts`). Com as vagas, isso deixaria um imóvel no ar sem ocupar vaga. Por
isso:

- toda publicação passa a gravar o `vitrine` dele no mesmo batch: numa vaga, se houver livre;
  fora do ar, se não;
- uma migração única cria o `vitrine` e a vaga dos imóveis que já estão no ar (hoje, só o
  Cedros), conferida antes e depois.

**Suspender, cancelar e reativar** (admin):

- **suspender:** num batch, a `situacao` vira `suspenso`, todo `vitrine` da conta vai para
  `online: false` e todas as vagas ficam livres. Com poucas dezenas de imóveis, cabe num batch
  só;
- **cancelar:** igual, com `situacao: 'cancelado'` e `canceladoEm` = agora;
- **reativar:** a `situacao` volta a `ativo`. Os imóveis **não** voltam sozinhos; o gerente põe
  de novo, vaga por vaga.

---

## 2. No painel

- **Tela da conta (admin):** vagas, ciclo, situação; "Suspender", "Cancelar" e "Reativar", com
  confirmação; numa conta cancelada, "os arquivos saem do site em X dias".
- **Lista de imóveis do cliente:** "3 de 5 vagas em uso".
- **O botão de estado** de cada imóvel:
  - **"Tirar do ar"**: sempre, com o aviso "esta vaga só aceita outro imóvel daqui a 1 h";
  - **"Pôr no ar"**: com uma vaga pronta. Senão, mostra o motivo: "todas as vagas em uso" ou
    "próxima vaga livre em 42 min".
- **Conta suspensa ou cancelada:** o gerente vê um aviso e o botão travado.

---

## 3. Os 90 dias e a etapa "retirar"

- Enquanto a conta está cancelada há menos de 90 dias, os arquivos ficam no site de imóveis,
  fora do ar. Nada muda neles.
- **No 91º dia, o robô retira os arquivos** de cada imóvel da conta. É uma etapa nova do robô
  ([m2-worker.md](m2-worker.md)), com o mesmo cuidado de publicar:
  - baixa o `estado.json` do ar;
  - monta o site sem os builds daquele imóvel, sem os ponteiros e sem a linha dele no
    `imoveis.json`;
  - aplica o portão de escopo, que aceita só essas saídas;
  - relê o `estado.json`, faz o deploy e relê de novo.
- **O registro:** o imóvel perde os campos de publicação, e entra uma publicação com a ação
  `retire`, que as regras passam a aceitar só do robô e só para conta cancelada há 90 dias.
  - A história do que foi publicado continua em `publications` e nos AuditLogs.
  - Os dados do cadastro (planta, dados do imóvel) continuam no banco.
- **Se o cliente voltar depois dos 90 dias:** o imóvel precisa de uma publicação nova. O robô
  gera de novo a partir da planta e dos dados que ficaram, e o gerente aprova.
- **Um link antigo** de imóvel retirado cai na página "não encontrado" do site, que já existe.

---

## 4. Incrementos

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **PL-1** | **Regras:** `agencies.plano`, `vagas/{agencyId}/slots/{n}`, o campo `vaga` e as novas condições do `vitrine` | `regras.test.mjs`:<br>• pôr no ar sem vaga pronta: negado;<br>• pôr numa vaga liberada há menos de 1 h: negado, **inclusive para o admin**;<br>• tirar do ar: sempre;<br>• uma vaga com dois imóveis, ou um imóvel em duas vagas: negado;<br>• vaga acima de `plano.vagas`: negada;<br>• conta suspensa ou cancelada: ninguém da conta põe no ar;<br>• corretor: não mexe;<br>• imóvel sem `publishedBuild`: não vai ao ar;<br>• gerente mudando o plano: negado | testes verdes, cada regra quebrada de propósito pega |
| **PL-2** | **Painel:** plano na conta, contador de vagas, botão de estado com o motivo, suspender, cancelar e reativar | testes do painel no emulador, com relógio falso para a 1 h | testes verdes; conferido no `painel:dev` |
| **PL-3** | **O robô respeita as vagas:** a publicação grava o `vitrine` no mesmo batch, numa vaga ou fora do ar | entra na matriz do M2-5 ([m2-worker.md](m2-worker.md)): publicar sem vaga deixa fora do ar e avisa | testes verdes |
| **PL-4** | **Migração única** do que já está no ar (o Cedros) para `vitrine` + vaga. Ação em produção, com autorização | antes e depois conferidos pela leitura | o Cedros no ar ocupando 1 vaga |
| **PL-5** | **Etapa "retirar"** do robô (§3) e a ação `retire` nas regras de `publications` | "ar" falso, como no M2-5: retirar X não mexe em Y; conta cancelada há 89 dias não é tocada; o link antigo cai no "não encontrado" | testes verdes |

Os números de cada plano (quantas vagas em cada um) são decisão comercial sua: o sistema só
precisa do número.

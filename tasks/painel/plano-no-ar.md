# Plano da conta e vagas no ar (especificação)

Proposta de 20/10/2026. **Só documento: nada implementado, nada no ar.** Escrita sobre a pilha
#86→#91 (`feat/cloud-run-preparo`, `dc3e121`), junto com a do [robô do M2](m2-worker.md).

Decisão do usuário (20/10), resumida:

- as maquetes ficam no ar enquanto o valor é pago, e isso depende do plano do cliente;
- na imobiliária, o plano é mensal;
- em caso de cancelamento ou inadimplência, a maquete pode ser retirada a qualquer momento. Quem
  faz isso é ele, pelo painel;
- o próprio cliente também tira a maquete do ar, pelo **botão de estado**. Ele tem um plano com
  um limite de imóveis no ar e pode tirar qualquer casa para pôr outra no lugar, **com 1 h entre
  essas mudanças**.

---

## 0. Resumo

1. **Cada conta tem um plano:** quantos imóveis podem ficar no ar ao mesmo tempo, o ciclo
   (mensal na imobiliária) e a situação (ativo, suspenso ou cancelado). Só o admin mexe.
2. **O botão "no ar" de hoje** (`vitrine/{slug}.online`, PR #88) passa a respeitar o plano:
   - **tirar do ar:** sempre e na hora;
   - **pôr no ar:** só com vaga livre no plano e **1 h depois da última vez que a conta pôs um
     imóvel no ar**.

   O admin não espera.
3. **Inadimplência ou cancelamento:** o admin suspende a conta no painel, num clique. Todos os
   imóveis dela saem do ar na hora, e o botão "no ar" trava até reativar.
4. **Nada disso gera build nem deploy.** O "no ar" é o mesmo interruptor ao vivo de hoje: a página
   do imóvel cobre a tela, e o ponto some do mapa geral.
5. **Publicar não fura o limite.** Se o gerente aprova um imóvel novo e não há vaga, o robô
   publica, mas o deixa **fora do ar**, e o painel avisa: "sem vaga no plano: tire outro do ar
   para pôr este".

---

## 1. Onde mora e quem muda

- **O plano**, em `agencies/{id}.plano`:

  ```ts
  { limiteNoAr: number,                                  // inteiro >= 0
    ciclo: 'mensal' | 'por_empreendimento',              // construtora pode ter outro ciclo
    situacao: 'ativo' | 'suspenso' | 'cancelado' }
  ```

  Só o `platform_admin` grava, como o resto da conta (as regras de `agencies` já são assim). Cada
  mudança tem AuditLog.
- **A contagem das vagas**, num documento por conta: `vagas/{agencyId}` =
  `{ noAr: [slugs], ultimaEntrada, updatedAt }`.
  - As regras não sabem contar documentos, então a lista dos imóveis no ar mora num lugar só.
  - Ela muda **no mesmo batch** de cada `vitrine/{slug}`, e as regras conferem as duas pontas.

**As regras novas do `vitrine`** (resumo):

| Mudança | Exige |
|---|---|
| pôr no ar (`online` de `false` para `true`) | conta com o plano `ativo`; o imóvel já publicado (`publishedBuild`); o slug entra na lista de `vagas` no mesmo batch; a lista não passa do `limiteNoAr`; **1 h** desde a `ultimaEntrada` (o admin não espera); a `ultimaEntrada` vira agora |
| tirar do ar (`online` de `true` para `false`) | o slug sai da lista no mesmo batch. Sempre permitido |
| preço e situação (disponível, vendido...) | igual a hoje; não mexe em vaga |

**Atenção a uma regra de hoje:** "sem documento no `vitrine`, o imóvel está no ar"
(`painel/src/lib/vitrine.ts`). Com o limite, isso deixaria um imóvel no ar sem ocupar vaga. Por
isso:

- toda publicação passa a gravar o `vitrine` dele no mesmo batch: no ar se houver vaga, fora do
  ar se não;
- uma migração única cria o documento dos imóveis que já estão no ar (hoje, só o Cedros) e monta
  as `vagas`, conferida antes e depois.

**Suspender e reativar** (admin):

- **suspender:** num batch, a `situacao` vira `suspenso`, todo `vitrine` da conta vai para
  `online: false` e a lista de `vagas` fica vazia. Com poucas dezenas de imóveis, cabe num batch
  só;
- **reativar:** a `situacao` volta a `ativo`. Os imóveis **não** voltam sozinhos; o cliente ou o
  admin põe no ar de novo, dentro do limite;
- **cancelar:** igual a suspender, com `situacao: 'cancelado'`. Os arquivos continuam no site,
  fora do ar (§3, pergunta 3).

---

## 2. No painel

- **Tela da conta (admin):** limite de imóveis no ar, ciclo, situação, e os botões "Suspender" e
  "Reativar", com confirmação.
- **Lista de imóveis do cliente:** "3 de 5 vagas no ar".
- **O botão de estado** de cada imóvel:
  - **"Tirar do ar"**: sempre;
  - **"Pôr no ar"**: com vaga e passada 1 h. Senão, mostra o motivo: "sem vaga: tire outro do
    ar" ou "próxima troca em 42 min".
- **Conta suspensa:** o cliente vê um aviso e o botão travado.

---

## 3. Incrementos

| # | O quê | Teste | Pronto quando |
|---|---|---|---|
| **PL-1** | **Regras:** `agencies.plano`, `vagas/{agencyId}`, as novas condições do `vitrine` | `regras.test.mjs`:<br>• pôr no ar sem vaga: negado;<br>• pôr no ar antes de 1 h: negado para o gerente, permitido para o admin;<br>• tirar do ar: sempre;<br>• conta suspensa: ninguém da conta põe no ar;<br>• lista de `vagas` sem o `vitrine` no mesmo batch: negado;<br>• imóvel sem `publishedBuild`: não vai ao ar;<br>• gerente mudando o plano: negado | testes verdes, cada regra quebrada de propósito pega |
| **PL-2** | **Painel:** plano na conta, contador de vagas, botão de estado com o motivo, suspender e reativar | testes do painel no emulador, com relógio falso para a 1 h | testes verdes; conferido no `painel:dev` |
| **PL-3** | **O robô respeita as vagas:** a publicação grava o `vitrine` no mesmo batch, no ar ou fora conforme a vaga | entra na matriz do M2-5 ([m2-worker.md](m2-worker.md)): publicar sem vaga deixa fora do ar e avisa | testes verdes |
| **PL-4** | **Migração única** do que já está no ar (o Cedros) para `vitrine` + `vagas`. Ação em produção, com autorização | antes e depois conferidos pela leitura | o Cedros no ar ocupando 1 vaga |

---

## 4. Perguntas para você decidir

1. **A 1 h vale só para pôr no ar?** A proposta é tirar do ar sempre na hora, porque um imóvel
   vendido não pode esperar, e esperar 1 h só entre uma entrada e outra. O admin não espera.
2. **Quem do cliente mexe no botão:** só o gerente (como hoje), ou o corretor também?
3. **Depois do cancelamento, os arquivos saem do site?**
   - Proposta: ficam fora do ar por 90 dias, para o caso de o cliente voltar.
   - Depois disso, o robô retira os arquivos do site. Seria uma etapa nova, "retirar".
4. **Os limites e preços de cada plano** (quantos imóveis em cada um) são seus: o sistema só
   precisa do número.

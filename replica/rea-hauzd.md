# REA na hauzd (2026-10-12)

Alvo: o que o showroom público entrega a qualquer navegador, na versão
`2.01.0092` de `nayamara.hauzd.app`. São 42 arquivos e 3 MB: o JS da interface,
dois `.wasm` e o `twin.json`. A análise foi estática e local. Nenhuma API deles foi
chamada, e nenhum código deles entrou neste repositório; os arquivos ficaram no
scratchpad da sessão.

Ferramenta: `rea-agents@6.4.0`, instalado com `--ignore-scripts` numa pasta isolada
e sem registro em nenhum agente. Rodei `analyze-javascript-application`: 22 s,
grafo de 52 MB. O que ele acrescentou foram as chaves de armazenamento
(`hauzd_utm_tags`, `refreshToken`, `email`). O resto saiu de leitura direta,
porque o JS deles não é minificado.

## O que interessa pro imobiliaria

**Captura de lead (compara com SPEC-captura-lead.md)**
- O formulário é montado no painel deles, por projeto. Os campos são dinâmicos e o
  tipo `L` é lead; os outros tipos são de reserva. Isso explica o `answers`
  chave-valor que aparece no Zapier.
- São três chamadas:
  - `startForm` quando o formulário abre. O servidor já fica sabendo que alguém
    começou a preencher e quem não terminou, e as UTMs vão junto.
  - `submitForm` com os valores.
  - `completeForm`, que fecha o lead.
- As UTMs (`utm_source`…`utm_content`) são lidas da URL na entrada, guardadas em
  `localStorage` e coladas no lead. **Nós não guardamos UTM** e deveríamos, porque
  é o que o incorporador usa pra saber qual campanha trouxe o lead.
- O WhatsApp tem **um número por projeto** e uma mensagem fixa. Não sabe qual
  unidade o comprador estava vendo nem qual corretor divulgou o link. O clique
  só vira evento no gtag. **Nisso o nosso plano (corretor da raiz + unidade +
  registro no servidor) é melhor.**
- A analytics é feita por eventos `gtag`/GTM com os IDs do Google Analytics do
  próprio cliente. Não encontrei pedido de consentimento antes do gtag. Nós pedimos
  aceite pras métricas; isso é ponto a nosso favor no Brasil (LGPD).

**Reserva**
- Configurada por formulário, com três modos: PayPal, sem pagamento e contrato.
  O contrato tem termos por idioma, caixa de aceite e assinatura digitada
  (`digitalContract`).
- Há também um gateway dominicano (Azul) em ambiente de teste.
- Depois da reserva, o status do CRM é atualizado (`updateReservedUnitCrmStatus`).

**Estoque ao vivo**
- O `v1/app/live` devolve um snapshot de sequência que é aplicado à cena. Não é
  recarga da página inteira.

**Motor (WASM)**
- O motor C++ interno se chama "IVAN" e roda em WebGL 2 / GLSL ES 3.00. Usa
  Bullet para colisão e raycast (é ele que leva o clique ao piso no passeio),
  libjpeg e stb_image_write.
- A luz usa **sondas de ambiente assadas** (`EnvProbe`, `ComponentBakeLightProbeData`)
  com IBL codificado em RGBM e pré-filtrado, além da luz assada em textura. É a
  mesma ideia da nossa sonda de ambiente.
- **Correção:** cada projeto sai em 6 compressões de textura (`Raw`, `Pvr`,
  `Etc2`, `Dxt`, `Bc7`, `Astc`), e o app escolhe pelo que a GPU suporta. O "BC7"
  medido em 10/10 era a escolha do desktop. No celular deve ir ASTC ou ETC2.
  Isso não foi medido no aparelho.

## O que fica pro plano

1. Acrescentar ao SPEC-captura-lead:
   - UTMs no lead;
   - um evento de "formulário aberto" para medir abandono (no nosso caso, sem dado
     pessoal até o envio).
2. Reserva (L futuro): o modelo deles é formulário configurável → contrato com
   aceite e assinatura → pagamento opcional → status no CRM.
3. Textura por GPU (KTX2/Basis) pesa mais pro nosso celular do que qualquer coisa
   do motor deles.

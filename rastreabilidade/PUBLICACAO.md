# Links individuais no Firebase

O usuário autorizou ativar a API, os links de corretores e funcionários e os registros de acesso em 22/10/2026.

O painel usa `NEXT_PUBLIC_TRACKING_API_URL` de `painel/.env.production`. A função `conectaTracking` roda em `southamerica-east1`, Node 22, com mínimo zero e máximo uma instância. A conta `conecta-tracking` tem os papéis `datastore.user` e `firebaseauth.viewer`, além de acesso somente ao segredo `TRACKING_SECRET` no Secret Manager. Não exportar chave da conta nem o valor do segredo; preservar o segredo entre publicações para manter recibos existentes.

Corretores geram e consultam seus próprios links. Gestores gerenciam responsáveis ativos da própria imobiliária, incluindo outros gestores. Administradores e operadores também podem selecionar a equipe interna. O servidor revalida imobiliária, imóvel e responsável em cada abertura e evento. Revogar a raiz interrompe seus encaminhamentos. Os campos `brokerUid` e `brokerName` continuam no contrato para manter compatibilidade, inclusive para os membros da equipe.

O LIV Clássico não tem metadados da esteira principal no documento do imóvel. `preparar-liv.mjs` registra a publicação avulsa pelo identificador `liv-ipanema` no arquivo gerado `functions/publication.json`, que é incluído no bundle da função. A configuração só completa os dois metadados quando ambos estão ausentes; não substitui metadados existentes inválidos e não ignora a autorização do imóvel. As entradas em `/b/liv-ipanema/<build>/` usam os recursos já publicados em `/liv-classico/`. O build depende dos arquivos originais, manifesto e preparador. Não apagar builds anteriores enquanto houver links em circulação.

Preparação e publicação, a partir da raiz:

```powershell
node rastreabilidade/preparar-publicacao.mjs https://conectaimoveis3d.com.br
npm --prefix rastreabilidade/functions ci --ignore-scripts --no-audit --no-fund
firebase deploy --only hosting --project imobilaria-deccb --config publicacao/liv-duplo-20261017/firebase.json --non-interactive
firebase deploy --only functions:tracking --project imobilaria-deccb --config firebase.rastreabilidade.json --non-interactive
npm --prefix painel run build
firebase deploy --only hosting --project imobilaria-deccb --config firebase.painel.json --non-interactive
```

Use a CLI autenticada. Os preparadores não publicam; o comando de functions compila o bundle antes do envio. Não publicar o `firebase.json` da raiz para atualizar o site do LIV. Os índices e TTL de rastreabilidade estão em `firebase/firestore.indexes.json`; criar somente os necessários e preservar os demais índices remotos.

O domínio próprio foi ativado com HTTPS válido e a migração canônica foi publicada em 22/10/2026. O domínio canônico é configuração do servidor e da página de acesso. Os tokens guardados no banco continuam os mesmos. A página antiga redireciona entre os três hosts explicitamente permitidos, preservando token, navegação e fragmento. A abertura continua gerando o endereço de encaminhamento do visitante, como antes. Preservar `TRACKING_SECRET` versão 2 nas próximas publicações.

Na primeira abertura, a relação do apartamento com sua planta pode chegar depois de a cena exterior ficar pronta. O runtime repete a restauração se o visualizador recusar essa tentativa enquanto carrega os dados; depois de abrir o modo solicitado, passa a acompanhar as mudanças do visitante. Essa correção passou nos 29 testes do cliente, incluindo a regressão sem consentimento analítico.

Experiência de compra publicada em 23/10: build `dabada53e18b`, runtime de acesso `2c01428ab8507259`, função ACTIVE revisão `conectatracking-00006-kiv`, mantendo TRACKING_SECRET 2. O runtime passa ao visualizador somente `opening.contact`, já público e validado, e o endereço de encaminhamento público. A nova opção de navegação `experiencia` é conservada ao comparar e compartilhar; a mensagem de interesse não inclui recibos ou identificadores de sessão. Sem WhatsApp público válido, o visitante copia a mensagem. HTMLs antigos continuam utilizáveis com os bundles compartilhados; não possuem nem ativam os controles experimentais. Ao gerar outro build, publique **Hosting antes da função**, para a API nunca apontar para uma página ainda ausente.

Atualização visual posterior de 23/10: fundo escuro da vista 3D/Tour, build atual
`e48bfa8011b0`, Hosting `a7480d3063246e2b`, função ACTIVE
`conectatracking-00008-zil`, mesmo runtime e TRACKING_SECRET 2. Apenas
`interior.html` e `interior-renderer.js` do clássico mudaram, além dos manifestos e
da referência ao build. Os builds anteriores permanecem disponíveis.

Referência atual após retirar a base verde e recortar a margem das plantas 2D:
build `5f8e72bc7aac`, Hosting `f5112bdae46d107c`, função ACTIVE
`conectatracking-00009-jin`; runtime `2c01428ab8507259` e segredo versão 2
preservados. Os arquivos JPG originais continuam com os mesmos hashes.

Referência atual após confirmar a abertura com toque duplo, em 23/10:
build `2b69f90177ac`, Hosting `04705d5089ca4a87`, função ACTIVE
`conectatracking-00010-jor`. Runtime `2c01428ab8507259`, TRACKING_SECRET versão 2,
tokens e builds anteriores preservados. Um toque na fachada ou lista seleciona;
dois toques seguidos na mesma unidade da fachada abrem a planta. Hosting foi
publicado antes da função.

Verifique no navegador autenticado: Imóveis → LIV Ipanema → Links individuais → selecione um responsável → Gerar link. Abra o endereço e confira imóvel, modos e consentimento. Sem aceite não se cria sessão analítica. As métricas consentidas aparecem no relatório dos últimos 30 dias. A abertura e a cadeia do endereço não provam a identidade pessoal do visitante nem que houve envio direto pelo corretor.

Validação automatizada: `npm run test:rastreabilidade` usa Auth e Firestore locais com projeto `demo-painel`. Nunca semear usuários ou imóveis no projeto de produção para testar.

Referências oficiais: [opções e limites das funções](https://firebase.google.com/docs/functions/manage-functions), [requisições HTTP](https://firebase.google.com/docs/functions/http-events) e [rawBody](https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.request).

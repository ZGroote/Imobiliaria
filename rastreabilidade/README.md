# Rastreabilidade de divulgação

Entrega local aprovada em 04/10/2026. Sites continuam offline. A API, o wrapper
e o painel seguem [CONTRATO.md](CONTRATO.md); não alteram o Capturador M1.1.

## Executar localmente

Node 24, dependências existentes da raiz/painel e Java 21 para emuladores.
`npm run rastreabilidade:dev` reinicializa **somente demo-painel** e cria uma
demonstração local: painel em `127.0.0.1:3000`, API em `127.0.0.1:5057` e site
em `127.0.0.1:5058`. Usa as contas fictícias de `painel/src/lib/dev.ts`, senha
`senha-do-emulador`, e adiciona `corretor.a2@painel.test` à agência A.

Os HTMLs padrão são os exemplos do painel. Para usar uma maquete autocontida
já gerada, mantendo sua fonte intacta:

```powershell
npx firebase emulators:exec --only auth,firestore --project demo-painel "node rastreabilidade/dev.mjs --maquete publicacao/m1-1a/C1/maquete/maquete.html"
```

Cada execução cria pasta nova em `publicacao/rastreabilidade/demo-*/`. Nada é
publicado; o segredo é aleatório e fica apenas em memória. Encerrar com Ctrl+C.
Isso não substitui as cinco sessões M1.1 em celulares físicos.

`npm run test:rastreabilidade` verifica cliente, painel, HTTP e transações no
Firestore real emulado. `npm run test:regras` verifica isolamento no Firestore.

## Preparar um pacote de publicação

```powershell
node tools/montar_rastreabilidade.mjs --saida publicacao/rastreabilidade/pacote-novo --api https://api.exemplo.com/ --origem-publica https://imoveis.exemplo.com --site-base publicacao/site-validado
```

O destino deve ser novo. `--site-base` exige `estado.json` schema 1, inventário
com hashes SHA-256 de todos os arquivos e nenhuma entrada fora dele. A cópia
preserva `/b/**`, acrescenta `acesso.html` e módulos versionados e gera um
manifesto. Sem site-base, gera apenas o wrapper. **Montar não faz deploy.**

Para executar a API fora da demonstração: `node rastreabilidade/servidor.mjs`,
com `GCLOUD_PROJECT`, `TRACKING_SECRET` (segredo durável de ao menos 32 bytes),
`TRACKING_PUBLIC_ORIGIN`, `TRACKING_PANEL_ORIGIN`, `PORT` e, se necessário,
`TRACKING_BIND_HOST`. Usar HTTPS na frente da API; credenciais administrativas
ficam no servidor. O painel requer `NEXT_PUBLIC_TRACKING_API_URL` em sua build.
Em modo emulado, configurar Auth e Firestore juntos num projeto `demo-`.

Uma futura ativação precisa provisionar a API, configurar as origens reais,
aplicar índices/TTL de `firebase/firestore.indexes.json` e montar/buildar o
site e painel. A exclusão TTL é assíncrona; a API já recusa dados expirados.
O limite HTTP usa o endereço da conexão, sem confiar em cabeçalhos enviados
pelo cliente; um proxy de produção deve limitar tráfego no próprio edge.

## Limites e próxima extensão

A barra de endereço muda para um sublink após a abertura. Copiar esse endereço
preserva a cadeia e o corretor. Copiar a mensagem original fora da página não
gera uma etapa detectável. Uma nova entrada por sublink indica reutilização
dele; não comprova um encaminhamento entre pessoas. A profundidade máxima é 8.

Relatório cobre sessões com métricas aceitas, iniciadas no período, com tempo
ativo acumulado por página e seção principal exibida. Navegadores distintos
são estimativas; janela oculta e inatividade pausam a contagem. Dados detalhados
expiram em 30 dias, sem criar histórico retroativo.
Falhas de rede podem reduzir a cobertura: a fila local é limitada a 64 eventos
e o tempo que não foi observado não é reconstruído.

`Opening.contact` já resolve o corretor da raiz e o número público opcional em
`users/{brokerUid}.publicContact.whatsapp` (dígitos E.164, sem '+'). O responsável
cadastra nome e celular em **Meu perfil**, no painel. O botão verde de WhatsApp
na experiência abre a conversa com esse responsável, inclusive após repasses,
com o nome do imóvel e o link público atual. Não inclui recibos ou dados de sessão
e funciona sem aceite de métricas. Sem número válido, o botão fica oculto.
Nenhuma mensagem é enviada automaticamente.

Fontes: [History.replaceState](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState),
[Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event),
[Firestore TTL](https://firebase.google.com/docs/firestore/ttl).

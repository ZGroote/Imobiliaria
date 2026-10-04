# Publicação temporária do piloto visual

O usuário autorizou uma demonstração sintética pública por sete dias. Este
procedimento publica apenas o canal `qualidade-piloto-20261004` do site existente
`imobilaria-deccb-miniaturas`, projeto `imobilaria-deccb`. Os quatro canais live e
os quatro previews anteriores permanecem desativados. Não publicar produção,
clonar releases antigas ou copiar conteúdo das publicações anteriores.

## Preparar e conferir

A fonte versionada da configuração é `firebase.preview.json` nesta pasta. Depois
da montagem, copiar esse arquivo para
`publicacao/piloto-qualidade-visual-2026-10-04/firebase.preview.json`, fora de
`site/`. O Firebase CLI resolve `hosting.public` em relação ao diretório do
config e bloqueia caminhos fora dele; `public: "site"` na cópia aponta para a
saída correta. Não executar o deploy diretamente pela fonte em `experimentos/`.
A configuração tem apenas Hosting estático, sem callbacks, redirects, rewrites,
funções ou serviços de dados.

O montador deve copiar somente sua lista pública permitida para `site/`:
apresentação, maquete derivada, scripts visual e de diagnóstico local, planta SVG
e assets referenciados. Leitura, contexto, mobiliário, originais, relatório,
configuração e evidências ficam fora de `site/`. O manifesto e os créditos JSON
de montagem presentes em `site/` são excluídos do deploy pelo filtro `**/*.json`.
Os filtros de ignore são uma proteção adicional; não substituem a conferência
da lista e dos hashes de todos os arquivos efetivamente públicos.

Antes de publicar:

1. Executar os testes do montador e conferir hashes, licenças, limite de assets e
   ausência de arquivos extras ou symlinks no pacote.
2. Abrir localmente o pacote e verificar Base/Acabamentos na mesma câmera,
   Planta 2D, Planta 3D, Visita 3D e fallback de material indisponível.
3. Conferir que os dados e o mobiliário são sintéticos e a página os identifica
   como demonstração. Conferir ausência de endereço, contato, imóvel real, links
   legados, credenciais, SDK Firebase, API e analytics nos arquivos públicos.
   `metricas.js` calcula somente diagnóstico local de renderização em memória,
   sem envio, identidade de visitante ou persistência; não confundir com a API
   de rastreabilidade do produto.
4. Conferir que cada asset cacheável está em `/assets/<hash>/arquivo`, com hash
   hexadecimal de 12 a 64 caracteres que identifica seu conteúdo/conjunto.
   Arquivos de uma URL imutável não podem ser substituídos; uma alteração exige
   novo hash. HTML e nomes fixos usam `no-store`.
5. Ler os canais atuais e registrar suas releases `SITE_DISABLE`; verificar HTTP
   404 dos endereços anteriores, inclusive os domínios `firebaseapp.com`.
   Em 04/10/2026 às 16:28 UTC, os oito canais consultados permaneciam desativados.

O preview é público para quem conhece a URL. `noindex` reduz indexação e não
constitui controle de acesso. O pacote não depende de serviços do projeto;
previews compartilham recursos reais caso o frontend passe a utilizá-los.

## Publicar somente o novo preview

Executar na raiz do repositório, usando o CLI já instalado. Primeiro preparar a
cópia da configuração, depois do montador criar o pacote:

```powershell
Copy-Item -LiteralPath experimentos/piloto-qualidade-visual-2026-10-04/firebase.preview.json -Destination publicacao/piloto-qualidade-visual-2026-10-04/firebase.preview.json
```

Conferir que fonte e cópia têm o mesmo SHA-256 e que a pasta `site/` passou na
verificação acima. Publicar com a cópia:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js hosting:channel:deploy qualidade-piloto-20261004 --project imobilaria-deccb --config publicacao/piloto-qualidade-visual-2026-10-04/firebase.preview.json --only imobilaria-deccb-miniaturas --expires 7d --no-authorized-domains --non-interactive
```

`--only` recebe o site, sem o prefixo `hosting:` neste comando. O site também é
explícito na configuração; não depende de target nem altera `.firebaserc`.
`--no-authorized-domains` evita a sincronização do preview com Firebase Auth.
Não usar `--debug`, pois os logs detalhados podem incluir informações de conta.

Registrar em `publicacao/piloto-qualidade-visual-2026-10-04/`, fora do pacote
público: URL retornada, canal/site, `expireTime`, release/version, inventário e
hashes, horário e resultados das verificações. Repetir o deploy redefine a
validade; registrar a expiração efetivamente retornada, não inferir pelo nome.

Depois de publicar, verificar:

- HTTP 200, recursos sem falhas e comportamento visual dos modos na URL nova.
- Cabeçalhos `noindex`, `nosniff`, iframe de mesma origem e `no-store` do HTML;
  `immutable` somente nos assets com hash.
- Canal novo com expiração em sete dias e inventário igual à lista pública
  validada; nenhum arquivo de entrada, relatório ou manifesto publicado.
- Os oito canais anteriores conservam as mesmas releases `SITE_DISABLE` e 404.
  Os quatro domínios live `web.app` e `firebaseapp.com` continuam em 404.

Não interpretar browser emulado como homologação em aparelho físico nem como
aceite das cinco sessões M1.1-A. Este piloto não altera esse gate ou suas fontes.

## Encerrar apenas o piloto

Preferir uma release `SITE_DISABLE` no canal novo, preservando o registro da
publicação. Com autenticação administrativa já configurada, a operação é:

```http
POST https://firebasehosting.googleapis.com/v1beta1/sites/imobilaria-deccb-miniaturas/channels/qualidade-piloto-20261004/releases
Content-Type: application/json

{"type":"SITE_DISABLE"}
```

Sem `versionName`. Essa chamada exige autenticação; não incluir credenciais em
arquivos, URLs ou logs. Verificar 404 do preview após a operação e novamente os
canais anteriores. Não usar `hosting:disable` como reversão do preview: esse
comando do CLI atua na release live do site.

A exclusão do canal novo, prevista na SPEC, também o encerra, mas elimina seu
histórico. A expiração automática desativa o preview e agenda a remoção do canal,
releases e versões; guardar as evidências localmente antes do prazo.

## Fontes verificadas

- [Preview público e isolamento de canal](https://firebase.google.com/docs/hosting/test-preview-deploy).
- [Validade, expiração e gestão de canais](https://firebase.google.com/docs/hosting/manage-hosting-resources).
- [Cabeçalhos e ordem das regras](https://firebase.google.com/docs/hosting/full-config#headers).
- [Release por canal e SITE_DISABLE sem versionName](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels.releases/create).
- CLI local 15.29.0: `lib/commands/hosting-channel-deploy.js` (seleção de canal,
  validade e flag de Auth), `lib/detectProjectRoot.js` (diretório do config),
  `lib/deploy/hosting/release.js` (release no canal) e
  `lib/commands/hosting-disable.js` (desativação live).

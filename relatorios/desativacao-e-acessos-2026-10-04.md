# Desativação das publicações e dados de acesso — 04/10/2026

Todas as publicações identificadas nesta auditoria tiveram o acesso público
removido: oito canais Firebase Hosting, distribuídos em quatro sites, e um
artefato Claude. As 50 URLs verificadas nos 16 aliases do Hosting responderam
HTTP 404 com a página `Site Not Found`. O artefato passou de “Qualquer pessoa
com o link” para “Apenas você”, com o salvamento confirmado na interface oficial.

A medição disponível para os 30 dias anteriores ao corte soma
**3.638.272.036 bytes enviados pelo Hosting**, cerca de **3,64 GB decimais**.
**Quantidade de visitas, requisições e pessoas únicas: desconhecida.**
Transferência de dados não permite converter esse total em audiência.

O escopo é a hospedagem encontrada nas referências atuais e históricas do
repositório, no inventário Firebase e no artefato Claude. O resultado não
constitui uma auditoria das permissões dos serviços de dados ou de automações
externas não inspecionadas.

## Publicações desativadas

Projeto Firebase: `imobilaria-deccb`. Cada linha abaixo representa um canal
desativado por um release `SITE_DISABLE`. O hostname listado e seu equivalente
com sufixo `.firebaseapp.com` foram verificados, totalizando 16 aliases.
O inventário não retornou domínios personalizados nem domínios legados associados.

| Site | Canal | Hostname `.web.app` | Versão anterior registrada |
|---|---|---|---|
| `imobilaria-deccb` | `live` | `imobilaria-deccb.web.app` | `1855179e3c93c2eb` |
| `imobilaria-deccb-imoveis` | `live` | `imobilaria-deccb-imoveis.web.app` | `449c68257ba9d0ed` |
| `imobilaria-deccb-imoveis` | `cedros-leve-9d4038e55b87` | `imobilaria-deccb-imoveis--cedros-leve-9d4038e55b87-lcpk35mk.web.app` | `ad78f3f8197ab03f` |
| `imobilaria-deccb-imoveis` | `imovel-monte-dos-cedros-37` | `imobilaria-deccb-imoveis--imovel-monte-dos-cedros-37-tsa1t4fn.web.app` | `80caeabec21e295d` |
| `imobilaria-deccb-miniaturas` | `live` | `imobilaria-deccb-miniaturas.web.app` | `2769c1c05b7090a4` |
| `imobilaria-deccb-painel` | `live` | `imobilaria-deccb-painel.web.app` | `cd7778a879412a64` |
| `imobilaria-deccb-painel` | `m1-1a-capturador` | `imobilaria-deccb-painel--m1-1a-capturador-o99ctbtu.web.app` | `afb0918d6d0e730e` |
| `imobilaria-deccb-painel` | `m1-1b-capturador` | `imobilaria-deccb-painel--m1-1b-capturador-abs902ef.web.app` | `44d1bda010f3b2cb` |

Os horários dos releases informados pela API foram **11:16:53–11:16:56**,
em `America/Sao_Paulo`, em 04/10/2026. A leitura posterior da API confirmou
`SITE_DISABLE` nos oito canais. As sondagens HTTP abrangeram a raiz dos aliases,
`/__/firebase/init.js` e caminhos conhecidos de capturador, mapa, estado e
maquetes: **50/50 respostas HTTP 404 com `Site Not Found`**. A lista exata de
URLs, códigos, hashes e respostas da API está em
[desativacoes.json](../publicacao/desativacao-2026-10-04/desativacoes.json).
O estado anterior, incluindo canais e versões, está em
[inventario-antes.json](../publicacao/desativacao-2026-10-04/inventario-antes.json).

O [artefato Claude](https://claude.ai/artifact/JSqvSPTHCibgdGMVdtd3hx),
referenciado historicamente em `v1.5/miniaturas/README.md:82`, teve sua privacidade
confirmada às **11:24:54** na interface da conta criadora: “Apenas você”, somente
o autor com acesso e indicador “Salvando” encerrado. O artefato foi preservado.
Essa confirmação é da permissão salva; não houve teste posterior em sessão
anônima. Evidências:
[claude-privado.json](../publicacao/desativacao-2026-10-04/claude-privado.json) e
[captura sem dados de conta](../publicacao/desativacao-2026-10-04/claude-acesso-privado.jpg).

## Publicações históricas e gatilhos de nova publicação

As duas origens históricas `imobiliaria-v17.web.app` e
`imobiliaria-v17.firebaseapp.com` já responderam HTTP 404 com `Site Not Found`.
A consulta autenticada `GET projects/-/sites/imobiliaria-v17` também retornou
404 `not_found`, sem informar projeto proprietário. Não houve alteração nesse
site. O repositório `ZGroote/Imobiliaria` está privado e a API informa
`has_pages=false`. Evidência:
[checagens-historicas.json](../publicacao/desativacao-2026-10-04/checagens-historicas.json).

A árvore da branch padrão retornou somente `.github/workflows/ci.yml`, com
testes, build e emulador, sem publicação Hosting nem cron. Não havia runs
ativos ou na fila. O registro antigo “Runtime V2 Browser Smoke” ainda constava
como `active`, mas seu arquivo estava ausente na branch padrão, com HTTP 404.
A busca local encontrou zero automações Codex referentes ao projeto. Nenhum
workflow ou automação foi alterado. Esse levantamento não cobre automações
externas fora do repositório e do diretório local inspecionado. Evidência:
[gatilhos-publicacao.json](../publicacao/desativacao-2026-10-04/gatilhos-publicacao.json).

## Transferência medida nos 30 dias

Período consultado: **04/09/2026 11:10:48 a 04/10/2026 11:10:48**, em
`America/Sao_Paulo` (UTC−03). O corte precede as sondagens de desativação.
A consulta foi coletada às **11:14:44**; as últimas amostras disponíveis dos
quatro sites terminam aproximadamente às **07:02–07:03** de 04/10. Atraso da
métrica impede tratar esse período como observação até o último segundo do corte.

Foram somados os valores inteiros `DELTA` de nove séries retornadas pelo Cloud
Monitoring, sem alinhamento ou redução, usando
`firebasehosting.googleapis.com/network/sent_bytes_count`, recurso
`firebase_domain`. Essa métrica mede bytes enviados pelo Hosting.
[Definição oficial da métrica](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h#firebasehosting).
Consultas, respostas resumidas e agregações estão em
[acessos-fontes.json](../publicacao/desativacao-2026-10-04/acessos-fontes.json).

### Por site

| Site | Bytes enviados | Participação no total |
|---|---:|---:|
| `imobilaria-deccb` | 1.036.183.624 | 28,48% |
| `imobilaria-deccb-imoveis` | 1.478.601.026 | 40,64% |
| `imobilaria-deccb-miniaturas` | 1.105.483.349 | 30,38% |
| `imobilaria-deccb-painel` | 18.004.037 | 0,49% |
| **Total** | **3.638.272.036** | **100,00%** |

### Por domínio com série retornada

| Domínio | Bytes enviados | Participação no total |
|---|---:|---:|
| `imobilaria-deccb.firebaseapp.com` | 21.805 | 0,00% |
| `imobilaria-deccb.web.app` | 1.036.161.819 | 28,48% |
| `imobilaria-deccb-imoveis--cedros-leve-9d4038e55b87-lcpk35mk.web.app` | 45.886.804 | 1,26% |
| `imobilaria-deccb-imoveis--imovel-monte-dos-cedros-37-tsa1t4fn.web.app` | 535.913.926 | 14,73% |
| `imobilaria-deccb-imoveis.web.app` | 896.800.296 | 24,65% |
| `imobilaria-deccb-miniaturas.web.app` | 1.105.483.349 | 30,38% |
| `imobilaria-deccb-painel--m1-1a-capturador-o99ctbtu.web.app` | 2.934.323 | 0,08% |
| `imobilaria-deccb-painel--m1-1b-capturador-abs902ef.web.app` | 1.379.835 | 0,04% |
| `imobilaria-deccb-painel.web.app` | 13.689.879 | 0,38% |
| **Total** | **3.638.272.036** | **100,00%** |

Percentuais arredondados a duas casas decimais; a soma das participações por
site resulta em 99,99% por arredondamento. Os bytes das duas tabelas reconciliam
exatamente com o total do JSON. `0,00%` na primeira linha da tabela de domínios
é uma participação positiva inferior a 0,01%. Os demais aliases sem série
retornada não recebem uma estimativa de tráfego zero.

### O que permanece desconhecido

- Pessoas únicas, visitas, sessões e quantidade de requisições. Bytes incluem
  transferências de ativos, testes, automação e bots; o peso das maquetes altera
  o total sem indicar quantas pessoas as abriram.
- Última visita humana, origem geográfica, permanência, conversão e usuários
  autenticados que navegaram. O fim de uma amostra `DELTA` é um intervalo de
  medição, não o instante de uma visita identificada.
- Histórico completo anterior ao período consultado. Para essa classe de
  métrica, a documentação informa retenção de seis semanas.
  [Retenção do Cloud Monitoring](https://docs.cloud.google.com/monitoring/quotas#data_retention).

A consulta de logs web retornou zero entradas, e a métrica de contagem de
entradas para `firebase_domain` não retornou séries. Isso demonstra ausência
de dados recuperados nessa consulta, **não ausência de visitantes**. Exportar
logs do Hosting exige vincular os sites ao Cloud Logging; registros também
podem atrasar ou ser descartados. Nenhuma integração foi configurada nesta
auditoria.
[Logs de requisições do Hosting](https://firebase.google.com/docs/hosting/web-request-logs-and-metrics).

A consulta `projects.getAnalyticsDetails` retornou 404 `NOT_FOUND`: o projeto
não tem vínculo atual com Google Analytics. Isso não comprova ausência de
vínculo histórico. A busca local nas áreas descritas no JSON não encontrou
instrumentação Analytics; o estado da sessão Auth e os `auditLogs` de ações
operacionais não constituem histórico de navegação.
[Definição de getAnalyticsDetails](https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/getAnalyticsDetails).

## Reversibilidade e preservação

A operação criou releases de desativação no Hosting. Não houve exclusão manual
de sites, canais ou versões, nem alteração em Firestore, Auth ou Storage.
As referências às versões anteriores e suas configurações foram registradas
no inventário para eventual recuperação enquanto disponíveis. Esse registro
não é um backup completo do conteúdo. O mecanismo utilizado para cada canal foi:

```http
POST https://firebasehosting.googleapis.com/v1beta1/sites/SITE_ID/channels/CHANNEL_ID/releases
Content-Type: application/json

{"type":"SITE_DISABLE"}
```

Para `SITE_DISABLE`, `versionName` deve ficar ausente. A API aceita canais
`live` e de preview nesse endpoint.
[Referência oficial de criação de releases](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels.releases/create).

Se houver autorização futura para republicar, uma versão ainda disponível
pode voltar ao **mesmo canal existente**, criando outro release com
`versionName=sites/SITE_ID/versions/VERSION_ID` e corpo `{}`. Os IDs da tabela
e o campo `previousVersion` do JSON permitem selecionar a versão anterior.
A recuperação não foi executada nem está autorizada por este relatório.

A desativação **não estendeu a validade dos previews**; `expireTime` permaneceu
igual antes e depois. As validades observadas, em `America/Sao_Paulo`, são:

| Preview | Expiração registrada |
|---|---|
| `cedros-leve-9d4038e55b87` | 05/10/2026 10:24:32 |
| `m1-1b-capturador` | 08/10/2026 01:42:29 |
| `m1-1a-capturador` | 09/10/2026 13:48:16 |
| `imovel-monte-dos-cedros-37` | 26/10/2026 19:06:22 |

Depois da expiração, o Firebase pode remover canal, releases e versões
associadas; a retenção de releases também limita a disponibilidade histórica.
Preservação nesta operação não significa conservação indefinida. Recuperar a
mesma URL depende de o canal ainda existir.
[Ciclo de vida de canais, releases e versões](https://firebase.google.com/docs/hosting/manage-hosting-resources).

## Continuidade local

As publicações públicas identificadas estão offline. O pacote M1.1-A em
`publicacao/m1-1a/rodada-2026-10-04/` permanece preparado localmente na
baseline `4586e7c`; **sessões físicas atuais: 0/5**. As sessões usarão o pacote
local/LAN, com as publicações públicas permanecendo desativadas. O
[plano de preparação](../tasks/miniaturas/m1-1a-preparacao-2026-10-04.md), o
protocolo e os fingerprints congelados não foram alterados.

A verificação `python tools/preparar_sessoes_m1_1a.py --verificar
publicacao/m1-1a/rodada-2026-10-04` terminou com código 0 e conferiu os
fingerprints de 43 arquivos na baseline completa
`4586e7cec78155369ea10cdc37fc0418ada02e61`. Isso confirma integridade do pacote
local; as sessões físicas continuam pendentes.

As evidências em `publicacao/desativacao-2026-10-04/` são arquivos locais,
ignorados pelo Git; podem não existir em outro clone. Este relatório mantém
apenas identificadores de publicações, agregados e horários, sem credenciais,
tokens, endereços IP, e-mails ou identificação de visitantes.

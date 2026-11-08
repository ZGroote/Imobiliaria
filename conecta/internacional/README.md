# Conecta em português e inglês

Atualizado em 03/11/2026. Projeto Firebase: `imobilaria-deccb` (número `163406298617`).

| Endereço | Hosting | Página inicial |
| --- | --- | --- |
| `https://conectaimoveis3d.com.br/` | `imobilaria-deccb-miniaturas` | Português, `site/index.html` |
| `https://conectaimoveis3d.com/` | `imobilaria-deccb-global` | Inglês, `site/index.en.html` publicado como `/index.html` |

As fontes ficam em `experimentos/apresentacao-2026-11-01/`. Cada site recebe seus próprios `assets/`, `fonts/` e `demo/` na raiz. O visualizador permanece na mesma origem da landing para conservar suas APIs, cenas preparadas e controles entre os iframes.

O domínio brasileiro conserva os arquivos e as rotas anteriores: maquetes, painel, login, documentos legais e regras que encaminham conteúdos protegidos para a função. Os links legais da página inglesa continuam apontando aos documentos em português no `.com.br`; nenhuma tradução jurídica foi criada.

## Idioma e sugestão regional

`site/idiomas.js` oferece a escolha manual PT/EN, conserva a âncora ao trocar de domínio e registra a escolha em `localStorage`. O parâmetro `?lang=en` ou `?lang=pt-BR` informa a escolha explícita ao domínio de destino. Em localhost/prévias, a troca usa `index.html` e `index.en.html` no mesmo diretório.

A região apenas sugere outro idioma. Não há redirecionamento geográfico automático nem pedido de localização do dispositivo. A consulta não bloqueia a maquete e tem limite de três segundos; falhas mantêm a página aberta. A escolha manual tem prioridade.

O Hosting configura `i18n.root` como `/locales` e seleciona o recurso pelo país do IP, independentemente do idioma do navegador:

| Recurso | Conteúdo |
| --- | --- |
| `/region.json` | `{"country":null,"locale":"en"}` |
| `/locales/ALL_br/region.json` | `{"country":"BR","locale":"pt-BR"}` |

Ambos usam `Cache-Control: private, no-store`. O JSON só distingue Brasil do resultado padrão. No `.com.br`, `/index.en.html` redireciona com 302 para o `.com`; no global, `/index.pt.html` redireciona para o `.com.br`.

## Tradução, build e testes

Edite o HTML português em `site/index.html` e as traduções em `i18n/en.json`. `i18n/build.py` gera `site/index.en.html` e `site/i18n.js`, validando textos ausentes, chaves repetidas e parâmetros de tradução. Os textos dinâmicos da landing usam `ConectaI18n.t()`.

Os rótulos da demonstração são traduzidos por `demo-i18n.js`, copiado pelo gerador para o demo. Essa camada conserva os dados e a API do viewer. `site/demo/` é gerado e ignorado pelo Git; alterações do viewer passam por `clonar_demo.py`, que também preserva a anonimização, as plantas originais, a luz aprovada e o preparo antecipado.

Na raiz do repositório:

```powershell
# Reconstruir o demo quando suas fontes mudarem.
python experimentos/apresentacao-2026-11-01/clonar_demo.py

# Gerar o inglês e seu runtime após editar os textos.
python experimentos/apresentacao-2026-11-01/i18n/build.py
python experimentos/apresentacao-2026-11-01/i18n/build.py --check
python -m unittest discover -s experimentos/apresentacao-2026-11-01/i18n -p test_build.py
node --test tests/test_apresentacao_idiomas.mjs tests/test_publicar_internacional.mjs
node --test tests/test_apresentacao.mjs tests/test_apresentacao_cache.mjs
node --test experimentos/apresentacao-2026-11-01/test_geometria.mjs
```

Para a inspeção local, sirva `experimentos/apresentacao-2026-11-01/site` por HTTP e confira `index.html` e `index.en.html`. A inspeção em navegador continua necessária para tradução do demo, controles, celular e CSP.

## Publicação sem substituir o restante do site

`publicar.mjs` lê a configuração e o inventário completos de cada Hosting. O plano mantém os hashes dos arquivos existentes e acrescenta/substitui somente os caminhos da apresentação. Não monta a versão brasileira a partir de uma pasta isolada.

A preparação grava blobs gzip por arquivo, com fila de quatro, e registra os inventários/configurações anteriores e propostos. A publicação envia apenas os hashes pedidos pelo Hosting. Não mantém o pacote inteiro em um buffer. As novas regras de CSP são específicas de `/` e `/index.html`, com hash dos scripts inline, conexões e frames da mesma origem. As regras legais e de outros produtos são preservadas; as duas regras de região são mescladas sem duplicação.

Antes de criar versões e imediatamente antes dos releases, o publicador confere versão, configuração e inventário. Também verifica os blobs congelados e recompõe a configuração proposta. A comparação aceita o ID e o número conhecidos deste projeto, mantendo site e ID de versão iguais. Evite outro deploy simultâneo: a API não fornece uma comparação e troca atômica para o release.

Sem argumentos, `node conecta/internacional/publicar.mjs` apenas prepara; `--publicar` é a operação que cria versões e releases. O diretório padrão pertence ao journal inicial de 03/11, preservado como histórico parcial. **Para uma nova revisão, use uma pasta nova pelos exports abaixo.** Não reutilize um journal que já contenha `publicado.json`.

```powershell
# Troque a identificação por uma revisão nova. Execute da raiz do repositório.
$conectaJournal = 'publicacao/internacionalizacao-AAAAMMDD-REVISAO'

# Só prepara e salva o plano; não altera o Hosting.
node --input-type=module -e "import {prepare,firebaseRemote} from './conecta/internacional/publicar.mjs'; await prepare({out:process.argv[1],remote:await firebaseRemote()});" "$conectaJournal"

# Após conferir o plano e o build testado, publica exatamente os blobs preparados.
node --input-type=module -e "import {publish,firebaseRemote} from './conecta/internacional/publicar.mjs'; await publish({out:process.argv[1],remote:await firebaseRemote()});" "$conectaJournal"
```

Os dois sites são finalizados antes dos releases. O global entra primeiro, seguido do brasileiro. O journal de publicação é gravado após cada release para registrar também uma eventual conclusão parcial. Uma corrida detectada interrompe a operação; prepare outra pasta a partir do estado remoto atualizado.

## Verificação pública de 03/11

As duas origens principais responderam com HTTPS validado e HTTP 200. O `.com.br` publicou a fonte portuguesa exata, com `Content-Language: pt-BR`; o `.com` publicou a fonte inglesa exata, com `Content-Language: en`. Os arquivos da landing e os pontos de entrada do demo conferiram com as fontes locais. Os dois endereços `www` responderam com 301 para seus domínios raiz.

O teste oficial com o cookie `firebase-country-override` confirmou Brasil → `pt-BR` e Estados Unidos → `en` nos dois sites, com `Cache-Control: private, no-store`. A escolha no site continua opcional, conforme a seção de idioma acima. O relatório está em `publicacao/internacionalizacao-20261103-conclusao/verificacao-http.json`; os cinco registros públicos de DNS estão em `dns-publico.json` na mesma pasta.

O Firebase ainda informava `CERT_PROPAGATING` para o `.com` e seu `www`, embora as conexões HTTPS testadas já tenham validado normalmente. A inspeção local anterior conferiu os quatro modos em inglês e a preservação das cenas. A inspeção visual final da produção foi interrompida porque o uso do navegador local foi desativado no Work; isso não substitui a validação visual em outros dispositivos.

Passaram 68 testes automatizados de navegação, cache, idioma, plantas traduzidas, vínculos e destaque das vagas, publicação, geometria e recursos de iluminação. Um caso de criação de link simbólico foi ignorado porque este Windows não permite criá-lo; a validação de caminhos permanece ativa. Não houve commit destas alterações.

## Journals e reversão

Entrega concluída em `publicacao/internacionalizacao-20261103-conclusao/`:

- `.com.br`: versão `b78e933224eeea36`, 1.681 arquivos; 300 alterados e 1.381 preservados.
- Global: versão `76ebc5e2b6524f38`, 302 arquivos; conteúdo idêntico ao primeiro release inglês.
- `integridade.json`: `PASS` para os dois sites, registrado em 03/11/2026 às 19:30 UTC.

`publicacao/internacionalizacao-20261103/` conserva o primeiro journal, que registrou o release global antes de uma divergência entre alias e número do projeto interromper a verificação. A conclusão foi feita em outra pasta; não apague nem reescreva esse histórico.

A revisão de rótulos fica em `publicacao/internacionalizacao-20261103-rotulos/`: corrige duas frases completas de acessibilidade da maquete para evitar rótulos mistos em inglês. Alterou somente cinco arquivos do demo em cada site. Versões: global `ddf4bf775725aad8` e brasileiro `7cee48e805e9769d`, publicadas às 19:48 UTC. A integridade dos dois inventários passou novamente. As versões anteriores dessa revisão já contêm a apresentação traduzida.

A revisão das plantas está em `publicacao/planta2d-en-20261103/publicacao/`: traduz os dez nomes embutidos em cada planta 2D, seleciona os PNGs ingleses pelo idioma e renova as revisões do script e do iframe para evitar a cópia antiga do navegador. A régua, as máscaras, o zoom e o cache mantêm o registro original. A comparação dos pixels confirmou zero alterações fora das áreas dos nomes; os JPEGs portugueses permanecem exatos. Versões: global `73e0a3bb6d9087b0` e brasileiro `01a24ef2a302e2ed`, publicadas às 20:08 UTC. Integridade `PASS` e vinte verificações HTTP públicas com bytes idênticos às fontes. Os assets e o prompt estão em `experimentos/apresentacao-2026-11-01/plantas2d-en/README.md`.

A revisão mais recente está em `publicacao/vagas-apresentacao-20261103/publicacao/`: restaura os vínculos locais entre os 170 apartamentos e suas vagas. A ficha conservava o texto da vaga, mas a lista usada pelo destaque ficava vazia após a retirada da integração com o cadastro remoto. Um wrapper exclusivo da apresentação recompõe essa lista na carga inicial e a cada atualização, sem alterar o módulo comercial original, os dados ou as 175 posições físicas. Os testes cobrem seleção com filtro verde desligado, troca, limpeza, atualização, pulso e chegada tardia do mapa. Versões: global `35526e426e4bda28` e brasileiro `1c6cc1a51b7f023c`, publicadas às 20:25 UTC. Integridade e vinte verificações HTTP: `PASS`. As revisões do script e do iframe foram renovadas para a próxima abertura carregar a correção.

Cada journal contém `preflight.json`, `blobs/`, `br/antes.json`, `global/antes.json`, configurações/inventários/diferenças, `versoes-preparadas.json` e `publicado.json`. Os `previousVersion` de `publicado.json` permitem voltar à versão anterior sem reconstruir seus arquivos. No journal de conclusão, o anterior do global já é a primeira apresentação inglesa; o anterior brasileiro é o institucional anterior.

Exemplo de reversão **somente do brasileiro**, recusando executar se houver um release posterior. Use o journal correspondente à versão que pretende reverter:

```powershell
@'
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {TARGETS,firebaseRemote,sameHostingVersion} from './conecta/internacional/publicar.mjs';
const out='publicacao/internacionalizacao-20261103-conclusao';
const target=TARGETS.find(item=>item.id==='br');
const journal=JSON.parse(await readFile(out+'/publicado.json','utf8'));
const record=journal.sites.find(item=>item.site===target.site);
assert(record?.previousVersion,'Não há versão anterior registrada para este site.');
const remote=await firebaseRemote(),current=await remote.snapshot(target);
assert(sameHostingVersion(current.version,record.version),'Há publicação posterior; reversão interrompida.');
const release=await remote.release(target,record.previousVersion);
await writeFile(out+'/rollback-br-'+Date.now()+'.json',JSON.stringify({site:target.site,from:current.version,to:record.previousVersion,release,at:new Date().toISOString()},null,2)+'\n');
'@ | node --input-type=module
```

A reversão não altera DNS, o outro site nem o journal original. Se não houver versão anterior, não desative o site como substituto automático da reversão.

## Domínio `.com` e DNS

O cadastro no Firebase e o DNS na Spaceship são operações separadas. Consulte os estados e os valores atuais exigidos pelo Firebase, incluindo TXT de propriedade e eventual validação do certificado:

```powershell
node conecta/internacional/dominios.mjs --resumo
```

Sem `--vincular`, esse comando apenas consulta o remoto e atualiza o registro local `publicacao/internacionalizacao-20261103/dominios.json`. `--vincular` cria/vincula site e domínios; não é necessário repeti-lo para consultar o estado.

| Tipo | Nome na zona `conectaimoveis3d.com` | Valor |
| --- | --- | --- |
| A | `@` | `199.36.158.100` |
| CNAME | `www` | `imobilaria-deccb-global.web.app` |
| TXT | Nome indicado pelo Firebase | Valor exato de `dominios.mjs --resumo` |

Preserve os registros de e-mail e demais TXT existentes. Troque somente registros de estacionamento/conflitantes dos hosts envolvidos; não altere o DNS do `.com.br`. O Firebase configura `www.conectaimoveis3d.com` para encaminhar ao domínio raiz. A publicação dos arquivos não comprova propagação DNS ou emissão de HTTPS: confira os estados de propriedade/host/certificado e abra ambos os domínios após a configuração.

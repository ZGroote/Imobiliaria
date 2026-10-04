# Avaliação do projeto — 04/10/2026

**Registro anterior à limpeza.** Os achados abaixo descrevem o estado inspecionado antes
das correções. O resultado posterior, com validações e pendências, fica em
[tasks/organizacao-2026-10-04.md](../tasks/organizacao-2026-10-04.md).

## Diagnóstico

O projeto tem uma base técnica integrada para capturar a planta, validar e normalizar a geometria, salvar snapshots imutáveis, fixar uma versão no pedido e gerar uma maquete LEVE controlada. A evolução mobile e os cômodos compostos já entraram na main. A publicação por imóvel também tem identidade por conteúdo, aprovação de manifest e reversão prevista.

O ponto atual é consolidar os experimentos e homologar a operação real pelo celular. Móveis, pavimentos e geração em um clique avançaram localmente, mas têm lacunas entre interface, persistência e artefato. O próximo marco do Plano Diretor continua sendo a homologação M1.1, seguida pela retirada do CV e pela automação operacional M2.

Esta avaliação cruza Git local, GitHub atual, Plano Diretor original, checkpoints, código, suítes e evidências de navegador. Não altera o código da aplicação, não publica e não modifica dados de produção. As prioridades abaixo são propostas, não autorização para executar marcos posteriores.

## Referências atuais: código, experimento e produção

| Referência | Estado verificado |
|---|---|
| Main remota | `d4a0307061beaccb373247da00f11b26c087cdb3`, merge #83 de 01/10; CI concluído com sucesso |
| Checkout local | Branch `feat/m1-construtor-planta-painel`, HEAD `f68f9a4`, um commit de comparativo 3D sobre a main |
| Trabalho local adicional | 12 arquivos rastreados modificados; +2.138/−161 linhas. O status inicial tem 745 entradas não rastreadas, incluindo diretórios; isso não equivale a 745 arquivos novos do produto |
| Conjunto versionado | 1.070 arquivos no índice, 216,21 MiB de blobs; não é o tamanho do histórico Git nem do diretório inteiro |
| Fonte urbana ativa | `v1.5/renderizador-v16-moveis/`. `v16-moveis` é a chave técnica; v15/v17 locais não comprovam variantes ativas |
| Produção pública do site de imóveis | Cedros atual `9d4038e55b87`, anterior `34331f1ceb9d`; promoção registrada em 28/09 |
| Integridade pública observada | Os dois manifests HTTP têm SHA-256 igual ao informado por `estado.json` |
| Outros sites públicos | Raízes de mapa, miniaturas e painel responderam HTTP 200. Isso não identifica o commit servido nem comprova fluxos autenticados |
| PRs experimentais abertos | Drafts #68 Runtime V2, #71 CV/croqui e #82 Instagram WebView |
| Visibilidade GitHub | Repositório principal público, divergindo da política registrada para dados reais privados |

Consulta HTTP/GitHub em 04/10/2026, aproximadamente 06:48 BRT. O manifest do Cedros atual informa maquete de 3.360.818 bytes; o anterior informa 43.709.682 bytes. São tamanhos brutos de artefato, não bytes transferidos nem medida de qualidade equivalente. Nesta avaliação os manifests foram conferidos; os grandes HTMLs do live não foram novamente baixados para verificar seus hashes.

Fontes: [CI da main](https://github.com/ZGroote/Imobiliaria/actions/runs/36894126417), [estado público](https://imobilaria-deccb-imoveis.web.app/estado.json), `tasks/checkpoints/m0a-2026-09-30.md` e Git local. Não foram consultados dados privados atuais de Firestore, regras implantadas ou elegibilidade de rollback.

## Validação feita nesta avaliação

| Verificação | Resultado | Limite |
|---|---|---|
| `npm test` | 186/186 passaram, sem skips | Inclui testes e fontes ainda não versionados presentes neste disco |
| `npm run test:py` | 305 executados; 303 passaram e 2 falharam | As falhas são inventários do comparativo: imagens e HTMLs grandes |
| TypeScript do painel | Passou | Confere o disco atual, que contém componentes não rastreados |
| Build do painel | Passou; 23 rotas, Next 16.3.6 | Build local não é deploy nem homologação física |
| Testes do painel no emulador | Não executaram | Firebase abortou porque `java -version` não está disponível no PATH |
| Testes de regras no emulador | Não repetidos localmente | Mesma dependência de Java; CI da main está verde, mas não cobre este conjunto local adicional |
| `git diff --check` | Falhou | Linha em branco extra no fim de `capturador.module.css:191`; baixa prioridade |
| A/B no navegador | Sem erros JS/HTTP na abertura; 1280×800 e 390×844 com toque emulado | Chrome 154, GPU desktop GTX 1650; não é teste de aparelho físico nem benchmark 3G |
| Destino ocupado do gerador | Perda de arquivo sentinela reproduzida em pasta temporária | Nenhum arquivo real foi usado na reprodução |
| Auth/CORS da nova rota | Processamento sem token e origem falsa refletida reproduzidos em loopback | Não há evidência de implantação/exposição dessa rota em produção |
| Lote local de dez casas | 10/10 hashes finais divergentes do relatório; 2/10 tamanhos divergentes | Os arquivos finais foram alterados após o relatório E2E |

As falhas Python vêm de `tests/test_dados_privados.py:98` (11 JPGs sem classificação) e `tests/test_tamanho_versionado.py:118` (os dois HTMLs A/B acima de 1 MiB sem exceção justificada). Os gates estão detectando desvios reais da política; não devem ser removidos para obter verde.

## Achados prioritários

### 1. Perda de dados ao gerar em destino ocupado — P1, reproduzido

`pipeline/gerar_maquete.py:218–222` usa `shutil.rmtree` no destino não vazio antes de executar o validador. Uma leitura inválida foi recusada, mas o arquivo sentinela anterior já tinha sido apagado. O E2E canônico recusa `DESTINO_OCUPADO` em `pipeline/e2e_leitura.py:314`.

Correção proposta: manter a recusa para destino ocupado e validar antes de qualquer substituição. Preservar montagem em diretório temporário e promoção segura. O diff local do E2E também substituiu a promoção por movimentos arquivo a arquivo (`e2e_leitura.py:343–355`); isso cria risco de saída parcial em falha/concorrência, ainda não reproduzido nesta avaliação.

Aceite: entrada inválida e falha injetada preservam integralmente o destino anterior; nenhuma saída parcial fica publicada como válida.

### 2. Interface mostra dados que não chegam à maquete — P1, confirmado por código

O capturador exporta móveis e chama `onGerar3D(json, moveisStr)` (`Capturador.tsx:844–846`), mas a página aceita apenas `json` (`page.tsx:62`). O fallback também envia só a leitura. A API recebe `contextoJson` e o ignora ao chamar Python (`tools/leitura-api.mjs:27–31`).

Consequência: os móveis desenhados e o contexto preparado na página não acompanham a geração. O gerador acaba sintetizando identidade `casa-3d`/`agA`, prédio quadrado e dados comerciais padrão. A própria página também usa contagens e modalidade fixas (`page.tsx:63–75`), portanto apenas transmitir esse objeto ainda não resolve o contexto real.

Correção proposta: definir um payload explícito para leitura, contexto cadastral e mobília; preservar a separação entre geometria declarada e dados comerciais. No fluxo de imóvel real, exigir dados disponíveis e registrar lacunas; contexto sintético deve ter modo demonstrativo explícito.

Aceite: título/agência/imóvel corretos e móveis posicionados aparecem no HTML final; troca de dado comercial não altera a identidade geométrica; campos ausentes não viram características inventadas.

### 3. Pavimentos e móveis não têm round-trip completo — P1/P2

Os pavimentos vivem em sessões locais separadas. `save()` salva apenas `json` da sessão ativa (`Capturador.tsx:825–828`); o contrato emitido não identifica pavimento (`modelo.ts:672–683`). Carregar `initialSession` recria somente a sessão de índice 0 (`Capturador.tsx:100–103`). Os downloads separados não constituem persistência de uma unidade com dois andares.

Os testes novos de pavimentos verificam sessões independentes do modelo. Os de móveis verificam modelo/exportação companion. Não cobrem salvar → fechar → carregar → trocar pavimento → gerar 3D com os mesmos dados.

Correção proposta: formalizar documento de edição/companion e identidade de pavimento, com persistência e reabertura. Escolher explicitamente o escopo de geração por andar ou unidade completa.

### 4. Nova rota enfraquece a fronteira autenticada — P1 antes de hospedar

`/gerar-maquete` executa antes da autenticação (`tools/leitura-api.mjs:104`, auth somente em `:128–130`). A nova política CORS aceita qualquer origem contendo `.web.app` (`:99`), incluindo `https://site.web.app.atacante.example`, confirmado localmente.

O CLI continua ligado a `127.0.0.1`; não se afirma exploração ou exposição pública atual. Antes de servir remotamente, restaurar origens exatas e conferir usuário/papel/agência/imóvel no servidor, ou isolar a prévia como serviço explicitamente local. Preservar limites já existentes de tamanho, concorrência e timeout.

### 5. Relatórios deixam de identificar o artefato final — P1 para homologação

`tools/benchmark_10_casas.mjs:449–465` altera iluminação no HTML por regex depois de gerar a prova E2E. A verificação atual encontrou SHA-256 divergente em todas as dez casas; casas 06/07 também divergem em bytes.

Correção proposta: representar variações como entradas de contexto/perfil antes da geração. Executar QA e calcular hash depois da transformação final. O lote é útil como exercício e teste de carga, mas os relatórios existentes não comprovam os HTMLs finais.

### 6. Reprodutibilidade e política de dados precisam acompanhar o experimento — P1

Os diffs rastreados importam componentes que ainda são não rastreados (`Movel2D.tsx`, `PainelMoveis.tsx`, `catalogoMoveis.ts`) e chamam `pipeline/gerar_maquete.py`, também não rastreado, que importa `avaliar_captura.py`. Os testes novos de geração dependem de `publicacao/m1-1a/C1/leitura.json`, ignorado pelo Git. Commitar apenas as modificações rastreadas produziria um conjunto incompleto.

Além disso, a API GitHub confirmou visibilidade pública, enquanto `tasks/higiene-repositorio/dados-privados.md` classifica cadastros/modelos reais como privados e o checkpoint de higiene exige repositório privado pelo histórico. Regularizar a visibilidade ou registrar uma política explícita e migrar/sanitizar o conteúdo correspondente. Não foi detectado nem afirmado vazamento de credenciais nesta avaliação.

Aceite: clone limpo reproduz testes/build sem arquivos secretos ou de `publicacao/`; inventários aprovados cobrem novas imagens/arquivos grandes; visibilidade e política documentada concordam. Não usar `git add .` sobre este checkout misturado.

## O que aproveitar dos testes e experimentos

| Frente | Valor comprovado | Destino proposto |
|---|---|---|
| Capturador mobile, portas compartilhadas e mesclar/separar | Implementação integrada com contrato e regressões; ataca atrito observado no piloto | Manter como base da homologação M1.1 |
| Móveis 2D e abertura interativa local | Úteis para esclarecer e decorar a captura | Completar integração/persistência antes de ampliar catálogo |
| Pavimento superior | Cobre necessidade real de casas/sobrados | Formalizar round-trip; hoje é protótipo de edição |
| Geração 3D em um clique | Reduz distância entre desenho e resultado visual | Aproveitar depois de corrigir destino, contexto, auth e dados companion |
| Lote de dez casas | Exercita variedade e geração repetida | Recalcular prova final; não substitui casos reais nem as 30 unidades do M5 |
| Qualidade progressiva Cedros | Medições reproduzíveis de rede/CPU, com limites declarados | Prioridade de desempenho após integração básica |
| Comparativo A/B recente | Hipótese visual; ambas as páginas abriram no navegador | Manter experimental; corrigir métricas e banner antes de decidir arquitetura |
| `teste melhoria grafica` | Tipologia, telhados, semente por centroide e sRGB já existem na fonte atual | Tratar como histórico; não reimplementar a mesma técnica |
| Runtime urbano V2 (#68) | Spike separado de streaming | Avaliar com protocolo M3; não escolher pela existência do PR |
| CV/croqui (#71) | Ativos potencialmente reutilizáveis | Seguir depreciação e retirada após homologação; não retomar como via principal |
| Instagram WebView (#82) | Canal real de distribuição a investigar | Teste em aparelho e app reais depois de URLs/payloads estáveis |

### Comparativo A/B: não tratar a tabela atual como benchmark

`metricas_comparativo.json` registra FPS mobile, VRAM, abandono, custos e tempos de rede sem evidência de coleta correspondente. Há inconsistências objetivas: B anuncia 7.820 KB gzip e 11 requisições secundárias; o teste local observou HTML gzip de cerca de 420 KB, pasta de JPGs de 2,51 MB e nove requisições secundárias. HDRI e normal do tapete existem, mas não são carregados. Os geradores produzem texturas procedurais com NumPy/PIL, apesar do texto dizer que são fotografias escaneadas.

No enquadramento inicial de desktop/mobile, o ganho visual do B foi pequeno. Isso não avalia close-ups internos. Em 390×844 os banners de ambos extrapolam a tela e cortam texto/CTA. O teste usa GPU desktop e não sustenta a promessa de 60 FPS em celular de entrada, abertura em 1,7 s no 3G ou taxa de abandono.

Recomendação: separar hipóteses/estimativas de medição; registrar bytes HTTP, aparelho, cache, FPS p50/p95, tarefas completas e capturas equivalentes. O estudo pode continuar como teste de material, com menor prioridade que a integração.

Observações e capturas desta auditoria estão em `relatorios/avaliacao-2026-10-04/evidencias-ab/`. As capturas mobile mostram o banner cortado. São evidências de layout e da abertura nas condições descritas, não homologação de FPS.

### Qualidade progressiva: atacar CPU e sequenciamento da luz

O estudo `experimentos/qualidade-progressiva-cedros/medicao-rede.md`, de 04/10, tem método e dados crus. Em rede emulada 4G fraca, primeiro quadro LEVE/PREMIUM ficou em 1,49/1,58 s, mas o PREMIUM chegou à luz exterior em 15,2 s. No perfil Lighthouse, primeiro quadro ficou em 5,05/5,25 s, e a luz exterior em 51,2 s. Esses números são de desktop com rede/CPU emuladas, não aparelhos físicos.

Ao entrar na visita, o pior quadro travado foi de 1,2–1,3 s no LEVE e 2,5–2,9 s no PREMIUM. O loader da luz interior espera o bake por vértice terminar (`lightmap-v3.js:81`), embora o atlas o substitua depois. Separar início do download, montagem de geometria e qualidade final; repartir trabalho de CPU e cancelar/deferir trabalho desnecessário durante interação. Confirmar causalidade e ganho em aparelho real antes de promover.

O padrão PREMIUM aprovado do Cedros deve ser preservado como referência. Colinas e Castanheiras ainda não receberam esse bake. Investigar também o pico de memória e recuperação de erro: o estudo estima 104 MiB de texturas e observa heap de 158–204 MiB no PREMIUM; erro do lightmap interno hoje pede recarregar, e o exterior registra o erro no console. Progresso, cancelamento e nova tentativa têm utilidade direta para o usuário.

## Pendências dos planos

Plano Diretor original: `C:/Users/respawn/Downloads/Plano_Diretor_Imobiliaria_v2.docx`, SHA-256 `4242212e45ba73f809e882d79bc273176eb37f5729e4f8fcb8bfdaf34111c5bb`. Também consultados os checkpoints e o chat “Plano de ação encadeado”, que após o merge #83 libera cinco sessões M1.1-A sobre a baseline `d4a0307`, sem mudança funcional durante a medição.

| Marco do diretor | Estado | O que falta |
|---|---|---|
| M0-A/B/C | Implementações concluídas e integradas (#72–74) | Atualizar retrato e resolver regressões de inventário do novo experimento |
| M1-0/A/B/C | Implementações concluídas (#75–78), com evolução de geometria no #83 | Homologação física no fluxo real |
| M1-D/E/F entregues no repo | Persistência, fixação e E2E controlado aceitos (#79–81) | Reconciliar escopo com metas operacionais do documento original |
| Fotos/referências do M1-D original | Parcial | Schema preserva referências; capturador emite `references: []`, sem vínculo de foto |
| Contexto do painel do M1-E original | Parcial | Resolver dados reais de agência/imóvel/prédio/perfil/modalidade; corrigir descarte na API |
| Primeiro caso real mobile → LEVE do M1-F original | Parcial | A prova integrada foi controlada/sintética; demonstrar captura real sem JSON manual até artefato correto |
| M1.1-B/C | Integrados pelo #83 | `DOCUMENTACAO.md` ainda diz “em revisão” para B/C1 |
| M1.1-A / fechamento M1.1 | Pendente de homologação completa | Cinco sessões físicas, métricas e critérios; há evidência C1 local, insuficiente para fechar o conjunto |
| M1.2 | Pendente após homologação | Retirada do CV conforme mapa de dependências, preservando ativos úteis |
| M2 operacional | Fundação parcial | Job idempotente/transacional, worker, lease/heartbeat, retry/cancelamento e publicação reconciliável; consulta de job ativo seguida de batch ainda permite corrida (`buildjob.mjs:61–92`) |
| M3 urbano | Pendente como decisão | Protocolo V1 × V2 × híbrido, causa do cold start e relatório de escolha |
| M4 | Pendente | Implementação/rollout da arquitetura escolhida no M3 |
| M5 | Pendente | 30 imóveis em ondas 10+10+10, tempo humano/máquina, custo, bloqueios, retrabalho e falhas mobile |

Os nomes M1-D/E/F mudaram de significado nas entregas posteriores aceitas. Esta avaliação não reabre automaticamente PRs aprovados: registra os objetivos originais ainda não comprovados para que a continuidade seja explícita.

O roteiro antigo `tasks/miniaturas/fabrica.md` usa **outros nomes**: M1 é runner local (implementado), M2 é LEVE genérico (implementado para perfis suportados), M3 é PREMIUM por jobs (pendente), M4 é build+preview automático (build existe; runner registra `preview.executed: false`), M5 é lote de 30. “M2 LEVE entregue” não fecha o M2 operacional do diretor.

Planos anteriores:

- **Modularização:** aceite concluído em 18/09 para São Carlos/v16-moveis. Não reabrir checklists históricos por estarem desmarcados.
- **Proporção/ocupação urbana:** etapas 1/2 têm relatórios locais e implementação; evidências ainda fora do tracker. As etapas seguintes e desempenho em GPU/aparelho real não estão comprovados. Consolidar os registros antes de refazer o trabalho.
- **Backlog v1.0:** T01/T02 concluídos; T03 parcial por Storage; T04 entregue por imóvel e condicional no mapa; T05 links internos, T06 ficha estática e T07 preview/OG ainda relevantes. T08–T11 têm modos básicos implementados, mas aceite completo nos três imóveis pendente. T12 carga sob demanda e T13 mobile/fallback parciais. T14 offline e T15 release estável pendentes.

## Ordem recomendada de execução

1. **Restaurar integridade do experimento:** corrigir apagamento de destino e prova final do lote; regularizar inventários/visibilidade; selecionar explicitamente fontes/testes novos e fixtures versionáveis. Aceite: clone limpo, suítes verdes e falha segura.
2. **Fechar integração do capturador local:** contexto real, móveis e pavimentos no round-trip; origens exatas/auth para serviço remoto. Aceite: salvar e reabrir preserva o que o usuário vê, e o 3D usa o mesmo imóvel/dados.
3. **Reconciliar os planos e congelar uma baseline de homologação.** A baseline aprovada anteriormente é `d4a0307`; qualquer versão nova precisa de revisão própria antes de substituir a versão das sessões. Não alterar o capturador no meio da medição.
4. **Executar/registrar as cinco sessões físicas M1.1**, incluindo tempo, atrito, dúvidas, correções, perda de estado e ciclo até 3D. Completar fotos/contexto/caso real ou registrar decisão explícita de adiamento. Depois fechar M1.1 e M1.2.
5. **Implementar M2 por incrementos:** identidade → transação → adaptador runner → lease/heartbeat → retry/cancelamento → reconciliação → falhas controladas → rollout de um e dois pedidos.
6. **Fechar jornada pública:** links internos determinísticos, ficha estática sem WebGL, compartilhar/contato contextual e OG real. Em paralelo, usar o estudo medido para reduzir travadas e esperar menos pela luz.
7. **M3/M4/M5:** comparar arquitetura urbana com o mesmo protocolo, escolher e executar lote real de 30. Deixar offline e novos efeitos visuais para depois dos critérios essenciais do piloto.

Não é necessário abrir um novo trilho de arquitetura agora. Os próximos passos têm critérios verificáveis suficientes para transformar os protótipos úteis em uma operação repetível.

## Limites da avaliação

Não foram feitas cinco sessões com participantes nem testes físicos Android/iPhone/Instagram/WhatsApp. O smoke A/B cobre abertura/layout, não todos os modos e gestos. Não houve deploy, rollback ou teste de concorrência em produção. Contagens de testes no disco não certificam um clone limpo nem a versão publicada. Ruflo/ToolSearch não estavam expostos entre as ferramentas desta sessão; a auditoria usou Git, GitHub CLI, ferramentas locais e três revisões paralelas.

# M1-D — leitura versionada vinculada ao imóvel

Rota autenticada `/imoveis/planta?id=<propertyId>`, acessível pelo detalhe do
imóvel nas áreas de agência e equipe interna. O painel continua exportação
estática Next: segue o padrão existente de ID na query, sem servidor Next.
`/capturador` continua sandbox isolado, sem Firebase ou opção de salvar.

## Contrato persistido

`propertyReadings/{saveId}` contém:

- `propertyId`, `agencyId`: vínculo verificado com imóvel existente;
- `version`: sequência **por imóvel**, independente da revisão geométrica;
- `createdBy`, `createdByName`, `createdAt`: UID/nome do perfil e timestamp do servidor;
- `schemaVersion`, `revision`, `contentSha256`, `leitura`: conteúdo aprovado
  pelo validador normativo M1-0, hash SHA-256 da serialização canônica M1-A;
- `basedOnVersionId`: versão usada como base, ou null para nova leitura.

Tipos e cliente: `painel/src/lib/leituras.ts`. O JSON geométrico não recebe
cadastro. `properties` não guarda a planta nem ponteiro para uma suposta planta
atual/aprovada. `propertyReadingCounters/{propertyId}` guarda apenas o contador
interno, sem acesso do cliente. Snapshot e incremento nascem na mesma transação.

Carregar uma versão antiga permite ramificação: a próxima gravação ganha o
próximo `version` do imóvel e aponta para a base escolhida. A `revision` do
contrato avança quando a geometria muda; não é o número de versão do imóvel.
Salvar conteúdo inalterado explicitamente pode criar outra versão; não há autosave.
Um retry com o mesmo `saveId`, autor, conteúdo e base retorna a versão existente;
reutilizar esse ID com conteúdo diferente falha. Nenhuma operação faz update ou
delete de snapshot.

## Fronteira de confiança

Regras Firestore não executam Python nem validam toda a geometria M1-0. Permitir
`addDoc` direto com apenas validação de navegador deixaria um cliente adulterado
gravar conteúdo inválido. Por isso **create direto também é false**, assim como
update/delete. A criação autorizada acontece exclusivamente na API autenticada
`tools/leitura-api.mjs`, sem novo papel ou mecanismo de login.

1. Recebe `POST /property-readings` com token Firebase Auth e campos fechados
   `{saveId, propertyId, agencyId, leituraJson, basedOnVersionId?}`.
2. Verifica token, inclusive revogação, e perfil ativo estritamente booleano.
3. Confere imóvel/agência e papéis: platform_admin/operator ou gerente/corretor
   da mesma agência. Reconfere na transação para evitar alteração concorrente.
4. Executa `python -m pipeline.preparar_leitura` via stdin, sem shell. Esse módulo
   chama **`pipeline.validar_leitura.validar` real**, sem reparar a entrada.
   Parsing rejeita chaves repetidas e números não finitos. Não chama normalizador
   geométrico, renderer ou Blender; usa apenas a serialização canônica M1-A.
5. Confere base do mesmo imóvel/agência, calcula número e usa `transaction.create`.

O Admin SDK não passa pelas Security Rules; por isso a API faz sua própria
autorização transacional e não expõe operações genéricas de banco. Leitura pelo
SDK cliente exige agência do snapshot **e** agência atual do imóvel; equipe
interna lê conforme os papéis existentes. Trocar um imóvel de agência não
transfere automaticamente snapshots antigos para a outra imobiliária.

Limites da API: JSON da leitura até 384 KiB, corpo HTTP até 512 KiB, quatro
requisições simultâneas por processo, timeout do validador de 10 s, origem CORS
exata, respostas sem cache/stack traces. Falha do validador impede gravação.
Não há credenciais no bundle. Hash prova integridade de conteúdo, não aprovação.

Referências primárias: [Admin SDK e Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure),
[verificação de ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Editor e histórico

O mesmo capturador recebe estado inicial e callback de gravação opcional; não
importa Firebase. Salvar é ação explícita, desabilitada para planta inválida,
edição pendente ou arraste. Durante o request, editor e troca de versão ficam
bloqueados. O servidor faz a decisão final de validade.

Histórico mostra número/data/autor, 50 por página. Índice composto cobre
agência/imóvel/versão; `leitura` não é indexada. Carregar base reconstrói estado
independente, sem compartilhar objetos com o snapshot. Round-trip semântico
impede perda silenciosa de campos que a UI não suporta (referências externas,
paredes com IDs arbitrários etc.); esses documentos podem ser válidos no M1-0,
mas o editor os recusa em vez de descartar informações. Todas as leituras
produzidas pela UI deste estágio são suportadas.

## Execução e limites de entrega

Desenvolvimento: instalar dependências de raiz/painel e `requirements.txt`, ter
JDK 21 disponível e executar `npm run painel:dev`. Esse comando usa exclusivamente
o projeto `demo-painel`, semeia dados fictícios, sobe API loopback em 5056 e Next
em 3000 (ou `PAINEL_PORT`). Abrir `http://127.0.0.1:<porta>`; CORS usa essa origem.
`NEXT_PUBLIC_READINGS_API_URL` é fornecida ao Next pelo script, nunca por default
de produção. O script dev continua destrutivo apenas para os dados do emulador,
como antes deste marco.

**Nenhum serviço, regra, índice ou site foi implantado.** Para futura operação,
será necessário hospedar a API atrás de HTTPS, disponibilizar Node/Python e
dependências, configurar credencial de serviço restrita, `GCLOUD_PROJECT`,
`READINGS_ALLOWED_ORIGIN`, `PORT` e a URL da API na build do painel. O executável
escuta somente loopback; hospedagem/reverse proxy e política de quotas duráveis
serão decisões de implantação, não ações deste PR. Sem endpoint configurado,
salvar falha explicitamente. A política append-only vale na API/regras; operadores
com IAM/Admin SDK continuam sendo uma fronteira privilegiada a proteger.

Sem aprovação de planta, pedido automático, BuildJob, LEVE, Blender ou produção.
M1-E e M1.1 exigem autorização posterior. Aparelho físico continua gate de M1.1.
Trocar de base substitui edição não salva, com aviso visível; confirmação de
descarte permanece questão de usabilidade já identificada no M1-C.

Evidências: [checkpoint](../checkpoints/m1-d-2026-09-30.md).

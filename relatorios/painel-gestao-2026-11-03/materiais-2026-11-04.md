# Solicitação única e envio de materiais — 04/11/2026

Publicado no painel:

- Nova solicitação sem seleção LEVE/PREMIUM, na imobiliária e na equipe interna. Link do anúncio explicitamente opcional.
- Após criar, o solicitante é encaminhado ao pedido e envia materiais pelo cartão “Materiais da solicitação”. O formulário explica essa segunda etapa.
- Seleção múltipla (até 20 por seleção), progresso, confirmação, fila com nova tentativa e lista de arquivos recebidos. Mesmo cartão na visão administrativa, com download autenticado.
- PDF, imagens, vídeos, CAD/BIM, documentos e ZIP. Cada arquivo deve ter conteúdo e menos de 200 MiB. Nomes normalizados e identificador exclusivo; não sobrescreve arquivos anteriores.
- Retentativa conserva identificador e arquivo já enviado quando somente o registro Firestore falhou. Não cria outra solicitação para repetir upload.
- Interface em português e inglês. A imobiliária não vê a classificação técnica na lista nem na ficha. Histórico interno e pipeline legados preservados: o backend de criação usa o preset técnico existente `leve` quando não recebe modo explícito; não há novo produto ou opção comercial.

Infraestrutura necessária habilitada: API Cloud Storage for Firebase; bucket `imobilaria-deccb.firebasestorage.app`, região SOUTHAMERICA-EAST1. Regras permitem apenas materiais privados vinculados à agência e à solicitação; leitura pela própria imobiliária ou equipe ativa, escrita sem sobrescrita. Formatos executáveis/HTML/SVG e arquivos vazios recusados. Metadados continuam no contrato `requestAssets` existente; regras Firestore não alteradas.

CORS GET/HEAD limitado aos dois domínios do painel para downloads autenticados. Não usa URLs públicas com tokens de download. Conta técnica do Storage recebeu exclusivamente `roles/firebaserules.firestoreServiceAgent`, exigido para as regras consultarem os usuários e o vínculo do pedido no Firestore; política anterior preservada. Outros papéis mantidos.

Validação: TypeScript e build Webpack passaram; seis testes de materiais/pedidos passaram, incluindo upload real em emulador, retry sem duplicar registro, download pela equipe e bloqueio de outra imobiliária. Suite completa de regras com 48 testes passou em emulador limpo, incluindo SVG com MIME disfarçado, executável e arquivo vazio. Reexecução isolada no emulador reutilizado falhou após a limpeza anterior de contexto; reiniciado o emulador, a suite completa passou. Em produção, listagem sem autenticação retornou 403. Não foram criados pedidos, contas ou arquivos de clientes para testar produção. Sem teste visual autenticado nesta etapa.

Storage e Hosting publicados. Logs, configuração anterior, política IAM anterior e resultados: `publicacao/painel-materiais-20261104/` (ignorado). Código sem commit.

Documentação oficial consultada: [criação do bucket padrão](https://firebase.google.com/docs/reference/rest/storage/rest/v1alpha/projects.defaultBucket/create), [upload e progresso](https://firebase.google.com/docs/storage/web/upload-files), [download direto e CORS](https://firebase.google.com/docs/storage/web/download-files).

## Tamanho livre no painel

Na mesma data, a pedido do usuário, removido o limite de 200 MiB na validação, nas regras Storage e no download autenticado. Interface informa que não há tamanho máximo definido pelo painel; limites técnicos do serviço e do navegador continuam aplicáveis. Upload continua em partes pelo SDK, com progresso. Download atual usa Blob e depende da memória disponível no navegador, especialmente para arquivos muito grandes.

Build e TypeScript passaram; dois testes de materiais e 48 testes de regras passaram. Validação de tamanhos inclui 200 MiB e 5 GiB sem gerar/transferir arquivos gigantes durante o teste. Autenticação e isolamento preservados. Publicação em Storage e Hosting registrada em `sem-limite-storage-deploy.log` e `sem-limite-painel-deploy.log`, na pasta de artefatos ignorada. Alterações sem commit.

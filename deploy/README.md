# Serviços Node no Cloud Run — preparado em 20/10/2026, sem deploy

Dois servidores Node do fluxo da imobiliária precisam de um lugar público para rodar:

| Serviço | Arquivo | Para quê |
|---|---|---|
| `rastreabilidade` | `rastreabilidade/servidor.mjs` | link por corretor, métricas, botão do WhatsApp e lead do clique |
| `leituras` | `tools/leitura-api.mjs` (chama o Python) | a equipe salvar a planta e gerar a prévia 3D no painel |

**Decisão de 20/10:** deixar tudo pronto e mudar para o plano Blaze depois. Até lá, o painel
e o site de imóveis podem voltar ao ar no plano Spark (gratuito), mas os dois serviços ficam
desligados. O painel mostra "recurso preparado" no cartão do link, não há link por corretor
nem WhatsApp para o comprador, e a equipe não salva planta em produção.

## O que já está pronto (este diretório)

- `servicos/package.json` + lock: só o `firebase-admin` (14.3.0), a única dependência dos dois.
- `rastreabilidade.Dockerfile` (Node 24) e `leituras.Dockerfile` (Python 3.14 + o Node copiado
  da imagem oficial, ambos em Debian bookworm).
- `contexto.py`: monta a pasta que vai ao Cloud Build com só o que cada serviço usa
  (rastreabilidade ~130 KB; leituras ~3,4 MB, sem os 62 MB de `v1.5/miniaturas`). A lista das
  leituras saiu de uma auditoria dos arquivos que o Python abre ao gerar uma prévia, e
  `tests/test_deploy_contexto.py` gera uma prévia dentro da pasta montada.
- No código: `TRACKING_PROXY_HOPS` e `TRACKING_RATE_LIMIT` no link por corretor, e
  `READINGS_BIND_HOST` nas leituras.

**Não testado aqui:** a montagem das imagens (não há Docker nesta máquina; quem monta é o
Cloud Build). O primeiro `gcloud builds submit` confirma.

## Custo esperado

O Blaze cobra só o que passa das cotas gratuitas, e mantém as cotas do Spark (Firestore,
Hosting, Auth). Pede cartão cadastrado; conta nova do Google Cloud costuma ganhar US$ 300 de
crédito. Cotas gratuitas mensais que importam aqui (documentação oficial do Google Cloud,
consultada em 20/10/2026):

| Item | De graça por mês |
|---|---|
| Cloud Run (cobrança por requisição) | 2 milhões de requisições, 180.000 vCPU-s, 360.000 GB-s |
| Artifact Registry (imagens) | 0,5 GB |
| Cloud Build | 2.500 min de build |
| Secret Manager | 6 versões de segredo, 10.000 acessos |

Estimativa de uso:
- **Link por corretor:** uma visita com métricas faz ~22 chamadas (abertura, sessão e um
  sinal a cada 15 s por 5 min), cada uma com ~0,2 s de 1 vCPU, o que dá ~4,4 vCPU-s por visita.
  A cota gratuita cobre **~40 mil visitas por mês**.
- **Leituras:** prévia ~30 s com 2 vCPU (~60 vCPU-s); gravação ~3 s.
  100 prévias + 300 gravações ≈ 8 mil vCPU-s.
- 1.000 visitas e 100 prévias por mês usam ~7% da cota de CPU.

O que pode sair do gratuito, em centavos:
- **Imagens acima de 0,5 GB:** a política de limpeza abaixo guarda só as 2 últimas de cada.
- **Tráfego de saída a partir de São Paulo:** a cota de 1 GB vale só para tráfego saindo da
  América do Norte. A prévia tem ~3,7 MB, então 100 prévias são ~0,4 GB. O preço por GB não foi
  conferido aqui; use a [calculadora](https://cloud.google.com/products/calculator).

Proteções: `--max-instances 2` em cada serviço e alerta de orçamento (passo 1).

## Passos, quando mudar para o Blaze

Cada passo é uma ação em produção e pede autorização. Os comandos valem no PowerShell.

1. **Plano:** Firebase console → Uso e faturamento → mudar para Blaze. Depois, em Google Cloud
   → Faturamento → Orçamentos, criar um alerta (por exemplo R$ 10, avisos em 50/90/100%).
2. **CLI:** instalar o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), depois
   `gcloud auth login` e `gcloud config set project imobilaria-deccb`.
3. **APIs:**
   `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com`
4. **Repositório de imagens com limpeza:**
   `gcloud artifacts repositories create servicos --repository-format=docker --location=southamerica-east1`,
   e no console uma política "manter as 2 versões mais recentes".
5. **Contas de serviço** (uma por serviço, com o mínimo):
   ```
   gcloud iam service-accounts create rastreabilidade
   gcloud iam service-accounts create leituras
   ```
   Para cada uma: `gcloud projects add-iam-policy-binding imobilaria-deccb --member serviceAccount:<nome>@imobilaria-deccb.iam.gserviceaccount.com --role <papel>`
   com `roles/datastore.user` (Firestore) e `roles/firebaseauth.viewer` (conferir o login com
   revogação).
6. **Segredo do link** (32 bytes, nunca no repositório):
   ```
   python -c "import secrets;open('segredo.txt','w').write(secrets.token_hex(32))"
   gcloud secrets create tracking-secret --data-file=segredo.txt --replication-policy=user-managed --locations=southamerica-east1
   Remove-Item segredo.txt
   gcloud secrets add-iam-policy-binding tracking-secret --member serviceAccount:rastreabilidade@imobilaria-deccb.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
   ```
7. **Imagens**, a partir de uma worktree limpa da `main` (`<commit>` = `git rev-parse --short HEAD`):
   ```
   python deploy/contexto.py rastreabilidade C:\temp\ctx-rastreabilidade
   gcloud builds submit C:\temp\ctx-rastreabilidade --tag southamerica-east1-docker.pkg.dev/imobilaria-deccb/servicos/rastreabilidade:<commit>
   python deploy/contexto.py leituras C:\temp\ctx-leituras
   gcloud builds submit C:\temp\ctx-leituras --tag southamerica-east1-docker.pkg.dev/imobilaria-deccb/servicos/leituras:<commit>
   ```
   Se o push for recusado, dar à conta que roda o build o papel `roles/artifactregistry.writer`.
8. **Serviços:**
   ```
   gcloud run deploy rastreabilidade --image southamerica-east1-docker.pkg.dev/imobilaria-deccb/servicos/rastreabilidade:<commit> --region southamerica-east1 --service-account rastreabilidade@imobilaria-deccb.iam.gserviceaccount.com --allow-unauthenticated --cpu 1 --memory 512Mi --concurrency 80 --min-instances 0 --max-instances 2 --set-env-vars GCLOUD_PROJECT=imobilaria-deccb,TRACKING_PUBLIC_ORIGIN=https://imobilaria-deccb-imoveis.web.app,TRACKING_PANEL_ORIGIN=https://imobilaria-deccb-painel.web.app,TRACKING_PROXY_HOPS=1 --set-secrets TRACKING_SECRET=tracking-secret:latest
   gcloud run deploy leituras --image southamerica-east1-docker.pkg.dev/imobilaria-deccb/servicos/leituras:<commit> --region southamerica-east1 --service-account leituras@imobilaria-deccb.iam.gserviceaccount.com --allow-unauthenticated --cpu 2 --memory 2Gi --concurrency 2 --timeout 60 --min-instances 0 --max-instances 2 --set-env-vars GCLOUD_PROJECT=imobilaria-deccb,READINGS_ALLOWED_ORIGIN=https://imobilaria-deccb-painel.web.app
   ```
   "Sem autenticação" no Cloud Run é de propósito. Quem confere o login é o próprio serviço
   (token do Firebase), e a parte pública do link é pública. Os endereços devem sair
   `https://rastreabilidade-163406298617.southamerica-east1.run.app` e
   `https://leituras-163406298617.southamerica-east1.run.app`; o deploy mostra o endereço certo.
9. **Conferir o limite por visitante.** Atrás do proxy do Google, o endereço da conexão não é o
   do visitante, e `TRACKING_PROXY_HOPS` diz qual entrada do `X-Forwarded-For` é a real.
   - Com `gcloud run services update rastreabilidade --region southamerica-east1 --update-env-vars TRACKING_RATE_LIMIT=2`,
     chamar três vezes, do mesmo computador:
     `curl.exe -s -o NUL -w "%{http_code} " -X POST -H "Origin: https://imobilaria-deccb-imoveis.web.app" -H "Content-Type: application/json" -H "X-Forwarded-For: 9.9.9.<1, 2 e 3>" --data "{}" <url>/open`
   - Depois, uma vez pelo 4G do celular. O certo é `400 400 429` no computador e `400` no celular.
   - Se o computador der três `400`, o valor 1 está pegando o endereço forjado. Se o celular
     também der `429`, está pegando um endereço do Google. Ajustar o número e repetir.
   - No fim, voltar para `TRACKING_RATE_LIMIT=240`.
10. **Painel:** em `painel/.env.production`,
    `NEXT_PUBLIC_TRACKING_API_URL=<url do rastreabilidade>/` e
    `NEXT_PUBLIC_READINGS_API_URL=<url das leituras>/property-readings`. Build e deploy do painel, conforme
    o [plano do religar](../tasks/painel/religar-2026-10-20.md).
11. **Página do link no site de imóveis:**
    `node tools/montar_rastreabilidade.mjs --saida <pasta-nova> --api <url do rastreabilidade>/ --origem-publica https://imobilaria-deccb-imoveis.web.app --site-base publicacao/site`
    e deploy de `hosting:imoveis`, no mesmo passo do site de imóveis do plano do religar.

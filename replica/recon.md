# Recon: hauzd (web + apps nativos + totem Windows)

Escopo: o showroom 3D de lançamento imobiliário e o que o alimenta (estoque, leads, reserva). Ficam de fora a produtora de render/vídeo e o hauzdengine (archviz).
Para quem: o imobiliaria. Isto é referência de produto e de posicionamento, não um plano de clonar.
Data: 2026-10-11

## Regras seguidas

- Só fontes públicas. Nenhum login. O painel `admin.hauzd.app` não foi aberto.
- O showroom público (`nayamara.hauzd.app`) foi aberto em 10/10/2026. Para entrar foi preciso aceitar um aviso legal ("De acuerdo"). **Os termos desse aviso não foram lidos com atenção pra ver se proíbem uso para produto concorrente.** Ler isso antes de qualquer nova visita.
- A medição de 10/10 registrou o peso dos downloads (content-length). Isso serve só pra dimensionar custo; nenhum endpoint deve ser copiado.

## Fontes

| # | fonte | URL | o que deu |
| --- | --- | --- | --- |
| 1 | home | https://hauzd.com | os 10 módulos, a promessa "first version in 10 business days" e o FAQ de preço vazio |
| 2 | plataforma | https://hauzd.com/platform | funções do showroom, do painel e da analytics |
| 3 | SDK e API | https://hauzd.com/sdk-api | SDK JS de embed, eventos customizados, REST com OAuth 2.0, webhooks |
| 4 | integrações | https://hauzd.com/integrations | 32 integrações: CRM, ERP, pagamento, portal |
| 5 | casos | https://hauzd.com/success-stories | 13 casos em MX, PY, VE, PE, DO, PA, CL, CA, GT |
| 6 | App Store | https://apps.apple.com/us/app/hauzd/id1393281813 | app de consumidor com filtros, mapa e POI, galeria com drone; nota 4,2 com 6 avaliações; v2.01.0094 |
| 7 | Zapier | https://zapier.com/apps/hauzd/integrations | `get_leads` (lead = `answers` chave-valor por projeto) e `Update Unit Properties` (`project`, `crmId`) |
| 8 | Crunchbase | https://www.crunchbase.com/organization/hauzd | fundadores Val Dess (CEO) e Dan Burdman |
| 9 | Serchen | https://serchen.com/company/hauzd | "450+ projetos, 15+ países", totem touchscreen |
| 10 | showroom público | https://nayamara.hauzd.app/ | medido em 10/10/2026 (memória `concorrente-hauzd`) |
| — | help center | https://learn.hauzd.com | só o cabeçalho é público; os artigos não aparecem |
| — | Capterra | https://www.capterra.com/p/197409/Hauzd-engine/ | HTTP 403; a busca cita "US$ 90/mês flat", número **não confirmado** |
| — | YouTube | https://www.youtube.com/@hauzd | a listagem não carregou sem navegador |

## O que o cliente compra

O incorporador troca o decorado físico (e o PDF) por um showroom 3D no navegador. Nele o comprador anda pelo prédio e pela unidade e vê preço e disponibilidade ao vivo. Pode reservar ali mesmo, e o lead chega ao CRM junto com o que ele olhou e por quanto tempo.

## Telas

As telas vêm da visita de 10/10. Os estados vazio, erro e celular não foram registrados.

| ID | tela | como chegar | propósito | componentes | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | idioma | entrada do showroom | escolher o idioma | botões de idioma | preenchido |
| S02 | aviso legal | após S01 | aceitar os termos | modal com "De acuerdo" | preenchido |
| S03 | exterior do prédio | após S02 | volume do prédio sobre foto desfocada da região (a cidade não é modelada) | canvas 3D, barra de modos | carregando (~260 MB), preenchido |
| S04 | lista de unidades | botão "Lista" | estoque, filtrado por preço | tabela/lista, filtros, status | preenchido |
| S05 | ficha da unidade | clique numa unidade de S04 | preço, área, status, reserva | ficha, CTA de reserva/contato | preenchido |
| S06 | planta 2D | "Plano" | planta com cotas | imagem/vetor com cotas | preenchido |
| S07 | planta 3D | modo de planta | vista de cima com móveis | canvas 3D | preenchido |
| S08 | passeio no interior | ícone do bonequinho | andar pela unidade | anel no piso (clicar para ir), arrastar para olhar | preenchido |
| S09 | vista da janela | dentro de S08 | 360° real de drone na altura do andar | panorama atrás do vidro | preenchido |
| S10 | reserva e pagamento | CTA da ficha | reservar com pagamento online e travar o estoque | formulário, Stripe/PayPal | **não visto**: só a página de marketing descreve |
| S11 | formulário de lead | não visto | capturar o comprador | campos variáveis por projeto | **não visto**: inferido do `answers` no Zapier |
| A01–A03 | painel: estoque, materiais, estatísticas | admin.hauzd.app | operação do incorporador | — | **não visto**: só os prints de marketing |

## Fluxos

```
F01 Comprador escolhe e reserva uma unidade
    S01 -> S02 -> S03 -> S04 -> S05 -> S10
    cliques no caminho feliz: ~6 até a ficha (contado em 10/10); reserva não medida
    exceções: unidade reservada no meio do fluxo (o "inventory locks" cobre isso), pagamento recusado

F02 Comprador conhece a unidade por dentro
    S05 -> S06 -> S07 -> S08 -> S09
    exceções: celular (6 compressões de textura escolhidas pela GPU — ver rea-hauzd.md; peso no celular não medido), 260–450 MB de download no desktop

F03 Corretor/totem no stand
    app Windows offline, ou app iOS/Android de vendas -> S03..S05
    não visto

F04 Incorporador atualiza preço/status
    painel A01, ou CRM -> Update Unit Properties (crmId) -> showroom ao vivo
```

## Componentes

| componente | variantes | usado em |
| --- | --- | --- |
| canvas 3D (motor próprio C++ → WASM, WebGL 2) | exterior, planta 3D, passeio | S03, S07, S08 |
| anel de destino no piso | — | S08 |
| panorama de janela (360° de drone) | por andar | S09 |
| lista de unidades + filtros | preço (site); preço, disponibilidade, quartos, área (app) | S04 |
| ficha da unidade | — | S05 |
| planta 2D com cotas | — | S06 |
| modal de aviso legal / idioma | — | S01, S02 |

## Modelo de dados inferido

```
Project     id, nome, país, localização, POIs próximos, galeria (imagens, renders, drone)
            evidência: App Store, success-stories            confiança: alta
Building    id, project_id, níveis, gêmeo digital 3D
            evidência: "3D Building" no SDK, "views by level" no Landmark   confiança: média
Unit        id, project_id, crmId, preço, status, quartos, área, planta, andar
            evidência: Zapier Update Unit Properties (crmId), filtros do app   confiança: alta
Material    id, opção de acabamento por ambiente/unidade
            evidência: painel "materials", Bioma "finish visualization"   confiança: média
Lead        id, project_id, answers (json chave-valor), unidades vistas, tempo por unidade
            evidência: Zapier get_leads; plataforma "which units viewed and for how long"   confiança: alta
Reservation unit_id, lead_id, pagamento (Stripe/PayPal), trava de estoque
            evidência: Booking Module   confiança: média (nada visto rodando)
Session     tempo, unidades vistas (base da analytics e do "20 min")   confiança: palpite
```

Relações: Project 1-n Building 1-n Unit; Project 1-n Lead; Lead n-n Unit (vistas); Unit 1-0..1 Reservation.

## Matriz de funcionalidades

Está em `features.csv`. A coluna `clone` é o **estado atual do imobiliaria**, conferido no repositório em 11/10/2026.

## O que não se copia

- A carteira deles (450+ projetos, 15 países) e as parcerias comerciais com CRMs da LatAm (Tokko, Sperant, Evolta, Enkontrol...).
- A captação de drone por projeto. É operação de campo, não software.
- A produtora de render/vídeo e o prazo de 10 dias úteis. São serviço, não produto.

## Tamanho e conclusão

São ~11 telas públicas, 4 fluxos e 7 entidades. Partes difíceis: pagamento com trava de estoque, sync bidirecional com CRM e analytics por sessão. Tamanho: **L**.

Recorte relevante: o diferencial técnico deles (luz assada + 360° na janela) o imobiliaria já disputa. A distância está no **comercial**: lead com comportamento, reserva/pagamento, CRM e analytics. Já o mapa da cidade inteira é um diferencial do imobiliaria, porque a hauzd põe uma foto desfocada no lugar da cidade.

## Avaliações (replica-entrepreneur)

Não houve amostra. A App Store tem 6 notas sem texto no feed RSS. A Capterra devolveu 403. G2, Trustpilot e Reddit não têm nada sobre a hauzd. O produto é B2B e não junta review pública. Por isso não existe `reviews.csv` nem `fixes.md`: a regra da skill é não inventar. A fonte que sobra é conversar com incorporadores que usaram a hauzd.

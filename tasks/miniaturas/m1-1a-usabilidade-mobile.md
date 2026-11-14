# M1.1-A — cinco sessões de captura em telefone físico

**Estado em 04/10/2026: preparação; 0/5 sessões homologadas.** Esta rodada usa
exclusivamente a baseline `4586e7cec78155369ea10cdc37fc0418ada02e61`. Preparar o
pacote, validar exports ou simular toque não preenche resultados físicos.

O protocolo original está preservado no commit `1b4d303`, na antiga branch
`test/m1-1a-usabilidade-mobile`. A liberação posterior usava `d4a0307`; o capturador
atual acrescenta pavimentos, móveis e projeto completo. Portanto esta é uma nova
baseline, congelada durante as cinco sessões. A preparação autorizada está em
[m1-1a-preparacao-2026-10-04.md](m1-1a-preparacao-2026-10-04.md).

## Objetivo e casos

Medir se pessoas conseguem reproduzir plantas reais sem treinamento técnico, com
medidas fiéis à fonte, e descobrir onde toque, convenção de medidas ou consumidor
3D bloqueiam o percurso.

- Cinco plantas reais distintas, identificadas somente como C1–C5. Não há cinco
  imóveis ou tipologias previamente definidos. A fixture sintética não conta.
- Pelo menos dois operadores; pelo menos um não participou da implementação nem
  conhecia o capturador. Quem facilita observa e anota; não opera o telefone.
- Registrar a origem genérica e a convenção da fonte: parede a parede, eixo de
  parede, dimensão externa, cota de projeto, trena/laser ou não indicada.
- Digitar as medidas reais. Se a fonte informa 3,43 m, não ajustar para 3,45 m por
  causa da grade do consumidor. Arredondamento feito pelo operador é observado.
- Registrar quantos pavimentos a fonte tem e quais foram capturados. Não inventar
  segundo piso, móveis, fotos, ficha comercial ou dimensões do prédio.

## Preparar e identificar o pacote

O preparador exige um checkout limpo da baseline indicada. Executa a instalação
limpa de dependências e o build estático do painel nesse checkout, sem configuração
local nem emulador. Dependências já existentes não dispensam o `npm ci`.
O PC também precisa de Node 24, Python com `jsonschema` e OpenSSL; os comandos
de instalação e verificação estão em [DEPENDENCIAS.md](../../DEPENDENCIAS.md).

```powershell
python tools/preparar_sessoes_m1_1a.py --build-root <checkout-limpo-baseline> --baseline 4586e7cec78155369ea10cdc37fc0418ada02e61 --destino publicacao/m1-1a/rodada-2026-10-04
python tools/preparar_sessoes_m1_1a.py --verificar publicacao/m1-1a/rodada-2026-10-04
```

O pacote contém `site/` com somente o capturador e seus assets, `manifesto.json`,
`README.md` operacional e `C1/ficha.json` até `C5/ficha.json`. A ficha vem do
[template](m1-1a/ficha-template.json), com caso, baseline e rodada preenchidos pelo
preparador. Todas começam `nao-iniciada`, com `physicalAccepted: false`, sem tempos
ou resultados. Destino ocupado ou divergência dos fingerprints deve ser recusado.

Conferir o manifesto antes de cada sessão; não substituir o bundle entre casos.
Não usar os canais de preview antigos como comprovação desta baseline. Esta entrega
não publica Hosting nem muda o firewall.

## Abrir no telefone

```powershell
python tools/servir_lan.py publicacao/m1-1a/rodada-2026-10-04/site
```

O telefone abre `https://<ip-do-pc>:8813/capturador`, na mesma rede do PC. O servidor
usa certificado local autoassinado e imprime o IP. O aviso de certificado deve ser
resolvido pelo operador do aparelho. Se não alcançar o PC ou o contexto seguro não
funcionar, registrar o impedimento antes da sessão; não alterar o firewall.

Servir somente `site/`, nunca a pasta com fichas, exports ou referências. Não expor
API de leitura/geração na LAN. O capturador desta rodada funciona no telefone; o
download vai ao PC e o avaliador gera a maquete localmente.

Antes de receber o participante: conferir tela vazia, modelo do aparelho, sistema,
navegador e viewport aproximado. Recarregar apaga a edição em memória. Guardar
observação e captura/gravação do telefone como prova física. User-Agent e log de
acesso são auxiliares; sozinhos não comprovam uma sessão humana.

## Roteiro da sessão

1. Pedir consentimento verbal para observar e, opcionalmente, gravar a tela.
   Registrar a resposta; consentimento de gravação não é obrigatório.
2. Entregar a planta de origem em papel ou outra tela. Dizer somente:
   **“Reproduza esta planta e, quando terminar, baixe a leitura da arquitetura do
   andar ativo. Depois baixe o projeto completo para preservar seu trabalho.”**
   Não explicar gestos ou botões antes de observar a tentativa.
3. Iniciar o cronômetro no primeiro toque. Registrar o tempo primário quando termina
   o download da **leitura da arquitetura do andar ativo**. O menu Projeto oferece
   “Baixar leitura do andar”, ou as leituras do térreo/superior quando existem dois
   pavimentos. Essa leitura não contém os móveis.
   Confirmar que o arquivo está disponível no telefone: o toast do aplicativo
   confirma o início do download e não basta para encerrar o cronômetro.
4. Registrar separadamente o tempo até **Baixar projeto completo** terminar e o
   intervalo entre os dois downloads. O botão principal **Baixar** baixa
   `projeto-planta.json`, preservando pavimentos, móveis e andar ativo. Não confundir
   esses dois produtos ou apresentar um tempo combinado como tempo de arquitetura.
   Confirmar também a disponibilidade desse arquivo no aparelho.
5. Observar seleção, arraste, pinça, snap, teclado, portas/janelas, desfazer/refazer,
   mesclar/separar quando aplicável e troca de pisos/móveis quando a fonte os tiver.
   Anotar perguntas literais e o momento antes de responder. Cada fala que ajuda a
   avançar conta como intervenção. Após três minutos sem progresso, perguntar
   somente o que a pessoa está tentando fazer e contar a intervenção.
6. Se houver desistência, mais de 40 minutos ou bloqueio que impeça concluir, marcar
   `nao-concluida`, guardar a evidência e interromper a rodada antes de outra sessão.
   Não corrigir a interface entre casos para conseguir completar cinco a qualquer custo.
7. Transferir os downloads originais ao PC sem editar. Registrar separadamente o
   tempo de transferência. Guardar ambos em `C1/`, ou na pasta do caso correspondente,
   com nomes claros e SHA-256 dos bytes originais.
8. Depois da captura cronometrada, reabrir o projeto completo no telefone, se a sessão
   permitir. Conferir pisos, móveis e andar ativo; registrar perdas ou diferenças.
   Esta verificação tem finalidade distinta do tempo primário. Não recarregar antes
   de confirmar que o projeto foi baixado.

## Avaliar os arquivos no PC

Usar uma pasta nova por avaliação, preservando tentativas anteriores. O avaliador
guarda o download original byte a byte, extrai todos os pavimentos presentes e
registra os resultados em `relatorio.json`. As leituras e os móveis de cada piso
permanecem associados ao piso correto.

```powershell
node tools/avaliar_projeto_capturado.mjs publicacao/m1-1a/rodada-2026-10-04/C1/projeto-planta.json --caso C1 --destino publicacao/m1-1a/rodada-2026-10-04/C1/avaliacao-01
```

Sem `--demo` ou `--contexto`, o comando somente avalia. Para gerar uma prévia,
escolher explicitamente contexto real declarado ou demonstração, em nova pasta:

```powershell
node tools/avaliar_projeto_capturado.mjs publicacao/m1-1a/rodada-2026-10-04/C1/projeto-planta.json --caso C1 --destino publicacao/m1-1a/rodada-2026-10-04/C1/avaliacao-02 --andar 0 --contexto <contexto-real.json>
node tools/avaliar_projeto_capturado.mjs publicacao/m1-1a/rodada-2026-10-04/C1/projeto-planta.json --caso C1 --destino publicacao/m1-1a/rodada-2026-10-04/C1/avaliacao-03 --andar 0 --demo
```

`--andar 0` ou `--andar 1` escolhe o piso para a geração. A maquete fica em
`andar-X/maquete/`. Contexto demonstrativo serve para abrir o 3D; não avalia encaixe
real do imóvel. Registrar `demo` ou `real-declarado`, origem genérica do contexto e
pendências de fotos/referências. Fotos e contexto real ainda incompletos não viram
resultado aprovado por haver uma prévia demonstrativa.
O contexto real deve declarar o mesmo `andar` selecionado. Na demonstração, o
gerador usa um prédio ilustrativo de um pavimento: a arquitetura do piso selecionado
aparece no pavimento demonstrativo 0. O relatório registra essa diferença; a prévia
não comprova a posição do superior nem a composição dos dois pisos no prédio real.

Registrar M1-0, M1-A e portões do M1-F de cada piso capturado. Uma recusa por
`FORA_DA_GRADE`, `VAO_ESTREITO`, encaixe ou outro código é resultado do teste.
Não editar o JSON nem alterar as medidas para passar. Comparar também a leitura
primária baixada com a arquitetura correspondente no projeto completo.

Comparar fonte e export cômodo a cômodo e abertura a abertura: dimensões, posição,
convenção, nomes, pisos, grupos mesclados e móveis declarados. Registrar diferenças
com causa observada ou `não determinada`; não deduzir fidelidade apenas dos gates.

## Smoke físico do 3D

Pelo menos um caso deve ser aberto no mesmo telefone da captura. Se o consumidor
aceitar e houver contexto declarado, usar o artefato desse caso. Se todos forem
recusados, usar a fixture sintética e registrar essa origem; ela não substitui
nenhuma das cinco plantas reais.

```powershell
python tools/servir_lan.py publicacao/m1-1a/rodada-2026-10-04/C1/avaliacao-02/andar-0/maquete --porta 8814
```

Abrir `https://<ip-do-pc>:8814/maquete` no telefone. Testar Prédio, Planta 2D,
Planta 3D e Visita 3D; atravessar pelo menos uma porta. Guardar capturas de cada
etapa e anotar dificuldade ou falha. Medir a duração dessa fase separadamente da
captura, da avaliação técnica e da geração. Isso não mede FPS ou transferência em 4G.

## Preencher e consolidar as fichas

`null` significa não medido/não informado; zero só entra quando foi observado.
Usar IDs anônimos para operadores. Em `eventos`, registrar objetos com `tempoMs`,
`categoria` e `descricao`; categorias úteis são dúvida, intervenção, toque, snap,
abertura, mesclagem, correção, perda de estado, piso e móvel.

Em `pavimentos`, criar um registro por andar capturado com: `andar`, contagens de
cômodos/portas/janelas/grupos mesclados/móveis, resultados `m1_0`, `m1_a` e `m1_f`,
códigos/caminhos de recusa e referência local ao relatório. Copiar os resultados do
avaliador, sem marcar aceite físico a partir deles.

Em `fidelidade.diferencas`, registrar campo/elemento, valor da fonte, valor exportado
e causa. Em `achados`, registrar evidência e categoria: UX, contrato de entrada ou
limite do consumidor 3D. Não escolher soluções durante a coleta.

Ao terminar as cinco, consolidar tempos individuais e mediana, intervenções,
contagens de erros, perdas de estado, fidelidade e recusas por piso/caso. Taxa de
toques incorretos exige também denominador observado; sem contagem total, apresentar
somente a contagem e marcar a taxa como não medida. Não há meta de velocidade.

## Gate e regra de parada

- Cinco sessões documentadas sobre plantas reais distintas nesta baseline.
- Pelo menos dois operadores, incluindo um alheio à implementação.
- Prova física suficiente, tempos e intervenções registrados em cada caso.
- Leitura primária e projeto completo preservados sem edição; todos os pisos
  capturados passam M1-0 e M1-A. Resultado de M1-F categorizado, inclusive recusas.
- Fidelidade e preservação de estado/pisos/móveis avaliadas, com lacunas explícitas.
- Pelo menos um smoke físico 3D completo, com origem do artefato registrada.
- Aceite físico revisado por pessoa identificada anonimamente; preparação ou relatório
  técnico não altera automaticamente `physicalAccepted`.

UX grave, impossibilidade de representar a fonte ou problema arquitetural interrompe
a rodada. Três das cinco plantas recusadas por grade de 5 cm é o exemplo histórico
que exige decisão de fronteira contrato/consumidor. Guardar evidência e decidir antes
de modificar código. M1.2 e M2 seguem depois do fechamento da homologação.

## Histórico e privacidade

O P0 de 01/10 foi uso físico livre em Android/Chrome, sem planta real, modelo do
aparelho, cronômetro ou export; revelou o problema da rolagem e não conta no gate.
O C1 anterior tem export e cadeia técnica local, sem ficha física completa. Ele e
os smokes sintéticos não contam nesta rodada. C2–C5 anteriores não têm resultados.

Fontes, fotos, gravações, contextos reais, exports e fichas preenchidas ficam em
`publicacao/`, ignorado pelo Git. Não versionar endereço, nomes, anúncio identificável
ou planta de origem. O checkpoint público contém apenas IDs anônimos, origem
genérica, hashes, métricas e achados sanitizados. Os comandos desta preparação não
autorizam publicação, alteração de firewall ou contato com participantes.

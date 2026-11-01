# Entrada das plantas 3D — resultado

Correções implementadas nas fontes, incorporadas aos preparadores e publicadas
no [LIV](https://conectaimoveis3d.com.br/maquetes/liv/) e no
[Parque das Laranjeiras](https://conectaimoveis3d.com.br/laranjeiras/).

## O que mudou

- Navegadores sem `scheduler.yield` cedem o processador por tarefas, sem esperar
  repintura de um iframe estacionado. O agendador nativo é preservado.
- A navegação verifica colisões contínuas uma vez por segmento; as amostras só
  conferem o contorno. As rotas mantiveram o mesmo resultado.
- Móveis carregam dependências da tipologia e alternativas de fallback compatíveis;
  a montagem libera o JSON de autoria e o mapa de objetos. Luz com peso zero não
  baixa atlas/sondas, conservando samplers válidos e a mesma mistura visual.
- No máximo dois interiores ficam preparados. O descarte salva câmera, móveis e
  apresentação para restaurar depois. Uma planta parada deixa de enviar quadros à
  GPU; controles, caminhada, rotas e portas continuam funcionando.
- Falha inicial de WebGPU tenta WebGL em iframe novo uma vez. Sem GPU, o aviso
  oferece apartamentos com planta validada para abrir 2D. Links de unidade para
  2D validam o cadastro sem construir antes a maquete exterior. Acesso direto ao
  iframe também recupera com página/canvas novo.
- Os dois geradores de pacote incluem essas fontes. Saídas novas em
  `release-entrada-v3/` foram produzidas pelos comandos normais de preparação.
  O template LEVE usa outro Three, sem a construção TSL que causava essa espera.

## Medição da entrada

Intel UHD / Chrome desktop, viewport mobile; cache de contexto novo por caso.
Cada linha tem uma amostra por variante, com ordem alternada entre projetos.
O cache do driver pode persistir. São comparações de pacotes completos locais;
**não são homologação em celular físico nem promessa para os aparelhos dos 80 s**.

| Condição | LIV antes → depois | Laranjeiras antes → depois |
|---|---:|---:|
| CPU limitada a 4×, API nativa | 48,16 → 42,00 s | 39,11 → 35,28 s |
| API de agendamento ausente, sem limite de CPU | 13,62 → 6,68 s | 11,62 → 4,65 s |

As quatro capturas comparáveis foram idênticas pixel a pixel. Na cena imóvel,
as submissões à GPU em 1 s caíram de 7–61 para zero. Reabertura de interiores
**ainda no cache** ficou entre 27 e 306 ms. Os casos com CPU lenta continuam
levando 35–42 s: houve ganho, mas essa latência ainda é alta.

## Verificação

- 128 testes Node e o teste Python do manifesto: PASS.
- 144 mil segmentos nas seis plantas, com portas e móveis: mesmo resultado;
  rotas iguais. Cálculo de rotas de 537–845 para 327–553 ms no ensaio local.
- Pacotes finais: seis tipologias × planta/Tour × dia/noite e WebGPU real nos dois
  projetos; edição/reset, horário, plafons e cache: PASS, sem erro de JavaScript.
- Ausência de GPU, links 2D, falhas iniciais WebGPU no exterior/interior: PASS.
- Limite de dois contextos no Chrome: seis trocas, até dois interiores no cache e
  móveis editados restaurados após descarte: PASS.
- Arraste, caminhada, portas animadas, retorno a zero desenhos e perda real de
  contexto induzida com `WEBGL_lose_context`: PASS.
- Verificação pública: oito casos de plantas/backends e nove casos de falha/recuperação e cache: PASS.
  As seis plantas passaram pelas quatro vistas/horários nas URLs publicadas.
- Última conferência do Hosting: mesma versão, 1.621 arquivos e zero diferenças
  entre os pacotes esperados e os arquivos servidos.

## Publicação e fontes

Versão: `c9d002294057220d`, publicada em 01/11/2026 às 01:48:34 UTC.
Anterior: `4c56bcec8bc6c6db`. 38 arquivos alterados, 35 enviados, cerca de
1,9 MiB gzip. Inventário final: 1.621 arquivos. Configuração preservada e
**1.209 arquivos fora dos pacotes com o mesmo hash**. 30 verificações HTTP/hashes
públicos passaram; o HTML do LIV continua na função existente, usando os bundles
estáveis. O Laranjeiras mantém `noindex`.

Integração: commit `63d1955` em `feat/predio-novo`, sem trocar a branch compartilhada.
Os ajustes anteriores relacionados e três testes pendentes foram preservados.
Os outros 16 arquivos rastreados pendentes mantiveram seus hashes; pendências de
outras sessões continuam fora destes commits.

Evidências e scripts reproduzíveis:
`C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/implementacao-entrada/`.
Inventários, versão anterior, integridade e reversão:
`C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/deploy-entrada/`.
Não há acompanhamento automático ativo desta tarefa.

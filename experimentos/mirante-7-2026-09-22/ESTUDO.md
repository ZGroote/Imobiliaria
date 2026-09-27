# Teste de produção da miniatura Mirante 7

> **Registro histórico (22/09/2026).** Ensaio de produção feito na data; não descreve o estado atual. Estado atual: [DOCUMENTACAO.md](../../DOCUMENTACAO.md).

> **Material de terceiro retirado do `HEAD`.** O histórico do git não foi reescrito: os arquivos retirados e a versão completa deste texto continuam nos commits anteriores à retirada, e só quem tem acesso ao repositório privado alcança esses commits.
>
> **Em 26/09/2026 saíram as 15 imagens,** porque não há autorização documentada para redistribuí-las:
>
> - `fotos/01–05.jpg`, do anúncio da Maria Aires;
> - `fotos-iplano/01–09.jpg`, da iPlano;
> - `contato.jpg`, a folha de contato das cinco primeiras.
>
> **Em 27/09/2026 saiu o resto do material de terceiro ou derivado dele:**
>
> - os registros do anúncio: `iplano.json`, `dados-anuncio.json` e `anuncio.json`;
> - as coletas e os coletores: `coleta.json`, `coleta-iplano.json`, `coletar.py` e `coletar_complemento.py`;
> - o registro do extrator: `processo.json`, que guardava a URL do anúncio;
> - a planta e o modelo interpretados das imagens: `hipoteses.json`, `unidade.json`, `layout-automatico.json`, `ajustes-layout.json`, `gerar_miniatura.py`, `modelar.py` e `modelo/`;
> - a página montada: `miniatura.html`.
>
> **Este texto também foi reduzido em 27/09.** Ficam o método em nível alto, os tempos, as verificações e as limitações. Saíram as URLs das fontes, preço, área e tipologia, a comparação entre anúncios, as dimensões e hipóteses tiradas das imagens e os detalhes da interpretação da planta e do modelo.
>
> **Ficam na pasta** este texto e três registros nossos de medição: `resultado-teste.json`, `tempo-blender.json` e `tempo-montagem.json`. **O ensaio não é mais reproduzível a partir do repositório.**

## Resultado e tempo de ponta a ponta

Em 22 de setembro de 2026, o ensaio partiu do link de um anúncio público de lançamento e produziu uma página HTML local com:

- o exterior;
- o conjunto de duas torres;
- planta 2D e planta 3D;
- visita em primeira pessoa;
- o editor de móveis.

O botão "Ver mapa" foi omitido.

**Tempo:** o intervalo observado foi de **12 minutos e 1 segundo**, entre 20:34:05 e 20:46:06 UTC.

- O início é a primeira leitura do relógio ao começar a execução.
- O fim é a conclusão da revisão da miniatura e das verificações locais.
- Não entram o intervalo entre o envio da mensagem e a primeira leitura do relógio, nem a redação deste registro.

**O que o tempo representa:** uma primeira produção assistida neste ambiente, com reutilização do renderizador e das bibliotecas do projeto. Ele inclui:

- pesquisa;
- inspeção de código;
- adaptação da extração;
- download;
- interpretação;
- autoria de scripts;
- execução, erros e correções;
- revisão no navegador.

**O que ele não é:** a medição de um fluxo automático, uma média de vários empreendimentos ou um prazo de entrega garantido.

**A miniatura ficou pronta para avaliação local, sem publicação no Firebase.** O tempo até uma URL pública continua não medido.

## Método, em nível alto

1. **Extração.** O extrator genérico do projeto não identificou as imagens do anúncio. A extração foi adaptada para ler os dados estruturados que a própria página publica, sem capturar logotipos ou outros imóveis.
2. **Coleta.** Dois coletores baixaram as imagens de duas galerias públicas, 14 arquivos no total, e validaram cada arquivo. Uma das fontes complementares foi achada por pesquisa assistida. Não foi implementado um buscador autônomo.
3. **Planta.**
   - A planta foi interpretada visualmente de uma prancha de divulgação e calibrada pela área anunciada, sem cotas.
   - Uma divisória que não existia na referência foi removida na revisão.
4. **Mobília.** O gerador automático de mobiliário do projeto produziu um primeiro arranjo, e a revisão o ajustou para 19 peças. O arranjo é ilustrativo.
5. **Exterior.**
   - O modelo foi feito no Blender com as ferramentas do projeto (`blender_maquete_base.py`) e parâmetros ilustrativos.
   - A primeira exportação falhou numa validação de grupos por torre e foi corrigida. Uma segunda revisão ajustou a cobertura.
   - As duas correções estão dentro dos 12 minutos e 1 segundo.
6. **Montagem.** O ensaio reutilizou o template da miniatura existente, sem alterar cadastros publicados nem o gerador original.

## Tempos automáticos medidos

| Operação | Duração observada | Escopo |
| --- | ---: | --- |
| Coleta da primeira galeria | 4,533 s | Execução do coletor já escrito, rede e validação das imagens |
| Coleta da galeria complementar | 2,802 s | Download depois de identificar as imagens |
| Geração e exportação no Blender, execução final | 0,755 s | Tempo interno do script até salvar o projeto, sem iniciar o executável |
| Renderização estática final | 7,414 s | Cycles, 16 amostras, 1000 × 1000 pixels |
| Blender, total interno na execução final | 8,169 s | Soma das duas parcelas anteriores; não somar de novo |
| Montagem final da miniatura | 0,086 s | Tempo interno do script, com cadastro e mobiliário, sem inicialização do processo |
| Processo completo assistido até a conferência local | 12 min 1 s | Pesquisa, adaptação, interpretação, autoria, execuções, retrabalho e revisão |

Os tempos curtos não substituem o tempo de produção.

- Não se deve subtraí-los do total e chamar o restante de trabalho humano. O intervalo também contém leituras, chamadas de ferramentas, latência, raciocínio do assistente e outras execuções, e a medição não separou essas parcelas.
- Os valores do Blender e da montagem são das últimas execuções bem-sucedidas, não o custo acumulado de todas as tentativas.

Os números de Blender e montagem estão em `tempo-blender.json` e `tempo-montagem.json`. O resumo do ensaio está em `resultado-teste.json`.

**Ambiente:** Windows, Python do runtime Codex e Blender 5.2.2 LTS. A interface foi testada no navegador do Codex, em tela normal e num viewport de 390 × 844. O Cycles serviu para uma imagem de revisão; a miniatura interativa usa Three.js no dispositivo de quem visita.

## Verificações realizadas

**O roteiro executado:**

- foram abertos os modos prédio, conjunto de duas torres, planta 2D, planta 3D e visita;
- o editor listou as 19 peças;
- o sofá foi selecionado, teve a largura alterada e foi restaurado com Desfazer;
- o console consultado não mostrou avisos nem erros.

Isso não é uma validação exaustiva de cada opção do catálogo, de todos os percursos de caminhada ou da persistência entre dispositivos.

**Duas correções vieram da revisão:**

- **Responsiva:** havia sobreposição nos campos da ficha em tela estreita. A ficha passou a duas colunas com quebra de texto, e a conferência seguinte não achou rolagem horizontal.
- **Planta 2D:** o filtro de paredes herdado desenhava vergas como se fechassem portas. O ensaio passou a filtrar as paredes pelo corte a 1,20 m, e as aberturas foram conferidas visualmente depois da correção.

## Limitações

- Não houve teste em celular físico, ensaio de carga, medição de FPS, medição de memória nem publicação.
- **Exterior:** é aproximado. Fachadas não visíveis, medidas externas e a ligação entre as torres foram estimadas.
- **Prédio:** quantidade de pavimentos, altura e andar da unidade são ilustrativos, e não dados confirmados do empreendimento.
- **Planta:** calibrada pela área anunciada, sem cotas. A escala não foi conferida de forma independente.
- **Ficha:** o preço exibido na miniatura reproduzia o anúncio na data da consulta, sem confirmação comercial.
- Se o critério de "pronta" exigir planta cotada, implantação e fachadas confirmadas, este protótipo não o atende.

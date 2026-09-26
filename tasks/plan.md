# Plano: proporcao e ocupacao dos quarteiroes

> **Registro histórico (09/09/2026).** Plano de proporção e ocupação dos quarteirões. Os itens não foram acompanhados neste arquivo, e ele não descreve o estado atual do mapa. Estado atual: [DOCUMENTACAO.md](../DOCUMENTACAO.md).

Pedido de 09/09/2026: planejar melhorias no resultado visual das casas e terrenos.
Este documento propoe trabalho; nao aplica novas alteracoes no mapa.

## Diagnostico

O encaixe antigo podia reduzir os modelos a 65%. A correcao recente permite
6.771 encaixes em escala 1:1, mas nao resolve o parcelamento. A fonte completa de
lotes configurada esta ausente; a alternativa precisa ser confrontada com os
muros e com a procedencia das geometrias. Nao assumir que todo lote profundo e
incorreto ou que toda geometria disponivel representa cadastro oficial.

Ha tambem uma contrapartida: exigir escala quase real reduziu o uso da biblioteca
na amostra do teste de 525 para 239 instancias, antes da mudanca final da camera.
Os demais volumes usam o renderizador antigo. A melhora precisa recuperar modelos
compativeis em tamanho real, sem voltar a diminuir portas e janelas.

## Resultado pretendido

Um quarteirao com terrenos coerentes com sua origem, casas com proporcoes
arquitetonicas constantes, entradas conectadas a rua e quintais legiveis. Casas,
muros e portoes devem derivar do mesmo lote. O entorno sintetico continua sendo
ilustrativo; dados de imoveis cadastrados e geometrias confirmadas sao preservados.

## Ordem de execucao

### 1. Medir e escolher tres quarteiroes de teste

Auditar largura, profundidade, area, ocupacao, origem do lote e compatibilidade
com muros. Escolher um trecho com lotes profundos, um com terrenos estreitos e um
com esquina/geometria irregular. Registrar camera fixa, geometria antes/depois,
uso da biblioteca, memoria, tamanho do arquivo e tempo de quadro na mesma maquina.

Aceite: cada problema tem coordenada, medida e causa identificada. A procedencia
incerta e registrada; nao vira autorizacao automatica para subdividir terrenos.

Arquivos provaveis: pipeline/encaixar_casas_lotes.py; auditorias em
modelos_urbanos/v1/integracao; padrao/cidades/sao-carlos.json. Escopo medio.

### 2. Corrigir um quarteirao sintetico completo

Recuperar ou reconciliar primeiro as fontes de lotes. Onde a origem sintetica for
confirmada, revisar a geracao de profundidade e divisao das fileiras. Usar 10 x 25 m
como caso de teste, nao como dimensao universal. Lotes devem ter frente acessivel;
nao criar uma segunda fileira sem acesso ou transformar todo miolo em lotes cegos.
Em quadras grandes, manter um espaco interno coerente quando nao houver fundamento
para novas ruas ou subdivisoes. Gerar novamente casas, muros e portoes juntos.

Aceite: nenhuma parcela sobre via ou vizinha, nenhuma entrada isolada, nenhuma
mudanca em lote confirmado ou imovel cadastrado. Comparacao visual do quarteirao
deve eliminar as faixas profundas causadas pelo gerador, quando esse for o motivo.

Arquivos provaveis: pipeline/lotes_sinteticos.py; pipeline/muros.py;
pipeline/cobertura_da_quadra.py; gerador de portoes a localizar na etapa 1.
Dividir em duas entregas: geometria do lote; regeneracao de divisas e acessos.

### 3. Completar a biblioteca para as dimensoes que faltam

Agrupar os encaixes rejeitados por largura/profundidade e modelar primeiro as
variantes que atendem mais casos: casas estreitas e profundas, casas em L e
sobrados compactos. Ajustar os volumes no gerador Blender, mantendo portas,
janelas, espessuras e altura dos pavimentos. Nao esticar a malha pronta.

Dimensionar a ocupacao a partir do espaco edificavel e do tipo de casa; uma faixa
visual inicial de 35–55% do terreno pode servir para os casos sinteticos comuns,
com excecoes explicitas. Isso e parametro de composicao, nao regra urbanistica.

Aceite: aumentar a proporcao de modelos detalhados nos tres trechos sem reduzir
a escala abaixo do limite atual, sem aumentar a repeticao perceptivel e sem
colisoes. Comparar envelope externo e projecao das paredes separadamente.

Arquivos provaveis: modelos_urbanos/v1/gerar.py; compilar_mapa.mjs;
pipeline/encaixar_casas_lotes.py; renderizador-v16-moveis/urban-models.js.
Escopo medio por pequeno lote de variantes, sem refazer todo o catalogo.

### 4. Dar funcao aos espacos livres

Com a geometria estabilizada, adicionar composicoes reutilizaveis: caminho entre
portao e porta, entrada de garagem, quintal com piso/grama e vegetacao contida.
Garagens e ediculas apenas onde houver espaco e uma composicao coerente, sem
duplicar anexos existentes. Evitar preencher todos os vazios com objetos.

Aceite: acessos conectados, quintais diferenciados e ausencia de objetos sobre
muros, vias ou casas. Elementos pequenos aparecem somente perto da camera e
usam instancias compartilhadas. Escopo medio, uma composicao por entrega.

### 5. Integrar a fachada com a calcada

Manter o desnivel existente e conectar entradas de veiculos com rebaixamentos
locais, preservando o percurso de pedestres. Refinar cantos e encontros de muros;
alinhar portoes com os acessos internos. Conferir tamanho das arvores junto das
fachadas e restringir copas que encobrem sistematicamente as casas.

Aceite: meio-fio legivel, acesso sem degrau indevido, ausencia de frestas e de
arvores bloqueando portoes. Escopo medio por item; nao alterar toda a malha viaria
antes da validacao do quarteirao piloto.

### 6. Validar e ampliar gradualmente

Repetir as auditorias de lotes, paredes, telhados, vizinhos e asfalto. Conferir
streaming, selecao de imovel, relevo e alturas. Comparar capturas identicas dos
tres trechos; expandir para um bairro antes da cidade inteira.

Orcamento inicial proposto: crescimento de arquivo comprimido ate 5% e regressao
de tempo de quadro p95 ate 10% na mesma maquina/camera/configuracao. Medir memoria
e chamadas de desenho junto desses valores; sao limites de aceite propostos,
nao resultados ja medidos. Otimizar ou reduzir detalhes se forem excedidos.

Comandos existentes: node modelos_urbanos/v1/integracao/testar.mjs;
node modelos_urbanos/v1/integracao/testar_ruas.mjs;
node modelos_urbanos/v1/integracao/testar_colisao_ruas.mjs;
python modelos_urbanos/v1/integracao/auditar_encaixes.py;
python modelos_urbanos/v1/integracao/testar_browser.py colisao.
Montagem: MAPA_V=v16-moveis e python pipeline/montar.py sao-carlos.

## Dependencias e checkpoints

1 -> 2 -> 3 -> 4 -> 5 -> 6. A biblioteca pode ser diagnosticada durante 1, mas
suas dimensoes finais dependem do parcelamento validado. Checkpoint apos 2:
quarteirao piloto coerente e sem colisoes. Checkpoint apos 3: recuperacao de
modelos detalhados sem miniaturizacao. Checkpoint apos 5: composicao visual e
desempenho aprovados nos testes antes de ampliar. Publicacao fora deste plano.

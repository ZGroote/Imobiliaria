# Apresentação Conecta

Base criada pelo Claude no commit `f5af7738`. A abertura e a demonstração formam
uma única composição, seguida pelo processo, dúvidas e contato. Há um único
visualizador; a animação 2D da abertura e as listas repetidas foram removidas.

Prévia da revisão, válida até 3 de dezembro de 2026:
https://imobilaria-deccb-miniaturas--experiencia-20261102-q8g2v4hn.web.app/#demonstracao

## Executar e validar

Na raiz do repositório:

```powershell
python -m http.server 8766 --bind 127.0.0.1 --directory experimentos/apresentacao-2026-11-01/site
node --test tests/test_apresentacao.mjs
node --test tests/test_apresentacao_cache.mjs
node --test experimentos/apresentacao-2026-11-01/test_geometria.mjs
python -m unittest discover -s tests -p test_apresentacao_luz.py
node --check experimentos/apresentacao-2026-11-01/site/site.js
```

A pasta `site/demo` é gerada por `clonar_demo.py`, fica fora do Git e precisa
existir para executar ou publicar a maquete. O script usa o payload publicado do
LIV, remove a identidade do cliente e gera dados ilustrativos. Não substitua essa
pasta por uma cópia do viewer compartilhado sem passar pela anonimização.

Os testes que leem `site/demo` ficam em `testes/`, fora do CI (lá a demo não
existe). Com a demo gerada, rode nesta pasta: `node --test testes/*.mjs`.

## Comportamento

- A maquete começa a carregar assim que a apresentação abre, inclusive antes de
  chegar à demonstração. O visitante não precisa clicar para iniciar downloads.
- `prepareViews({all:true})` começa assim que o catálogo chega, antes da primeira
  cena ficar pronta. Decodifica as duas plantas e prepara o exterior em paralelo
  à fila dos dois interiores, preservando a câmera e a seleção do visitante.
  Cada interior compila e renderiza os modos apartamento e tour antes de ficar
  pronto. As demais horas de iluminação continuam sendo buscadas em segundo plano.
- O progresso de quatro etapas usa plantas decodificadas e `readyScenes`; não
  confunde um iframe existente ou arquivos baixados com uma cena pronta.
- As etapas usam a API `__livViewer` da mesma origem. As cenas
  preparadas e o apartamento escolhido permanecem entre as trocas.
- A prontidão da aba considera a tipologia selecionada, sem esperar pela outra.
  Apartamento e tour compartilham o renderer ativo; trocar entre eles só muda o
  modo da cena. As outras cenas ficam suspensas e conservam seus recursos.
- O estado pronto depende de `ready` e do modo solicitado, não do evento `load`.
  Os vínculos das plantas são aguardados antes da seleção da unidade padrão.
- Ampliar usa o mesmo elemento e iframe em um diálogo modal. O diálogo nativo
  fornece fechamento por Escape e isolamento do foco; o botão de retorno também
  funciona no celular. Referência: [elemento dialog no MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).
- Voltar à página devolve a rolagem ao visitante. Falhas oferecem nova tentativa;
  escolher outra etapa após erro reinicia o documento da demonstração.
- O prazo de abertura conta apenas o tempo com a página visível. O monitor volta
  a funcionar quando a apresentação é restaurada pelo histórico.
- A maquete faz uma órbita lenta enquanto está visível, até o primeiro gesto do
  visitante. Usa o controle e o ciclo de renderização existentes, sem outro loop.
- O passeio guiado é opcional e só libera quando as quatro vistas estão prontas.
  Apresenta o prédio, a planta original, o apartamento com paredes baixas e o
  caminho até a sala. Pode pausar, continuar ou repetir; escolher uma aba ou
  interagir com a maquete encerra o roteiro e devolve o controle ao visitante.
- Sair da área da demonstração ou ocultar a página pausa o passeio. A preferência
  por movimento reduzido desativa a órbita e as animações decorativas e torna o
  deslocamento até a sala imediato.

O gerador aplica esse comportamento somente à cópia da apresentação e recompila
as três entradas usadas pelo HTML: viewer, exterior e interior, com os respectivos
preloads. Requer o esbuild da raiz e o Three 0.186.1 já instalado em
`experimentos/liv-experimental-2026-10-14/node_modules/three`; os arquivos centrais
são conferidos contra os da publicação preservada. A revisão nas URLs evita
executar um bundle antigo guardado no navegador.

Validação: testes de comportamento, inspeção real dos quatro modos e do
diálogo no navegador, e layouts de 320 px, 390 px e desktop. O teste responsivo
usa viewport de navegador; não substitui uma conferência em iPhone físico.

## Atualizar a prévia

Nesta pasta, usando o CLI instalado na raiz:

```powershell
node ../../node_modules/firebase-tools/lib/bin/firebase.js hosting:channel:deploy experiencia-20261102 --expires 30d --project imobilaria-deccb --config firebase.json --no-authorized-domains --non-interactive
```

O comando publica somente o canal temporário `experiencia-20261102`.

## Plantas originais e fluxo

Por solicitação do usuário, a demonstração preserva as plantas humanizadas de
`publicacao/liv-duplo-20261017/payload/liv-classico/plantas2d`, em vez de redesenhá-las.
Os dois JPGs de 1000×1000 e suas máscaras SVG são cópias idênticas às da origem;
o registro da régua e das medidas permanece. O gerador não precisa mais do Pillow.
As URLs incluem uma revisão para evitar reutilizar a imagem simplificada antiga.

A página mostra as quatro vistas somente dentro da demonstração. Depois dela,
apresenta o processo, as dúvidas e o contato. O carregamento antecipado
continua ativo desde a abertura, sem depender da animação removida.

## Tratamento visual

A navegação das quatro vistas é horizontal, sem coluna de estados permanentes.
Os indicadores de preparo somem ao concluir. A cópia do viewer usa a mesma
tipografia e fundo azul claro institucional da página, com ferramentas por contexto e disponibilidade
desligada de início. O botão “Ver disponibilidade” continua destacando unidades.
O sol modifica a luz da cena, preservando o fundo transparente. A planta abre
enquadrada pelo contorno do desenho original, sem alterar os pixels ou as
coordenadas da régua. O enquadramento inicial do exterior aproxima o prédio.

`assets/arquitetura.webp` é uma versão otimizada do estudo próprio em
`experimentos/casa-vistalar-2026-10-08/casa-vistalar-fim-de-tarde.png`, usada somente
na seção de processo. Não representa o Vila Aurora. O rodapé mantém os créditos
dos veículos CarConcept (Eric Chadwick / Darmstadt Graphics Group, CC BY 4.0).

A identidade vem de `fachada/assets/visual-novo.css`, promovida em 28/10/2026,
conforme `fachada/PUBLICACAO.md`: papel `#f5f8ff`, tinta `#07184d`, painel
`#edf2ff` e gradiente azul/roxo `#008ff5 → #3345ff → #8a15f3`. Cabeçalho,
rodapé e favicon usam cópias exatas de `fachada/assets/logo-conecta.webp` e
`marca.svg`; a marca não é reconstruída com texto. As opções comerciais antigas
foram retiradas por orientação atual do usuário, sem criar novos pacotes.

Os 26 testes de navegação incluem inicialização sem o hero antigo, preparo
antecipado, troca de modos, erro, histórico, preservação do iframe, sequência e
pausa do passeio, visibilidade, movimento reduzido e interrupção pelo primeiro
gesto, sincronização dos controles do viewer durante o roteiro e regressão da
identidade oficial e do conteúdo comercial. Três testes adicionais executam o
viewer e os módulos de plantas reais em VM, com DOM, rede e GPU controlados:
comprovam preparo dos interiores antes do exterior pronto, dois ciclos por
tipologia sem novos iframes, decodificações ou descartes, e uma fila compartilhada
pelos pedidos do visitante durante o preparo inicial. As alterações desta
conversa continuam sem commit.

## Versões em português e inglês

A apresentação é a base publicada em `conectaimoveis3d.com.br` (português) e
`conectaimoveis3d.com` (inglês). O catálogo da landing fica em `i18n/en.json`,
com build por `i18n/build.py`; os rótulos dinâmicos do demo usam `demo-i18n.js`.
O seletor manual tem prioridade sobre a sugestão por país. A configuração,
as verificações e os journals de publicação estão documentados em
[`conecta/internacional/README.md`](../../conecta/internacional/README.md).

Os nomes gravados na imagem da planta também têm variantes em inglês para Canto
e Meio, em [`plantas2d-en/`](plantas2d-en/README.md). Apenas as áreas dos dez
rótulos mudam: a validação encontrou zero pixels diferentes no restante do
desenho. O catálogo seleciona a imagem antes do preload e conserva a régua,
as máscaras, as medidas e o cache. Os JPEGs usados em português não mudam.

## Vagas dos apartamentos da demonstração

Ao desligar o cadastro remoto para a demonstração, a ficha conservava o texto
`Vaga N`, mas o campo numérico `parkingSpaces`, usado pelo renderer, ficava
vazio. As 175 posições e o efeito amarelo pulsante estavam presentes.

A apresentação passa a criar os vínculos locais dos 170 apartamentos a partir
dos números explícitos da própria tabela ilustrativa. A integração é exclusiva
da cópia; o cadastro remoto e o módulo comercial original não mudam. A validação
do gerador confere os números contra o mapa físico antes de gravar os arquivos.
Atualizar a tabela recompõe o vínculo; remover uma atribuição limpa o destaque.

Os testes executam o catálogo e o wrapper reais, a seleção do viewer e o
renderer de vagas com Three real. Conferem as coordenadas do volume e contorno,
o pulso, a troca, a limpeza, o descarte e a última seleção enquanto o mapa ainda
está carregando. O controle do navegador do Work continua desativado; a
conferência visual final em produção depende de sua reativação.

A correção foi publicada em ambos os domínios em 03/11/2026 às 20:25 UTC.
O journal `publicacao/vagas-apresentacao-20261103/publicacao/` registra integridade
`PASS` e vinte respostas HTTP idênticas ao build testado. No conjunto, passaram
68 testes; um caso de link simbólico foi ignorado pela restrição deste Windows.
As alterações continuam sem commit.

## Correção da luz acima das aberturas

A origem de 17/10 não continha a correção de iluminação publicada em 01/11.
`sincronizar_luz_aprovada()` incorpora os 30 atlas Canto/Meio dessa publicação,
verificando antes a identidade visual da geometria e dos UVs. Conserva os vínculos
e hashes da cena anonimizada e usa a interpolação RGBM aprovada, que decodifica
os quatro texels antes de interpolar. O carregador recebe dimensões e usa
`NearestFilter`; não importa o outro motor de renderização presente na publicação.
O teste de recursos confere todos os bytes compactados e descompactados dos atlas,
seus manifestos e a expressão do material. Copiar só código ou manifestos deixa
a correção incompleta, pois os binários de iluminação são ignorados pelo Git.

## Encaixe das portas

`interior-porta-fecho.js` ajusta as nove folhas de giro Canto/Meio depois de sua
extração pelo módulo de portas. A fonte deixava 25 mm livres no trinco e 8 mm
acima da folha. O ajuste prolonga a madeira em 40 mm na largura e 23 mm no topo,
produzindo a mesma sobreposição de 15 mm sob as ombreiras e a travessa. Conserva
dobradiça, espessura, altura da maçaneta e tamanho das ferragens; a maçaneta apenas
acompanha a nova borda. Atualiza o alcance da colisão e mantém o giro original.

Os dois testes de geometria usam as cenas congeladas e o módulo de portas reais:
comparam vértices das ferragens, raios nas frestas antes/depois, fechamento,
reabertura e passagem. O gerador copia o módulo e instala a chamada no renderer
da apresentação, antes de fechar a entrada e configurar o corte das paredes.

Na revisão de 03/11, passaram 31 testes Node (incluindo os dois casos de
geometria) e três testes de recursos da iluminação. A conferência no navegador
incluiu a porta da suíte e a parede acima dela no Meio, caminhada até o outro
quarto e abertura do Canto em WebGL, sem erro de renderização observado.

# Estudo de acessos repetidos — quanto custa o segundo acesso

Pergunta: **uma pessoa abre a maquete uma vez. Depois ela volta, na mesma maquete ou em
outra. Quanto esse segundo acesso gasta?** Comparação entre a versão atual (v3, no ar) e a
v4 (`versao-melhorada-07-10/`), medida em @@QUANDO@@ com o Monte dos Cedros.

## Resposta curta

- **Volta à mesma maquete: praticamente nada, nas duas versões.** O aparelho guardou os
  arquivos da primeira vez. O servidor só confirma que a página não mudou: **@@VOLTA_V4@@**
  na v4 e @@VOLTA_BASE@@ na atual, contra @@PRIMEIRO_V4@@ (v4) e @@PRIMEIRO_BASE@@ (atual) do
  primeiro acesso. Mil voltas custam menos de um centavo de dólar.
- **Abrir outra maquete do site: é aqui que a v4 economiza no segundo acesso.** O motor 3D,
  o decodificador de texturas e o código da maquete são os mesmos para todo imóvel e já estão
  no aparelho. A v4 baixa só os dados do imóvel novo: **@@OUTRA_V4@@** (celular fraco:
  **@@OUTRA_V4_FRACO@@**). A versão atual embute tudo na página de cada imóvel e baixa
  @@OUTRA_BASE@@ de novo.
- **Depois de uma publicação nova (uma correção no código):** quem volta baixa na v4 só o
  arquivo que mudou (**@@PUB_V4@@**). Na atual, baixa a página inteira de novo
  (@@PUB_BASE@@), porque o código está dentro dela.
- **O "quase nada" depende de o aparelho ter guardado os arquivos.** Aba anônima, limpeza de
  dados, celular sem espaço ou o navegador de dentro de outro app (Instagram, por exemplo)
  fazem a segunda visita custar o mesmo que a primeira. Mais abaixo:
  [quando o aparelho não tem nada guardado](#quando-o-aparelho-não-tem-nada-guardado).

## Quanto cada acesso baixa

Bytes que saem do servidor (corpo comprimido mais cabeçalhos), mediana de 3 execuções. Na
versão atual o número é o mesmo em qualquer aparelho. Na v4 o celular fraco recebe a luz em
meia resolução.

@@BYTES@@

- "Volta" é fechar o navegador e abrir de novo outro dia: o que sobrevive é o cache em disco,
  como num celular.
- "Outra maquete" é um segundo imóvel do mesmo site, com dados do mesmo tamanho do Cedros.
  Hoje só o Cedros está na v4; com mais imóveis, cada um custa isso para quem já abriu outro.
- Entrar no apartamento custa a mesma coisa na volta e no primeiro acesso, porque esses
  arquivos só descem quando a pessoa pede. Da segunda vez em diante, sai do aparelho.
- **Defeito achado neste estudo:** no celular, quando a capa sai da tela, a v4 baixa também a
  versão larga da capa (@@CAPA_EXTRA@@), que ninguém vê. São 1 a 2% do primeiro acesso no
  celular, e a tabela já inclui esse valor. A correção é de uma linha: tirar o `<picture>`
  inteiro, e não só a imagem de dentro dele. Ela fica para a próxima versão, para não mudar a
  v4 que está sendo avaliada.

## Quanto custa no Firebase Hosting

**Custo de 1.000 acessos de cada tipo**, só pela transferência (US$ 0,15/GB), sem descontar a
franquia gratuita. Mistura de aparelhos: 30% computador, 50% celular médio, 20% celular fraco.

@@MIL@@

**Por mês**, com @@PREMISSAS@@. A franquia gratuita do Hosting (360 MB por dia) é do projeto
inteiro: o mapa e o painel usam a mesma.

@@MES@@

- **Ninguém volta** é o teto: é a conta de quando o cache não ajuda (ver abaixo).
- **Catálogo** é o caso em que a v4 mais se distancia: com vários imóveis no ar, cada maquete
  a mais custa só os dados dela.
- As fatias (primeiro acesso, volta, outra maquete) são suposições. Para trocar:
  `python medicoes/estudo_acessos.py --acessos 1000 --interior 0.4`, e editar a lista `MIXES`.

## Quanto tempo leva

Tempo até a maquete aparecer com a luz calculada, mediana de 3. O ambiente de medição não
tem placa de vídeo, então os tempos servem para comparar as versões entre si, não como tempo
absoluto de um celular.

@@TEMPO@@

Na volta, a v4 abre a luz calculada em cerca de 3 s em qualquer aparelho, porque não há nada
para baixar. Sobra só o trabalho do aparelho: transcodificar a textura e preparar o desenho.

Do toque em "Planta 3D" até a luz do apartamento:

@@TEMPO3D@@

## O que é reaproveitado ao abrir outra maquete

Celular médio, v4: o que veio da rede e o que saiu do próprio aparelho.

@@OUTRA@@

## Quando o aparelho não tem nada guardado

@@PESQUISA@@

## Como foi medido

- `node medicoes/acessos.mjs` abre um Chromium de verdade com um perfil novo, gravado em
  disco, e fecha o navegador entre as sessões. Cada execução percorre, nesta ordem: primeiro
  acesso; volta, recarregar e entrar no apartamento; volta e entrar de novo; outra maquete e
  o apartamento dela; volta depois de uma publicação nova. São 3 execuções por aparelho, com
  rede e CPU simuladas (os mesmos perfis do `medir.mjs`).
- O servidor de medição (`medicoes/servidor.mjs`) imita o Hosting: compressão, os cabeçalhos
  de cache do `firebase.json` de cada versão, e ETag com resposta 304. Os bytes são contados
  dos dois lados: no servidor e no navegador (DevTools Protocol). A maior diferença entre os
  dois em toda a medição foi de @@CONFERE@@ bytes: os cabeçalhos.
- A "outra maquete" é a do Cedros com outro endereço para os dados (mesmos bytes). A
  "publicação nova" muda o código: na v4, o arquivo principal ganha outro nome e o HTML aponta
  para ele; na atual, muda o HTML, onde o código está embutido.
- Para refazer: `node medicoes/acessos.mjs` e `python medicoes/estudo_acessos.py`.

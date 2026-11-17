# Página de demonstração: lista de terrenos + mapa + maquete (Visual, 17/11)

**Onde:** direto na worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Mexa só em `viabilidade/visual/`. **Não mexa** no `index.html` da worktree `imobiliaria-viabilidade` nem em `viabilidade/projetista/`. Não commite: a central commita.

## Para quê

O usuário vai mostrar a ideia para uma pessoa. A página atual (`index.html`) é a ferramenta técnica, com muitos painéis. Esta página nova é a **vitrine**: limpa, para alguém de fora entender em um minuto. Quem abre precisa conseguir:

1. ver a lista de terrenos em estudo;
2. ver onde cada terreno fica no mapa;
3. ver a maquete do prédio sobre o mapa, no lugar certo.

## O que fazer

**Página nova `viabilidade/visual/vitrine.html`**, que lê `../projetista/vitrine/indice.json`. Os dados já existem: 7 terrenos, 5 com status `ok` e 2 com `falhou`.

1. **Lista (à esquerda; no celular, em cima):** um cartão por terreno, com:
   - nome ("Terreno 1"...);
   - área do lote;
   - andares e apartamentos (sem térreo / com térreo), copiados do `resumo.json`.

   Os de status `falhou` aparecem acinzentados, com o `motivo` em texto. Não esconda esses terrenos: eles mostram que o sistema também diz "não cabe".
2. **Mapa (à direita):** ao escolher um terreno, mostre o fundo de ruas em volta dele, com o contorno do lote destacado.
   - **Sem biblioteca nova.** Use o three que já está no `importmap`: um plano no chão com os ladrilhos de mapa como textura (calcule x/y do ladrilho a partir de lat/lon, zoom 17 ou 18, uma grade 3×3 ou 5×5 em volta do centro) e o lote e os volumes em metros locais em cima.
   - **O fundo do mapa vem de uma constante só** no topo do arquivo (URL do ladrilho + texto de atribuição). Por enquanto, use o OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) e mostre **sempre** "© colaboradores do OpenStreetMap" visível no canto do mapa. O usuário ainda vai decidir entre ruas e satélite. Trocar o fundo tem que ser mudar só essa constante.
   - **Sem ladrilho** (offline ou com erro): chão neutro claro, com uma mensagem pequena "mapa indisponível". O resto da página continua funcionando.
   - Respeite a regra de uso do OSM: só os ladrilhos da vista. Nada de baixar ladrilhos antes de precisar, guardar em disco ou mandar muitos pedidos.
3. **Prédio no mapa:** os volumes de `volumes_wgs84` (ou `volumes_terreo_wgs84`), extrudados com `z0_m` e `altura_m`, no **estilo maquete** da tarefa 22 (papel branco, lajes, janelas). Reaproveite o código da 22 se der; se precisar copiar, copie só o necessário.
   - Um botão troca entre "sem térreo" e "com térreo", e os números do cartão trocam junto.
   - A câmera enquadra o lote e o prédio num ângulo 3/4, com as ruas em volta visíveis.
4. **Ficha do terreno escolhido:** os números do `resumo.json` (andares, apartamentos, vagas, área privativa, área computável, área do lote) e um link "abrir estudo completo", que abre `index.html?estilo=maquete&resumo=../projetista/vitrine/terreno-N/resumo.json`.
5. **Faixa fixa, sempre visível:** "Estudo preliminar — números não conferidos com a prefeitura". Nunca escreva "viável" nem "aprovado". Nenhuma conta nova no navegador.
6. **Sem dado pessoal:** use só `nome`, `lote_ref` e os números. O `lote_ref` pode ir num texto pequeno.
7. **Visual limpo:** fundo claro, poucos elementos, tipografia do `index.html`. No celular (390 px), lista em cima e mapa embaixo, sem rolagem lateral.

## Prova

- Prints em `viabilidade/visual/evidencias/`:
  - `tarefa23-desktop.png`: lista + terreno 1 no mapa;
  - `tarefa23-terreno-6.png`: o mais alto (21 andares);
  - `tarefa23-celular.png`;
  - `tarefa23-sem-mapa.png`: com os ladrilhos bloqueados.

  Para os prints com mapa, pode carregar os ladrilhos do OSM no navegador do teste. É uso normal de poucos ladrilhos.
- `testar.cjs` com casos novos. **Nos testes automáticos, bloqueie os ladrilhos** (sem rede) e confira:
  - 7 cartões, sendo 5 `ok` e 2 acinzentados com motivo;
  - clicar num cartão troca o prédio e os números;
  - o botão do térreo troca os números;
  - a faixa de estudo preliminar aparece;
  - a atribuição aparece;
  - sem erro no console;
  - celular sem rolagem lateral.
- `index.html` continua passando nos testes de antes.
- Relato curto em `viabilidade/visual/RELATORIO-23.md`, dizendo:
  - qual zoom e quantos ladrilhos a página pede por terreno;
  - quanto erra a posição do prédio sobre o mapa: confira num print se o lote cai sobre a quadra certa.
- Ao terminar: `maestri ask "Claude Code" "Visual tarefa 23 pronta"`.

## Regras

- Não toque em `motor/`, `terreno/`, `projetista/`, `relatorio/`, painel, `.github/`, config nem hook.
- Nada de dependência nova.
- **Não publique nada.** Publicar depende do usuário.

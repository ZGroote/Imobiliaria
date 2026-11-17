# Maquete de arquiteto + números na tela (Visual, 17/11)

**Onde:** direto na worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Mexa só em `viabilidade/visual/`. **Não mexa** no `index.html` da worktree `imobiliaria-viabilidade`: ele faz parte da pilha de PRs #125 a #128. Não commite: a central commita. Os agentes Claude mexem em `viabilidade/projetista/`: não toque nessa pasta.

## Para quê

O usuário vai mostrar a ideia para uma pessoa. Hoje a prévia do projetista são caixas coloridas: dá para entender o tamanho, mas não parece um prédio, o prédio aparece pequeno na tela e nenhum número explica a ideia. O objetivo é que quem olha veja **um estudo de prédio no estilo maquete de arquiteto**, ou seja, de papel branco, e não um render realista. O estilo é proposital: o estudo é preliminar e não pode parecer projeto final.

## O que fazer

1. **Estilo "maquete"**, ligado com `?estilo=maquete` ou com um botão "Maquete / Esquema". **Sem esse parâmetro, tudo fica como hoje**, e os estudos antigos do motor saem idênticos. Mostre isso com a mesma medição que você usou na tarefa 21. Com o estilo ligado:
   - **Volumes:** branco ou cinza bem claro, fosco, com aresta fina mais escura.
   - **Uma linha de laje** em cada pavimento, a partir de `z0_m` e da altura do volume.
   - **Faixas de janela** escuras, levemente azuladas, nas faces externas das **unidades**, uma por andar.
     - Núcleo e circulação ficam sem janela.
     - Faça o mais barato que funcionar: algumas caixas finas ou uma textura desenhada num canvas. Não use modelo externo.
   - **Térreo:**
     - **Garagem:** aberta e mais escura por dentro, ou com pilares simples nos cantos.
     - **Hall:** com vidro.
   - **Lote:** um tom de grama ou de madeira clara.
   - **Sombra suave** no chão.
   - **Envelope tracejado:** continua, com um botão para ligar e desligar.
   - **Fora do lote:** nada. Sem rua, árvore, carro ou vizinho.
2. **Enquadramento:** ao abrir, a câmera enquadra o prédio, que ocupa uns 60% da altura da tela, num ângulo 3/4 de cima. "Vista inicial" volta para esse enquadramento.
3. **Painel de números**, opcional, com `?resumo=<arquivo.json>`. O formato está abaixo e é o mesmo que o Motor está gerando.
   - Mostre: andares, apartamentos, vagas, área privativa, área computável e área do lote, cada uma com sua unidade.
   - Mostre **sempre** a faixa "Estudo preliminar — números não conferidos com a prefeitura".
   - Não faça nenhuma conta nova no navegador. Nunca escreva "viável" nem "aprovado".
   - Valide o arquivo; se for inválido, mostre uma mensagem clara.
4. **Legenda** das cores ou dos materiais que aparecem, no estilo atual.
5. **Térreo ligado/desligado:** se o resumo tiver `estudo_terreo`, um botão troca entre as duas versões (sem térreo e com térreo), e o painel troca os números junto.

## Formato do `resumo` (o Motor gera)

```json
{
  "id": "terreno-1",
  "nome": "Terreno 1",
  "estudo": "estudo-previa.json",
  "estudo_terreo": "estudo-previa-terreo.json",
  "numeros":        {"andares": {"valor": 2, "unidade": "pav"}, "unidades": {"valor": 12, "unidade": "un"},
                     "vagas": {"valor": 0, "unidade": "vagas"}, "area_privativa": {"valor": 0.0, "unidade": "m²"},
                     "area_computavel": {"valor": 772.29, "unidade": "m²"}, "area_lote": {"valor": 0.0, "unidade": "m²"}},
  "numeros_terreo": { "...mesmas chaves..." : {} }
}
```

Os caminhos de `estudo` são relativos ao arquivo do resumo. Até o Motor entregar, teste com um resumo de exemplo feito à mão a partir de `viabilidade/projetista/exemplo-22421/estudo-previa.json`, e deixe esse resumo em `viabilidade/visual/evidencias/`.

## Prova

- Prints em `viabilidade/visual/evidencias/`:
  - 22421 no estilo maquete, com o painel;
  - o mesmo com o térreo ligado;
  - o mesmo visto de cima;
  - um estudo antigo do motor sem o parâmetro, idêntico ao de antes.
- `testar.cjs` passando, com um caso novo para `estilo=maquete` e outro para o `resumo` inválido.
- Relato curto em `viabilidade/visual/RELATORIO-22.md`.
- Ao terminar: `maestri ask "Claude Code" "Visual tarefa 22 pronta"`.

## Regras

Não toque em `motor/`, `terreno/`, `projetista/`, `relatorio/`, painel, `.github/`, config nem hook. A biblioteca de 3D é a que já está no `importmap`; nada de dependência nova.

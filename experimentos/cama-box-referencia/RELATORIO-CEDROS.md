# Cama assada na Cedros: marcos de qualidade, peso, tempo e custo

> **Atualização (v6, mesmo dia):** a rodada de otimização está [no fim deste arquivo](#rodada-de-otimização-v6). Resumo: apartamento + cama **615 KB** (era 851), **US$ 1/mês** a 1.000 visitas/dia, 3G abre em **3,0 s**.

06/10/2026. Pergunta: dá para pôr o móvel do Blender na Cedros e abrir num celular em 3G/4G em
menos de 5 s, ou abrir o resto e ir carregando em partes? Quanto pesa o apartamento e quanto custa
com 1.000 visualizações por dia?

## Resposta curta

**Sim, desde que as texturas de parede e piso do piloto PBR fiquem de fora ou entrem depois.**

- Com a página LEVE e a cama assada no nível q3 (marco D), o apartamento pesa **851 KB** na primeira visita.
- Ele **abre em 1,6 s no 4G e em 3,5 s no 3G**.
- A cama boa chega sozinha depois, trocando no lugar sem recarregar:
  - aos 4,3 s no 4G;
  - aos 8,8 s no 3G.
- Com 1.000 visitas por dia são **~24 GB/mês, uns US$ 2 por mês** no Firebase Hosting.

O que estoura o padrão não é o móvel: são os **2,6 MB das texturas de parede e piso** do piloto PBR (marco F). Elas quadruplicam o peso e atrasam a cama para 21 s no 3G.

## O que foi feito

1. **Cama de solteiro.** É a mesma receita da cama casal (`cena.py` com `LARGURA=0.88`): box inteiriço, um travesseiro e a almofada. A Cedros tem cama de solteiro (0,90 × 2,05) num quarto de 2,71 × 3,29 m. Testei a de casal e o gerador de layout a recusa naquela parede mesmo com o limite de área mais baixo.
2. **Pacote web em níveis** (`prep_web.py`):
   - A geometria é indexada e comprimida (posição em 16 bits, normal em 8 bits): 55 KB para a cama inteira, contra 603 KB só dos travesseiros no formato cru.
   - A textura sai em 4 resoluções.
3. **Extensão `cama-assada.js`**, no mesmo padrão do `visual.js` do piloto:
   - A página abre como sempre, com a cama do catálogo.
   - A cama assada baixa em paralelo e entra no lugar da antiga quando o q1 chega, depois sobe para q2 e q3 sem recarregar.
   - O material já nasce com espaço para o relevo, então subir de nível não trava o quadro.
   - A cama do catálogo fica escondida, nunca apagada. `?cama=q0` desliga a troca.
4. **Calibração de cor no quarto.** A luz do interior da maquete é quase toda céu. Sem correção a cama saía azulada: tampo em (99, 105, 119) contra (166, 159, 156) na foto. Com ganho por canal e um pouco de brilho próprio quente, o tampo ficou com 0,96 do brilho da foto e o mesmo calor. É o mesmo recurso que o piloto PBR usa na parede.
5. **Duas variantes montadas**, sem tocar nas existentes:
   - `publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5/site-leve`: LEVE + cama;
   - `publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5/site`: v4 PBR + cama.

## Marcos de qualidade (medidos)

Primeira visita, sem cache. A rede foi emulada no Chrome com a GPU desta máquina, e os bytes são entregues em brotli como o Hosting entrega. Mediana de 2 rodadas.
- **"abre":** primeiro quadro na tela.
- **"cama":** a cama assada já no quarto, naquele nível. No pior caso o visitante clica em Visita no mesmo instante em que a página abre.

| marco | o que tem | peso 1ª visita | 4G bom (20 Mbps) | 4G fraco (5 Mbps) | 3G (1,6 Mbps) | celular lento + CPU 4× | GB/mês (1000/dia) | US$/mês | R$/mês* |
|---|---|---|---|---|---|---|---|---|---|
| A | hoje: cama do catálogo | 448 KB | abre 1,6 s | abre 1,8 s | abre 3,5 s | abre 5,7 s | 13 | 0,30 | 1,67 |
| B | cama assada q1 (forma) | 509 KB | abre 1,6 / cama 3,9 s | abre 1,8 / cama 4,2 s | abre 3,5 / cama 6,3 s | abre 5,7 / cama 9,7 s | 15 | 0,57 | 3,11 |
| C | cama assada q2 (básico) | 585 KB | abre 1,6 / cama 4,1 s | abre 1,8 / cama 4,5 s | abre 3,5 / cama 7,0 s | abre 5,7 / cama 11,2 s | 17 | 0,89 | 4,90 |
| **D** | **cama assada q3 (detalhe)** | **851 KB** | **abre 1,6 / cama 4,3 s** | **abre 1,8 / cama 5,2 s** | **abre 3,5 / cama 8,8 s** | **abre 5,7 / cama 13,3 s** | **24** | **2,03** | **11,17** |
| E | cama assada q4 (máximo) | 1.721 KB | não medido | não medido | não medido | não medido | 49 | 5,77 | 31,71 |
| F | q3 + parede/piso PBR (v4) | 3.386 KB | abre 2,1 / cama 7,2 s | abre 1,8 / cama 8,5 s | abre 3,9 / cama 20,9 s | abre 5,6 / cama 23,3 s | 97 | 12,91 | 71,01 |

\* Câmbio suposto de R$ 5,50 por dólar; ajuste ao do dia. Preço do Firebase Hosting: 360 MB/dia grátis e US$ 0,15/GB acima ([tabela oficial](https://firebase.google.com/pricing)).

### Como cada marco aparece (recorte de perto, `fotos/niveis-perto-recorte.webp`)

- **q1 (61 KB):** a forma certa, mas o tufo vira mancha e o matelassê some. Na distância normal da visita (`fotos/niveis-quarto.webp`) ele já é igual ao q4.
- **q2 (137 KB):** o matelassê do box aparece e o tufo começa a ter estrela.
- **q3 (402 KB):** vinco em estrela e linha de bordado nítidos. É o melhor custo-benefício.
- **q4 (1,27 MB):** quase igual ao q3 pelo triplo do peso. Não recomendo.

Desempenho da cena com a cama: as mesmas **46 chamadas de desenho** da cama do catálogo, e menos triângulos (38.670 → 37.055), porque a cama antiga era mais pesada.

## Recomendação

**Padrão: marco D, a página LEVE abrindo na hora e a cama subindo q1 → q2 → q3.** Cabe nos 5 s em 3G e 4G (abre em 1,6–3,5 s) e o detalhe chega sozinho. Para outros móveis vale a mesma receita, ao custo de ~400 KB por peça no q3.

Se as texturas de parede e piso do PBR voltarem, elas precisam carregar do mesmo jeito: em níveis, depois da cama. Do jeito que estão hoje (2,6 MB de uma vez) elas são 77% do peso e atrasam todo o resto.

## Ressalvas

- **O celular lento do Lighthouse abre em 5,6–5,7 s** em todos os marcos, inclusive no A, que não tem a cama nova. O gargalo é o HTML base da maquete (3,4 MB cru, ~450 KB na rede) com CPU 4× mais lenta. A cama não muda isso; quem resolve é dividir o HTML.
- **A cama só começa quando o script do fim da página roda**, 4 a 9 s depois do início conforme o perfil. Dá para antecipar com `preload` no `<head>`, ao custo de disputar banda com o HTML (cerca de +0,3 s no primeiro quadro em 3G). Não fiz.
- **O custo é teto:** conta toda visita como primeira. As texturas e a cama têm cache longo, então o visitante que volta baixa quase nada. Os 360 MB/dia grátis valem para o projeto inteiro, não por página. Se o visitante abrir também o mapa da cidade (9–10 MB), esse passa a ser o item dominante.
- **Rede emulada**, não um aparelho físico. A GPU é a desta máquina e o perfil "celular" só desacelera a CPU. As versões v5 não foram publicadas.
- **Lateral da cama 23% mais clara que a foto:** a janela do quarto bate nela, e corrigir na cor escureceria o tampo.

## Como reproduzir

```bash
LARGURA=0.88 ASSADO=assado-solteiro blender -b --factory-startup --python assa.py
python prep_web.py assado-solteiro web-solteiro
python montar_v5.py                    # v4 + cama
python montar_v5.py --base leve --destino <...>/cedros-v5/site-leve
python fotos_cama.py q0,q1,q2,q3,q4     # fotos do quarto, de longe e de perto
SITE=site-leve python medir_cama.py 4g-bom,4g-fraco,3g,celular-lighthouse 2
python custo.py                         # gera marcos.md
```


---

## Rodada de otimização (v6)

Pedido: "faz tudo e mede de novo". Site em `publicacao/piloto-qualidade-visual-2026-10-04/cedros-v6/site-leve`, montado por `montar_v6.py` (LEVE + `enxuga.py` + cama `web-solteiro-v2`).

### O que entrou e quanto rendeu (medido)

| Mudança | Antes | Depois | Conferência |
|---|---|---|---|
| Textura em **AVIF**, com WebP de reserva | q3 274 KB | q3 200 KB | O navegador escolhe testando um AVIF de 1 px embutido |
| Atlas da cama por **skyline com rotação** | 673 px/m (50% vazio) | 916 px/m | Mesma nitidez num atlas 25% menor de lado (768 no lugar de 1024) |
| **Travesseiro** decimado de 22% para 9% | 4.185 tri | 1.711 tri | Recorte de perto (`fotos/v5-x-v6-perto.webp`): o relevo assado segura o detalhe |
| Geometria indexada e comprimida | 55 KB | 26 KB | — |
| **Pula nível** quando a rede é rápida (`downlink` ≥ 5 Mbps ou ≥ 400 KB/s medidos no q1) | sempre q1 → q2 → q3 | q1 → q3 no 4G bom | 4G bom: 229 KB de cama; 3G: 287 KB (passa pelo q2) |
| Cama **só baixa ao entrar** na Planta 3D ou Visita | toda visita baixava | só quem entra | Quem só olha o prédio paga 328 KB |
| **`__luzue` vazio** (atlas de luz do Unreal) | 89 KB na rede | 0 | Só é lido com `?luz=ue`; a página padrão não usa |
| **Biblioteca de móveis** só com as peças pedidas (7 de 16) | 839 KB cru | 525 KB cru | Rodei a original com a biblioteca num Proxy em Prédio, Planta 3D e Visita; os 16 móveis saem com o mesmo número de triângulos (`montar_v6.py --confere`) |
| **three.js em arquivo próprio** com `preload` | dentro do HTML | 138 KB separado e em cache | A partir da 2ª visita, ou em outra unidade, não baixa de novo |

**HTML base:** 444 → **184 KB** (+138 KB do three na 1ª visita) = 322 KB, −27%.
**Cama no q3:** 402 → **229–287 KB** (−29 a −43%).

### Marco G contra os anteriores

| marco | peso 1ª visita | 4G bom | 4G fraco | 3G | celular lento | GB/mês (1000/dia) | US$/mês | R$/mês* |
|---|---|---|---|---|---|---|---|---|
| A: hoje | 448 KB | abre 1,6 s | abre 1,8 s | abre 3,5 s | abre 5,7 s | 13 | 0,30 | 1,67 |
| D: v5, LEVE + cama q3 | 851 KB | abre 1,6 / cama 4,3 s | abre 1,8 / cama 5,2 s | abre 3,5 / cama 8,8 s | abre 5,7 / cama 13,3 s | 24 | 2,03 | 11,17 |
| **G: v6** | **615 KB** | **abre 1,6 / cama 4,6 s** | **abre 2,0 / cama 5,4 s** | **abre 3,0 / cama 8,0 s** | **abre 5,8 / cama 13,5 s** | **18** | **1,02** | **5,59** |

\* Câmbio suposto de R$ 5,50.

Como ler o "cama" do G: a medição clica em Visita no instante em que a página abre. Na v6 a cama só começa a baixar nesse clique, e a visita leva 2 a 3,5 s para montar (bake de luz da própria maquete). Da casa pronta até a cama no q3 são **0,5 s no 4G bom, 2,5 s no 3G e 4,1 s no celular lento**.

### O que NÃO melhorou, e por quê

**O celular lento continua abrindo em ~5,8 s.** Medido nesse perfil (rede de 1,5 Mbps e CPU 4×):

| | HTML chega | 1º quadro | CPU em script |
|---|---|---|---|
| LEVE | 3,0 s | 6,1 s | 3,1 s |
| v6 | **2,0 s** | 6,4 s | 3,5 s |

A rede ficou 1 s mais rápida, mas a CPU lenta passa ~3,5 s executando o código da maquete antes de desenhar. Nesse perfil, cortar bytes não adianta mais. Quem resolve é adiar o código que só serve dentro da visita: luz assada por vértice, interior e catálogo de móveis. Isso exige mexer no gerador (`v1.5/miniaturas/pagina_maquete.py`) e eu não fiz.

### O que ficou de fora, e por quê

| Item | Motivo | Ganho estimado |
|---|---|---|
| Recortar o three.js no que a página usa | Precisa do código-fonte do three r168 (pacote npm), que não existe na máquina | ~150 → ~90 KB na 1ª visita |
| Adiar o código da visita (acima) | Refatoração no gerador da maquete | É a única alavanca para o celular lento ficar abaixo de 5 s |
| Detalhe repetível (textura de tecido pequena repetida mais mapa único de baixa resolução) | Exige shader de detalhe próprio; o three não tem esse mapa no material padrão | Cama de ~250 para ~80–100 KB, e a textura de tecido serve para todos os estofados |
| CDN com saída grátis (Cloudflare Pages/R2) | Decisão de conta e de infraestrutura | Custo de tráfego perto de zero, independente do peso |

### Reproduzir

```bash
LARGURA=0.88 ASSADO=assado-solteiro-v2 blender -b --factory-startup --python assa.py
python prep_web.py assado-solteiro-v2 web-solteiro-v2
python enxuga.py --usadas            # descobre as peças que a página pede
python montar_v6.py && python montar_v6.py --confere
VERSAO=publicacao/piloto-qualidade-visual-2026-10-04/cedros-v6 SITE=site-leve python medir_cama.py 4g-bom,4g-fraco,3g,celular-lighthouse 2
python custo.py
```

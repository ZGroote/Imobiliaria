# Sofá "nuvem" (estacionado) — o que ficou aprendido

Estacionado em 06/10/2026: cor e proporção bateram (foto × Cycles 7,4 %, Cycles × navegador ~10 %), o
braço em voluta com vivo não ficou igual à foto. O próximo sofá é de braço reto (referência mandada no
chat). Tudo abaixo vale pra QUALQUER estofado (sofá, poltrona, cama, cabeceira, almofada, pufe).

## Modelar

1. **Estofado = caixa de pano inflada** (`kit.estofado(nome, sx, sy, sz, mat, pressao, passo)`): cubo de
   malha fina (passo 2–4 cm), modificador Cloth com pressão, sem gravidade, 30 quadros, aplicado.
   O pano não estica (tensão 40): a face estufa, a aresta puxa pra dentro, o canto vira ponta e a ruga
   nasce na costura. Bevel + subsurf nunca dá esse "fofo".
2. **Pressão manda no tamanho final.** Ela cresce a caixa: 0,35 transformou um bloco de 40 cm em 56 cm
   e cobriu o encosto. Valores que deram certo:
   - bloco firme (assento + base, braço, estrutura do encosto): **0,08–0,12**;
   - almofada de encosto: **0,5–0,8**;
   - almofada solta: **1,3**;
   - travesseiro: **1,6**.
   Conferir o tamanho final no log (`estofado X: (pedido) -> [obtido]`).
3. **Caixa inflada não vira cilindro.** Braço em rolo é tubo de verdade (`kit.rolo`): seção redonda, ponta
   em quarto de círculo. A UV tem que ser arco DE VERDADE (u = raio do anel × ângulo, v = comprimento do
   meridiano). Com o raio cheio até a ponta, a trama do tecido espremia em "estrela" na tampa.
4. **Braço "voluta"** (lado de fora abrindo pra cima): cisalhar os vértices de fora do corpo do braço
   (x += k·altura), e o corpo subir até cobrir a ponta do rolo.
5. **Almofada solta deitada no encosto**: girar no plano ANTES de deitar (`poe(..., modo="YXZ")`, deitar
   −55°). Em XYZ ela fica em pé, como losango.
6. **Luz de foto de sala**: a de cima forte e a de frente fraca (topo do assento 210 × frente 130 na foto).
   Render em Standard. Luz demais estoura tudo em branco: começar com ~120 W de área no teto.

## Levar pro navegador

7. **Decimar até uma meta** de triângulos (`o["tri_alvo"]`; `TRI_ESCALA` no exportador). O sofá todo:
   10k tri = 84 KB, 5k tri = 46 KB (formato 2). Com o relevo assado, 5k já basta.
8. **Assar POR PEÇA** (selecionado→ativo, uma baixa só com a SUA alta). Com tudo junto, o raio da
   almofada acertava o encosto (elas se interpenetram) e o relevo saía com bloco verde-oliva e risco na
   borda da ilha. O AO continua vendo as vizinhas.
9. **Malha de bake SOLDADA** por posição. Em sopa de triângulos o MikkTSpace dá uma tangente por
   triângulo: o relevo sai assado em base facetada e a tangente não funde vértice (390 KB contra 207).
   O triângulo que a solda achataria ganha vértice próprio (degenerado derruba o `calc_tangents`).
10. **Exportar a tangente** (Int8×4). Sem ela o three monta a base por triângulo (derivada de tela) e a
    malha decimada aparece facetada mesmo com relevo.
11. **Respiro entre ilhas do atlas ≥ 10 px** (margem do bake 4). Com 4/2, a versão 512 vazava costura clara.
12. **Estratégia BN** = tecido compartilhado (cor + trama, uma imagem por casa) + AO 512 + relevo 512
    da peça. Comparação de perto:
    - B puro mostra faceta;
    - A (textura única) sai liso, mas sem trama (114 px/m);
    - BN é o mais parecido com o Cycles.
    Custo da peça: geometria + 18 + 8–11 KB.
13. **Linho compartilhado em 512** (cor 14 + relevo 27 KB). O 1024 tem relevo de 107 KB e não compensa.

## Depois (cortina, fogão)

14. **Dobra apertada: a malha baixa nasce baixa.** A cortina aberta (8 ilhós em 40 cm, meia-onda de
    6 cm) decimada até 3 mil tri virou mancha triangular no app — em B e em BN, então não era relevo.
    Gerar o pano já com 6 segmentos por dobra, sem subsurf e sem espessura (material dupla-face):
    24 KB contra 83, e limpo.
15. **Tecido grande pede mescla fina.** A mescla de 6 cm do linho virou mancha suja numa cortina de
    2,6 m; o blackout tem só o fio.
16. **Encaixe no registro depende do tipo:**
    - "caixa" (geladeira): estica w×h×d;
    - "altura" (fogão): escala uniforme pela altura e encosta na parede (esticar 45% deixa gordo);
    - "plano" (cortina, painel): estica largura e altura e mantém a profundidade real da dobra.
17. **`?moveis=0` é do app** (modo Móveis do v16) e tira todo móvel da casa. O desligador da peça
    nova é `?movelweb=0`.
18. **Python no Windows grava cp1252 por padrão.** Sempre `encoding="utf-8"`. Um "fumê" quebrou o
    exportador.

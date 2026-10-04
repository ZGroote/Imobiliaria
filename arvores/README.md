# Biblioteca de árvores (20 espécies)

Árvores low-poly de arborização urbana brasileira, geradas por script no Blender.
Revisão de 09/09/2026: copas deformadas suavemente para quebrar a regularidade,
normais suaves na folhagem e variação de cor mais discreta. Troncos preservam faces
definidas. Não houve aumento de triângulos; foram removidas faces sem área nas
pontas das folhas de palmeiras. O total do nível leve caiu de 6.482 para 6.324.
Sem textura: toda a cor é cor de vértice. O mapa reutiliza geometria com instâncias
globais por espécie e atualiza a entrada/saída das regiões incrementalmente.

## Arquivos

| arquivo | o que é |
|---|---|
| `especies.py` | a tabela das 20 espécies. **Dado puro, sem `bpy`** — dá pra ler sem o Blender. |
| `arvores.py` | o gerador. Roda dentro do Blender e monta as 20 espécies na cena. |
| `recolorir.py` | reescreve só a COR da biblioteca, sem abrir o Blender. |
| `export_arvores.py` | importa o gerador e escreve `arvores_lib.json`. |
| `render_fichas.py` | renderiza as fichas de conferência (`fichas_*.png`). |
| `arvores_lib.json` | a biblioteca consumível pelo mapa (1,7 MB; ~344 KB em gzip). |
| `arvores.blend` | a cena com as 20 espécies, pra inspeção manual. |
| `blender_bridge.py` / `bl.py` | ponte pra executar Python numa sessão do Blender já aberta. |

## Espécies

Folhosas: mangueira, oiti, sibipiruna, ipê-amarelo, ipê-roxo, quaresmeira, flamboyant,
figueira, jacarandá-mimoso, chapéu-de-sol, cinamomo, aroeira-salsa, ficus (topiária).
Palmeiras: imperial, coqueiro, areca (touceira).
Coníferas/outras: araucária, casuarina, eucalipto. Mais `arbusto` pra preenchimento.

As "floridas" (ipês, quaresmeira, flamboyant, jacarandá) têm parte dos blobs numa cor e
parte em outra — é a copa de duas cores que dá volume vista de cima. **Hoje as duas cores
são verdes:** `FLORACAO` em `especies.py` vale 0, e a cor de floração é substituída pelo
`flor_verde` de cada espécie. Pondo `FLORACAO = 1`, elas voltam a florir.

> As fichas `fichas_*.png` deste diretório foram renderizadas ANTES disso e mostram as
> árvores floridas. Regerar exige o Blender aberto (ver abaixo); a geometria não mudou,
> só a cor.

## Formato do JSON

```
especies[nome].lod["1"|"0"] = {
  pos_cm: [x,y,z, ...]   inteiros em centímetros, origem no pé do tronco, +Z pra cima
  nrm_127: [x,y,z, ...]  normal * 127 (int8)
  col: [r,g,b, ...]      byte sRGB, aplicar como vertexColors
  idx: [...]             índices dos triângulos
}
```

LOD 1 = copa arredondada (média 534 tris). LOD 0 = icosaedro cru (média 324 tris).
A normal entra na chave de deduplicação. A exportação usa normais de vértice nas
copas suavizadas e normais de face no restante. Não rodar `computeVertexNormals()`
no consumidor; usar as normais exportadas.

Para variar as instâncias sem gerar mesh nova: girar em Z (aleatório) e escalar entre
0,85 e 1,2. As cores já vêm com jitter por face e gradiente vertical (topo mais claro),
que é o que dá volume sem depender de luz.

## Regerar

Revisão atual, sem interferir no Blender aberto:

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python arvores/gerar_v2.py
python arvores/validar_v2.py
```

Isso atualiza `arvores_lib.json` e salva `arvores-v2.blend`. O gerador usa semente
CRC32 por espécie para manter a forma entre execuções. `validacao-v2.json` registra
o orçamento verificado. O mapa ainda utiliza o LOD leve global; seleção de detalhe
por distância continua sendo uma próxima etapa, não foi ativada nesta revisão.

Com o Blender aberto, rodar `blender_bridge.py` no Text Editor uma vez, e então:

```bash
python bl.py -f arvores.py && python bl.py -f render_fichas.py && python bl.py -f export_arvores.py
```

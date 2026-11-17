# Fluxo de ponta a ponta e cargas na torre (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `vitrine.py`, `test_vitrine.py` e na pasta `vitrine/`: **não toque neles.** Você cria `fluxo.py` e `test_fluxo.py` e mexe em `cargas.py`, `pacote.py` e nos testes deles. Em `sintese.py`, só se for indispensável; nesse caso, explique no relato.

## Problema

As peças existem, mas cada uma roda separada:
- gerador;
- torre (`torre.compor`, nova);
- avaliação;
- cargas;
- sondagem;
- pacote.

Ninguém rodou as seis em sequência. As cargas ainda só foram medidas com **um** pavimento, e o pacote tem o limite que você mesmo apontou.

## O que fazer

1. **`fluxo.py`:** `python fluxo.py <piloto> <pasta> [--terreo] [--sondagem arq] [--escopo ...]` roda, nesta ordem:
   1. gerador;
   2. `torre.compor`;
   3. `sintese.avaliar`;
   4. `cargas.estimar`;
   5. `pacote.montar`.

   Grava na pasta, com o `gravar` atômico:
   - `revisao-01.json` (o pavimento);
   - `revisao-02.json` (a torre);
   - a avaliação, as cargas e o pacote **da torre**, com o mesmo NN da torre.

   Sem relógio, e com os mesmos bytes em duas rodadas. Se uma etapa falhar, pare e diga qual; não grave arquivo pela metade.
2. **Cargas na torre:**
   - Rode no 22421 com e sem térreo, confira o acumulado do topo à base e escreva os números no relato.
   - O aviso "pilha de pavimentos ausente" some quando há mais de um pavimento.
   - O vão do elevador e do shaft **não leva g de laje**. Hoje o contorno inteiro leva, o que puxa o total para cima. Desconte só esse vão e mostre quanto mudou.
   - O térreo usa as sobrecargas de garagem e hall que já existem.
3. **Pacote, o limite que você apontou:** se a avaliação cita uma sondagem (`evidencias.sondagem`), o id e o sha dela têm que bater com a sondagem do pacote. Se não baterem, a avaliação fica `invalida`, com motivo.
4. **Não dependa dos números exatos da síntese no teste:** as regras do validador ainda vão mudar. Teste a forma e as ligações (ids, shas, estados), não o rótulo da síntese.

## Testes (só `assert`)

1. O `fluxo` do 22421, sem térreo e com térreo:
   - grava os arquivos esperados;
   - a torre é filha do pavimento;
   - as quatro peças do pacote ficam `valida`;
   - mesmos bytes em duas rodadas.
2. Cargas da torre:
   - o acumulado cresce até a base;
   - o total é a soma dos pavimentos;
   - o aviso de pilha ausente sumiu.
3. O desconto do vão: o g do pavimento cai exatamente `área do vão × g de laje` (até 0,01 kN), e o q não muda.
4. Uma avaliação que cita outra sondagem faz o pacote marcá-la `invalida`, com motivo.
5. Uma etapa que falha não deixa arquivo na pasta.
6. Continuam passando: `test_cargas` (6), `test_pacote` (6), `test_sintese` (13), `test_sondagem` (3), `test_projetista` (18), `test_gerador` (8), `test_editor` (10) e `test_torre` (7).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-PVF-FLUXO.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Terreno fluxo pronto"`.

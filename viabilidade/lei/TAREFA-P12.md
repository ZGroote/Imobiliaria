# Tarefa da Lei: o Plano Diretor foi alterado depois de 2016? (pergunta P12)

**Quem:** Lei.
**Onde escrever:** só `viabilidade/lei/ALTERACOES-P12.md` (e linhas novas em `BLOQUEIOS.md`, se houver bloqueio).
**Não fazer:**
- não commitar;
- não alterar `zonas.json`.

## Pergunta

O portal publica a Lei 18.053/2016 sem consolidação. Alguma lei posterior alterou os índices das zonas EIXO, Z1, Z2, Z3 ou Z4? Os índices são CA básico e máximo, TO, permeabilidade, recuos, lote mínimo e testada mínima, e os artigos são 11 a 30 e 150 a 154. Os decretos você já respondeu (`DECRETOS-P23.md`): eles não contam.

## Como

1. **Partir da ficha da lei** no portal oficial (o mesmo que você usou na P23: `cidadao.saocarlos.sp.gov.br/servicos/consultaleis/`). Veja se ela lista "alterada por" ou leis vinculadas.
2. **Busca no portal por leis** que citem "18.053" de 2017 até hoje. Para cada lei achada:
   - número e data;
   - ementa;
   - quais artigos da 18.053 ela muda;
   - se muda algum índice das 5 zonas (sim / não / não deu para ler);
   - link aberto;
   - trecho copiado.
3. **Comparar com `lei/zonas.json`.** Se alguma lei alterou um índice que está lá, diga qual campo, o valor antigo e o novo.

## Regras (iguais às da P23)

- Só fonte aberta.
- Sem forçar URL, sem adivinhar código e sem contornar bloqueio.
- Sem link aberto e trecho copiado, a resposta é "não deu para ler".

## Entrega

`lei/ALTERACOES-P12.md`, com a conclusão no topo. Depois: `maestri ask "Claude Code" "Lei tarefa P12 pronta"`.

# T26: os 118 recusados "sem frente" (só medir) (16/11)

Galho `viabilidade/sem-frente`, que sai do `duas-zonas` (PR #126). **Esta tarefa não muda código nem regra.** Só mede e classifica, para decidirmos o que dá para resolver.

No sorteio de 500 (semente 20261120), depois da T25, 118 lotes são recusados por falta de frente. Hoje a frente vem de duas fontes:
- as arestas do lote coladas ao asfalto do cadastro (até 6 m);
- a rua do OpenStreetMap (T21). Tem 5 classes de via e a via precisa estar ligada à rede, a no máximo 8 m do eixo e 20° de ângulo, sem encostar em outro lote.

## O que fazer

1. **Para cada um dos 118, diga por que não achou frente.** Use uma destas categorias e crie outra se precisar:
   - **lote de fundo ou interno:** não encosta em rua nenhuma, nem no mapa nem na foto, e a recusa é correta;
   - **rua existe na foto, mas falta no asfalto do cadastro e no OSM;**
   - **rua do OSM existe, mas uma regra da T21 barrou:** diga qual regra (classe, distância, ângulo, conexão ou encostar em outro lote) e por quanto (ex.: 9,4 m do eixo, 23°);
   - **condomínio ou via particular:** acesso por via interna;
   - **gleba ou área rural:** lote grande sem via urbana;
   - **geometria ruim do lote:** buraco, lasca ou deslocamento em relação à foto.
2. **Tabela de contagem** por categoria. Para a categoria "regra barrou", mostre a distribuição: quantos passariam com 10 m e quantos com 25°, só como medida.
3. **Conferência na imagem:** abra pelo menos 30 lotes no satélite ou no Anexo 02, cobrindo todas as categorias. Os casos óbvios do mesmo tipo podem ser conferidos por amostra. Monte uma folha de prints em `terreno/evidencias/t26/`, pequena, no estilo do `aceitos-40.png`.
4. **Proposta:** diga o que daria para resolver, quantos lotes cada proposta ganharia e qual risco cada uma traz de aceitar um lote sem frente de verdade. Diga também o que **não** se deve resolver, porque a recusa é correta.

Não mude `sugerir_zona.py`, `novo_lote.py`, `motor/`, `relatorio/` nem `lotes-piloto.json`. Script de medição, se precisar, vai para a pasta de rascunho, fora do repositório. Não commite. Relato em `terreno/RELATORIO-26.md`, curto e numerado, com a lista dos 118 e suas categorias no fim. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 26 pronta"`.

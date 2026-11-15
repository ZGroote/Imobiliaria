# Tarefa 7 do Auditor: as correções de 15/11 fecham os achados?

**Quem:** Auditor.
**Galho:** `viabilidade/lote-livre` (PR #124), no HEAD atual.
**Onde escrever:** só `viabilidade/auditoria/AUDITORIA-7.md`.
**Não fazer:**
- não commitar;
- não alterar código.

## Contexto

Antes do merge na main, o usuário pediu uma conferência independente do que foi corrigido depois da AUDITORIA-6b e da REVISAO-7. Leia:
- `auditoria/AUDITORIA-6b.md` e `revisao/REVISAO-7.md` (seção 4);
- `terreno/RELATORIO-12.md`, `terreno/RELATORIO-13.md`, `terreno/RELATORIO-14.md` e `motor/RELATORIO-21.md`.

## Perguntas (responda cada uma com evidência)

1. **AUDITORIA-6b, ressalva por anexo.** O ponto `-21.985132, -47.885094` agora sai com o alerta do Anexo 07 **e** a ressalva do 06? Rode `terreno/novo_lote.py --ponto` e mostre o `areas_especiais`.
2. **Leis posteriores aos mapas.** Todo lote traz o registro das Leis 19.166/2019 e 18.927/2018 com os links oficiais? Os links abrem a lei certa? Algum texto promete mais do que o código verifica (por exemplo, dizer que leu o Anexo 9-A)?
3. **Art. 80 (REVISAO-7, MÉDIA).** Os lotes `74451`, `77015`, `77022` e `77375` agora saem com opções de no máximo 9 m? O `80172` continua fora? Confira no texto do art. 80 da Lei 18.053/2016 se os 9 m são altura total e de onde se mede, e se o código segue isso.
4. **Frente pela borda da quadra (T12).** Escolha 3 lotes com `regra: borda_de_quadra` (por exemplo, o 92058) e diga, olhando o mapa ou a foto aérea pública, se a frente presumida é plausível. Algum caso aceita frente que claramente não dá para rua?
5. **Alertas no estudo (T21).** Num estudo real, cada opção tem exatamente um alerta agrupado de área não verificada e um alerta próprio por área encontrada sem altura? Algum alerta sumiu sem ser substituído?

## Regras de evidência

- Todo achado vem com o comando rodado, a saída copiada, ou o link e o trecho da lei.
- Achado sem evidência não vale.
- Acesso a dado público: só o que a fonte oferece abertamente. Nada de forçar parâmetro de URL, burlar bloqueio ou contornar login.
- Rode os estudos numa pasta temporária fora do repositório.

## Entrega

`AUDITORIA-7.md`:
- veredito no topo (pode juntar na main ou não, do ponto de vista dos achados);
- uma seção por pergunta;
- achados classificados por gravidade (ALTA, MÉDIA, BAIXA).

Depois: `maestri ask "Claude Code" "Auditor tarefa 7 pronta"`.

## Parte 2 (perguntas 1, 2 e 3), no HEAD `18be7045` ou mais novo

Depois da parte 1, mudou o posicionamento dos anexos: a T17 (`terreno/RELATORIO-16.md` e `RELATORIO-17.md`) trocou os 5 vértices via SAD69 pela afim direta de 21 cruzamentos, porque o ajuste antigo errava 40–100 m. A T18 (`RELATORIO-18.md`) reconferiu os pilotos. Por isso:
- na pergunta 3, o **74451 agora deve sair FORA da subárea** de 9 m (era falso positivo do erro de posição); 77015, 77022 e 77375 dentro, 80172 fora. Confira isso no `anexo06.jpg` com o posicionamento novo;
- na pergunta 1, rode no HEAD novo;
- acrescente uma pergunta 6: pegue 2 cruzamentos de rua com nome fora de `terreno/dados/zonas-controles.json` e diga a distância, no Anexo 02, entre o pixel que a afim dá e o centro do cruzamento no mapa.

Complete o `AUDITORIA-7.md` (veredito no topo valendo para as 6 perguntas). Depois: `maestri ask "Claude Code" "Auditor tarefa 7 pronta"`.

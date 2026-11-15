# Tarefa 6 do Auditor: a leitura automática do mapa está certa?

**Quem:** Auditor.
**Onde escrever:** só `viabilidade/auditoria/AUDITORIA-6.md`.
**Não fazer:**
- não commitar;
- não alterar código.

## Contexto

Lote novo ganha zona e áreas especiais lidas por cor nos anexos do Plano Diretor de São Carlos (Lei 18.053/2016). Leia nesta ordem:
- `terreno/sugerir_zona.py`, `terreno/ZONA-AUTO.md`, `terreno/RELATORIO-5.md`;
- `terreno/areas_especiais.py`, `terreno/RELATORIO-6.md`;
- `terreno/novo_lote.py`, `terreno/RELATORIO-7.md` (seleção do lote por coordenada).

Os PDFs oficiais estão em https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ (Anexo 02 Zoneamento, 05, 06 e 07). Os recortes locais estão em `terreno/dados/zonas-mapas/`.

## Perguntas (responda cada uma com evidência)

1. **Legenda → zona.**
   - A tabela de cores do código corresponde à legenda do Anexo 02? Confira zona por zona, com a cor medida na legenda do PDF ou do recorte.
   - Alguma zona tem cor parecida com outra (distância RGB pequena) a ponto de poder ser confundida?
2. **Regras de recusa.**
   - Os limites "divisa < 10 m", "Eixo ≤ 60 m" e "RGB ≤ 18" fazem sentido diante do erro de georreferenciamento de 3,53 m e da resolução do mapa?
   - Ache um caso concreto em que a regra deixaria passar uma zona errada, ou diga por que não acha.
3. **Eixo Estruturante.**
   - O tratamento do art. 11 (testada para a via, não a cor) está certo?
   - Há eixo que a lista do código não cobre? Compare com o texto do art. 11 no portal de leis.
4. **Áreas especiais.**
   - AIA (Anexo 05), AEI/AEIS (Anexo 06) e cones do aeroporto (Anexo 07): a interpretação de cada cor e traço está certa?
   - "Não verificada" e "possível incidência" estão sendo usados onde devem?
   - Algum tipo de área especial dos anexos ficou de fora?
5. **Seleção por coordenada.** Ponto na divisa entre dois lotes, ponto num lote com buraco (pátio interno) e ponto num condomínio grande: o que acontece? Rode e mostre.

## Regras de evidência

- Todo achado vem com o comando rodado, a saída copiada, ou o link e o trecho do PDF.
- Achado sem evidência não vale.
- Fonte bloqueada: registre em `viabilidade/BLOQUEIOS.md` e siga.
- Acesso a dado público: só o que a fonte oferece abertamente. Nada de forçar parâmetro de URL, burlar bloqueio ou contornar login.

## Entrega

`AUDITORIA-6.md`:
- veredito no topo;
- uma seção por pergunta;
- achados classificados por gravidade (ALTA, MÉDIA, BAIXA).

Depois: `maestri ask "Claude Code" "Auditor tarefa 6 pronta"`.

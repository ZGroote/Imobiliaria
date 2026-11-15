# Conferência: frente Lei × leitura independente

Feita em 14/11/2026. "Lei disse" = `viabilidade/lei/zonas.json` e `lei/FONTES.md`. "Eu li" = `leitura-independente.md` (texto do portal oficial, com as leis alteradoras aplicadas à mão). PD = Plano Diretor (Lei 18.053/2016); COE = Código de Obras (Lei 19.950/2020).

**Resumo: nenhum número da frente Lei está errado.** Os 3 conflitos que eu achei na lei (Z5A/Z5B, Z6B, Z6E) ela também achou, e marcou `conferido: false`. Sobrou 1 diferença de tradução entre `zonas.json` e o motor (recuo do 1º pavimento) e 4 detalhes que faltam.

## Tabela

| Zona | Parâmetro | Lei disse | Eu li | Bate? | Fonte |
|---|---|---|---|---|---|
| Eixo | CA básico | 2,0 | 2,0 | sim | PD art. 13, IV; art. 152, I, a |
| Eixo | CA máximo | 4,0 | 4,0 | sim | PD art. 13, V; art. 152, I, b |
| Eixo | CA unifamiliar | 1,4 | 1,4 | sim | PD art. 13, III |
| Eixo | Taxa de ocupação | 70% | 70% | sim | PD art. 13, I; art. 150, I |
| Eixo | Permeabilidade | 15% | 15% | sim | PD art. 13, II; art. 153, I |
| Eixo | Térreo comercial de prédio misto | não computável | não computável | sim | PD art. 11, p. ú.; COE art. 52 |
| Z1 | CA básico | 2,0 | 2,0 | sim | PD art. 17, IV |
| Z1 | CA máximo | 3,0, só com ≥ 50% multifamiliar | 3,0, só com ≥ 50% multifamiliar | sim | PD art. 17, V e p. ú.; art. 152, II, b |
| Z1 | Taxa de ocupação | 70% | 70% | sim | PD art. 17, I; art. 150, II |
| Z1 | Permeabilidade | 15% | 15% | sim | PD art. 17, II; art. 153, II |
| Z2 | CA básico | 2,0 | 2,0 | sim | PD art. 21, IV |
| Z2 | CA máximo | 3,5 | 3,5 | sim | PD art. 21, V; art. 152, III, b |
| Z2 | Taxa de ocupação | 70% | 70% | sim | PD art. 21, I; art. 150, III |
| Z2 | Permeabilidade | 15% | 15% | sim | PD art. 21, II; art. 153, III |
| Z5A, Z5B | CA | 1,0 (1,4 HIS) | 1,0 (1,4 HIS) | sim | PD arts. 36/38 (quadro); art. 152, VI–VII |
| Z5A, Z5B | Taxa de ocupação | 50% (lote > 300 m²) | quadro: 70% → 50% conforme o lote; art. 150: 50% | sim para lote > 300 m² | PD arts. 36/38; art. 150, VI–VII |
| Z5A, Z5B | Permeabilidade | 30% (lote > 300 m²), conflito anotado | quadro: 15% → 30% conforme o lote; art. 153: 20% | sim (mesmo conflito, mesma escolha possível) | PD arts. 36/38; art. 153, VI–VII |
| Z5A, Z5B | Cobertura vegetal | 10%, conflito anotado | quadro: 10% (gleba 20%); art. 154: 20% | sim (mesmo conflito) | PD arts. 36/38; art. 154, II–III |
| Z6B | CA | 1,0; 2,0 em arterial tipo 1 | 1,0; 2,0 em arterial tipo 1 | sim | PD art. 45, IV; art. 152, IX |
| Z6B | Taxa de ocupação | 50% | 50% | sim | PD art. 45, I; art. 150, IX |
| Z6B | Permeabilidade | 40%, conflito anotado | art. 45: 40%; art. 153: 30% | sim (mesmo conflito) | PD art. 45, II; art. 153, IX |
| Z6B | Cobertura vegetal | 20% | 20% | sim | PD art. 45, III; art. 154, V |
| Z6E | CA | `null` (lei não define) | lei não define | sim | PD art. 42A (Lei 18.927/2018) |
| Z6E | Taxa de ocupação | 70% | 70% | sim | PD art. 42A, I |
| Z6E | Permeabilidade | 25% | 25% | sim | PD art. 42A, II |
| Z6E | Cobertura vegetal | 15% | 15% | sim | PD art. 42A, III |
| todas | Altura máxima | `null` (sem limite por zona) | sem limite por zona | sim | PD: nenhum artigo de zona traz altura |
| todas | Altura em área especial | 9 m (gabarito histórico); tabela do Observatório | 9 m; mesma tabela de 7 linhas, cota 850 m | sim | PD arts. 80 e 82 |
| todas | Recuo frontal | `null` (vale o loteamento) | lei municipal não fixa; vale o loteamento | sim | COE art. 74 |
| todas | Lateral/fundos com janela, térreo e 1º pavimento | 1,50 m; no campo: `ate_pavimento: 1` | 1,50 m no térreo **e** no 1º pavimento | **número sim, campo não** (item 1 abaixo) | COE art. 67, I (Lei 20.072/2021) |
| todas | Lateral/fundos com janela, acima | h/8, mín. 2,00 m (h = até o teto do pavimento) | igual | sim | COE art. 67, II e § 2º |
| todas | Parede cega | encosta até 12 m; 2,00 m acima | encosta até 12 m; 2,00 m fixo acima | sim | COE art. 70 |
| todas | Fundos = lateral | sim | sim ("divisa" inclui os fundos) | sim | COE art. 3º, XXV; art. 67 |
| todas | Varanda | 1,50 m no 1º pav.; h/8 (mín. 2,00) acima | igual | sim | COE art. 68 (Lei 24.031/2026) |
| todas | Entre blocos / unidades | 2,00 m | 2,00 m paralelas; 0,75 m perpendiculares | sim | COE art. 69 |
| todas | Escalonar | permitido | permitido | sim | COE art. 71 |
| todas | Não computável | lista do art. 51 (I a VIII, menos VII), beiral, térreo misto no Eixo, fachada ativa | mesma lista, mais o inciso VII ("locais sem ocupação humana a definir pelo Executivo") | sim (item 3 abaixo) | COE arts. 3º IX/XV, 51, 52; PD arts. 11 e 141 IV |
| todas | Garagem na taxa de ocupação | não conta | não conta | sim | COE art. 51, caput; art. 3º, XXIII |
| todas | Varanda | computável (leitura deles) | computável (mesma leitura) | sim | COE art. 3º, IX; art. 51 |
| todas | Vagas mínimas (multifamiliar vertical) | nenhuma; PNE 2% (mín. 1); bicicleta 1/20 | igual | sim | COE art. 100, Tabela 1 |
| todas | Tamanho da vaga | 2,40 × 5,00 m; manobra 90° 5,00 m | 2,4 × 5; manobra 46°–90° 5,00 m | sim | COE Tabela 2 |
| Eixo, Z1, Z2 | Outorga onerosa | 5% do valor de mercado da área acima do CAB | igual | sim | PD art. 176; art. 177, § 1º |

## O que não bate ou falta

1. **Recuo de 1,50 m no 1º pavimento: o campo diz uma coisa e o motor lê outra.** A lei (COE art. 67, I, com a redação da Lei 20.072/2021) dá 1,50 m "no térreo e no primeiro pavimento". O texto da frente Lei diz isso certo. Mas o campo é `"ate_pavimento": 1`, e o motor (`motor/motor.py`, `recuo_divisa`) conta "1 = térreo". Resultado: o motor dá 1,50 m só no térreo e põe 2,00 m no pavimento logo acima.
   **Qual está certa:** a lei, 1,50 m nos dois. Na numeração do motor o campo deveria ser `ate_pavimento: 2`. O erro é a favor da segurança: perde 0,50 m de cada lado num pavimento só, nunca deixa caber o que não cabe. Correção: Lei ou Motor, não esta pasta.
2. **Zonas 5A e 5B: o número da permeabilidade e da cobertura vegetal depende de qual artigo vale.** O quadro dos arts. 36/38 (que copia a Lei 13.944/2006) dá CP 30% e CCV 10% para lote > 300 m²; os arts. 153 e 154 dão CP 20% e CCV 20%. A frente Lei usou o quadro. Pela regra comum de que a norma especial (quadro da zona) vale sobre a geral, o quadro venceria; mas os arts. 153/154 vêm depois e são específicos de cada zona também. **Precisa de profissional** (ou consulta à Prefeitura). Para não errar, usar o mais restritivo de cada um: CP 30% e CCV 20%. Hoje o `zonas.json` usa CCV 10%, que é o menos restritivo.
3. **Zona 6B, permeabilidade 40% × 30%.** Mesma situação: art. 45 (da zona) diz 40%, art. 153 diz 30%. A frente Lei usou 40%, o mais restritivo. **Precisa de profissional** para o número final; 40% é a escolha segura.
4. **Zona 6E, CA.** Nenhuma lei dá. As duas leituras concordam: `null`. O nome no art. 42A é o mesmo da Z6A ("Maior Densidade", CA 1,4 / 2,0), mas isso é palpite. **Precisa de profissional** ou consulta à Prefeitura.
5. Faltas pequenas (não mudam número do motor hoje):
   - **Z6B (e Z6A):** os arts. 150, 152, 153 e 154 dizem que os índices valem "nos parcelamentos do solo para fins urbanos"; "antes dos parcelamentos (...) não se aplica". A observação da Z6A cita isso; a da Z6B não.
   - **Não computável, art. 51, VII:** "locais sem ocupação humana a serem definidos pelo Poder Executivo Municipal" não está na lista. Depende de decreto; não muda conta hoje.
   - **Faixas não edificáveis** (COE arts. 72, 72-A e 73, Lei 22.285/2024): rodovia 15 m da faixa de domínio (21 m onde o Anexo 8 prevê marginal), ferrovia pela Lei 6.766, linha de transmissão a ≤ 35 m do eixo pela concessionária. O FONTES cita a lei, mas os números não estão em nenhum arquivo. São restrição do lote (`areas_especiais`), não da zona.
   - **Varanda no térreo:** a redação nova do art. 68 começa no "primeiro pavimento"; o térreo ficou sem regra própria de varanda. Nenhuma das duas leituras resolve. Na dúvida, usar a do art. 67 (1,50 m).

## Limites desta conferência

- Li o texto do portal, que não é consolidado e "não substitui o publicado no Diário Oficial". As alterações foram aplicadas à mão. Não confrontei com o Diário Oficial.
- Não li: Lei 13.944/2006 (APREM, Z5), decretos do Plano Diretor (links quebrados no portal), Anexo 8 (quais vias são arterial tipo 1).
- O `README.md` (v3) já resumia os recuos da frente Lei antes da minha leitura. Conferi cada ponto de novo no texto da lei, mas os recuos não foram lidos 100% às cegas.

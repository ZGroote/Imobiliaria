# Ajustes 2 (central, 14/11)

1. **Aviso enganoso.** A faixa amarela diz "Zona marcada como conferida no arquivo", mas no exemplo a zona do TERRENO foi escolhida pra teste. Contrato v4 (README): use `lote.zona_origem` e `lote.zona_conferida` pra dizer se o terreno está mesmo nessa zona, separado de `zona.conferido` (números da lei). Ex.: "Números da Z2 conferidos na lei · Zona do terreno escolhida pra teste, não conferida". Se os campos faltarem, trate como não conferida.
2. **Parede cega** (item 5 do AJUSTES.md, ficou de fora): `volumes[].parede_cega`, `caixa_maxima.parede_cega_ate_m`, `caixa_maxima.projecao_parede_cega_utm`. Mostre a faixa e marque os volumes que encostam na divisa.
3. **Regra nova no README:** fonte bloqueada vai pro `viabilidade/BLOQUEIOS.md` (endereço, tipo de bloqueio, o que ficou pendente, encaminhamento).

Teste de novo, renove as capturas e mande o relatório curto com `maestri ask "Claude Code"`.

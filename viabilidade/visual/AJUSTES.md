# Ajustes pedidos pela central (14/11)

1. A faixa fixa "estudo preliminar" cobre os botões "Vista inicial / Vista de cima" e a lista de alertas no desktop (ver `evidencias/desktop-B.png`). Deixe espaço embaixo da página ou tire a faixa de cima do conteúdo.
2. Na comparação lado a lado, "Informe o preço" quebra em duas linhas e fica cortado. Use texto menor ou "—" com dica.
3. O Motor entregou o v0.3.0 com zona REAL (SC-Z2) em `viabilidade/motor/exemplos/estudo-exemplo.json` (já commitado). Novidades do contrato (README v3):
   - `caixa_maxima.degraus` (a caixa escalona com a altura) e `caixa_maxima.recuo_frontal_m`;
   - `volumes[].recuo_lateral_m` e `recuo_fundos_m`.
   Desenhe os degraus da caixa e mostre os recuos usados em cada opção. Mostre também os alertas novos (recuo frontal vem de premissa, não da lei).
4. Rode o teste de novo com o exemplo novo e atualize as capturas em `evidencias/`.

Relatório curto no fim com `maestri ask "Claude Code"`.

## Acréscimo (depois do commit 0f506a7 do Motor)

5. Parede cega: `volumes[].parede_cega = true` quando o volume encosta na divisa; `caixa_maxima.parede_cega_ate_m` e `caixa_maxima.projecao_parede_cega_utm`. Mostre a faixa da parede cega (até 12 m) e marque os volumes que encostam na divisa. O exemplo foi regenerado.

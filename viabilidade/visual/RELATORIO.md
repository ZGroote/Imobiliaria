# Ajustes 2 da frente Visual — contrato v4

- Aviso separa números da lei (`zona.conferido` + fontes) do vínculo entre terreno e zona (`lote.zona_origem`/`zona_conferida`).
- Origem de teste, campos ausentes, identificadores vazios ou divergentes nunca aparecem como vínculo confirmado.
- Faixa de parede cega desenhada em azul tracejado, de zero até a altura e projeção informadas pelo Motor.
- Volumes `parede_cega: true` ficam azuis, com identificação no painel e nos recuos; ausente não é inventado.
- Exemplo atual não marca volumes cegos: teste sintético identificado verifica a cor e a marcação sem alterar o Motor.
- `index.html`, `README.md`, `testar.cjs` e `evidencias/` atualizados; 18 capturas renovadas e resultado em `teste-browser.json`.
- Chrome headless PASS: dez combinações de conferência, faixa/volumes cegos, compatibilidade e 19 entradas inválidas; zero erros de console e sem overflow em cinco larguras.
- Capturas desktop/celular conferidas: avisos distintos, faixa tracejada visível, volume marcado e aviso preliminar sem sobreposição.
- Nenhuma fonte bloqueada nesta frente; não foi necessário acrescentar registro em `viabilidade/BLOQUEIOS.md`.
- Somente `viabilidade/visual/` alterada; sem commit nem publicação. Integração pela central.
- Limites: sem aparelho físico, validação legal ou relevo; 3D depende de CDN/WebGL.

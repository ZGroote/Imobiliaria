# Entrega da frente Visual

- `index.html`: página única com Three.js 0.186.1 por CDN, arquivo por caminho, seleção ou arrastar e soltar.
- Usa `../motor/exemplos/estudo-exemplo.json` por padrão; o provisório foi removido.
- Lote, caixa máxima, volumes A–D, subsolos, troca de opção e comparação com mesma escala inicial.
- Contrato v2: unidades, área privativa, vagas e VGV destacados; sem preço, “Informe o preço”.
- Demais métricas, alertas, fontes, incertezas e premissas identificadas como padrão.
- SIRGAS 2000 / UTM 23S recebido do Motor, centralizado antes dos buffers 3D. Não usa fx/fy.
- `README.md`: como abrir e testar; `testar.cjs`: teste com Chrome headless já instalado.
- `evidencias/`: 14 capturas e `teste-browser.json` com resultado do teste.
- Chrome: desktop 1440 px, celular 390 px e verificação de largura em 320/768/1024 px; sem overflow horizontal.
- Passaram A–D, comparação, caminho, exemplo padrão, upload, arrastar, VGV com/sem preço e sete entradas inválidas preservando o estudo anterior; zero erros de console.
- Conferência das capturas: quatro volumes distintos, caixa em linha, subsolos lilás, métricas legíveis e comparação empilhada no celular.
- Revisão de dados: 34 verificações passaram; fontes inválidas e métricas impossíveis rejeitadas; ausente/null não vira zero.
- Somente `viabilidade/visual/` alterada. Sem commit e sem publicação; integração pela central.
- Limites: terreno plano, 3D dependente de CDN/WebGL, exemplo com zona fictícia; sem validação legal ou de relevo.
- Dúvidas de contrato: nenhuma; campos v2 ausentes em arquivos antigos aparecem como não informados.

# Visual do estudo de viabilidade

Na raiz do repositório:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8765/viabilidade/visual/`.
O exemplo padrão é `../motor/exemplos/estudo-exemplo.json`, produzido pelo Motor.
Ele usa lote real, mas zona fictícia: não é uma conclusão de viabilidade legal.

Para outro estudo, use `?estudo=caminho/estudo.json` (relativo à página),
o botão **Abrir estudo.json** ou arraste o arquivo para a página.
Arquivos locais selecionados são lidos no navegador, sem envio para servidor.
A biblioteca Three.js 0.186.1 e OrbitControls vêm da CDN jsDelivr; o 3D precisa
de acesso à CDN e WebGL. Sem o 3D, as métricas continuam disponíveis.

## O que aparece

- Lote, contorno da caixa máxima e volumes das opções A–D do exemplo.
- Garagem/subsolo com outra cor e lote transparente quando há subsolo.
- Troca de opção e comparação lado a lado; no celular, comparação vertical.
- Vista inicial e vista de cima por botões acessíveis pelo teclado.
- Unidades, área privativa, vagas e VGV em destaque. Sem preço informado,
  aparece **Informe o preço**; o preço deve entrar no estudo pelo Motor.
- Demais métricas v2, alertas, fontes, incertezas e premissas identificadas
  como **padrão**, conforme o arquivo. Ausente ou `null` não vira zero.
- Aviso fixo de estudo preliminar.

O Visual exibe os cálculos recebidos; não calcula preço, VGV, legislação ou
áreas faltantes. Coordenadas devem chegar em SIRGAS 2000 / UTM 23S
(EPSG:31983), já convertidas pelo produtor. Não lê `fx`/`fy` do GeoJSON.
O centro do lote é subtraído antes dos buffers 3D para preservar a precisão.

## Teste

Com o servidor ativo, execute:

```powershell
node viabilidade/visual/testar.cjs
```

O teste usa Chrome headless e o Playwright já instalado no runtime Codex
desta máquina; os caminhos estão explícitos no script. Gera capturas e
`evidencias/teste-browser.json` dentro desta pasta.

## Limites

Maquete volumétrica em terreno plano, sem modelagem do relevo, projeto de
arquitetura ou validação legal. A vista inicial usa escala comum entre as
opções; câmeras podem ser giradas separadamente. Arquivos de até 10 MB,
12 opções e 200 volumes por opção. Não verifica interseções de polígonos.
Sem commit ou publicação: a integração fica com a central.

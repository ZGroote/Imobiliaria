# Inspeção de privacidade das pastas liberadas no portão 1E

**Data:** 15/11/2026. **Quem:** central (Claude Code). **Base:** `main` em 186a0fd8.

**Por quê.** O usuário liberou duas pastas na trava de dados privados da `main` (PR #121):
- `viabilidade/terreno/dados/`
- `viabilidade/visual/evidencias/`

A revisão pediu inspeção efetiva. Classificar uma pasta não prova que os arquivos dela são seguros.

## Como foi feito

1. **Lista.** `git ls-files` nas duas pastas, filtrado pelas mesmas extensões de imagem da trava: 89 arquivos.
2. **Metadados.** Pillow leu `info` e EXIF de cada arquivo.
   - Nenhum arquivo tem câmera, GPS, autor ou programa.
   - Só o `.tif` tem metadado: georreferência e a atribuição "produced using Copernicus WorldDEM".
3. **Olhar.** As 89 imagens foram vistas em 5 folhas de miniaturas.
   - Uma captura (`desktop-piloto-SC-completo-22421.png`) foi lida em tamanho real.
4. **Fonte das capturas.** A tela desenha a partir do `index.html`, dos 7 pilotos e do exemplo. Nesses arquivos e nos 8 relatórios, procurei:
   - nomes de clientes e incorporadoras dos outros projetos;
   - e-mail, CPF, telefone, WhatsApp;
   - caminho da pasta do usuário no Windows.

   **Nada foi achado.** A única ocorrência de "cliente" é a frase "não vieram do cliente", das premissas.

## Resultado

**Seguro para exposição pública.** Nenhum arquivo traz dado de cliente, de pessoa ou da máquina. O conteúdo é de três tipos:
- recortes dos anexos públicos do Plano Diretor de São Carlos (Lei 18.053/2016);
- relevo Copernicus (licença aberta, com atribuição);
- capturas da tela com estudos de lotes do cadastro público e fontes legais oficiais.

**Limite desta inspeção.**
- Vale para o conteúdo listado abaixo, conferido pelo sha256.
- Imagem nova nessas pastas passa pela trava sem nova inspeção. Quem acrescentar imagem tem que repetir este passo.
- Algumas capturas são de versões antigas do motor, por exemplo a 0.7.1. São evidência histórica, não o estado atual.

| Arquivo | O que é | sha256 (16) |
| --- | --- | --- |
| `viabilidade/terreno/dados/copernicus-glo30-sao-carlos.tif` | relevo Copernicus GLO-30 (metadado: atribuição Copernicus) | `1d4e386afa3ef377` |
| `viabilidade/terreno/dados/eixo-anexo02.jpg` | recorte de anexo do Plano Diretor | `5dffb1988a315187` |
| `viabilidade/terreno/dados/eixo-anexo05.jpg` | recorte de anexo do Plano Diretor | `ba53b4502083998e` |
| `viabilidade/terreno/dados/eixo-anexo06.jpg` | recorte de anexo do Plano Diretor | `f8c487444c3a86ce` |
| `viabilidade/terreno/dados/eixo-anexo07.jpg` | recorte de anexo do Plano Diretor | `992a4bd75afb32d3` |
| `viabilidade/terreno/dados/eixo-testada.jpg` | desenho gerado (polígonos de lote) | `2d367a166ba600ed` |
| `viabilidade/terreno/dados/eixo-trecho-art11.jpg` | recorte de anexo do Plano Diretor | `0213b21847958df4` |
| `viabilidade/terreno/dados/z2-anexo02.jpg` | recorte de anexo do Plano Diretor | `77be227801e9c6d7` |
| `viabilidade/terreno/dados/z2-anexo05.jpg` | recorte de anexo do Plano Diretor | `a31aa35fbd10ae07` |
| `viabilidade/terreno/dados/z2-anexo06.jpg` | recorte de anexo do Plano Diretor | `ad3474cd1f2993a7` |
| `viabilidade/terreno/dados/z2-anexo07.jpg` | recorte de anexo do Plano Diretor | `4589ed7faf2a271b` |
| `viabilidade/terreno/dados/z2-componentes.png` | desenho gerado (polígonos de lote) | `0119f0fd87dd3866` |
| `viabilidade/terreno/dados/zonas-mapas/22421-divisa-sem-marca.jpg` | recorte de anexo do Plano Diretor | `edb5f91735785af9` |
| `viabilidade/terreno/dados/zonas-mapas/22421-divisa.jpg` | recorte de anexo do Plano Diretor | `5fa0156843bcb15b` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22421-anexo02.jpg` | recorte de anexo do Plano Diretor | `52c53f38fb1639e3` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22421-anexo05.jpg` | recorte de anexo do Plano Diretor | `2de78d3b7dfda01e` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22421-anexo06.jpg` | recorte de anexo do Plano Diretor | `6b5710630e18e290` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22421-anexo07.jpg` | recorte de anexo do Plano Diretor | `e133d9ebba49e096` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22426-anexo02.jpg` | recorte de anexo do Plano Diretor | `f1a7be2625f321e5` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22426-anexo05.jpg` | recorte de anexo do Plano Diretor | `60bd4228847b5203` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22426-anexo06.jpg` | recorte de anexo do Plano Diretor | `80924670aca95fe2` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-22426-anexo07.jpg` | recorte de anexo do Plano Diretor | `6a4a4741ace29397` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-25297-anexo02.jpg` | recorte de anexo do Plano Diretor | `52991a8c2d06da17` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-25297-anexo05.jpg` | recorte de anexo do Plano Diretor | `8921197bb1db2590` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-25297-anexo06.jpg` | recorte de anexo do Plano Diretor | `2755687ba767ee2c` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-25297-anexo07.jpg` | recorte de anexo do Plano Diretor | `54f51629bc129c5a` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-30516-anexo02.jpg` | recorte de anexo do Plano Diretor | `e6a1eb80520d48fa` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-30516-anexo05.jpg` | recorte de anexo do Plano Diretor | `74431e5cca59a906` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-30516-anexo06.jpg` | recorte de anexo do Plano Diretor | `1be8d867fff6c083` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-30516-anexo07.jpg` | recorte de anexo do Plano Diretor | `679efca13445b116` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-37607-anexo02.jpg` | recorte de anexo do Plano Diretor | `50ed2e8f15259732` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-37607-anexo05.jpg` | recorte de anexo do Plano Diretor | `545f851b2b1544eb` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-37607-anexo06.jpg` | recorte de anexo do Plano Diretor | `08a79a5b52995eb8` |
| `viabilidade/terreno/dados/zonas-mapas/SC-completo-37607-anexo07.jpg` | recorte de anexo do Plano Diretor | `fa67a0facaf02fee` |
| `viabilidade/terreno/dados/zonas-mapas/anexo02-geral.jpg` | anexo do Plano Diretor (página/legenda) | `4a5ef4246029c3c4` |
| `viabilidade/terreno/dados/zonas-mapas/anexo02-localizados.jpg` | anexo do Plano Diretor (página/legenda) | `23e13564247a17f0` |
| `viabilidade/terreno/dados/zonas-mapas/anexo05-geral.jpg` | anexo do Plano Diretor (página/legenda) | `dd4122213e04dd68` |
| `viabilidade/terreno/dados/zonas-mapas/anexo05-localizados.jpg` | anexo do Plano Diretor (página/legenda) | `293f8a0305374796` |
| `viabilidade/terreno/dados/zonas-mapas/anexo06-geral.jpg` | anexo do Plano Diretor (página/legenda) | `23c20d1157356545` |
| `viabilidade/terreno/dados/zonas-mapas/anexo06-localizados.jpg` | anexo do Plano Diretor (página/legenda) | `ae6735c973258f6f` |
| `viabilidade/terreno/dados/zonas-mapas/anexo07-geral.jpg` | anexo do Plano Diretor (página/legenda) | `2696da5980a79ce8` |
| `viabilidade/terreno/dados/zonas-mapas/anexo07-localizados.jpg` | anexo do Plano Diretor (página/legenda) | `2e1ca13e2551b633` |
| `viabilidade/terreno/dados/zonas-mapas/controle02.jpg` | recorte de anexo do Plano Diretor | `ba3b07e5d2d89f26` |
| `viabilidade/terreno/dados/zonas-mapas/controle05-31.jpg` | recorte de anexo do Plano Diretor | `ba359a76d796e29a` |
| `viabilidade/terreno/dados/zonas-mapas/controle05-54.jpg` | recorte de anexo do Plano Diretor | `19fdb715aeeef5dc` |
| `viabilidade/terreno/dados/zonas-mapas/controle05.jpg` | recorte de anexo do Plano Diretor | `f3b7b322ee555e4c` |
| `viabilidade/terreno/dados/zonas-mapas/controle06-31.jpg` | recorte de anexo do Plano Diretor | `263e37f2a35c112b` |
| `viabilidade/terreno/dados/zonas-mapas/controle06-54.jpg` | recorte de anexo do Plano Diretor | `0cdaf2a4df6ca962` |
| `viabilidade/terreno/dados/zonas-mapas/controle06.jpg` | recorte de anexo do Plano Diretor | `f36a21cf31265e89` |
| `viabilidade/terreno/dados/zonas-mapas/controle07-31.jpg` | recorte de anexo do Plano Diretor | `63011c99ef3d43ec` |
| `viabilidade/terreno/dados/zonas-mapas/controle07-54.jpg` | recorte de anexo do Plano Diretor | `efa1b5875483a697` |
| `viabilidade/terreno/dados/zonas-mapas/controle07.jpg` | recorte de anexo do Plano Diretor | `f4d76508d2b64089` |
| `viabilidade/terreno/dados/zonas-mapas/controle31.jpg` | recorte de anexo do Plano Diretor | `6380433632a12e35` |
| `viabilidade/terreno/dados/zonas-mapas/left.jpg` | faixa de borda de anexo (quase branca) | `11f65c68ee3d3f9a` |
| `viabilidade/terreno/dados/zonas-mapas/legend.jpg` | anexo do Plano Diretor (página/legenda) | `ceefa3be2ae93fad` |
| `viabilidade/terreno/dados/zonas-mapas/sul.jpg` | recorte de anexo do Plano Diretor | `2ac14c40e2b43e62` |
| `viabilidade/terreno/dados/zonas-mapas/top.jpg` | faixa de borda de anexo (quase branca) | `47ffbe3e8f333a7d` |
| `viabilidade/visual/evidencias/celular-A.png` | captura da tela (estudo de dado público) | `134314415d43f129` |
| `viabilidade/visual/evidencias/celular-B.png` | captura da tela (estudo de dado público) | `905c505538542462` |
| `viabilidade/visual/evidencias/celular-C.png` | captura da tela (estudo de dado público) | `f3a6b4c63b9b99a9` |
| `viabilidade/visual/evidencias/celular-D.png` | captura da tela (estudo de dado público) | `b3a7b6ece25ae92b` |
| `viabilidade/visual/evidencias/celular-comparacao.png` | captura da tela (estudo de dado público) | `d3bf10e7070861da` |
| `viabilidade/visual/evidencias/celular-erro.png` | captura da tela (estudo de dado público) | `d66139b7afebd24f` |
| `viabilidade/visual/evidencias/celular-parede-cega.png` | captura da tela (estudo de dado público) | `274a7346ab14b5c6` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-22421.png` | captura da tela (estudo de dado público) | `fea157638b1ec3d8` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-22426.png` | captura da tela (estudo de dado público) | `727d30da801983a2` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-25297.png` | captura da tela (estudo de dado público) | `e46d8c767c88e426` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-30516.png` | captura da tela (estudo de dado público) | `10314e0c6fa2cd21` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-37607.png` | captura da tela (estudo de dado público) | `0db7a95c960b3c40` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-q1382-11984-11988.png` | captura da tela (estudo de dado público) | `9b6f68c44b352242` |
| `viabilidade/visual/evidencias/celular-piloto-SC-completo-remembramento-75352-75354.png` | captura da tela (estudo de dado público) | `67fe9f19b72fec8e` |
| `viabilidade/visual/evidencias/celular-v2.png` | captura da tela (estudo de dado público) | `93800b0259b8204e` |
| `viabilidade/visual/evidencias/degraus-explicitos.png` | captura da tela (estudo de dado público) | `8d17c816d318c45e` |
| `viabilidade/visual/evidencias/degraus-inferidos.png` | captura da tela (estudo de dado público) | `9f679f3664c27ea1` |
| `viabilidade/visual/evidencias/desktop-A.png` | captura da tela (estudo de dado público) | `70504281ebbd9b67` |
| `viabilidade/visual/evidencias/desktop-B.png` | captura da tela (estudo de dado público) | `a4205004ec1c8131` |
| `viabilidade/visual/evidencias/desktop-C.png` | captura da tela (estudo de dado público) | `ea2114bbdd210b70` |
| `viabilidade/visual/evidencias/desktop-D.png` | captura da tela (estudo de dado público) | `5ed03c5a584a7696` |
| `viabilidade/visual/evidencias/desktop-comparacao.png` | captura da tela (estudo de dado público) | `8d7dc905c3f4aac2` |
| `viabilidade/visual/evidencias/desktop-erro.png` | captura da tela (estudo de dado público) | `797c02f6b6ecbbc0` |
| `viabilidade/visual/evidencias/desktop-parede-cega.png` | captura da tela (estudo de dado público) | `401d4a00c059fd18` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-22421.png` | captura da tela (estudo de dado público) | `8128e1701eba148e` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-22426.png` | captura da tela (estudo de dado público) | `2f6e23eb799b1bdb` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-25297.png` | captura da tela (estudo de dado público) | `eba3651b8f019233` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-30516.png` | captura da tela (estudo de dado público) | `c0d66174bfac9897` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-37607.png` | captura da tela (estudo de dado público) | `d7033c12df68f9d7` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-q1382-11984-11988.png` | captura da tela (estudo de dado público) | `21bf6b22873a6a07` |
| `viabilidade/visual/evidencias/desktop-piloto-SC-completo-remembramento-75352-75354.png` | captura da tela (estudo de dado público) | `d8b1cd394c4324cc` |
| `viabilidade/visual/evidencias/desktop-v2.png` | captura da tela (estudo de dado público) | `14d1708f4682d7b8` |

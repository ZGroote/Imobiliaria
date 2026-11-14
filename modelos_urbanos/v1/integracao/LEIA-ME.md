# Biblioteca de casas, sobrados e predios no mapa

Implementada no renderizador `renderizador-v16-moveis`. Paginas locais reconstruidas
em `v16-moveis/sao-carlos-v16-moveis.html` e `sao-carlos-v16-moveis-aberto.html`.
Nenhuma alteracao foi publicada no Firebase.

## Comportamento

- Usa 20 casas, 20 sobrados e 20 predios da biblioteca Blender, em LOD1, com materiais e cores.
- Escolhe a variante de forma deterministica pela posicao, categoria, altura e
  dimensoes disponiveis. Usa a orientacao de fachada da base quando informada.
- Escala uniforme, de 0,65 a 1,15, sem esticar separadamente portas e janelas.
- Predios exigem escala minima de 0,8 e altura resultante a no maximo 20% da altura
  da base. Torres comerciais continuam no caminho anterior.
- Visita os registros em ordem espacial fixa e favorece variantes menos usadas
  num raio de 80 m dentro do mesmo quarteirao. Nao garante exclusividade entre
  quarteiroes; preserva encaixe e escolhas estaveis independentemente do streaming.
- Confere o retangulo completo do modelo dentro da pegada recuada, inclusive em
  poligonos concavos. O limite considera tambem as sacadas do modelo simplificado.
- Conserva volumes existentes quando nao ha encaixe, nos comercios e nos
  registros de lancamentos/modelos proprios identificados por seus atributos.
- Compartilha geometria e dois materiais por biblioteca. As instancias acompanham
  o streaming existente de quarteiroes; sair da regiao remove as instancias, e
  voltar recria as mesmas escolhas. Os 60 modelos ficam em cache para reutilizacao.
- Acompanha relevo, multiplicador de altura, sombra de contato, corte do interior e
  identificacao do registro clicado por `instanceId`.

Esta etapa nao altera o raio do streaming e nao consulta Google Maps.
A categoria ainda vem das regras/dados do mapa; as
fachadas sao ilustrativas, nao uma reconstituicao de cada endereco.

## Comparar e reconstruir

Abrir a pagina normalmente ativa a biblioteca. Acrescentar `?casas=procedural`
(ou `&casas=procedural` se ja houver parametros) volta aos volumes anteriores.
Pack ausente/invalido no boot tambem mantem o caminho anterior, com aviso no console.
`window.__int.urban.stats()` informa quantidade de modelos, pools e instancias.

Na raiz do projeto, em PowerShell:

```powershell
node modelos_urbanos/v1/compilar_mapa.mjs
$env:MAPA_V='v16-moveis'
python pipeline/montar.py sao-carlos
node modelos_urbanos/v1/integracao/testar.mjs
python modelos_urbanos/v1/integracao/testar_browser.py
python modelos_urbanos/v1/integracao/testar_browser.py procedural
python modelos_urbanos/v1/integracao/testar_browser.py predios
```

`compilar_mapa.mjs` converte os GLBs existentes em `mapa-casas.json`. Posicoes em
centimetros (Int16), normais Int8, cores lineares Uint8 e indices Uint16. A pagina
embute esse bloco: nao baixa 60 arquivos e nao precisa de um parser glTF no boot.
O pacote completo ocupa aproximadamente 5,14 MB aberto e 1,24 MB comprimido/base64.
A pagina comprimida passou de 10,01 MB (40 modelos) a 11,07 MB (60 modelos).

## Verificacao

Teste Node com Three.js real: limites dos 60 modelos, escolha estavel, diversidade
perto de vizinhos, encaixe/altura de predios, recusa de
terrenos pequenos/irregulares, protecao de registros especiais, crescimento do pool,
remocao com troca de indice, altura/relevo, raycast e limpeza/reutilizacao.

Teste Chrome headless com WebGL SwiftShader, perfil isolado e pagina comprimida:
carrega bairro perto do Sanca 135, identifica uma instancia, alterna relevo, sai da
regiao, confirma zero instancias e retorna conferindo contagem e escolhas identicas.
Logs e imagens: `modelos.log`, `modelos.png`, `procedural.log`, `procedural.png`.

A comparacao usa raio de streaming de 450 m, 75 quarteiroes e camera fixa. A primeira
medicao deu 536 substituicoes: 2,17 milhoes de triangulos/178 chamadas na cena contra
1,96 milhao/104 chamadas no caminho anterior. Sao medidas do enquadramento, nao de
FPS em GPU real. A biblioteca reduz duplicacao de geometria, mas acrescenta detalhe
e chamadas; ainda e preciso medir nos dispositivos alvo antes de ampliar o alcance.

Copias dos fontes anteriores a integracao ficam em `antes/`.

Extensao para 60 modelos: teste no centro confirmou 587 substituicoes, sendo 474
casas, 110 sobrados e 3 predios compativeis em 104 quarteiroes. Passaram clique,
relevo, descarregamento completo e retorno com as mesmas escolhas. A captura
`predios.png` aproxima um dos predios substituidos; o log registra o estado do teste.
Os numeros da primeira medicao acima sao historicos e usam outro enquadramento.

Plano separado para as proximas melhorias: `PLANO-RUAS-ARVORES.md`.

Primeira melhoria das ruas implementada: passeio 22 cm acima da pista, sarjeta,
chanfro e laterais fechadas. Corrigidas as faces invertidas de um dos lados da
calcada. Teste: `node modelos_urbanos/v1/integracao/testar_ruas.mjs`.
Comparacao visual: `ruas-antes.png` e `ruas.png`; detalhes e proximas etapas no plano.

Segunda entrega: indice global de cruzamentos e recuo de calcadas pela largura/angulo
da via conectada, inclusive nos nos intermediarios. Copas revisadas no Blender com
normais suaves e silhueta irregular; 20 especies, sem aumento de triangulos.
Ver `arvores.png`, `arvores-antes.png` e `arvores/arvores-v2.blend` na raiz do projeto.
O teste de arborizacao incremental passou nas seis rodadas. A troca de LOD por
distancia e o acabamento curvo das esquinas ainda estao planejados.

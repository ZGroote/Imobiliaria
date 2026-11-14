# Interior LIV Ipanema pelo construtor de plantas

`construir-interior.ts` chama as APIs do construtor existente (`modelo.ts` e
`editorDocument.ts`), em vez de fabricar `unidade.json` ou usar o cadastro legado.
O script monta paredes, contornos, vãos e móveis a partir da planta publicitária
`../referencias/planta-47-59.jpg`. `referencia.json` conserva fonte, hash da imagem,
pontos de registro e limites da leitura.

`projeto-planta.json` é o projeto completo reabrível pelo botão **Abrir projeto**
do construtor. Inclui móveis do catálogo e o pavimento ativo. A referência visual
fica separada porque o contrato do editor não aceita imagem ou procedência que
não consiga reabrir sem perda. O round-trip do projeto, da leitura e dos móveis
é conferido pelo mesmo carregador usado no editor.

## Regenerar

Na raiz do repositório, com Node 24+:

```powershell
node v1.5/miniaturas/liv-ipanema/interior/construir-interior.ts
python -m pipeline.gerar_maquete v1.5/miniaturas/liv-ipanema/interior/leitura.json --contexto v1.5/miniaturas/liv-ipanema/interior/contexto.json --moveis v1.5/miniaturas/liv-ipanema/interior/moveis.json --destino v1.5/miniaturas/liv-ipanema/interior/previa-nova
```

O pipeline exige destino novo ou vazio. Não apaga a execução anterior. A saída
contém `maquete.html`, `unidade.json` e `relatorio.json`; o relatório registra os
hashes da leitura, do normalizador, do consumidor e da geometria conferida.

## Resultado da captura

- Suíte, dormitório, banho suíte, banho social, sala integrada e varanda/serviço.
- A sala TV, jantar, circulação e cozinha pertencem ao mesmo contorno integrado,
  composto por cinco partes mescladas. Não há parede inventada entre esses usos.
- Dez aberturas: seis portas e quatro janelas observadas na referência.
- Vinte e nove móveis posicionados no construtor, incluindo quatro cadeiras de jantar
  e duas cadeiras da varanda, todos do catálogo existente.
- Grade de 50 mm, escala uniforme aproximada de 11 mm/pixel e pé-direito inferido de 2,70 m.
- Área nominal entre eixos de paredes de 47,235 m². A ficha conserva a área
  publicada de 47,59 m². Esses números têm bases distintas; o contorno não foi
  deformado para igualá-los.

`comparativo-captura.png` é uma conferência da captura exportada sobre a fonte,
com laranja para portas, azul para janelas e marrom para footprints dos móveis.
Não é fotografia de renderização. A maquete integrada deve ser verificada
separadamente em planta 3D e visita.

Esta é uma reconstrução local da planta pública, sem unidade à venda, número de
apartamento ou posição comercial atribuídos, e sem gravação em Firestore ou deploy.

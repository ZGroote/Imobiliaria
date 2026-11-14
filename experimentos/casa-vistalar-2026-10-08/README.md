# Casa VistaLar — casa renderizada e visita navegável

Estudo criado por código no Blender 5.2.2 LTS, inspirado na fachada fornecida.
Sobrado contemporâneo com concreto claro, pedra, madeira, vidro, varanda, garagem e jardim.
O interior é ilustrativo: sala, jantar, cozinha, lavabo, escada, suíte, escritório e banheiro.

## Abrir

Visita local: http://127.0.0.1:8774/

Para abrir novamente, execute `abrir-visita.ps1`. Alternativamente, neste diretório:

```powershell
C:/Python314/python.exe -m http.server 8774 --bind 127.0.0.1
```

Os módulos, texturas e decodificador estão incluídos; não há dependência de CDN.
É necessário servir a pasta por HTTP.

- **Entrar na casa** inicia a caminhada.
- **WASD** anda; **Shift** acelera; **Q/E** gira; arrastar olha ao redor.
- **F** ou o botão na tela abre/fecha a porta mais próxima.
- No celular, arraste para olhar e use o controle circular para caminhar.
- A escada liga os andares; menu e planta permitem ir diretamente aos cômodos.
- Exterior permite girar e aproximar; Dia/Fim de tarde muda a luz.

## Arquivos

- `casa-vistalar-dia.png` e `casa-vistalar-fim-de-tarde.png`: renders Cycles, 2000 × 1125.
- `casa-vistalar.blend`: cena editável com materiais, câmera e iluminação.
- `index.html`, `visita.css`, `visita.js`: interface e visualizador Three.js 0.180.0.
- `navigation.mjs`, `navigation.json`: colisão, alturas, escada e pontos de visita.
- `casa-vistalar-web-draco.glb`: modelo comprimido usado no navegador.
- `casa-vistalar-web.glb`: exportação intermediária sem compressão Draco.
- `gerar_casa.py`: arquitetura inicial; `preparar_visita.py`: interiores, escada, portas e carros.
- `exportar_web.py`: reduz detalhes e converte materiais procedurais em texturas para web.
- `tools/compress.mjs`: comprime o GLB mantendo a hierarquia das portas.
- `renderizar.py`: renderiza a cena nativa.
- `verificacao.json`, `navigation-tests.json`, `renders.json`: verificações.

## Otimização e verificação

Meshes repetidos compartilham dados na cena nativa. Folhas são agrupadas por árvore.
A cópia web reduz vegetação e detalhes dos carros, usa texturas pequenas e Draco.
O visualizador limita resolução em telas densas, renderiza até 30 quadros/s e pausa
em abas ocultas. Sombras são recalculadas quando a luz ou as portas mudam.

Os testes usam os limites dos objetos carregados no navegador para conferir os pontos
de entrada dos cômodos, subida e descida da escada, corredor superior e bloqueio de
paredes e bordas do andar. A interface foi conferida em desktop e em 390 × 844 pixels.
A subida real pela escada também foi exercitada usando os controles de teclado.
Os renders usam Cycles; a visita usa iluminação em tempo real e uma aproximação dos
materiais para manter a navegação leve.

Cycles usa CUDA, amostragem adaptativa, denoising e blocos de 512 pixels para limitar
o uso de memória na GTX 1650 de 4 GB. Limite final: 96 amostras. A prévia CUDA
diurna com 1100 × 619 pixels e 40 amostras levou 43,69 segundos de render nesta máquina.

## Reproduzir

Neste diretório:

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python './preparar_visita.py'
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background './casa-vistalar.blend' --python './exportar_web.py'
node ./tools/compress.mjs
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background './casa-vistalar.blend' --python './renderizar.py'
```

Para reinstalar o compressor, rode `pnpm install` dentro de `tools`.
Para prévias, acrescente `-- --draft` ao renderizador.
Teste de navegação: `node ./test-navigation.mjs`, usando `browser-geometry.json`.

## Créditos

Casa, interiores, vegetação, materiais e código foram criados para este estudo.
A imagem enviada pelo usuário orientou a fachada.

Carros: **CarConcept**, modelo e texturas de **Eric Chadwick**, © 2024
**Darmstadt Graphics Group GmbH**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Fonte: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept).
Adaptações: escala, duplicação, pinturas grafite/pérola e redução de detalhes na web.
Os créditos da fonte estão em `car-concept-creditos.md`.

Three.js: MIT (`vendor/LICENSE-three.txt`). Draco: Apache 2.0 (`vendor/draco/LICENSE.txt`).
Compressão: [glTF Transform](https://gltf-transform.dev/cli), MIT.
O módulo de caminhada foi reutilizado do projeto imobiliário existente.

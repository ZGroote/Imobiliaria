/* Building surface and growth-line shaders; all scene inputs are explicit. */
(function(root) {
  "use strict";
  function create({THREE, AP_LUZ, AP_JANELA, TEX_CIDADE, getNoise,
                   uRelief, uHeight, uFuro, uNoite}) {
const AP_GLSL = AP_LUZ ? "1.0" : "0.0";

const JAN_TABELA = AP_JANELA ? `
         float pu = 3.4, pv = 3.15;            // largura do vao e pe-direito, em metros
         // x,y = fracao do vao, na horizontal. z,w = PEITORIL e VERGA, em METROS acima
         // do piso daquele pavimento (ver a nota em JAN_MALHA).
         vec4  w  = vec4(0.16, 0.84, 0.90, 2.55);
         float skip = 0.06;                    // fracao de colunas cegas
         float vitrine = 0.0, porta = 0.0, mull = 0.0, rib = 0.0, tint = 0.0;
         float peD = 3.15;                     // piso do primeiro pavimento-tipo

         if (st < 0.5)      { pu=3.6; pv=3.05; w=vec4(0.22,0.66,1.05,2.20); skip=0.16; porta=1.0; peD=0.0; }
         else if (st < 1.5) { pu=3.5; pv=3.00; w=vec4(0.20,0.64,1.05,2.20); skip=0.12; porta=1.0; peD=0.0; }
         else if (st < 2.5) { pu=3.3; pv=3.15; w=vec4(0.14,0.86,0.72,2.55); skip=0.05; peD=3.7; porta=1.0; }
         else if (st < 3.5) { pu=3.7; pv=3.30; w=vec4(0.18,0.82,1.00,2.65); skip=0.14; vitrine=1.0; peD=4.2; porta=1.0; }
         else if (st < 4.5) { pu=2.7; pv=3.20; w=vec4(0.06,0.94,0.42,2.90); skip=0.00; vitrine=1.0; mull=1.0; peD=4.7; tint=1.0; porta=1.0; }
         else if (st < 5.5) { pu=6.0; pv=2.60; skip=1.00; rib=1.0; peD=0.0; porta=1.0; }
         else if (st < 6.5) { pu=4.3; pv=3.60; w=vec4(0.22,0.78,1.05,3.10); skip=0.10; peD=4.8; porta=1.0; }
         else               { pu=3.2; pv=2.80; w=vec4(0.32,0.62,1.20,2.05); skip=0.58; porta=1.0; peD=0.0; }
` : `
         float pu = 3.4, pv = 3.15;            // periodo da malha de janelas
         vec4  w  = vec4(0.16, 0.84, 0.26, 0.84);
         float skip = 0.06;                    // fracao de colunas cegas
         float vitrine = 0.0, porta = 0.0, mull = 0.0, rib = 0.0, tint = 0.0;
         float peD = 3.15;                     // pe-direito do terreo

         if (st < 0.5)      { pu=4.7; pv=3.05; w=vec4(0.30,0.63,0.42,0.80); skip=0.46; porta=1.0; peD=0.9; }
         else if (st < 1.5) { pu=4.1; pv=3.05; w=vec4(0.26,0.62,0.36,0.80); skip=0.32; porta=1.0; peD=0.9; }
         else if (st < 2.5) { pu=3.3; pv=3.15; w=vec4(0.14,0.86,0.22,0.82); skip=0.05; peD=3.7; porta=1.0; }
         else if (st < 3.5) { pu=3.7; pv=3.30; w=vec4(0.18,0.82,0.30,0.80); skip=0.14; vitrine=1.0; peD=4.2; porta=1.0; }
         else if (st < 4.5) { pu=2.7; pv=3.20; w=vec4(0.06,0.94,0.12,0.90); skip=0.00; vitrine=1.0; mull=1.0; peD=4.7; tint=1.0; porta=1.0; }
         else if (st < 5.5) { pu=6.0; pv=2.60; skip=1.00; rib=1.0; peD=0.0; porta=1.0; }
         else if (st < 6.5) { pu=4.3; pv=3.60; w=vec4(0.22,0.78,0.30,0.86); skip=0.10; peD=4.8; porta=1.0; }
         else               { skip=1.00; porta=1.0; peD=0.6; }
`;

const JAN_MALHA = AP_JANELA ? `
         // --- pavimentos-tipo -----------------------------------------
         vec2 cell = vec2(vFace.x/pu, (y - peD)/pv);
         vec2 gq   = fract(cell);
         float col = floor(cell.x), row = floor(cell.y);
         float body = step(peD, y) * step(y, hU - 0.35);   // nada acima da laje: platibanda fica limpa
         // A altura DENTRO do pavimento, em METROS. Peitoril e verga tem tamanho
         // fisico (1,05 m e 2,20 m acima do piso, na casa e na torre) e nao fracao do
         // pe-direito -- e era fracao. E ISSO que deixava a rua de casa terrea CEGA:
         // 0,42 de 3,05 m poe o peitoril a 2,18 m do chao, ja dentro dos 35 cm que o
         // 'body' corta abaixo do beiral. Sobrava uma lasca escura colada no telhado,
         // que o olho le como sombra e nao como vao. Como casa e a tipologia da maior
         // parte da cidade, o mapa inteiro perdia a referencia de tamanho: sem fileira
         // de janela nada na fachada diz se aquilo tem 3 m ou 30. Mesma licao do
         // embasamento da Fase 2 -- o que tem tamanho fisico se mede em metro.
         float fy = y - peD - row * pv;
         // O pavimento so ganha janela se o VAO INTEIRO couber abaixo do beiral. Sem
         // isto o ultimo pavimento de qualquer altura quebrada reproduz a lasca: meia
         // janela cortada no meio da verga, que e pior que janela nenhuma.
         float cabe = step(peD + row * pv + w.w + 0.30, hU);
         float open = step(skip, fract(sin(col*12.9898 + row*3.713 + sd*311.7) * 43758.5453)) * cabe;
         float win = step(w.x,gq.x)*step(gq.x,w.y)*step(w.z,fy)*step(fy,w.w) * open * body;
         // A fileira de janela e a unica coisa da fachada que diz de quantos andares e
         // o predio, e ela nao alias como o resto do detalhe: com 3-4 m de passo ainda
         // sobram ~10 px a 700 m. Por isso ela tem o proprio alcance, mais longo que o
         // 'fade' geral (que existe pra apagar peitoril, escorrido e nervura).
         float fadeJ = 1.0 - smoothstep(430.0, 1050.0, length(vViewPosition));
         // Peitoril e verga. A janela era um retangulo escuro chapado: sem a faixa
         // clara embaixo (o peitoril pega sol de cima) e sem a sombra do vao no alto,
         // o vao nao tem profundidade nenhuma -- e vao sem profundidade e o que
         // separa uma fachada de um adesivo colado na caixa.
         float sill = step(w.z - 0.11, fy) * step(fy, w.z)
                    * step(w.x - 0.03, gq.x) * step(gq.x, w.y + 0.03) * open * body;
         float verga = win * smoothstep(0.34, 0.0, w.w - fy);
` : `
         // --- pavimentos-tipo -----------------------------------------
         vec2 cell = vec2(vFace.x/pu, (y - peD)/pv);
         vec2 gq   = fract(cell);
         float col = floor(cell.x), row = floor(cell.y);
         float body = step(peD, y) * step(y, hU - 0.35);   // nada acima da laje: platibanda fica limpa
         float open = step(skip, fract(sin(col*12.9898 + row*3.713 + sd*311.7) * 43758.5453));
         float win = step(w.x,gq.x)*step(gq.x,w.y)*step(w.z,gq.y)*step(gq.y,w.w) * open * body;
         float fadeJ = fade;
         // Peitoril e verga. A janela era um retangulo escuro chapado: sem a faixa
         // clara embaixo (o peitoril pega sol de cima) e sem a sombra do vao no alto,
         // o vao nao tem profundidade nenhuma -- e vao sem profundidade e o que
         // separa uma fachada de um adesivo colado na caixa.
         float sill = step(w.z - 0.09, gq.y) * step(gq.y, w.z)
                    * step(w.x - 0.03, gq.x) * step(gq.x, w.y + 0.03) * open * body;
         float verga = win * smoothstep(0.12, 0.0, w.w - gq.y);
`;

function facadeMaterial(u) {
  /* O vidro deixou de dividir o acabamento do reboco (`material_luz`).
     Uma fachada inteira com `shininess:0` e `specular` preto e uma superficie so:
     janela e parede diferem apenas em quanto escurecem a cor difusa -- ou seja, a
     janela e PINTURA. E pintura escura sobre plano claro e exatamente o que faz o
     volume ler como caixa de papelao com adesivo. Aqui o Phong ganha um especular
     de verdade, e quem decide onde ele aparece e o `specularStrength` por fragmento
     (ver `gEspec` no color_fragment): vidro brilha, reboco nao. `specularStrength`
     ja existia no material -- estava em 1,0 multiplicando um especular preto. */
  const m = new THREE.MeshPhongMaterial({ vertexColors:true,
    shininess: AP_LUZ ? 56 : 0, specular: AP_LUZ ? 0x6B7682 : 0x000000,
    side:THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = u;
    sh.uniforms.uRelief = uRelief;
    sh.uniforms.uHeight = uHeight;
    sh.uniforms.uFuro = uFuro;
    sh.uniforms.uNoite = uNoite;
    sh.uniforms.uTexReb = { value: TEX_CIDADE.reboco };
    sh.uniforms.uTexTij = { value: TEX_CIDADE.tijolo };
    sh.vertexShader =
      "attribute vec2 aFace;\nattribute float aDist;\nattribute float aDY;\nattribute vec3 aStyle;\n" +
      "uniform float uT;\nuniform float uRelief;\nuniform float uHeight;\n" +
      "varying vec2 vFace;\nvarying vec3 vStyle;\nvarying vec3 vMundo;\nvarying vec3 vNw;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvFace=aFace;\nvStyle=aStyle;\nvNw=normal;\n" +
        "float g=clamp((uT-aDist*0.5)/0.5,0.0,1.0);transformed.y*=g*g*(3.0-2.0*g)*uHeight;transformed.y+=aDY*uRelief;\n" +
        "vMundo=transformed;");

    sh.fragmentShader = "varying vec2 vFace;\nvarying vec3 vStyle;\nvarying vec3 vMundo;\nvarying vec3 vNw;\nuniform vec4 uFuro;\nuniform float uNoite;\nuniform sampler2D uTexReb;\nuniform sampler2D uTexTij;\nvec3 gLuz;\nfloat gEspec;\n" + getNoise() +
      sh.fragmentShader
        // A luz da janela nao pode entrar na cor difusa: difusa e multiplicada pela
        // luz da cena, e a noite a luz da cena e quase zero. Entra na EMISSIVA, que
        // atravessa a iluminacao -- e por isso precisa de uma global escrita la em
        // cima, no color_fragment, e somada aqui embaixo.
        .replace("#include <emissivemap_fragment>",
                 "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gLuz;")
        .replace("#include <specularmap_fragment>",
                 "#include <specularmap_fragment>\nspecularStrength = gEspec;")
        .replace("#include <color_fragment>",
      `#include <color_fragment>
       gLuz = vec3(0.0);
       gEspec = 0.0;
       // ---- textura de superficie ----------------------------------------
       // Entra ANTES do desenho de janela e telha: vao e caixilho nao levam grao
       // de reboco. E entra como RAZAO em torno da media da textura, nao como cor
       // -- a cor vem do cadastro e da tipologia, e trocar por uma foto cinza
       // apagaria a paleta inteira da cidade.
       //
       // vFace.x ja corre ao longo da fachada em METROS e vMundo.y e a altura:
       // os dois sao a UV, sem atributo novo e sem triplanar.
       float wall = 1.0 - abs(vNw.y);            // 1 na fachada, 0 na laje/telhado
       if (wall > 0.35) {
         // Tijolo aparente e RARO e so em casa baixa (ate 9 m). Em predio alto nao
         // existe por aqui, e aplicado em tudo viraria fantasia. A escolha sai da
         // semente que o aStyle ja carregava.
         float tij = step(0.90, fract(sin(vStyle.y * 57.31) * 43758.5453))
                   * step(vStyle.z * 0.1, 9.0);
         vec2 uvT = vec2(vFace.x, vMundo.y);
         vec3 tx = mix(texture2D(uTexReb, uvT * 0.55).rgb,
                       texture2D(uTexTij, uvT * 0.42).rgb, tij);
         // medias medidas em pipeline/baixa_texturas.py: 212 e 116 de 255
         float med = mix(0.831, 0.455, tij);
         float g = dot(tx, vec3(0.299, 0.587, 0.114)) / med;
         // Reboco tem desvio 4,1 em 255 e some no mipmap a 80 m; tijolo tem 42,5 e
         // sobrevive. Por isso a forca e diferente -- empatar as duas gastaria
         // contraste onde nao ha o que mostrar.
         diffuseColor.rgb *= mix(1.0, g, mix(0.45, 0.85, tij) * wall);
         // Mancha de ~6 m: sobrevive ao mipmap porque a escala dela e METRO,
         // nao milimetro. Custa zero byte e faz o que a foto de reboco nao fez.
         float mancha = vnoise(vec2(vFace.x, vMundo.y) * 0.17 + vStyle.y) * 0.62
                      + vnoise(vec2(vFace.x, vMundo.y) * 0.61) * 0.38;
         diffuseColor.rgb *= 1.0 + (mancha - 0.5) * 0.20 * wall;
       }
       float AP = ${AP_GLSL};    // 1 so na cidade que declarou 'material_luz'
       if (uFuro.z > 0.0 && vMundo.y > uFuro.w &&
           distance(vMundo.xz, uFuro.xy) < uFuro.z) discard;
       if (vFace.y >= 0.0) {
         float st = vStyle.x;
         float sd = vStyle.y / 256.0;          // semente do prédio, 0..1
         float hU = vStyle.z * 0.1;            // altura útil (topo da laje), em metros
         float y  = vFace.y;
         // Detalhe some com a distância: de perto vira desenho, de longe vira
         // ruído. A cor da parede (vertexColors) não desaparece junto -- é ela
         // que segura a variedade do bairro visto de cima.
         float fade = 1.0 - smoothstep(190.0, 560.0, length(vViewPosition));
         /* A PALETA EXISTIA E NAO CHEGAVA NA TELA. Medido na cena de Ribeirao: 70%
            das 5.021 casas e sobrados tem croma >= 0,24 no atributo de cor -- salmao,
            terracota, ocre, cinza-azulado, a abertura de paleta da Fase 2 -- e a rua
            aparecia como uma familia de brancos. Nao e a paleta: e o caminho da cor.
            A saida sRGB levanta o valor (0,81 linear vira 0,92) e o ACES desatura
            justamente o meio-tom alto, entao os dois juntos comem quase todo o croma
            das cores claras, que sao a maioria de uma rua brasileira.

            O conserto e devolver croma ANTES do tone mapping, que e onde ele se perde:
            um 'mix' de peso NEGATIVO afasta a cor do proprio cinza. So na FACHADA --
            asfalto, grama, telha e chao tem calibracao propria e nao passam por aqui.
            O 0,96 no valor e o par disso: parede pintada nao e fonte de luz, e branco
            no limite do estouro nao aceita croma nenhum.                            */
         float lumP = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = max(vec3(0.0),
                                mix(diffuseColor.rgb, vec3(lumP), -0.34 * AP)) * (1.0 - 0.04 * AP);

${JAN_TABELA}

${JAN_MALHA}

         // --- térreo ---------------------------------------------------
         float g0  = step(0.75, y) * step(y, peD - 0.55);
         float vg  = fract(vFace.x/5.2);
         float vit = g0 * vitrine * step(0.08, vg) * step(vg, 0.92);   // vitrine quase corrida
         float marq = vitrine * smoothstep(0.26, 0.0, abs(y - (peD - 0.28))) * step(y, hU);  // marquise

         // Portão de garagem numa coluna sorteada: é o que faz duas casas iguais
         // pararem de ser a mesma casa.
         float du   = fract(vFace.x/pu);
         float door = porta * step(abs(col - floor(sd*5.0 + 1.0)), 0.5)
                    * step(0.20,du) * step(du,0.80) * step(0.05,y) * step(y,2.30);

         // --- galpão: nervura da telha + fita de clarabóia --------------
         float ribv  = rib * (0.5 + 0.5*sin(y * 6.9813)) * 0.07;
         float cg    = fract(vFace.x/2.4);
         float clere = rib * step(hU-2.6, y) * step(y, hU-0.9) * step(0.10,cg) * step(cg,0.90);

         // --- linha de laje e montante da cortina de vidro --------------
         float slab = step(1.5, st) * step(st, 4.5) * body * smoothstep(0.07, 0.0, abs(gq.y - 0.02));
         float ml   = mull * step(0.43, abs(du - 0.5));

         // Noite: parte das janelas acende. O sorteio e por JANELA (coluna, fila e a
         // semente do predio), entao a mesma janela fica acesa a noite inteira, o
         // vizinho acende outras, e quem tem mais vao acende mais.
         float acesa = step(0.56, h21(vec2(col * 3.7 + sd * 91.0, row * 1.9)));
         gLuz += uNoite * max(win, vit) * acesa * vec3(1.30, 0.92, 0.52) * 2.6;
         float glass = max(max(win, vit), clere);
         /* O VIDRO DEIXOU DE SER "UM RETANGULO MAIS ESCURO". Reboco e vidro dividiam o
            mesmo acabamento -- 'shininess:0', especular preto --, entao a janela era
            PINTURA: uma mancha escura chapada num plano claro, que e literalmente o
            desenho de um adesivo colado numa caixa. As duas coisas pelas quais o olho
            reconhece vidro sao o BRILHO (o sol na vidraca) e o REFLEXO DO CEU crescendo
            com o angulo rasante -- e por isso que a mesma janela e escura de frente e
            clara de esguelha, e por isso que uma torre vista de lado acende inteira.
            Nenhuma das duas custa chamada de desenho: o brilho sai pelo
            'specularStrength', que ja existia (em 1,0, multiplicando preto), e o
            Fresnel e uma potencia do produto escalar com a normal ja interpolada.   */
         gEspec = glass * 0.90 * AP;
         float fres = pow(1.0 - clamp(abs(dot(normalize(vNw),
                          normalize(cameraPosition - vMundo))), 0.0, 1.0), 4.0);
         gLuz += AP * glass * fres * fadeJ * (1.0 - uNoite * 0.8) * vec3(0.26, 0.31, 0.39);
         float dark  = min(0.80, glass*(0.36 + 0.10*AP) + door*0.44 + marq*0.34 + verga*0.30) * fadeJ;
         diffuseColor.rgb *= 1.0 + sill * 0.14 * fade;
         diffuseColor.rgb *= 1.0 - dark;
         diffuseColor.rgb *= 1.0 - (slab*0.10 + ml*0.13 + ribv) * fade;
         diffuseColor.rgb *= 1.0 - (1.0 - step(peD, y)) * 0.045;      // embasamento (terreo)
         // v11: a faixa de embasamento em METROS. A rampa por vertice nao sabe fazer
         // faixa -- entre dois vertices o rasterizador interpola em linha reta, e
         // fatiar a parede pra por a faixa por vertice multiplicaria o triangulo da
         // cidade inteira (a mesma armadilha que a gradacao da parede do interior
         // levou). Soleira e rodape de fachada tem tamanho FISICO, ~60-90 cm, igual
         // em casa e em torre; por isso nao e fracao da altura.
         diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.90, y)) * 0.10;
         // Sombra do beiral (ou da platibanda): os ultimos 45 cm da parede, logo
         // abaixo do topo util. Toda casa tem essa faixa escura debaixo do beiral;
         // sem ela o telhado parece COLADO na parede, que e exatamente a colagem que
         // faz o volume ler como bloco de montar.
         diffuseColor.rgb *= 1.0 - smoothstep(0.45, 0.0, hU - y) * step(y, hU) * 0.17 * fade;
         // Platibanda: acima da laje (hU) nao ha pavimento, so parapeito -- e e ela
         // que recorta o predio contra o ceu. Sai mais clara e menos saturada que a
         // parede. O proprio hU diz onde ela COMECA de verdade; nao e preciso chutar
         // "os 10% de cima", e telhado inclinado (ph = 0) nao entra sozinho: ali a
         // parede termina exatamente em hU.
         float plat = step(hU + 0.05, y);
         vec3  pcor = mix(diffuseColor.rgb,
                          vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.25);
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(pcor, vec3(1.0), 0.10), plat);
         // Encardido de parede. Reboco pintado nao e chapa de plastico: tem mancha
         // larga de pintura e, principalmente, ESCORRIDO -- a agua que desce da laje
         // ou do beiral risca a fachada de cima pra baixo. Sao os dois motivos de uma
         // caixa branca lida como caixa branca e nao como predio.
         diffuseColor.rgb *= 0.968 + 0.064 * vnoise(vec2(vFace.x * 0.33, y * 0.21));
         float escorre = (1.0 - smoothstep(0.0, 5.5, hU - y)) * step(y, hU)
                       * smoothstep(0.58, 0.96, h21(vec2(floor(vFace.x * 2.3), sd)));
         diffuseColor.rgb *= 1.0 - escorre * 0.075 * fade;
         diffuseColor.rgb  = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.70,0.81,0.96), glass*tint*fade);
       } else {
         /* --- telhado -----------------------------------------------------
            O telhado e a superficie que MAIS aparece num mapa olhado de cima, e ate
            aqui era cor chapada: o leque de cores separava um telhado do vizinho, mas
            dentro de cada telhado nao havia nada -- nenhuma escala, nenhuma fiada. Um
            bairro inteiro saia como um campo de poligonos marrons lisos, que e
            metade do motivo de a cidade parecer maquete de bloco de montar.

            Nao entra atributo novo nenhum aqui, e por isso o custo e zero byte de
            pagina e zero chamada de desenho. A direcao em que a agua DESCE sai da
            propria normal do triangulo (vNw e a normal em espaco de objeto, que
            nesta cena e o mundo: a malha do quarteirao nao gira nem escala), e a
            posicao de mundo ja existia pro furo do interior. Com as duas, a fiada
            corre perpendicular ao declive em qualquer telhado, de qualquer angulo,
            sem UV.                                                                */
         vec3  nw    = normalize(vNw);
         float incl  = clamp(length(nw.xz) / 0.45, 0.0, 1.0);   // 0 = laje, 1 = agua cheia
         // Laje de concreto tem um brilho fraco e largo; telha ceramica nao tem
         // nenhum. E o mesmo 'specularStrength' do vidro, com 1/6 da forca.
         gEspec = AP * (1.0 - incl) * 0.15;
         float fadeT = 1.0 - smoothstep(260.0, 780.0, length(vViewPosition));
         vec2  dirD  = incl > 0.02 ? normalize(nw.xz) : vec2(1.0, 0.0);   // desce a agua
         vec2  dirT  = vec2(-dirD.y, dirD.x);                             // corre a fiada
         float sD = dot(vMundo.xz, dirD), sT = dot(vMundo.xz, dirT);
         // 32 cm de fiada: a telha colonial deitada mede ~46 cm com ~14 de
         // sobreposicao. A junta escura e a sombra dessa sobreposicao, e e ela que
         // faz o telhado LER como telhado visto de cima.
         float fr    = fract(sD / 0.32);
         float junta = smoothstep(0.13, 0.0, fr) * 0.85 + smoothstep(0.88, 1.0, fr) * 0.35;
         // Capa e canal: a onda da telha ao longo da fiada, a cada 19 cm.
         float canal = 0.5 + 0.5 * cos(sT * 33.0);
         // So quem olha o telhado POR CIMA ve telha. Visto de baixo (o beiral, da
         // calcada) o que existe e forro e sombra -- desenhar fiada ali poria telha
         // na parte de baixo da agua. O cameraPosition e uniforme embutido do three,
         // e vMundo ja e posicao de mundo: o sinal do produto escalar resolve.
         float porCima = step(0.0, dot(nw, normalize(cameraPosition - vMundo)));
         float telha = (junta * 0.34 + (1.0 - canal) * 0.13) * incl * fadeT * porCima;
         diffuseColor.rgb *= 1.0 - (1.0 - porCima) * incl * 0.22;   // sombra do beiral por baixo
         // Laje nao tem telha: tem junta de concretagem, a cada 2,8 m, bem mais fraca.
         float jx = smoothstep(0.985, 1.0, fract(vMundo.x / 2.8))
                  + smoothstep(0.985, 1.0, fract(vMundo.z / 2.8));
         diffuseColor.rgb *= 1.0 - telha - min(0.10, jx * 0.09) * (1.0 - incl) * fadeT;
         // Encardido. Telhado de verdade nao tem cor uniforme: tem limo do lado que
         // nao pega sol e poeira no resto. Mesma mancha de baixa frequencia do asfalto.
         diffuseColor.rgb *= 0.93 + 0.14 * vnoise(vMundo.xz * 0.09);
       }`);
  };
  return m;
}

function riseLine(u) {
  const m = new THREE.LineBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:0.22 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = u;
    sh.uniforms.uRelief = uRelief;
    sh.uniforms.uHeight = uHeight;
    sh.uniforms.uFuro = uFuro;
    sh.vertexShader = "attribute float aDist;\nattribute float aDY;\nuniform float uT;\nuniform float uRelief;\nuniform float uHeight;\nvarying vec3 vMundo;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfloat g=clamp((uT-aDist*0.5)/0.5,0.0,1.0);transformed.y*=g*g*(3.0-2.0*g)*uHeight;transformed.y+=aDY*uRelief;\nvMundo=transformed;");
    sh.fragmentShader = "varying vec3 vMundo;\nuniform vec4 uFuro;\n" + sh.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\nif (uFuro.z > 0.0 && vMundo.y > uFuro.w && distance(vMundo.xz, uFuro.xy) < uFuro.z) discard;");
  };
  return m;
}
    return Object.freeze({facadeMaterial, riseLine});
  }
  root.FacadeMaterials = Object.freeze({create});
})(globalThis);

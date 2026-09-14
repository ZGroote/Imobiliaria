/* ============================================================
   Fachada: um shader, oito tipologias
   ============================================================
   Não existe dado aberto de fachada em lugar nenhum do mundo — nem o Overture,
   nem o OSM, nem lidar nenhum dizem onde ficam as janelas. Então fachada é
   sempre desenhada, nunca lida. O que muda entre um mapa que parece maquete de
   isopor e um que parece cidade é só QUANTA regra você põe nesse desenho.

   Aqui a regra vem por vértice em `aStyle` = (tipologia, semente, altura útil).
   Como os três vértices de um triângulo carregam o mesmo valor, a interpolação
   entrega o número exato — dá pra ramificar por tipo sem material novo. É isso
   que mantém o custo em ZERO chamada de desenho a mais: um único material
   continua servindo o quarteirão inteiro.

   `aFace` continua sendo (u ao longo do perímetro, altura na parede), e telhado
   continua marcado com v = -1 pra sair fora de tudo isso.
   ============================================================ */
function facadeMaterial(u) {
  const m = new THREE.MeshPhongMaterial({ vertexColors:true, shininess:0, specular:0x000000, side:THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = u;
    sh.uniforms.uRelief = uRelief;
    sh.uniforms.uHeight = uHeight;
    sh.vertexShader =
      "attribute vec2 aFace;\nattribute float aDist;\nattribute float aDY;\nattribute vec3 aStyle;\n" +
      "uniform float uT;\nuniform float uRelief;\nuniform float uHeight;\n" +
      "varying vec2 vFace;\nvarying vec3 vStyle;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvFace=aFace;\nvStyle=aStyle;\n" +
        "float g=clamp((uT-aDist*0.5)/0.5,0.0,1.0);transformed.y*=g*g*(3.0-2.0*g)*uHeight;transformed.y+=aDY*uRelief;");

    sh.fragmentShader = "varying vec2 vFace;\nvarying vec3 vStyle;\n" +
      sh.fragmentShader.replace("#include <color_fragment>",
      `#include <color_fragment>
       if (vFace.y >= 0.0) {
         float st = vStyle.x;
         float sd = vStyle.y / 256.0;          // semente do prédio, 0..1
         float hU = vStyle.z * 0.1;            // altura útil (topo da laje), em metros
         float y  = vFace.y;
         // Detalhe some com a distância: de perto vira desenho, de longe vira
         // ruído. A cor da parede (vertexColors) não desaparece junto -- é ela
         // que segura a variedade do bairro visto de cima.
         float fade = 1.0 - smoothstep(190.0, 560.0, length(vViewPosition));

         float pu = 3.4, pv = 3.15;            // período da malha de janelas
         vec4  w  = vec4(0.16, 0.84, 0.26, 0.84);
         float skip = 0.06;                    // fração de colunas cegas
         float vitrine = 0.0, porta = 0.0, mull = 0.0, rib = 0.0, tint = 0.0;
         float peD = 3.15;                     // pé-direito do térreo

         if (st < 0.5)      { pu=4.7; pv=3.05; w=vec4(0.30,0.63,0.42,0.80); skip=0.46; porta=1.0; peD=0.9; }
         else if (st < 1.5) { pu=4.1; pv=3.05; w=vec4(0.26,0.62,0.36,0.80); skip=0.32; porta=1.0; peD=0.9; }
         else if (st < 2.5) { pu=3.3; pv=3.15; w=vec4(0.14,0.86,0.22,0.82); skip=0.05; peD=3.7; }
         else if (st < 3.5) { pu=3.7; pv=3.30; w=vec4(0.18,0.82,0.30,0.80); skip=0.14; vitrine=1.0; peD=4.2; }
         else if (st < 4.5) { pu=2.7; pv=3.20; w=vec4(0.06,0.94,0.12,0.90); skip=0.00; vitrine=1.0; mull=1.0; peD=4.7; tint=1.0; }
         else if (st < 5.5) { pu=6.0; pv=2.60; skip=1.00; rib=1.0; peD=0.0; }
         else if (st < 6.5) { pu=4.3; pv=3.60; w=vec4(0.22,0.78,0.30,0.86); skip=0.10; peD=4.8; }
         else               { skip=1.00; porta=1.0; peD=0.6; }

         // --- pavimentos-tipo -----------------------------------------
         vec2 cell = vec2(vFace.x/pu, (y - peD)/pv);
         vec2 gq   = fract(cell);
         float col = floor(cell.x), row = floor(cell.y);
         float body = step(peD, y) * step(y, hU - 0.35);   // nada acima da laje: platibanda fica limpa
         float open = step(skip, fract(sin(col*12.9898 + row*3.713 + sd*311.7) * 43758.5453));
         float win = step(w.x,gq.x)*step(gq.x,w.y)*step(w.z,gq.y)*step(gq.y,w.w) * open * body;

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

         float glass = max(max(win, vit), clere);
         float dark  = min(0.78, glass*0.36 + door*0.44 + marq*0.34) * fade;
         diffuseColor.rgb *= 1.0 - dark;
         diffuseColor.rgb *= 1.0 - (slab*0.10 + ml*0.13 + ribv) * fade;
         diffuseColor.rgb *= 1.0 - (1.0 - step(peD, y)) * 0.045;      // embasamento
         diffuseColor.rgb  = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.70,0.81,0.96), glass*tint*fade);
       }`);
  };
  return m;
}

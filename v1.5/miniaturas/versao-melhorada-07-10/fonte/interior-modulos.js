/* O pacote do interior: os módulos do renderizador que a planta 3D e a visita usam,
   sem nenhuma alteração (as mesmas cópias do padrão aprovado). Cada um registra a sua
   fábrica em `globalThis` (`root.X = Object.freeze({create})`); este arquivo só os reúne
   num pedaço carregado sob demanda pela miniatura (`garanteInterior`). */
import './interior/furniture-param.js';
import './interior/furniture-catalog.js';
import './interior/shell-geometry.js';
import './interior/interior-textures.js';
import './interior/interior-materials.js';
import './interior/openings.js';
import './interior/floor-plan.js';
import './interior/light-bake.js';
import './interior/light-atlas.js';
import './interior/house-mesh.js';
import './interior/furniture-editor.js';

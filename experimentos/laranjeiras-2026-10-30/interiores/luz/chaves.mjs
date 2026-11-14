// Horas gravadas por planta: 7 horas x 4 fachadas (±x, ±z da cena), direção do sol já no referencial da planta.
// Mesmo formato de liv-luz-natural-2026-10-26/fontes/luz-horario/chaves.json; o lado é o context.side do site.
//   node experimentos/laranjeiras-2026-10-30/interiores/luz/chaves.mjs
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {interiorSunDirection, solarState, unitSolarContext} from '../../site/horario-solar.js';

const here = dirname(fileURLToPath(import.meta.url));
const date = '2026-10-31', hours = [6, 8, 10, 12, 14, 16, 18], sides = ['+x', '-x', '+z', '-z'];
// A espelhada mantém a fachada da original: mesmas direções de sol (unitSolarContext olha o prefixo).
for (const typology of ['canto', 'meio', 'canto-espelhado', 'meio-espelhado']) {
  const keys = [];
  for (const side of sides) {
    const context = unitSolarContext({side, typology});
    for (const hour of hours) {
      const sun = solarState(hour, {date}), d = interiorSunDirection(sun.direction, context);
      keys.push({id: `${side[0] === '+' ? 'mais' : 'menos'}${side[1]}-${String(hour).padStart(2, '0')}`, side, hour, date,
        elevationDegrees: sun.elevationDegrees, daylight: sun.daylight, sunStrength: sun.sunStrength,
        directionThree: d, directionBlender: [d[0], -d[2], d[1]]});
    }
  }
  mkdirSync(join(here, typology), {recursive: true});
  writeFileSync(join(here, typology, 'chaves.json'), JSON.stringify({schema: 'liv-luz-horario-chaves-v1', date, hours, keys}, null, 2));
  console.log(typology, keys.length, 'chaves');
}

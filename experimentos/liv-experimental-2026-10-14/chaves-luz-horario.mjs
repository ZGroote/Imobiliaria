// Horas-chave da luz gravada no Cycles: sol de cada lado do Canto, na data de referência.
// Uso, na raiz: node experimentos/liv-experimental-2026-10-14/chaves-luz-horario.mjs > experimentos/liv-luz-natural-2026-10-26/fontes/luz-horario/chaves.json
import {interiorTimeState} from './horario-interior.js';

const date = '2026-10-26', hours = [6, 8, 10, 12, 14, 16, 18];
// Three (x, y, z) -> Blender (x, -z, y), igual ao exportador dos GLBs.
const blender = ([x, y, z]) => [x, -z, y];
const keys = [];
for (const side of ['estacionamento', 'lazer']) for (const hour of hours) {
  const time = interiorTimeState(hour, {side}, {date});
  keys.push({id: `${side}-${String(hour).padStart(2, '0')}`, side, hour, date,
    elevationDegrees: time.elevationDegrees, daylight: time.daylight, sunStrength: time.sunStrength,
    directionThree: time.direction, directionBlender: blender(time.direction)});
}
console.log(JSON.stringify({schema: 'liv-luz-horario-chaves-v1', date, hours, keys}, null, 2));

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeHour, formatHour, solarState, unitSolarContext, interiorSunDirection, facadeExposure } from '../experimentos/liv-experimental-2026-10-14/horario-solar.js';

const options = { date: '2026-10-26' };
const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);

test('horários de horizonte conferem com os rótulos do Shadowmap fornecido',()=>{
  const location={date:'2026-10-26',latitude:-22.023,longitude:-47.89010};
  function horizon(lo,hi,rising){
    for(let step=0;step<35;step++){
      const mid=(lo+hi)/2,above=solarState(mid,location).elevationDegrees>-.833;
      if(above===rising)hi=mid;else lo=mid;
    }
    return (lo+hi)/2;
  }
  // The app labels 05:32 /18:20. -.833° is only this event comparison, not a second sun.
  near(horizon(4,7,true),5+32/60,3/60);
  near(horizon(17,20,false),18+20/60,3/60);
});

test('horas contínuas aceitam o range e preservam os extremos 0 e 24', () => {
  assert.equal(normalizeHour('18.375'), 18.375);
  assert.equal(normalizeHour(-1), 0);
  assert.equal(normalizeHour(25), 24);
  assert.equal(formatHour(0), '00:00');
  assert.equal(formatHour(18.375), '18:23');
  assert.equal(formatHour(24), '24:00');
  for (const value of [undefined, null, '', ' ', 'amanhã', NaN, Infinity, {}, [], true]) assert.equal(normalizeHour(value), 14);
  assert.equal(normalizeHour(NaN, 9), 9);
  assert.equal(normalizeHour(NaN, Infinity), 14);
  assert.equal(solarState('inválida', options).hour, 14);
});

test('data explícita é determinística e rejeita dias inexistentes', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '0000-01-01', '', null, new Date()]) {
    assert.throws(() => solarState(12, { date }), RangeError);
  }
  assert.equal(solarState(12, { date: '2024-02-29' }).date, '2024-02-29');
  assert.equal(solarState(12, { date: '2026-12-31' }).date, '2026-12-31');
  for (const invalid of [{ latitude: 91 }, { longitude: -181 }, { timezone: Infinity }, { buildingYaw: NaN }]) {
    assert.throws(() => solarState(12, { ...options, ...invalid }), RangeError);
  }
});

test('vetores unitários e azimute respeitam leste de manhã e oeste à tarde', () => {
  for (let hour = 0; hour <= 24; hour += 0.125) {
    const state = solarState(hour, options);
    near(Math.hypot(...state.directionGeo), 1);
    near(Math.hypot(...state.direction), 1);
    near(state.direction[1], state.directionGeo[1]);
    near(state.elevationDegrees, state.elevation * 180 / Math.PI);
    assert.ok(state.azimuth >= 0 && state.azimuth < 2 * Math.PI);
    for (const field of ['daylight', 'sunStrength', 'night']) assert.ok(state[field] >= 0 && state[field] <= 1);
    near(state.daylight + state.night, 1);
    assert.equal(state.approximate, true);
  }
  const morning = solarState(9, options), afternoon = solarState(16, options);
  assert.ok(morning.directionGeo[0] > 0);
  assert.ok(afternoon.directionGeo[0] < 0);
  assert.ok(morning.azimuth < Math.PI);
  assert.ok(afternoon.azimuth > Math.PI);
  const equator = solarState(12, { date: '2026-03-20', latitude: 0, longitude: 0, timezone: 0 });
  assert.ok(equator.elevationDegrees > 87);
});

test('a rotação manual do prédio transforma o mesmo sol geográfico em coordenadas do modelo', () => {
  const state = solarState(9, options), [east, up, south] = state.directionGeo;
  const yaw = -120 * Math.PI / 180;
  near(state.direction[0], Math.cos(yaw) * east + Math.sin(yaw) * south);
  near(state.direction[1], up);
  near(state.direction[2], -Math.sin(yaw) * east + Math.cos(yaw) * south);
  assert.deepEqual(solarState(9, { ...options, buildingYaw: 0 }).direction, state.directionGeo);
});

test('noite desliga sol direto e leva as luzes automáticas a 1 em ambos os extremos', () => {
  for (const hour of [0, 2, 22, 24]) {
    const state = solarState(hour, options);
    assert.ok(state.elevation < 0);
    assert.equal(state.sunStrength, 0);
    assert.equal(state.daylight, 0);
    assert.equal(state.night, 1);
    assert.equal(state.phase, 'noite');
    assert.equal(facadeExposure(state.direction, 'lazer'), 0);
    assert.equal(facadeExposure(state.direction, 'estacionamento'), 0);
  }
  assert.equal(solarState(12, options).night, 0);
  assert.equal(solarState(24, options).hour, 24);
  // 24:00 mantém a data selecionada e coincide com 00:00 do dia seguinte.
  const end = solarState(24, options), next = solarState(0, { date: '2026-10-27' });
  for (let axis = 0; axis < 3; axis++) near(end.direction[axis], next.direction[axis]);
});

test('amanhecer e anoitecer transitam suavemente, sem depender do caminho do slider', () => {
  const phases = new Set();
  let previous = solarState(0, options);
  for (let minute = 1; minute <= 1440; minute++) {
    const current = solarState(minute / 60, options);
    phases.add(current.phase);
    for (const field of ['daylight', 'sunStrength', 'night']) assert.ok(Math.abs(current[field] - previous[field]) < 0.04, `${field} saltou em ${minute}`);
    assert.ok(Math.hypot(...current.direction.map((value, axis) => value - previous.direction[axis])) < 0.005);
    previous = current;
  }
  assert.deepEqual(phases, new Set(['noite', 'amanhecer', 'dia', 'anoitecer']));
  const original = solarState(17.25, options);
  for (const hour of [0, 24, 12, 3, 22, 8]) solarState(hour, options);
  assert.deepEqual(solarState(17.25, options), original);
  const descending = Array.from({ length: 97 }, (_, index) => solarState(24 - index / 4, options));
  assert.deepEqual(descending.reverse(), Array.from({ length: 97 }, (_, index) => solarState(index / 4, options)));
});

test('fachadas opostas recebem potenciais diferentes conforme o mesmo sol global', () => {
  const morning = solarState(9, options), afternoon = solarState(16, options);
  assert.ok(facadeExposure(morning.direction, 'lazer') > 0);
  assert.equal(facadeExposure(morning.direction, 'estacionamento'), 0);
  assert.ok(facadeExposure(afternoon.direction, 'estacionamento') > 0);
  assert.equal(facadeExposure(afternoon.direction, 'lazer'), 0);
});

test('contextos reais do cadastro alinham as aberturas -Z e aceitam ambos os campos de pavimento', async () => {
  const catalog = JSON.parse(await readFile(new URL('../experimentos/liv-experimental-2026-10-14/unidades.json', import.meta.url), 'utf8'));
  const parking = unitSolarContext(catalog.units.find(unit => unit.side === 'estacionamento'));
  const leisure = unitSolarContext(catalog.units.find(unit => unit.side === 'lazer'));
  assert.equal(parking.floorIndex, 1);
  assert.equal(leisure.floorIndex, 1);
  assert.equal(parking.yaw, 0);
  assert.equal(leisure.yaw, Math.PI);
  assert.equal(parking.approximate, true);
  assert.equal(unitSolarContext({ id: 'u', final: 2, floor: 0 }).floorIndex, 0);
  assert.equal(unitSolarContext({ id: 'u', final: 2, floorIndex: 8, floor: 3 }).floorIndex, 8);
  assert.equal(unitSolarContext({ id: 'p04-f03', final: 3 }).floorIndex, 4);
  const direction = solarState(9, options).direction;
  const localParking = interiorSunDirection(direction, parking), localLeisure = interiorSunDirection(direction, leisure);
  near(localParking[0], -localLeisure[0]);
  near(localParking[1], localLeisure[1]);
  near(localParking[2], -localLeisure[2]);
  for (const context of [parking, leisure]) {
    const local = interiorSunDirection(direction, context);
    near(Math.hypot(...local), 1);
    near(facadeExposure(direction, context.side), Math.max(0, -local[2]));
  }
  assert.throws(() => unitSolarContext({ side: 'norte' }), RangeError);
  assert.throws(() => unitSolarContext({ final: 11 }), RangeError);
  assert.throws(() => interiorSunDirection([0, 1, 0], {}), RangeError);
  assert.throws(() => facadeExposure([0, NaN, 0], 'lazer'), TypeError);
});

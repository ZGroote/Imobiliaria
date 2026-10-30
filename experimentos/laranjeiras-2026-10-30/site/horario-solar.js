const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function numericHour(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return NaN;
  return Number(value);
}

export function normalizeHour(value, fallback = 14) {
  const hour = numericHour(value);
  const alternative = numericHour(fallback);
  return clamp(Number.isFinite(hour) ? hour : Number.isFinite(alternative) ? alternative : 14, 0, 24);
}

export function formatHour(hour) {
  const minutes = Math.round(normalizeHour(hour) * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function calendarDate(value) {
  // O calendário padrão é o de São Paulo; uma data explícita nunca consulta o relógio.
  const date = value === undefined ? new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10) : value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) {
    throw new RangeError('Data solar inválida; use AAAA-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError('Data solar inválida; use um dia existente.');
  }
  const year = parsed.getUTCFullYear();
  const firstDay = new Date(`${date.slice(0, 4)}-01-01T00:00:00.000Z`);
  return { date, dayOfYear: 1 + (parsed - firstDay) / 86400000, daysInYear: year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365 };
}

function boundedNumber(value, min, max, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} inválido.`);
  }
  return value;
}

function smoothstep(from, to, value) {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function vector(direction) {
  if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new TypeError('Direção solar inválida; use [x, y, z].');
  }
  return direction;
}

// Direções [x, z] das fachadas do Laranjeiras na cena.
const AXES = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };

function rotateY(direction, yaw) {
  const [x, y, z] = vector(direction);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [c * x + s * z, y, -s * x + c * z];
}

/** Sol ilustrativo, sem refração nem obstruções. Direções apontam para o sol.
 * Fonte: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * shortcut: implantação e rotação manuais; validar levantamento antes de estudar insolação executiva.
 */
export function solarState(hour, { date, latitude = -21.98896655, longitude = -47.92314270, timezone = -3, buildingYaw = -152 } = {}) {
  hour = normalizeHour(hour);
  const calendar = calendarDate(date);
  const lat = boundedNumber(latitude, -90, 90, 'Latitude') * RAD;
  boundedNumber(longitude, -180, 180, 'Longitude');
  boundedNumber(timezone, -14, 14, 'Fuso horário');
  boundedNumber(buildingYaw, -Infinity, Infinity, 'Rotação do prédio');
  // NOAA: ano fracionário, equação do tempo, declinação e hora solar verdadeira.
  // 24:00 é o fim da data escolhida: gamma avança continuamente até o próximo dia.
  const gamma = TAU / calendar.daysInYear * (calendar.dayOfYear - 1 + (hour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarMinutes = modulo(hour * 60 + eqtime + 4 * longitude - 60 * timezone, 1440);
  const hourAngle = (solarMinutes / 4 - 180) * RAD;
  const east = -Math.cos(decl) * Math.sin(hourAngle);
  const up = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const south = Math.sin(lat) * Math.cos(decl) * Math.cos(hourAngle) - Math.cos(lat) * Math.sin(decl);
  const length = Math.hypot(east, up, south);
  const directionGeo = [east / length, up / length, south / length];
  const elevation = Math.asin(clamp(directionGeo[1], -1, 1));
  const elevationDegrees = elevation / RAD;
  const daylight = smoothstep(-6, 6, elevationDegrees);
  return {
    hour, date: calendar.date, elevation, elevationDegrees,
    azimuth: modulo(Math.atan2(east, -south), TAU),
    directionGeo,
    // +X leste / -Z norte no mapa; o prédio está girado +120° em Y.
    direction: rotateY(directionGeo, -buildingYaw * RAD),
    daylight, sunStrength: smoothstep(0, 15, elevationDegrees), night: 1 - daylight,
    phase: elevationDegrees >= 6 ? 'dia' : elevationDegrees <= -6 ? 'noite' : hourAngle < 0 ? 'amanhecer' : 'anoitecer',
    approximate: true,
  };
}

/** O pavimento não muda o sol global; o yaw alinha a abertura -Z do interior. */
export function unitSolarContext(unit) {
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) throw new TypeError('Unidade solar inválida.');
  const unitId = unit.id ?? unit.unitId ?? null;
  const finalValue = unit.final ?? (typeof unitId === 'string' ? /(?:final-|f)(\d+)$/.exec(unitId)?.[1] : null);
  const finalNumber = finalValue === undefined || finalValue === null ? null : Number(finalValue);
  if (finalNumber !== null && (!Number.isInteger(finalNumber) || finalNumber < 1 || finalNumber > 10)) throw new RangeError('Final da unidade inválido.');
  const final = finalNumber === null ? null : String(finalNumber).padStart(2, '0');
  // Laranjeiras: side = 'torre-0N:±x|±z', a direção da fachada na cena.
  const side = /(?:^|:)([+-][xz])$/.exec(unit.side ?? '')?.[1] ?? null;
  if (!side) throw new RangeError('Lado da unidade inválido.');
  const idFloor = typeof unitId === 'string' ? /(?:pavimento-modelo-|^p)(\d+)/.exec(unitId)?.[1] : undefined;
  const floorIndex = unit.floorIndex ?? unit.floor ?? (idFloor === undefined ? null : Number(idFloor));
  if (floorIndex !== null && (!Number.isInteger(floorIndex) || floorIndex < 0)) throw new RangeError('Pavimento da unidade inválido.');
  // A planta tem a fachada em -Z (canto, varanda em cima) ou em -X (meio): o yaw leva a fachada real até ela.
  // Finais espelhados usam a planta sem espelho: a fachada fica certa, esquerda e direita trocam.
  const typology = unit.typology ?? unit.relation?.typology;
  const facing = AXES[side], plan = typology === 'meio' ? [-1, 0] : [0, -1];
  const yaw = Math.atan2(plan[1], plan[0]) - Math.atan2(facing[1], facing[0]);
  return { unitId, side, final, floorIndex, yaw, approximate: true };
}

export function interiorSunDirection(direction, context) {
  const yaw = context?.yaw;
  boundedNumber(yaw, -Infinity, Infinity, 'Rotação da unidade');
  return rotateY(direction, -yaw);
}

/** Potencial direto na normal da fachada, sem sombras de sacadas ou vizinhos. */
export function facadeExposure(direction, side) {
  const [x, y, z] = vector(direction);
  const facing = AXES[side];
  if (!facing) throw new RangeError('Lado da fachada inválido.');
  return y <= 0 ? 0 : clamp(x * facing[0] + z * facing[1]);
}

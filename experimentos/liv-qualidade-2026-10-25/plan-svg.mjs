const xml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const rect = (x, y, w, h, fill, radius = .03) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;

function furniture(item) {
  const { w, d, tipo } = item;
  let detail = '', fill = '#c5b196';
  if (tipo === 'tapete') fill = '#d9d3c4';
  else if (tipo === 'cama') {
    fill = '#f5f1e8';
    detail = rect(-w / 2 + .04, -d / 2 + d * .33, w - .08, d * .62, '#9aaca0', .05)
      + rect(-w / 2 + .08, -d / 2 + .1, w * .38, .38, '#fffdf7', .07)
      + (w > 1.1 ? rect(w * .06, -d / 2 + .1, w * .38, .38, '#fffdf7', .07) : '')
      + `<path d="M${-w / 2 + .04} ${d * .18}h${w - .08}" stroke="#7b9587" stroke-width=".025"/>`;
  } else if (tipo === 'sofa') {
    fill = '#a7b3ae';
    detail = rect(-w / 2 + .12, -d / 2 + .16, w - .24, d - .28, '#bdc8c1', .08)
      + `<path d="M0 ${-d / 2 + .17}v${d - .3}" stroke="#84938b" stroke-width=".02"/>`;
  } else if (tipo === 'pia') {
    fill = '#dbd8cc';
    detail = rect(-w * .2, -d * .28, w * .4, d * .55, '#a8b4b4', .09);
  } else if (tipo === 'vaso') {
    fill = '#faf9f4'; detail = `<ellipse cx="0" cy=".04" rx="${w * .31}" ry="${d * .28}" fill="#e2e5df"/>`;
  } else if (tipo === 'fogao') {
    fill = '#68716e';
    detail = [-1, 1].flatMap(x => [-1, 1].map(y => `<circle cx="${x * w * .22}" cy="${y * d * .22}" r=".075" fill="#343d39" stroke="#b1b7af" stroke-width=".015"/>`)).join('');
  } else if (tipo === 'box') fill = '#cddbd6';
  else if (tipo === 'geladeira' || tipo === 'maquina') fill = '#d8ddda';
  return `<g transform="translate(${item.p.join(' ')}) rotate(${(item.rot || 0) * 90})" stroke="#807b6b" stroke-width=".012">${rect(-w / 2, -d / 2, w, d, fill, tipo === 'sofa' ? .1 : .035)}${detail}</g>`;
}

export function planSVG(unit) {
  const plan = unit.planta;
  if (!plan?.comodos?.length || plan.comodos.some(room => !room.poly?.length)) throw Error('Planta sem polígonos registrados.');
  const points = plan.comodos.flatMap(room => room.poly);
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  const viewBox = [minX - .7, minY - .7, maxX - minX + 1.4, maxY - minY + 1.4].join(' ');
  const rooms = plan.comodos.map(room => `<polygon points="${room.poly.map(p => p.join(',')).join(' ')}" fill="url(#${/suíte|dormitório/i.test(room.nome) ? 'wood' : 'tile'})"/>`).join('');
  const walls = plan.comodos.map(room => `<polygon points="${room.poly.map(p => p.join(',')).join(' ')}" fill="none" stroke="#535c53" stroke-width=".13" stroke-linejoin="miter"/>`).join('');
  const openings = [...(plan.portas || []), ...(plan.janelas || [])].map(opening => {
    const vertical = /east|west$/.test(opening.wallId), [x, y] = opening.p, half = opening.largura / 2;
    const door = plan.portas.includes(opening);
    const a = vertical ? [x, y - half] : [x - half, y], b = vertical ? [x, y + half] : [x + half, y];
    let result = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${door ? '#efede5' : '#a4c1bb'}" stroke-width=".145"/>`;
    if (door && opening.largura < 1) {
      const end = vertical ? [x + opening.largura, y - half] : [x - half, y - opening.largura];
      result += `<path d="M${b.join(' ')} A${opening.largura} ${opening.largura} 0 0 0 ${end.join(' ')} L${a.join(' ')}" fill="none" stroke="#a39880" stroke-width=".018"/>`;
    }
    return result;
  }).join('');
  const labels = plan.comodos.map(room => {
    const xs = room.poly.map(p => p[0]), ys = room.poly.map(p => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = Math.max(...ys) - .22;
    const label = room.nome.replace('Dormitório 01', 'Dormitório').replace('Varanda / serviço', 'Varanda');
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-size=".14" font-weight="500" fill="#344639" stroke="#f6f3e9" stroke-width=".055" paint-order="stroke">${xml(label)}</text>`;
  }).join('');
  const pieces = [...plan.moveis].sort((a, b) => (a.h || 0) - (b.h || 0)).map(furniture).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc"><title id="title">${xml(unit.ficha.titulo)} — estudo vetorial</title><desc id="desc">Planta ilustrativa derivada dos mesmos polígonos do modelo 3D. Medidas inferidas.</desc><defs><pattern id="wood" width=".76" height=".14" patternUnits="userSpaceOnUse"><rect width=".76" height=".14" fill="#d6c3a4"/><path d="M0 .14H.76 M.76 0V.14 M0 .065H.76" stroke="#bba789" stroke-width=".008" opacity=".55"/></pattern><pattern id="tile" width=".58" height=".58" patternUnits="userSpaceOnUse"><rect width=".58" height=".58" fill="#ece9df"/><path d="M0 .58H.58V0" fill="none" stroke="#d8d6c9" stroke-width=".012"/></pattern></defs>${rooms}${pieces}${walls}${openings}${labels}</svg>`;
}

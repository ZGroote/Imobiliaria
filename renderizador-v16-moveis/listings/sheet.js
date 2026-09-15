/* Listing sheet content: fills the property card from the unit record. */
(function(root) {
  "use strict";
  function create({$, esc, brl, cidade:CIDADE, sheet:usheet}) {
const m2 = v => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " m\u00b2";

// A area de um comodo sai do cadastro quando ele a traz; quando nao, do POLIGONO (a
// formula do laco), que e o mesmo contorno que vira parede na visita 3D. Assim a
// metragem da ficha nunca contradiz o que se anda la dentro.
function areaDoComodo(c) {
  if (typeof c.area === "number" && c.area > 0) return c.area;
  const p = c.poly || [];
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(s) / 2;
}

function preenche(u, confirmado) {
  const f = u.ficha || {}, pl = u.planta || {}, com = pl.comodos || [];
  const nome = (f.empreendimento && f.empreendimento !== "\u2014")
    ? f.empreendimento : (f.titulo || u.id);
  $("uTag").textContent = f.preco ? (f.tipo === "aluguel" ? "Para alugar" : "\u00c0 venda")
                                  : "Planta 3D";
  $("uName").textContent = nome;
  $("uAddr").textContent = [f.bairro, f.municipio || (CIDADE.nome + "/" + CIDADE.uf),
    u.andar ? u.andar + "\u00ba andar" : null].filter(Boolean).join(" \u00b7 ");
  // O aviso do item da vitrine repetido aqui de proposito: a ficha e onde se decide
  // entrar, e entrar num predio errado e o erro caro.
  $("uAviso").hidden = !!confirmado;
  $("uAviso").textContent = u.lote
    ? "Terreno ainda não confirmado"
    : "Prédio ainda não confirmado";

  const medida = com.reduce((a, c) => a + areaDoComodo(c), 0);
  const st = [];
  if (f.preco) st.push(["Pre\u00e7o", brl(f.preco) + (f.tipo === "aluguel" ? "/m\u00eas" : "")]);
  if (f.area_util) st.push(["\u00c1rea \u00fatil", m2(f.area_util)]);
  else if (medida) st.push(["\u00c1rea medida", m2(medida)]);
  if (f.area_total && f.area_total !== f.area_util) st.push(["\u00c1rea total", m2(f.area_total)]);
  if (f.quartos != null) st.push(["Quartos", f.quartos]);
  if (f.suites) st.push(["Su\u00edtes", f.suites]);
  if (f.banheiros != null) st.push(["Banheiros", f.banheiros]);
  if (f.vagas != null) st.push(["Vagas", f.vagas]);
  if (pl.pe_direito) st.push(["P\u00e9-direito", String(pl.pe_direito).replace(".", ",") + " m"]);
  $("uStats").innerHTML = st.map(r =>
    "<div>" + esc(r[0]) + "<b>" + esc(r[1]) + "</b></div>").join("");

  // Comodo repetido ganha numero. "Banho" duas vezes na lista parece erro de
  // transcricao; "Banho 1 / Banho 2" e a planta dizendo que sao dois.
  const quantos = {};
  for (const c of com) quantos[c.nome] = (quantos[c.nome] || 0) + 1;
  const visto = {};
  $("uNCom").textContent = com.length
    ? com.length + " \u00b7 " + m2(medida) + " de piso"
    : "sem planta";
  $("uCom").innerHTML = com.map(c => {
    visto[c.nome] = (visto[c.nome] || 0) + 1;
    const nm = c.nome + (quantos[c.nome] > 1 ? " " + visto[c.nome] : "");
    return '<div class="ci"><span>' + esc(nm) + "</span><b>" +
           esc(m2(areaDoComodo(c))) + "</b></div>";
  }).join("");
  usheet.querySelector(".comodos").hidden = !com.length;
  $("uEnter").hidden = !com.length;
}

    return {m2, areaDoComodo, preenche};
  }
  root.ListingSheet = Object.freeze({create});
})(globalThis);

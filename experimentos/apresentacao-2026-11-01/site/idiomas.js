(() => {
  "use strict";
  const key = "conecta-idioma-v1";
  const origins = { "pt-BR": "https://conectaimoveis3d.com.br/", en: "https://conectaimoveis3d.com/" };
  const production = new Set([
    "conectaimoveis3d.com.br", "www.conectaimoveis3d.com.br", "conectaimoveis3d.com", "www.conectaimoveis3d.com",
    "imobilaria-deccb-global.web.app", "imobilaria-deccb-global.firebaseapp.com",
    "imobilaria-deccb-miniaturas.web.app", "imobilaria-deccb-miniaturas.firebaseapp.com",
  ]);
  function locale(value) {
    if (/^en(?:-|$)/i.test(value || "")) return "en";
    if (/^pt(?:-|$)/i.test(value || "")) return "pt-BR";
    return null;
  }
  function languageUrl(language, current) {
    if (!Object.prototype.hasOwnProperty.call(origins, language)) throw new TypeError("Idioma inválido.");
    const from = new URL(current);
    const target = production.has(from.hostname) ? new URL(origins[language]) :
      new URL(language === "en" ? "index.en.html" : "index.html", from);
    target.searchParams.set("lang", language);
    target.hash = from.hash;
    return target.href;
  }
  function recommendation(region, selected) {
    if (selected) return locale(selected);
    if (region?.country === "BR" && region.locale === "pt-BR") return "pt-BR";
    if (region?.country === null && region.locale === "en") return "en";
    return null;
  }
  window.ConectaIdiomas = Object.freeze({ languageUrl, recommendation });
  const current = locale(document.documentElement.lang) || "pt-BR";
  const page = new URL(location.href);
  const explicit = locale(page.searchParams.get("lang"));
  const remember = language => {
    try { localStorage.setItem(key, language); } catch { /* A escolha pelo link continua funcionando. */ }
  };
  let selected = null;
  try { selected = locale(localStorage.getItem(key)); } catch { /* Armazenamento é opcional. */ }
  if (explicit === current) { selected = current; remember(current); }
  document.querySelectorAll("[data-idioma]").forEach(link => {
    const language = link.dataset.idioma;
    if (!Object.prototype.hasOwnProperty.call(origins, language)) return;
    link.href = languageUrl(language, location.href);
    if (language === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    link.addEventListener("click", () => remember(language));
  });
  const box = document.querySelector(".idioma-sugestao");
  if (!box || selected === current) return;
  function suggest(language) {
    if (!language || language === current) return;
    const portuguese = language === "pt-BR";
    box.lang = language;
    box.querySelector("p").textContent = portuguese ? "Prefere navegar em português?" : "Would you prefer English?";
    const accept = box.querySelector("a");
    accept.href = languageUrl(language, location.href);
    accept.textContent = portuguese ? "Continuar em português" : "Continue in English";
    accept.addEventListener("click", () => remember(language));
    const stay = box.querySelector("button");
    stay.textContent = portuguese ? "Manter em inglês" : "Stay in Portuguese";
    stay.addEventListener("click", () => { remember(current); box.hidden = true; });
    box.hidden = false;
  }
  if (selected) { suggest(selected); return; }
  // O Hosting escolhe este JSON pelo país do IP. A consulta nunca bloqueia a maquete.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  fetch(new URL("region.json", location.href), { cache: "no-store", signal: controller.signal })
    .then(response => response.ok ? response.json() : null)
    .then(region => suggest(recommendation(region, null)))
    .catch(() => {})
    .finally(() => clearTimeout(timer));
})();

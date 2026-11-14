const $ = selector => document.querySelector(selector);
const query = new URLSearchParams(location.search);
const state = { mode: ['maquete', 'planta2d', 'planta3d'].includes(query.get('modo')) ? query.get('modo') : 'maquete',
  type: query.get('tipologia') === 'meio' ? 'meio' : 'canto', enhanced: query.get('qualidade') !== 'atual' };
let frame, api, serial = 0, planSerial = 0, timer, zoom = 1, pan = [0, 0], pointer, lowWalls = false;
const host = $('#scene-host'), loading = $('#loading'), image = $('#plan-image');
const headings = { maquete: ['01 / VOLUMETRIA', 'O projeto, por inteiro.'], planta3d: ['02 / ESPAÇOS', 'Entre luz, forma e matéria.'], planta2d: ['03 / PLANTA', 'Cada espaço, em detalhe.'] };

function controls() {
  const is2D = state.mode === 'planta2d', isExterior = state.mode === 'maquete';
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  for (const button of document.querySelectorAll('[data-type]')) button.setAttribute('aria-pressed', String(button.dataset.type === state.type));
  $('#original').setAttribute('aria-pressed', String(!state.enhanced)); $('#enhanced').setAttribute('aria-pressed', String(state.enhanced));
  $('#typology-setting').hidden = isExterior;
  $('#appearance-title').firstChild.textContent = isExterior ? '02 ' : '03 ';
  $('#area').textContent = `${state.type === 'canto' ? '47,59' : '47,50 a 47,89'} m² · 2 quartos · 1 suíte`;
  $('#scene-index').textContent = headings[state.mode][0]; $('#scene-title').textContent = headings[state.mode][1];
  $('#profile-badge').textContent = state.enhanced ? 'ESTUDO GRÁFICO' : 'APARÊNCIA ATUAL';
  $('#treatment-note').textContent = is2D ? 'Estudo vetorial com linhas contínuas, mobiliário e texturas de piso. Compare com a imagem comercial.'
    : state.enhanced ? 'Iluminação de estúdio, reflexos suaves e sombras de contato.' : 'Materiais e luz atuais. As duas aparências compartilham a resolução das sombras.';
  for (const id of ['aerial', 'facade']) $('#' + id).hidden = !isExterior;
  $('#low-walls').hidden = isExterior || is2D;
  $('#low-walls').setAttribute('aria-pressed', String(lowWalls));
  for (const id of ['zoom-out', 'zoom-in']) $('#' + id).hidden = !is2D;
  $('#instruction').textContent = is2D ? 'Role para ampliar · arraste para explorar' : 'Arraste para girar · role para aproximar';
  host.hidden = is2D; $('#plan-host').hidden = !is2D;
  const params = new URLSearchParams({ modo: state.mode, tipologia: state.type, qualidade: state.enhanced ? 'estudio' : 'atual' });
  history.replaceState(null, '', '?' + params);
}
function status(ready) {
  $('#ready-dot').dataset.ready = String(ready);
  if (!ready) { $('#render-status').textContent = 'Carregando o estudo'; return; }
  const quality = api?.quality?.getState();
  const diagnostics = $('#render-status').dataset;
  diagnostics.backend = api?.backend || 'svg';
  diagnostics.contact = String(Boolean(quality?.contact));
  diagnostics.pixelRatio = String(quality?.pixelRatio || 1);
  diagnostics.error = quality?.effectError || '';
  diagnostics.backendError = JSON.stringify(api?.backendError || null);
  diagnostics.models = JSON.stringify(quality?.models || null);
  diagnostics.surfaces = JSON.stringify(quality?.surfaces || null);
  $('#render-status').textContent = state.mode === 'planta2d' ? (state.enhanced ? 'Desenho vetorial · nitidez em qualquer zoom' : 'Imagem comercial original')
    : state.enhanced ? (quality?.contact ? 'Luz de estúdio · sombras de contato' : 'Luz de estúdio · materiais refinados') : 'Aparência atual · comparação';
}
function planTransform() { image.style.transform = `translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`; }
async function showPlan(token) {
  const planToken = ++planSerial;
  zoom = 1; pan = [0, 0]; planTransform();
  image.alt = `LIV Ipanema · planta de ${state.type} · ${state.enhanced ? 'estudo vetorial ilustrativo' : 'imagem comercial'}`;
  image.src = state.enhanced ? `${state.type}.svg` : `runtime/plantas2d/${state.type}.jpg`;
  if (!state.enhanced) image.style.maskImage = `url(runtime/plantas2d/${state.type}-recorte.svg)`;
  else image.style.maskImage = 'none';
  image.style.maskSize = 'contain'; image.style.maskRepeat = 'no-repeat'; image.style.maskPosition = 'center';
  try { await image.decode(); }
  catch (error) { if (planToken !== planSerial || token !== serial) return; throw error; }
  if (token !== serial || planToken !== planSerial) return;
  loading.hidden = true; status(true);
}
async function release() {
  clearTimeout(timer);
  const previous = frame, previousAPI = api; frame = null; api = null;
  if (previousAPI?.dispose) {
    // Aguarde a liberação antes de criar outro contexto gráfico.
    try { await previousAPI.dispose(); } catch (error) { console.warn('Liberação da prévia:', error); }
  }
  previous?.remove();
}
function failure(message) {
  $('#load-text').textContent = message; loading.hidden = false;
  $('.loading-ring').hidden = true;
  if (!$('.error-retry')) {
    const retry = document.createElement('button'); retry.className = 'error-retry'; retry.textContent = 'Tentar novamente';
    retry.onclick = () => load(); loading.append(retry);
    const fallback = document.createElement('a'); fallback.className = 'error-source'; fallback.href = '?modo=planta2d'; fallback.textContent = 'Abrir planta 2D'; loading.append(fallback);
  }
}
async function load() {
  const token = ++serial; controls(); loading.hidden = false; status(false);
  $('.loading-ring').hidden = false; $('#load-text').textContent = 'Preparando luz e materiais…';
  $('.error-retry')?.remove(); $('.error-source')?.remove();
  await release(); if (token !== serial) return;
  if (state.mode === 'planta2d') { try { await showPlan(token); } catch { failure('Não foi possível carregar a planta.'); } return; }
  frame = document.createElement('iframe'); frame.title = state.mode === 'maquete' ? 'Maquete do LIV Ipanema' : `Planta 3D de ${state.type}`;
  const params = new URLSearchParams({ embed: '1', backend: query.get('backend') || 'auto', qualidade: state.enhanced ? 'estudio' : 'atual' });
  if (state.mode === 'maquete') { params.set('geometria', 'entrada'); params.set('ambiente', 'precalculado'); }
  else { params.set('tipologia', state.type); params.set('modo', 'planta3d'); }
  frame.src = `runtime/${state.mode === 'maquete' ? 'prova-rgbm' : 'interior'}.html?${params}`;
  host.append(frame); const started = performance.now();
  function inspect() {
    if (token !== serial) return;
    try {
      api = state.mode === 'maquete' ? frame.contentWindow.__livProva : frame.contentWindow.__livInterior;
      if (api?.error) {
        $('#render-status').dataset.backendError = JSON.stringify(api.backendError || null);
        $('#render-status').textContent = 'Visualizador interrompido';
        failure('O visualizador não pôde abrir: ' + api.error); return;
      }
      if (api?.ready) {
        if (!loading.hidden) {
          api.quality.setEnabled(state.enhanced);
          if (lowWalls && state.mode === 'planta3d') frame.contentDocument.querySelector('#cut-interior')?.click();
        }
        loading.hidden = true; status(true); timer = setTimeout(inspect, 1000); return;
      }
      $('#load-text').textContent = api?.progress?.message || 'Preparando luz e materiais…';
    } catch { /* O iframe ainda está entre a página vazia e o documento local. */ }
    if (performance.now() - started > 120_000) { failure('O carregamento demorou mais que o esperado. Tente novamente ou abra a planta 2D.'); return; }
    timer = setTimeout(inspect, 150);
  }
  inspect();
}
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => { if (state.mode === button.dataset.mode) return; state.mode = button.dataset.mode; load(); };
for (const button of document.querySelectorAll('[data-type]')) button.onclick = () => { if (state.type === button.dataset.type) return; state.type = button.dataset.type; load(); };
for (const [id, enhanced] of [['original', false], ['enhanced', true]]) $('#' + id).onclick = async () => {
  state.enhanced = enhanced; controls();
  if (state.mode === 'planta2d') { try { await showPlan(serial); } catch { failure('Não foi possível carregar a planta.'); } }
  else if (api?.ready) { api.quality.setEnabled(enhanced); status(true); }
};
$('#reset').onclick = () => {
  if (state.mode === 'planta2d') { zoom = 1; pan = [0, 0]; planTransform(); }
  else if (api?.ready) { if (state.mode === 'maquete') api.setView('perspectiva'); else frame.contentDocument.querySelector('#frame-interior')?.click(); }
};
$('#aerial').onclick = () => { if (api?.ready) api.setView('implantacao'); };
$('#facade').onclick = () => { if (api?.ready) api.setView('fachada'); };
$('#low-walls').onclick = () => { if (!api?.ready) return; frame.contentDocument.querySelector('#cut-interior')?.click(); lowWalls = !lowWalls; controls(); };
function setZoom(value) { zoom = Math.max(1, Math.min(5, value)); if (zoom === 1) pan = [0, 0]; planTransform(); }
$('#zoom-in').onclick = () => setZoom(zoom * 1.25); $('#zoom-out').onclick = () => setZoom(zoom / 1.25);
$('#plan-host').addEventListener('wheel', event => { event.preventDefault(); setZoom(zoom * Math.exp(-event.deltaY * .001)); }, { passive: false });
$('#plan-host').addEventListener('pointerdown', event => { pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: [...pan] }; event.currentTarget.setPointerCapture(event.pointerId); });
$('#plan-host').addEventListener('pointermove', event => { if (pointer?.id !== event.pointerId || zoom === 1) return; pan = [pointer.pan[0] + event.clientX - pointer.x, pointer.pan[1] + event.clientY - pointer.y]; planTransform(); });
$('#plan-host').addEventListener('pointerup', () => { pointer = null; }); $('#plan-host').addEventListener('pointercancel', () => { pointer = null; });
document.addEventListener('visibilitychange', () => { if (api?.ready) api.setActive?.(!document.hidden); });
window.addEventListener('pagehide', () => { clearTimeout(timer); api?.dispose?.(); });
window.__livStudio = { state, get api() { return api; } };
load();

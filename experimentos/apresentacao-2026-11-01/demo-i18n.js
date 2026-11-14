// Presentation-only copy. This layer changes DOM labels, never the viewer state or assets.
const phrases = [
  ['Maquete interativa', 'Interactive building model'],
  ['Maquete exterior do', 'Exterior building model of'],
  ['Arraste para olhar · use o teclado ou o controle na tela para caminhar', 'Drag to look around · use the keyboard or on-screen controls to walk'],
  ['Arraste para olhar · WASD ou setas para caminhar', 'Drag to look around · use WASD or the arrow keys to walk'],
  ['Arraste para girar · use a roda ou dois dedos para aproximar', 'Drag to rotate · scroll or pinch to zoom'],
  ['Arraste para girar · dois dedos ou roda para aproximar', 'Drag to rotate · pinch or scroll to zoom'],
  ['Selecione um apartamento · arraste para girar', 'Select an apartment · drag to rotate'],
  ['Marque dois pontos. Perto de cantos e paredes, a régua encaixa automaticamente. Medidas aproximadas.', 'Mark two points. The ruler snaps to nearby corners and walls. Measurements are approximate.'],
  ['Marque outros dois pontos para medir novamente. Medida aproximada.', 'Mark two more points to measure again. Approximate measurement.'],
  ['Escolha um segundo ponto diferente do primeiro.', 'Choose a second point different from the first.'],
  ['Primeiro ponto marcado', 'First point marked'],
  ['no canto da parede', 'at the wall corner'],
  ['na parede', 'on the wall'],
  ['Marque o segundo ponto.', 'Mark the second point.'],
  ['Marque mais dois pontos.', 'Mark two more points.'],
  ['Toque em dois pontos', 'Tap two points'],
  ['Setas movem o cursor · Enter marca · Esc cancela o ponto', 'Arrow keys move the cursor · Enter marks a point · Esc cancels it'],
  ['Planta 2D: use + e − para ampliar e as setas para mover.', '2D floorplan: use + and − to zoom and the arrow keys to pan.'],
  ['Dimensões aproximadas dos ambientes, entre eixos das paredes', 'Approximate room dimensions, measured between wall centerlines'],
  ['Estimativas entre eixos das paredes, inferidas a partir da planta ilustrativa.', 'Estimates between wall centerlines, inferred from the illustrative floorplan.'],
  ['Mostrar ou ocultar medidas aproximadas', 'Show or hide approximate measurements'],
  ['Mostrar medidas estimadas da planta 2D', 'Show estimated 2D floorplan measurements'],
  ['Ocultar medidas estimadas da planta 2D', 'Hide estimated 2D floorplan measurements'],
  ['Medir entre dois pontos na planta 2D', 'Measure between two points on the 2D floorplan'],
  ['Desfazer última medida', 'Undo the last measurement'],
  ['Limpar todas as medidas', 'Clear all measurements'],
  ['Aumentar zoom da planta 2D', 'Zoom in on the 2D floorplan'],
  ['Diminuir zoom da planta 2D', 'Zoom out of the 2D floorplan'],
  ['Zoom da planta 2D', '2D floorplan zoom'],
  ['Encerrar régua', 'Finish measuring'],
  ['Medidas aproximadas', 'Approximate measurements'],
  ['Medida aproximada', 'Approximate measurement'],
  ['Medidas', 'Measurements'],
  ['Régua', 'Ruler'],
  ['Desfazer', 'Undo'],
  ['Limpar', 'Clear'],
  ['Concluir', 'Done'],
  ['Centralizar', 'Center view'],
  ['Enquadrar', 'Fit to view'],
  ['Alternar paredes baixas e inteiras na Planta 3D', 'Switch between cutaway and full-height walls in the 3D floorplan'],
  ['Paredes inteiras', 'Full-height walls'],
  ['Paredes baixas', 'Cutaway walls'],
  ['Ajustar horário do sol', 'Adjust the sun time'],
  ['Horário do sol', 'Sun time'],
  ['posição solar pela localização e implantação aproximada do prédio', 'sun position based on the building’s approximate location and orientation'],
  ['Noite · luzes acesas', 'Night · lights on'],
  ['Anoitecer · luzes acendendo', 'Dusk · lights turning on'],
  ['Luz ilustrativa', 'Illustrative lighting'],
  ['Amanhecer', 'Dawn'],
  ['Anoitecer', 'Dusk'],
  ['Noite', 'Night'],
  ['Dia', 'Day'],
  ['Sol', 'Sun'],
  ['Ir ao ambiente selecionado', 'Go to the selected room'],
  ['Ir ao ambiente', 'Go to room'],
  ['passagem bloqueada', 'passage blocked'],
  ['bloqueado', 'blocked'],
  ['Abrir porta', 'Open door'],
  ['Fechar porta', 'Close door'],
  ['Entrada do apartamento', 'Apartment entrance'],
  ['Interior tridimensional do apartamento', '3D apartment interior'],
  ['Sala, cozinha, banheiros e varanda com área de serviço.', 'Living room, kitchen, bathrooms and a balcony with a utility area.'],
  ['Controles do interior', 'Interior controls'],
  ['Controles da planta', 'Floorplan controls'],
  ['Controles da visualização', 'View controls'],
  ['Ambiente', 'Room'],
  ['Caminhar', 'Walk'],
  ['Avançar', 'Move forward'],
  ['Recuar', 'Move backward'],
  ['Mover à esquerda', 'Move left'],
  ['Mover à direita', 'Move right'],
  ['Sala e jantar', 'Living / dining room'],
  ['Sala de estar', 'Living room'],
  ['Sala integrada', 'Living / dining room'],
  ['Sala TV · trecho', 'Living area'],
  ['Cozinha/jantar · trecho', 'Kitchen / dining area'],
  ['Cozinha · faixa', 'Kitchen area'],
  ['Jantar · trecho', 'Dining area'],
  ['Suíte · quarto', 'Primary bedroom'],
  ['Banho suíte', 'En suite bathroom'],
  ['Banho social', 'Bathroom'],
  ['Varanda/serviço', 'Balcony / utility area'],
  ['Varanda / serviço', 'Balcony / utility area'],
  ['Área de serviço', 'Utility area'],
  ['2 quartos (1 suíte)', '2 bedrooms (1 en suite)'],
  ['Suíte', 'Primary bedroom'],
  ['Dormitório', 'Bedroom'],
  ['Banheiros', 'Bathrooms'],
  ['Banheiro', 'Bathroom'],
  ['Banho', 'Bathroom'],
  ['Quartos', 'Bedrooms'],
  ['Quarto', 'Bedroom'],
  ['Cozinha', 'Kitchen'],
  ['Varanda', 'Balcony'],
  ['Sala', 'Living room'],
  ['Jantar', 'Dining room'],
  ['Corredor', 'Hallway'],
  ['Ir para o visualizador', 'Skip to the viewer'],
  ['Visualizador do empreendimento', 'Property viewer'],
  ['Opções de exploração', 'Explore options'],
  ['Navegação da maquete', 'Building model navigation'],
  ['Orientação preferida da maquete', 'Preferred model orientation'],
  ['Mais espaço na horizontal.', 'More room in landscape.'],
  ['Horizontal', 'Landscape'],
  ['Vertical', 'Portrait'],
  ['Informações do empreendimento', 'Property information'],
  ['Informações do apartamento', 'Apartment details'],
  ['Apartamento selecionado', 'Selected apartment'],
  ['Nenhum apartamento selecionado.', 'No apartment selected.'],
  ['Conhecer o apartamento selecionado', 'Explore the selected apartment'],
  ['Visualizações do apartamento selecionado', 'Views of the selected apartment'],
  ['Informações sobre este apartamento', 'About this apartment'],
  ['Conversar sobre este apartamento', 'Discuss this apartment'],
  ['Mensagem sobre o apartamento para copiar', 'Apartment enquiry to copy'],
  ['Conversar pelo WhatsApp sobre o', 'Discuss via WhatsApp:'],
  ['em nova aba', 'in a new tab'],
  ['Atendimento com', 'Contact'],
  ['Compartilhe a mensagem com seu corretor.', 'Share this message with your agent.'],
  ['Copiar interesse no', 'Copy enquiry about'],
  ['Mensagem copiada. Envie ao seu corretor.', 'Message copied. Send it to your agent.'],
  ['Selecione e copie a mensagem abaixo para enviar ao seu corretor.', 'Select and copy the message below to send it to your agent.'],
  ['Ficha do apartamento', 'Apartment details'],
  ['Ficha completa', 'Full details'],
  ['Expandir informações', 'Expand details'],
  ['Recolher informações', 'Collapse details'],
  ['Fechar informações', 'Close details'],
  ['Situação e preço', 'Availability and price'],
  ['Número e vaga', 'Apartment number and parking'],
  ['Quartos / banheiros', 'Bedrooms / bathrooms'],
  ['Número não informado', 'Number not provided'],
  ['vaga não informada', 'Parking not provided'],
  ['Não informados', 'Not provided'],
  ['Não informada', 'Not provided'],
  ['Disponibilidade e preço a confirmar', 'Availability and price to be confirmed'],
  ['Disponibilidade em atualização. Confirme com a equipe.', 'Availability is being updated. Please confirm with the team.'],
  ['Disponibilidade ainda não informada.', 'Availability has not been provided yet.'],
  ['Nenhum apartamento cadastrado como disponível.', 'No apartments are listed as available.'],
  ['Ver disponibilidade', 'Show availability'],
  ['Ocultar disponibilidade', 'Hide availability'],
  ['Todos os apartamentos', 'All apartments'],
  ['Disponíveis (em verde)', 'Available (in green)'],
  ['selecione para destacar', 'select to highlight'],
  ['2 toques abrem a planta', '2 taps open the floorplan'],
  ['toque para ver a ficha', 'tap to view details'],
  ['em verde', 'in green'],
  ['preço sob consulta', 'price on request'],
  ['Sob consulta', 'On request'],
  ['Disponíveis', 'Available'],
  ['Disponível', 'Available'],
  ['Reservada', 'Reserved'],
  ['Vendida', 'Sold'],
  ['Bloqueada', 'Unavailable'],
  ['A confirmar', 'To be confirmed'],
  ['Em conferência', 'Under review'],
  ['Lado do estacionamento', 'Parking side'],
  ['Lado do lazer', 'Amenities side'],
  ['Posição', 'Position'],
  ['Área', 'Area'],
  ['Vagas', 'Parking spaces'],
  ['Vaga', 'Parking space'],
  ['Apartamento', 'Apartment'],
  ['Apartamentos', 'Apartments'],
  ['selecionado, posição aproximada', 'selected, approximate position'],
  ['selecionado', 'selected'],
  ['Planta de referência', 'Reference floorplan'],
  ['Planta comercial de referência', 'Reference marketing floorplan'],
  ['Planta comercial publicada', 'Published marketing floorplan'],
  ['Planta de canto', 'Corner floorplan'],
  ['Planta de meio', 'Middle floorplan'],
  ['Planta Canto', 'Corner floorplan'],
  ['Planta Meio', 'Middle floorplan'],
  ['Referência de canto', 'Corner reference'],
  ['Referência de meio', 'Middle reference'],
  ['Planta do apartamento', 'Apartment floorplan'],
  ['Planta e Tour do', 'Floorplan and walkthrough of'],
  ['Planta e Tour', 'Floorplan and walkthrough'],
  ['Planta 2D', '2D floorplan'],
  ['Planta 3D', '3D floorplan'],
  ['Ver planta 2D', 'View 2D floorplan'],
  ['Ver planta', 'View floorplan'],
  ['Ver em 3D', 'View in 3D'],
  ['Tour 3D', '3D walkthrough'],
  ['Entrar no apartamento · Tour 3D', 'Enter the apartment · 3D walkthrough'],
  ['interior ilustrativo, com medidas inferidas', 'illustrative interior with inferred measurements'],
  ['Interior ilustrativo · medidas inferidas a partir das plantas publicadas.', 'Illustrative interior · measurements inferred from the published floorplans.'],
  ['interior ilustrativo', 'illustrative interior'],
  ['ilustração aproximada', 'approximate illustration'],
  ['de área publicada', 'published area'],
  ['incluindo varanda', 'including the balcony'],
  ['sem vínculo com uma unidade específica.', 'not linked to a specific apartment.'],
  ['associada ao final', 'linked to unit suffix'],
  ['pelo cadastro fornecido', 'using the supplied records'],
  ['associada pelo cadastro fornecido.', 'linked using the supplied records.'],
  ['O 3D/Tour é ilustrativo, com medidas inferidas.', 'The 3D walkthrough is illustrative, with inferred measurements.'],
  ['Conferindo a planta deste apartamento…', 'Checking this apartment’s floorplan…'],
  ['A planta deste apartamento está em conferência. Consulte a equipe para confirmar.', 'This apartment’s floorplan is under review. Please confirm with the team.'],
  ['Origem dos dados', 'Data source'],
  ['Posição aproximada, conforme a ordem da implantação.', 'Approximate position based on the site layout.'],
  ['Associação informada por', 'Association supplied by'],
  ['Fonte:', 'Source:'],
  ['Valores ilustrativos, só para demonstração', 'Illustrative prices, for demonstration only'],
  ['Tabela ilustrativa', 'Illustrative price list'],
  ['demonstração', 'demo'],
  ['Quintal do térreo: limites e área deste final em conferência.', 'Ground-floor patio: boundaries and area for this unit suffix are under review.'],
  ['Térreo', 'Ground floor'],
  ['andares', 'floors'],
  ['Demonstração · dados fictícios para teste visual.', 'Demo · fictional data for visual testing.'],
  ['Usar versão anterior', 'Use the previous version'],
  ['Empreendimento · demonstração', 'Property · demo'],
  ['Base visual ilustrativa · consulte o mapa para conhecer a região.', 'Illustrative setting · explore the map to see the area.'],
  ['Abrindo a planta do apartamento…', 'Opening the apartment floorplan…'],
  ['Abrindo a maquete…', 'Opening the building model…'],
  ['Preparando visualizador…', 'Preparing the viewer…'],
  ['Preparando as visualizações…', 'Preparing the views…'],
  ['Preparação dos próximos conteúdos', 'Preparing the next views'],
  ['Visualizações prontas para reabrir.', 'Views are ready to reopen.'],
  ['Algumas visualizações serão preparadas ao abrir.', 'Some views will be prepared when opened.'],
  ['Download do recurso atual', 'Current resource download'],
  ['Preparando os gráficos', 'Preparing graphics'],
  ['Conferindo a versão da maquete', 'Checking the building model version'],
  ['Montando a maquete', 'Building the model'],
  ['Preparando o modelo', 'Preparing the model'],
  ['Preparando os reflexos', 'Preparing reflections'],
  ['Preparando a primeira imagem', 'Preparing the first view'],
  ['Maquete carregada', 'Building model loaded'],
  ['Maquete do', 'Building model of'],
  ['Baixando o modelo', 'Downloading the model'],
  ['Baixando a iluminação', 'Downloading lighting'],
  ['Baixando os acabamentos', 'Downloading finishes'],
  ['Carregando geometria e iluminação…', 'Loading geometry and lighting…'],
  ['Carregando interior…', 'Loading the interior…'],
  ['Baixando o interior selecionado…', 'Downloading the selected interior…'],
  ['Preparando os recursos do interior…', 'Preparing interior resources…'],
  ['Carregando os móveis e acabamentos aprovados…', 'Loading furniture and finishes…'],
  ['Preparando o acabamento de cor aprovado…', 'Preparing the approved color finish…'],
  ['Baixando a luz gravada do horário…', 'Downloading lighting for this time of day…'],
  ['O visualizador demorou para responder. Tente novamente.', 'The viewer took too long to respond. Please try again.'],
  ['Este navegador é antigo demais para a maquete 3D. No iPhone, atualize para o iOS 16.4 ou mais novo.', 'This browser does not support the 3D model. On iPhone, update to iOS 16.4 or later.'],
  ['O contexto gráfico foi interrompido. Tente novamente ou abra a planta 2D.', 'The graphics context was interrupted. Try again or open the 2D floorplan.'],
  ['O renderizador encontrou uma falha gráfica. Tente novamente ou abra a planta 2D.', 'The renderer encountered a graphics error. Try again or open the 2D floorplan.'],
  ['Não foi possível atualizar a tabela. As informações da fonte e data indicadas foram preservadas.', 'The price list could not be updated. The previously dated information was kept.'],
  ['Dados comerciais indisponíveis. Consulte a equipe responsável para confirmar disponibilidade e preço.', 'Sales information is unavailable. Contact the team to confirm availability and price.'],
  ['A associação de plantas não pôde ser atualizada. Os últimos vínculos validados foram mantidos.', 'Floorplan associations could not be updated. The last validated associations were kept.'],
  ['A planta deste apartamento ainda não pôde ser conferida. Consulte a equipe responsável.', 'This apartment’s floorplan could not be verified. Please contact the team.'],
  ['Não foi possível retomar esta visualização.', 'This view could not be resumed.'],
  ['Não foi possível abrir este interior.', 'This interior could not be opened.'],
  ['Visualizador indisponível', 'Viewer unavailable'],
  ['A prova 3D não pôde ser carregada.', 'The 3D view could not be loaded.'],
  ['prova isolada RGBM/TSL', 'RGBM/TSL preview'],
  ['prova do transporte de luz', 'lighting preview'],
  ['Exterior da base preservada. Comparação técnica antes da integração dos modos e unidades.', 'Preserved exterior. Technical comparison before integrating views and apartments.'],
  ['Tentar novamente com WebGL2', 'Try again with WebGL2'],
  ['Tentar com WebGL2', 'Try WebGL2'],
  ['Tentar novamente', 'Try again'],
  ['Não foi possível capturar a imagem:', 'The image could not be captured:'],
  ['Não foi possível abrir o mapa:', 'The map could not be opened:'],
  ['Voltar ao prédio', 'Back to the building'],
  ['Voltar ao site principal da Conecta', 'Back to the Conecta website'],
  ['Voltar ao site', 'Back to the website'],
  ['Voltar ao LIV', 'Back to the building'],
  ['Abrir a versão preservada', 'Open the preserved version'],
  ['Prédio', 'Building'],
  ['Maquete', 'Building model'],
  ['Planta', 'Floorplan'],
  ['Entrar', 'Enter'],
  ['ficha', 'details'],
  ['Fechar', 'Close'],
  ['Abrir', 'Open'],
  ['Fotografar PNG', 'Save a PNG'],
  ['Fotografar', 'Take a picture'],
  ['Vistas da maquete', 'Building views'],
  ['Perspectiva', 'Perspective'],
  ['Fachada', 'Facade'],
  ['Aérea', 'Aerial'],
  ['Portaria', 'Entrance'],
  ['Implantação', 'Site plan'],
  ['Varandas', 'Balconies'],
  ['Acesso de perto', 'Entrance close-up'],
  ['Acesso', 'Access'],
  ['O que tem por perto?', 'What is nearby?'],
  ['Conhecer a região', 'Explore the area'],
  ['Entorno do', 'Around'],
  ['Mapa do entorno do', 'Area map of'],
  ['limitado a', 'limited to'],
  ['Ajustar móveis', 'Adjust furniture'],
  ['Mover na planta', 'Move on the floorplan'],
  ['Mover móvel à esquerda', 'Move furniture left'],
  ['Mover móvel à direita', 'Move furniture right'],
  ['Mover móvel para frente', 'Move furniture forward'],
  ['Mover móvel para trás', 'Move furniture backward'],
  ['Móveis alterados: iluminação dinâmica.', 'Furniture changed: dynamic lighting.'],
  ['Selecione na lista ou clique em um móvel na planta. As medidas mudam sua aparência na hora.', 'Select from the list or click furniture on the floorplan. Dimensions update its appearance immediately.'],
  ['Confira a medida: largura e profundidade de 0,20 a 3,50 m; altura até o teto.', 'Check the dimensions: width and depth from 0,20 to 3,50 m; height up to the ceiling.'],
  ['Medidas aplicadas ao móvel. Clique em Concluir ao terminar.', 'Dimensions applied. Click Done when finished.'],
  ['Clique no novo lugar na planta. Arrastar continua girando a câmera.', 'Click the new position on the floorplan. Dragging still rotates the camera.'],
  ['Movimento cancelado.', 'Move cancelled.'],
  ['Móvel posicionado. Clique em Concluir ao terminar.', 'Furniture positioned. Click Done when finished.'],
  ['Escolha um ponto dentro do apartamento.', 'Choose a point inside the apartment.'],
  ['Atualizando a iluminação e as sombras do novo layout…', 'Updating lighting and shadows for the new layout…'],
  ['Atualizando luz…', 'Updating lighting…'],
  ['Concluído. Iluminação e sombras atualizadas neste navegador.', 'Done. Lighting and shadows updated in this browser.'],
  ['Não foi possível atualizar a iluminação. Suas alterações foram mantidas; tente novamente.', 'Lighting could not be updated. Your changes were kept; please try again.'],
  ['Largura', 'Width'],
  ['Profundidade', 'Depth'],
  ['Altura', 'Height'],
  ['Móvel', 'Furniture'],
  ['Girar', 'Rotate'],
  ['Restaurar', 'Reset'],
];

const exact = new Map([
  ['Canto', 'Corner'], ['Meio', 'Middle'], ['canto', 'corner'], ['meio', 'middle'],
  ['Ir ↗', 'Go ↗'], ['Ir', 'Go'], ['Tour', 'Walkthrough'],
]);
const catalog = new Map(phrases.map(([pt, en]) => [pt.toLocaleLowerCase('pt-BR'), en]));
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = new RegExp(`(^|[^\\p{L}\\p{N}_])(${[...catalog.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex).join('|')})(?=$|[^\\p{L}\\p{N}_])`, 'giu');

/** Translate UI wording while retaining names, numbers, units and the original BRL prices. */
export function translateDemoText(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  const prefix = value.match(/^\s*/)[0], suffix = value.match(/\s*$/)[0];
  let text = value.trim();
  if (exact.has(text)) return prefix + exact.get(text) + suffix;
  text = text.replace(/(\d+)º pavimento tipo/giu, 'Typical floor $1')
    .replace(/(\d+)º andar/giu, 'Floor $1')
    .replace(/\bFinal (\d+)/g, 'Unit suffix $1')
    .replace(/(^|·\s*)(Canto|Meio)(?=\s*(?:·|$))/giu, (_, lead, type) => lead + (type.toLowerCase()==='canto'?'Corner':'Middle'));
  text = text.replace(words, (_, lead, phrase) => {
    const translated = catalog.get(phrase.toLocaleLowerCase('pt-BR'));
    const lower = phrase[0] === phrase[0].toLocaleLowerCase('pt-BR');
    return lead + (lower ? translated[0].toLowerCase() + translated.slice(1) : translated);
  });
  return prefix + text + suffix;
}

export function isEnglishDemo(document, location = document?.defaultView?.location) {
  const query = new URLSearchParams(location?.search || '').get('lang');
  return /^en(?:-|$)/i.test(query || document?.documentElement?.lang || '');
}

const installations = new WeakMap();
const attributes = ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt', 'data-mobile'];
const excluded = 'script,style,noscript,template,textarea,code,pre,[translate="no"],[data-i18n-skip],.project-name,.project-address,.stage-badge';

/** Each viewer document installs its own observer; iframe URLs are managed by the host. */
export function installDemoI18n(document, location = document?.defaultView?.location) {
  if (!document?.documentElement || !isEnglishDemo(document, location)) return null;
  if (installations.has(document)) return installations.get(document);
  document.documentElement.lang = 'en';
  const MutationObserver = document.defaultView?.MutationObserver || globalThis.MutationObserver;
  let observer, stopped = false;
  const skip = element => !element || Boolean(element.closest?.(excluded));
  const text = node => {
    if (skip(node.parentElement)) return;
    // An option without an explicit value derives its value from its label.
    if (node.parentElement?.closest?.('option:not([value])')) return;
    const next = translateDemoText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  };
  const labels = element => {
    if (skip(element)) return;
    for (const name of attributes) {
      if (!element.hasAttribute?.(name)) continue;
      const current = element.getAttribute(name), next = translateDemoText(current);
      if (next !== current) element.setAttribute(name, next);
    }
  };
  const visit = node => {
    if (node.nodeType === 3) { text(node); return; }
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    if (node.nodeType === 1 && skip(node)) return;
    if (node.nodeType === 1) labels(node);
    for (const child of node.childNodes || []) visit(child);
  };
  const observe = () => observer?.observe(document.documentElement, {
    subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes,
  });
  const refresh = (nodes = [document.documentElement]) => {
    if (stopped) return;
    // Synchronous translation cannot interleave with viewer updates. Disconnecting prevents self-observation.
    observer?.disconnect();
    try { for (const node of nodes) visit(node); } finally { observe(); }
  };
  if (MutationObserver) observer = new MutationObserver(records => {
    const nodes = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) nodes.add(node);
      else nodes.add(record.target);
    }
    refresh(nodes);
  });
  const api = {language:'en', translate:translateDemoText, refresh:()=>refresh(), dispose(){stopped=true;observer?.disconnect();installations.delete(document);}};
  installations.set(document, api);
  refresh();
  return api;
}

if (typeof document !== 'undefined') globalThis.__demoI18n = installDemoI18n(document);

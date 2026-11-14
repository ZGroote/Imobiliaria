/* O formulário só encaminha ao WhatsApp; os dados não são persistidos no site. */
const menu = document.querySelector('.menu-toggle');
const navegacao = document.querySelector('#navegacao');
if (menu && navegacao) {
  menu.hidden = false;
  menu.addEventListener('click', () => {
    const aberto = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(aberto));
    navegacao.classList.toggle('aberta', aberto);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      menu.setAttribute('aria-expanded', 'false');
      navegacao.classList.remove('aberta');
      menu.focus();
    }
  });
}

const formulario = document.querySelector('#formulario-contato');
if (formulario) {
  const interesse = new URLSearchParams(window.location.search).get('plano');
  const seletor = formulario.elements.namedItem('interesse');
  if (['leve', 'premium'].includes(interesse)) seletor.value = interesse;
  formulario.addEventListener('submit', (event) => {
    event.preventDefault();
    const dados = new FormData(formulario);
    const nome = String(dados.get('nome')).trim();
    const empresa = String(dados.get('empresa')).trim();
    const mensagem = String(dados.get('mensagem')).trim();
    const campoNome = formulario.elements.namedItem('nome');
    campoNome.setCustomValidity(nome ? '' : 'Informe seu nome.');
    if (!formulario.reportValidity()) return;
    const plano = seletor.selectedOptions[0].textContent;
    const texto = [`Olá! Meu nome é ${nome}.`, empresa ? `Imobiliária/empresa: ${empresa}.` : '', `Tenho interesse em: ${plano}.`, mensagem].filter(Boolean).join('\n');
    const link = `https://wa.me/${formulario.dataset.whatsapp}?text=${encodeURIComponent(texto)}`;
    const continuar = document.querySelector('#continuar-whatsapp');
    continuar.href = link;
    document.querySelector('#mensagem-pronta').hidden = false;
    continuar.focus();
  });
  formulario.elements.namedItem('nome').addEventListener('input', (event) => event.target.setCustomValidity(''));
  formulario.addEventListener('input', () => { document.querySelector('#mensagem-pronta').hidden = true; });
  formulario.querySelector('fieldset').disabled = false;
}

const botoesVista = document.querySelectorAll('[data-vista]');
if (botoesVista.length) {
  document.querySelector('#vistas').hidden = false;
  botoesVista.forEach((botao) => botao.addEventListener('click', () => {
    botoesVista.forEach((outro) => outro.setAttribute('aria-pressed', String(outro === botao)));
    document.querySelectorAll('[data-painel]').forEach((painel) => { painel.hidden = painel.dataset.painel !== botao.dataset.vista; });
    document.querySelector('#vista-atual').textContent = botao.dataset.descricao;
  }));
}

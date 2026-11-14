/* A marca usa os mesmos recursos do institucional em todas as entradas do LIV. */
export function instalarMarcaLiv(doc) {
  const barra = doc.getElementById('experienceBar');
  if (!barra || doc.getElementById('conectaLivBrand')) return;
  const estilo = doc.createElement('link');
  estilo.rel = 'stylesheet';
  estilo.href = '/institucional/assets/marca-liv.css';
  doc.head.append(estilo);

  const marca = doc.createElement('a');
  marca.id = 'conectaLivBrand';
  marca.href = '/';
  marca.target = '_top';
  marca.setAttribute('aria-label', 'Conecta Imóveis 3D — voltar ao site principal');
  const imagem = doc.createElement('img');
  imagem.src = '/institucional/assets/marca-liv.webp';
  imagem.alt = 'Conecta Imóveis 3D — Uma nova perspectiva.';
  imagem.width = 120;
  imagem.height = 79;
  marca.append(imagem);

  const comparacao = doc.createElement('div');
  comparacao.className = 'marca-liv-comparacao';
  for (const id of ['experienceLabel', 'experienceCompare']) {
    const elemento = doc.getElementById(id);
    if (elemento) comparacao.append(elemento);
  }
  barra.append(comparacao);
  barra.prepend(marca);
  barra.classList.add('conecta-com-marca');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => instalarMarcaLiv(document), { once: true });
  } else instalarMarcaLiv(document);
}

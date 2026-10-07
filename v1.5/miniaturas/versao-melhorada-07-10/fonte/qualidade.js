/* Qualidade adaptativa: o perfil de cada aparelho e o governador que o ajusta em uso.

   TRÊS PERFIS, ESCOLHIDOS ANTES DO CONTEXTO. Antialias (MSAA) só se decide na criação do
   WebGL; o resto pode mudar com a página aberta. A escolha segue esta precedência:
     1. `?q=alto|medio|baixo` na URL (é como se testa e como se força);
     2. o perfil que o PRÓPRIO APARELHO gravou numa visita anterior, quando não segurou
        o anterior (ver o governador);
     3. o palpite pela GPU (`WEBGL_debug_renderer_info`), pela tela e pela memória.

   O "médio" é o padrão aprovado em 23/09 para celular (sem MSAA, DPR 1,25, sombra do sol
   1024); o "alto" é o padrão aprovado para computador; o "baixo" é o que um celular
   fraco aguenta: lightmaps em meia resolução, sombras em tempo real reduzidas, 30 FPS.

   O GOVERNADOR mede o intervalo REAL entre quadros desenhados enquanto há animação
   contínua (giro da maquete, caminhada), pela MEDIANA de uma janela -- um engasgo de
   coleta de lixo não derruba a resolução. Abaixo da meta ele reduz o DPR em 15%; com
   folga, devolve 8% por vez, até o teto do perfil. Se chegar ao piso e ainda não
   segurar a meta, grava o perfil de baixo para a próxima abertura e aplica já o que dá
   para trocar sem recriar o contexto (meta de 30 FPS, sombras mais leves). */

export const PERFIS = {
  alto: {
    nome: 'alto', msaa: true, dpr: 2, dprToque: 1.5, dprMin: 1,
    fps: 60, fpsGiro: 60, solMapa: 2048, sombraSuave: true,
    luz: 'cheia', mipLuz: false, sombraComodos: 1024, sombrasVisita: true, recebeSombraFachada: true,
  },
  medio: {
    nome: 'medio', msaa: false, dpr: 1.5, dprToque: 1.25, dprMin: 0.8,
    fps: 60, fpsGiro: 30, solMapa: 1024, sombraSuave: true,
    luz: 'cheia', mipLuz: true, sombraComodos: 1024, sombrasVisita: true, recebeSombraFachada: true,
  },
  baixo: {
    nome: 'baixo', msaa: false, dpr: 1, dprToque: 1, dprMin: 0.6,
    fps: 30, fpsGiro: 30, solMapa: 1024, sombraSuave: false,
    luz: 'metade', mipLuz: true, sombraComodos: 512, sombrasVisita: false, recebeSombraFachada: false,
  },
};
const ORDEM = ['baixo', 'medio', 'alto'];
const CHAVE = 'miniaturas:qualidade:v4';

function guardaLe() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
function guardaGrava(v) { try { localStorage.setItem(CHAVE, v); } catch (e) { /* aba privada */ } }

/* A string da GPU custa um contexto descartável de poucos ms; é o único jeito de
   saber o hardware antes de criar o contexto de verdade (onde o MSAA se decide). */
export function lePlaca() {
  let gpu = '', maxTex = 0, webgl2 = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
      const perde = gl.getExtension('WEBGL_lose_context'); if (perde) perde.loseContext();
    }
  } catch (e) { /* sem WebGL: a página avisa adiante */ }
  return { gpu, maxTex, webgl2 };
}

export function palpite({ gpu = '', toque, memoria, nucleos }) {
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(g)) return 'baixo';
  if (toque) {
    // Celular/tablet. O número da Adreno e da Mali diz a geração; a Apple não informa o
    // modelo no navegador, então o iPhone começa no perfil aprovado e o governador ajusta.
    const adreno = g.match(/adreno[^0-9]*(\d{3})/);
    if (adreno) { const n = +adreno[1]; return n >= 730 ? 'alto' : n >= 640 ? 'medio' : 'baixo'; }
    if (/immortalis|mali-g7[12]\d/.test(g)) return 'alto';
    if (/mali-g(6[18]\d|7[6-9])/.test(g)) return 'medio';
    if (/mali|powervr|vivante|videocore/.test(g)) return 'baixo';
    if (/xclipse/.test(g)) return 'alto';
    if (/apple/.test(g)) return 'medio';
    if (memoria && memoria <= 3) return 'baixo';
    if (nucleos && nucleos <= 4) return 'baixo';
    return 'medio';
  }
  if (/nvidia|geforce|quadro|rtx|radeon rx|radeon pro|apple m\d|arc\(tm\)|intel\(r\) arc/.test(g)) return 'alto';
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega/.test(g)) return 'medio';
  if (memoria && memoria <= 4) return 'medio';
  return 'alto';
}

export function escolhePerfil() {
  const placa = lePlaca();
  const toque = matchMedia('(pointer:coarse)').matches;
  const memoria = navigator.deviceMemory || 0, nucleos = navigator.hardwareConcurrency || 0;
  const qs = new URLSearchParams(location.search).get('q');
  const gravado = guardaLe();
  const sugerido = palpite({ gpu: placa.gpu, toque, memoria, nucleos });
  const nome = PERFIS[qs] ? qs : PERFIS[gravado] && ORDEM.indexOf(gravado) <= ORDEM.indexOf(sugerido) ? gravado : sugerido;
  const origem = PERFIS[qs] ? 'url' : nome === gravado && gravado !== sugerido ? 'gravado' : 'palpite';
  const perfil = { ...PERFIS[nome] };
  perfil.dprTeto = Math.min(window.devicePixelRatio || 1, toque ? perfil.dprToque : perfil.dpr);
  return { perfil, placa: { ...placa, toque, memoria, nucleos }, origem, sugerido };
}

/* Governador de resolução (DRS). `quadro(ms)` recebe o intervalo entre dois quadros
   DESENHADOS em sequência, só enquanto a cena anima sem parar. */
export function criaGovernador({ perfil, aplicaDpr, aoRebaixar }) {
  const JANELA = 40, JANELA_MS = 1500;
  let amostras = [], soma = 0, dpr = perfil.dprTeto, lentasNoPiso = 0, rebaixou = false;
  function meta() { return 1000 / perfil.fpsMeta; }
  return {
    get dpr() { return dpr; },
    zera() { amostras = []; soma = 0; },
    quadro(ms) {
      // aba em segundo plano, depurador, carga de recurso: não é sinal de GPU fraca
      if (!(ms > 0) || ms > 400 || document.hidden) return;
      amostras.push(ms); soma += ms;
      if (amostras.length < JANELA && soma < JANELA_MS) return;
      if (amostras.length < 8) { amostras = []; soma = 0; return; }
      const ord = amostras.slice().sort((a, b) => a - b), med = ord[ord.length >> 1];
      amostras = []; soma = 0;
      let d = dpr;
      if (med > meta() * 1.2) d = Math.max(perfil.dprMin, dpr * 0.85);
      else if (med < meta() * 1.06) d = Math.min(perfil.dprTeto, dpr * 1.08);
      if (Math.abs(d - dpr) >= 0.02) { dpr = d; aplicaDpr(dpr); }
      if (med > meta() * 1.2 && dpr <= perfil.dprMin + 0.02) {
        if (++lentasNoPiso >= 2 && !rebaixou && perfil.nome !== 'baixo') {
          rebaixou = true;
          const abaixo = ORDEM[ORDEM.indexOf(perfil.nome) - 1];
          guardaGrava(abaixo);
          aoRebaixar(abaixo);
        }
      } else lentasNoPiso = 0;
    },
  };
}

# -*- coding: utf-8 -*-
"""
Gera v5/sao-carlos-v5.html aplicando patches sobre o v4.

Mesma disciplina do make_v4.py: patch ancorado em texto exato, que falha alto se
o v4 mudar de forma. O v4 continua sendo a fonte.

O que o v5 muda: a base geometrica da cidade sai de dentro do HTML e passa a ser
um arquivo servido ao lado. O motivo nao e tamanho de arquivo -- e que enquanto o
dado mora dentro da pagina, ele so existe pra essa pagina. Fora dela, o mesmo
city.json serve qualquer outro cliente (outro viewer, uma API, um app), e o cache
HTTP compartilha um download unico entre todas as instancias abertas.
"""
# ---------------------------------------------------------------------------
# APOSENTADO em 2026-08-29. Este script fazia parte da cadeia de patch ancorado
# (make_v4 -> make_v5 -> make_v7 -> make_v8, 59 ancoras de texto exato) que montava
# a pagina. O renderizador virou codigo de verdade em `renderizador/` e a pagina
# passou a ser montada por `pipeline/montar.py`. Rodar isto AGORA sobrescreve a saida
# do montador com uma versao gerada da base antiga -- as duas divergem em silencio.
# Fica aqui como historico. Pra rodar assim mesmo: --aposentado-eu-sei.
import sys as _s
if "--aposentado-eu-sei" not in _s.argv:
    raise SystemExit(__file__ + ": APOSENTADO. A pagina agora sai de "
                     "`python pipeline/montar.py` (ver PIPELINE.md). "
                     "Use --aposentado-eu-sei pra rodar mesmo assim.")
# ---------------------------------------------------------------------------

import io, os, shutil, gzip

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SRC  = os.path.join(ROOT, "v4", "sao-carlos-v4.html")
CITY = os.path.join(ROOT, "v4", "sao-carlos-v4.city.json")
OUT  = os.path.join(BASE, "sao-carlos-v5.html")
DATA = os.path.join(BASE, "sao-carlos-v5.city.json")

patches = 0
def sub(s, old, new, what):
    global patches
    if s.count(old) != 1:
        raise SystemExit(f"ancora nao unica ({s.count(old)}x): {what}")
    patches += 1
    print(f"  [{patches}] {what}")
    return s.replace(old, new)


# Loader com progresso real. Antes o dado ja estava na pagina e a barra era
# decorativa; agora sao megabytes pela rede e a barra precisa dizer a verdade.
LOADER = '''
/* ============================================================
   10. Inicio: a base da cidade vem de fora (v5)
   ============================================================ */
const CITY_URL = new URLSearchParams(location.search).get("city") || CITY_FILE;

async function fetchCity(url) {
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  // Content-Length vem do corpo COMPRIMIDO; o reader entrega bytes ja
  // descomprimidos. Num servidor com gzip os dois nao batem, entao a barra e
  // limitada a 100% e o texto mostra o que de fato chegou.
  const tot = +(r.headers.get("content-length") || 0);
  if (!r.body || !r.body.getReader) return r.json();

  const rd = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); got += value.length;
    const mb = (got / 1048576).toFixed(1).replace(".", ",");
    stM.textContent = tot ? `${mb} de ~${(tot/1048576).toFixed(1).replace(".", ",")} MB`
                          : `${mb} MB`;
    stI.style.width = tot ? `${8 + 62 * Math.min(1, got/tot)}%` : "45%";
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}

async function boot() {
  frame0(4);
  stK.textContent = "Baixando a base da cidade";
  stM.textContent = "Conectando";
  stI.style.width = "8%";
  try {
    const j = await fetchCity(CITY_URL);
    stI.style.width = "72%";
    stM.textContent = "Reconstruindo a cidade";
    await new Promise(r => setTimeout(r, 50));
    loadCity(j, CITY_URL === CITY_FILE ? "base local (v5)" : "base remota");
    return;
  } catch (e) {
    console.error("Falha ao carregar a base:", e);
    stK.textContent = "Nao consegui carregar a base da cidade";
    // O erro mais provavel aqui nao e rede: e abrir o arquivo com duplo clique.
    // Em file:// o fetch e bloqueado pela origem opaca, entao vale dizer isso
    // em vez de mostrar um "Failed to fetch" que nao ajuda ninguem.
    stM.textContent = location.protocol === "file:"
      ? "Abra por um servidor HTTP - file:// bloqueia a leitura do city.json."
      : (e.message || "Erro de rede");
    stI.style.width = "100%";
  }
}
'''


def main():
    global patches
    s = io.open(SRC, encoding="utf-8").read()
    print(f"v4: {len(s)/1048576:.1f} MB")
    print("aplicando patches:")

    # 1. marcador de versao
    s = sub(s, "<title>São Carlos — mapa 3D (v4)</title>",
               "<title>São Carlos — mapa 3D (v5)</title>", "titulo v5")

    # 2. arranca o payload embutido
    tag = '<script type="application/json" id="__citydata">'
    i = s.index(tag)
    j = s.index("</script>", i) + len("</script>")
    cut = (j - i) / 1048576
    s = s[:i] + "<!-- v5: a base da cidade agora e um arquivo separado, " \
                "baixado em runtime (ver CITY_FILE) -->" + s[j:]
    patches += 1
    print(f"  [{patches}] payload embutido removido: -{cut:.1f} MB")

    # 3. o arquivo que o loader busca
    s = sub(s, 'const CITY_FILE = "sao-carlos-overture-v2.city.json";',
               'const CITY_FILE = "sao-carlos-v5.city.json";',
               "CITY_FILE aponta pra base v5")

    # 4. boot() novo: fetch com progresso, sem leitura de tag embutida
    a = s.index("/* ============================================================\n"
                "   10. Início: tenta a cidade pronta antes de qualquer download")
    b = s.index("/* ============================================================\n"
                "   11. Ficha, câmera, controles, laço")
    s = s[:a] + LOADER.strip() + "\n\n" + s[b:]
    patches += 1
    print(f"  [{patches}] boot() busca a base por fetch, com progresso real")

    io.open(OUT, "w", encoding="utf-8").write(s)

    # a base, ao lado do html: o diretorio v5/ e servivel como esta
    if not os.path.exists(DATA) or os.path.getmtime(CITY) > os.path.getmtime(DATA):
        shutil.copyfile(CITY, DATA)

    raw = os.path.getsize(DATA)
    gz  = len(gzip.compress(io.open(DATA, "rb").read(), 6))
    print(f"\nv5: {len(s)/1024:.0f} KB de pagina  ->  {OUT}")
    print(f"    base: {raw/1048576:.1f} MB  ({gz/1048576:.1f} MB com gzip)  -> {DATA}")


if __name__ == "__main__":
    main()

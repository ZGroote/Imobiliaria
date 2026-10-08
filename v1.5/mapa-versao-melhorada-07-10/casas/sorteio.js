/* Sorteio determinístico das casas procedurais.

   Toda escolha "aleatória" de uma casa (partido, recuo extra, cor, se tem piscina) sai
   daqui, e sai IGUAL em qualquer máquina e em qualquer ordem de leitura. Três decisões
   garantem isso:

   1. Só aritmética inteira de 32 bits (Math.imul, >>>, ^). Nada de Math.random, nada de
      seno: o resultado não depende do motor JS nem da plataforma.
   2. A semente do lote é hash(slug, id estável do lote, versão das regras). O id é
      geométrico (centro do lote em decímetros), então não muda se o GeoJSON for
      reordenado.
   3. Cada ETAPA tem o seu fluxo, derivado da semente pelo nome da etapa. Mudar a regra
      do telhado muda quantos números o fluxo "telhado" consome, mas não mexe no fluxo
      "recuos" nem no "cores": uma casa não troca de cor porque o telhado mudou.

   O gerador é o splitmix32 (incremento da razão áurea + finalizador do murmur3). É
   pequeno, passa nos testes estatísticos que importam aqui e, principalmente, cada
   saída é função pura do estado, o que deixa o fluxo reproduzível em Python se um dia
   for preciso conferir. */
(function (root) {
  "use strict";

  const OURO = 0x9E3779B9;           // incremento do splitmix32 (2^32 / razão áurea)
  const DOIS32 = 4294967296;         // 2^32: divide u32 em [0, 1) sem arredondar

  // Finalizador do murmur3 (fmix32): espalha cada bit de entrada por toda a saída.
  function mistura(x) {
    x = x | 0;
    x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
    x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  /* FNV-1a de 32 bits sobre os bytes UTF-8 do texto. UTF-8, e não a unidade UTF-16 do
     JS, para a mesma string dar o mesmo hash em qualquer linguagem. Slug e id de lote
     são ASCII hoje; o caminho multibyte existe para o dia em que não forem. */
  function hashTexto(s) {
    let h = 0x811C9DC5;
    const byte = b => { h = Math.imul(h ^ b, 0x01000193); };
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        const d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
      }
      if (c < 0x80) byte(c);
      else if (c < 0x800) { byte(0xC0 | (c >> 6)); byte(0x80 | (c & 63)); }
      else if (c < 0x10000) { byte(0xE0 | (c >> 12)); byte(0x80 | ((c >> 6) & 63)); byte(0x80 | (c & 63)); }
      else { byte(0xF0 | (c >> 18)); byte(0x80 | ((c >> 12) & 63)); byte(0x80 | ((c >> 6) & 63)); byte(0x80 | (c & 63)); }
    }
    return h >>> 0;
  }

  /* Semente de um lote. O separador "|" impede que ("ab", "c") e ("a", "bc") colidam.
     A versão entra de propósito: trocá-la reembaralha a cidade inteira, e é o único
     jeito de fazer isso. Mudar um número de regra NÃO exige trocar a versão. */
  function semente(slug, idLote, versao) {
    return mistura(hashTexto(String(slug) + "|" + String(idLote) + "|" + String(versao)));
  }

  /* Um fluxo: sequência de u32 a partir de (semente, nome da etapa). O estado é um
     inteiro só; cada chamada soma a razão áurea e passa pelo finalizador. */
  function fluxo(sem, nome) {
    let estado = mistura((sem >>> 0) ^ hashTexto(String(nome)));
    function u32() {
      estado = (estado + OURO) | 0;
      return mistura(estado);
    }
    // [0, 1) exato: u32 / 2^32 é representável sem arredondamento num double.
    const real = () => u32() / DOIS32;
    return {
      u32,
      real,
      // Inteiro em [a, b], os dois inclusos. O viés do módulo é < 2^-24 para as faixas
      // usadas aqui (centenas de valores), muito abaixo de qualquer coisa visível.
      inteiro(a, b) { return a + Math.floor(real() * (b - a + 1)); },
      chance(p) { return real() < p; },
      // Escolha por pesos {nome: peso}. Itera na ordem das chaves, que é a ordem do JSON
      // de regras: determinística. Peso <= 0 nunca sai.
      pesos(tabela) {
        let total = 0;
        for (const k in tabela) if (tabela[k] > 0) total += tabela[k];
        if (!(total > 0)) return null;
        let r = real() * total;
        let ultimo = null;
        for (const k in tabela) {
          const w = tabela[k];
          if (!(w > 0)) continue;
          ultimo = k;
          if (r < w) return k;
          r -= w;
        }
        return ultimo;     // só por erro de arredondamento na última fatia
      },
      escolhe(lista) { return lista.length ? lista[Math.floor(real() * lista.length)] : undefined; }
    };
  }

  root.CasasSorteio = Object.freeze({ mistura, hashTexto, semente, fluxo });
})(globalThis);

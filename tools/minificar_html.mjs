// Minifica uma página de arquivo único antes de publicar: JS e CSS embutidos pelo esbuild
// (sem comentários, nomes locais encurtados) e comentários HTML removidos. Blocos de dado
// (<script type="application/json"> e afins) passam intactos.
//   node tools/minificar_html.mjs entrada.html saida.html
import { readFileSync, writeFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const [, , entrada, saida] = process.argv
if (!entrada || !saida || entrada === saida) throw new Error('uso: node tools/minificar_html.mjs entrada.html saida.html')

const BLOCO = /<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi
const semComentarios = s => s.replace(/<!--[\s\S]*?-->/g, '')
// Script clássico: sem `format`, o esbuild não renomeia os nomes de topo, que são globais
// compartilhados entre os <script> (THREE, __liv, __maq...).
// Conteúdo de strings (inclusive GLSL) é dado e deve permanecer intacto.
const minifica = (codigo, loader) =>
  transformSync(codigo, { loader, minify: true, charset: 'utf8' }).code.trimEnd()

const html = readFileSync(entrada, 'utf8')
let out = '', ultimo = 0, blocos = 0
for (const m of html.matchAll(BLOCO)) {
  const [bloco, tag, attrs = '', corpo] = m
  out += semComentarios(html.slice(ultimo, m.index))
  const css = tag.toLowerCase() === 'style', js = !css && !/\btype\s*=/i.test(attrs)
  out += css || js ? `<${tag}${attrs}>${minifica(corpo, css ? 'css' : 'js')}</${tag}>` : bloco
  ultimo = m.index + bloco.length
  blocos++
}
out += semComentarios(html.slice(ultimo))

// O esbuild escapa `</script` dentro de strings; se algum escapar, a página quebra calada.
const fechamentos = s => (s.match(/<\/script/gi) || []).length
if (fechamentos(out) !== fechamentos(html)) throw new Error('número de </script> mudou: abortado')
writeFileSync(saida, out)
console.log(JSON.stringify({ entrada, saida, blocos, antes: html.length, depois: out.length }))

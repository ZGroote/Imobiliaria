"""Página local para comparar renders e fotos, sem JavaScript ou CDN."""
from html import escape
import json
from pathlib import Path
from urllib.parse import quote


def gerar(destino):
    destino = Path(destino).resolve()
    anuncio = json.loads((destino / 'anuncio.json').read_text(encoding='utf-8'))
    receita = json.loads((destino / 'receita.json').read_text(encoding='utf-8'))
    report = json.loads((destino / 'resultado-blender.json').read_text(encoding='utf-8'))
    title = escape(receita['titulo'])
    fotos = []
    for i, foto in enumerate(anuncio['fotos'], 1):
        relative = foto['arquivo'].replace('\\', '/')
        if not (destino / relative).resolve().is_relative_to(destino):
            raise ValueError('Foto fora da pasta do processo')
        url = quote(relative, safe='/')
        fotos.append(f'<a class="foto" href="{url}" target="_blank"><img loading="lazy" src="{url}" alt="Referência {i}"><span>Foto {i} · {foto["largura"]} × {foto["altura"]}</span></a>')
    observations = ''.join('<li>' + escape(s) + '</li>' for s in receita['observacoes'])
    parts = ''.join('<tr><td>' + escape(p['nome']) + '</td><td>' + ('Contém estimativas' if p['estimado'] else 'Referência indicada') + '</td><td>' + escape(', '.join(p['referencias']) or 'Sem vista direta') + '</td></tr>' for p in receita['partes'])
    rendered = ''.join(f'<figure><img src="{name}" alt="{label}"><figcaption>{label}</figcaption></figure>' for name, label in [('frente.png', 'Fachada — modelo gerado'), ('perspectiva.png', 'Perspectiva — modelo gerado')] if (destino / name).is_file() and name in report.get('renderizados', []))
    html = f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — revisão 3D</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#edf0e9;color:#25332b;font:15px/1.55 system-ui,sans-serif}}main{{max-width:1200px;margin:auto;padding:36px 24px}}h1{{font-size:32px;line-height:1.2;max-width:850px}}h2{{font-size:22px;margin-top:34px}}p{{max-width:850px}}.tag{{font-size:12px;letter-spacing:.12em;font-weight:700;color:#667345}}.summary{{padding:18px 22px;background:#fff;border-left:4px solid #75865a;border-radius:8px}}.renders{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}figure{{margin:0;background:#fff;border-radius:12px;overflow:hidden}}figure img{{width:100%;display:block}}figcaption{{padding:12px 18px}}.fotos{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}}.foto{{display:block;background:#fff;border-radius:8px;overflow:hidden;color:inherit;text-decoration:none}}.foto img{{width:100%;aspect-ratio:4/3;object-fit:contain;background:#dce0d8}}.foto span{{display:block;padding:8px 12px;font-size:12px}}.links{{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}}.links a{{padding:10px 18px;border:1px solid #728369;border-radius:8px;color:#263c28;background:#fff;text-decoration:none}}table{{border-collapse:collapse;width:100%;font-size:12px}}td,th{{padding:9px;text-align:left;border-bottom:1px solid #cad2c5;overflow-wrap:anywhere}}td:last-child{{max-width:340px}}details{{margin-top:24px}}summary{{cursor:pointer;font-weight:600}}@media(max-width:650px){{main{{padding:24px 14px}}h1{{font-size:25px}}.renders{{grid-template-columns:1fr}}.fotos{{grid-template-columns:1fr 1fr}}}}
</style><main><div class="tag">ESTUDO 3D · REVISÃO PENDENTE</div><h1>{title}</h1>
<p>Compare a geometria com as fotografias. O projeto foi gerado a partir das referências disponíveis; medidas ou vistas ausentes continuam sendo estimadas.</p>
<div class="summary">{len(receita['partes'])} peças descritas · {report['objetos_malha']} objetos de geometria · {report['triangulos']:,} triângulos · {len(fotos)} fotos de referência</div>
<div class="links"><a href="projeto.blend">Projeto Blender</a><a href="exterior.glb">Modelo GLB</a><a href="receita.json">Receita editável</a></div>
<section class="renders">{rendered}</section><h2>Observações da modelagem</h2><ul>{observations}</ul>
<h2>Fotos do anúncio</h2><p>Abra cada imagem para inspecionar a resolução original.</p><section class="fotos">{''.join(fotos)}</section>
<details><summary>Peças e referências usadas</summary><table><tr><th>Peça</th><th>Situação</th><th>Referências</th></tr>{parts}</table></details>
</main></html>'''
    output = destino / 'revisao.html'
    output.write_text(html, encoding='utf-8')
    return output


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino', type=Path)
    print(gerar(parser.parse_args().destino))

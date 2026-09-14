# -*- coding: utf-8 -*-
import os, io, re, shutil

raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pasta = os.path.join(raiz, 'v16-moveis')
origem = os.path.join(pasta, 'sao-carlos-v16-moveis-aberto.html')

if not os.path.exists(origem):
    print('ERRO: arquivo de origem nao encontrado:', origem)
    exit(1)

content = io.open(origem, encoding='utf-8', errors='ignore').read()
if content and content[0] == '\ufeff':
    content = content[1:]

nome_titulo = 'São Carlos 3D'
content, count = re.subn(r'<title>[^<]*</title>', f'<title>{nome_titulo}</title>', content, count=1)
print(f'Substituicao de titulo: {count} ocorrencia(s)')

saida = os.path.join(pasta, 'publicado')
mapa_dir = os.path.join(saida, 'mapa')

if os.path.exists(mapa_dir):
    shutil.rmtree(mapa_dir)
os.makedirs(mapa_dir, exist_ok=True)

target_file = 'sao-carlos-v16-moveis-aberto.html'
destino_mapa = os.path.join(mapa_dir, target_file)

with io.open(destino_mapa, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

size_mb = os.path.getsize(destino_mapa) / (1024 * 1024)
print(f'Mapa gravado: {destino_mapa} ({size_mb:.2f} MB)')

index_html = (
    '<!doctype html><meta charset="utf-8">'
    f'<title>{nome_titulo}</title>'
    f'<meta http-equiv="refresh" content="0;url=/mapa/{target_file}">'
    f'<script>location.replace("/mapa/{target_file}")</script>'
    f'<a href="/mapa/{target_file}">abrir o mapa</a>'
)

index_path = os.path.join(saida, 'index.html')
with io.open(index_path, 'w', encoding='utf-8', newline='') as f:
    f.write(index_html)

print(f'Index gravado: {index_path}')

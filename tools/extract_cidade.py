#!/usr/bin/env python3
"""
tools/extract_cidade.py

Extrai o JSON __cidade do HTML monolítico e salva como arquivo separado.

Uso:
  python tools/extract_cidade.py v13/ribeirao-preto-v13-aberto.html
"""

import json
import re
import sys
import os

def extract_cidade(html_path):
    print(f"Lendo {html_path}...")
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Encontrar a tag <script type="application/json" id="__cidade">
    match = re.search(r'<script\s+type="application/json"\s+id="__cidade">([\s\S]*?)</script>', content)
    if not match:
        print("Erro: Não foi possível encontrar a tag id='__cidade' no arquivo HTML.")
        sys.exit(1)
        
    json_str = match.group(1).strip()
    
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"Erro ao parsear JSON: {e}")
        sys.exit(1)
        
    slug = data.get('slug', 'cidade_desconhecida')
    out_dir = os.path.join('public', 'cidade')
    os.makedirs(out_dir, exist_ok=True)
    
    out_path = os.path.join(out_dir, f"{slug}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Sucesso: Configuração da cidade extraída para {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python extract_cidade.py <caminho_do_html>")
        sys.exit(1)
    
    extract_cidade(sys.argv[1])

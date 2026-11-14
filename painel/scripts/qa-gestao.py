"""Confere a interface real com contas fictícias. Nunca acessa produção."""
import json
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = 'http://127.0.0.1:3027'
OUT = Path(__file__).resolve().parents[2] / 'relatorios/painel-gestao-2026-11-03'
expect.set_options(timeout=30000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    context = browser.new_context(locale='pt-BR', viewport={'width':1440,'height':1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for attempt in range(90):
        try:
            page.goto(URL+'/login', timeout=10000)
            page.get_by_role('heading', name='Entrar no painel').wait_for(timeout=10000)
            break
        except Exception:
            if attempt == 89: raise
            time.sleep(1)
    expect(page.get_by_alt_text('Conecta Imóveis 3D')).to_be_visible()
    page.wait_for_function("document.documentElement.dataset.locale === 'pt-BR'", timeout=60000)
    page.get_by_label('Idioma / Language').select_option('en')
    expect(page.get_by_role('heading', name='Sign in to your dashboard')).to_be_visible()
    page.get_by_label('Idioma / Language').select_option('pt-BR')
    expect(page.get_by_role('heading', name='Entrar no painel')).to_be_visible()
    page.screenshot(path=str(OUT/'login-desktop.png'), full_page=True)
    for width in [320,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Login overflow {width}'
        if width == 320: page.screenshot(path=str(OUT/'login-mobile.png'), full_page=True)
    page.get_by_label('E-mail', exact=True).fill('gerente.a@painel.test')
    page.get_by_label('Senha', exact=True).fill('senha-do-emulador')
    page.get_by_role('button', name='Entrar', exact=True).click()
    page.wait_for_url('**/dashboard', timeout=60000)
    # The agency is configured for English. A user may explicitly switch languages.
    page.get_by_label('Idioma / Language').select_option('en')
    expect(page.get_by_role('heading', name='Engagement and interest')).to_be_visible()
    page.get_by_label('Development', exact=True).select_option('cedros')
    expect(page.get_by_text('30 s', exact=True).first).to_be_visible(timeout=60000)
    for width in [320,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':1100})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Dashboard overflow {width}'
        if width in [320,1440]: page.screenshot(path=str(OUT/f'dashboard-{width}.png'), full_page=True)
    page.goto(URL+'/properties/view?id=cedros')
    expect(page.get_by_role('button', name='Edit', exact=True)).to_have_count(0)
    expect(page.get_by_role('switch')).to_have_count(0)
    page.set_viewport_size({'width':320,'height':1000})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Property overflow'
    page.set_viewport_size({'width':1440,'height':1100})
    page.goto(URL+'/properties/units?id=cedros')
    page.get_by_role('button', name='Edit 101', exact=True).click()
    expect(page.get_by_text('Price (USD)', exact=False).first).to_be_visible()
    expect(page.get_by_label('Número comercial', exact=True)).to_have_count(0)
    expect(page.get_by_label('Planta associada', exact=True)).to_have_count(0)
    expect(page.get_by_label('Vagas na implantação', exact=True)).to_have_count(0)
    page.get_by_label('Price (USD)', exact=False).fill('135000.50')
    page.get_by_label('Availability', exact=True).first.select_option('vendida')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('cell', name='$135,000.50', exact=True)).to_be_visible()
    page.screenshot(path=str(OUT/'unidades-gerente.png'), full_page=False)
    page.goto(URL+'/profile')
    page.get_by_label('Contact channel', exact=True).select_option('sms')
    page.get_by_label('International phone number', exact=True).fill('+1 212 555 0100')
    page.get_by_label('Public email', exact=True).fill('public-agent@example.test')
    page.get_by_role('button', name='Save profile', exact=True).click()
    expect(page.get_by_text('Profile saved. New visits to your links will use these contact details.')).to_be_visible()
    page.goto(URL+'/team')
    page.set_viewport_size({'width':320,'height':1000})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Team overflow'
    page.set_viewport_size({'width':1440,'height':1100})
    page.get_by_label('Email', exact=True).fill('qa-invite@example.test')
    page.get_by_label('Name', exact=True).fill('QA agent')
    page.get_by_role('button', name='Invite agent', exact=True).click()
    expect(page.get_by_role('cell', name='qa-invite@example.test', exact=False)).to_be_visible()
    page.get_by_label('Idioma / Language').select_option('pt-BR')
    expect(page.get_by_role('heading', name='Equipe', exact=True)).to_be_visible()
    page.goto(URL+'/dashboard')
    expect(page.get_by_role('heading', name='Acessos e interesse')).to_be_visible()
    page.get_by_label('Empreendimento', exact=True).select_option('cedros')
    expect(page.get_by_text('30 s', exact=True).first).to_be_visible()
    page.screenshot(path=str(OUT/'painel-pt-BR.png'), full_page=False)
    assert not errors, errors
    (OUT/'browser.json').write_text(json.dumps({'pageErrors':errors,'flows':['login','responsive','tracking','commercial','sms','invite','languages']},indent=2),encoding='utf-8')
    browser.close()
print('QA visual: login, quatro larguras, métricas, preço/venda, SMS, convite e idiomas passaram.')

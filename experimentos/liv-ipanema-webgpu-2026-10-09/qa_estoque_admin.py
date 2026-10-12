"""Painel real + leitor público real sob regras, exclusivamente no emulador demo-painel."""
import json
import time
import hashlib
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready

EXP=Path(__file__).resolve().parent
OUT=EXP/'evidencias/estoque-admin'
ADMIN='http://127.0.0.1:3017'
VIEW='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'
PID='liv-estoque-qa'
CONFIG={'schema':'liv-sales-config-v1','mode':'emulador','propertyId':None,'firebase':{'apiKey':'demo-key','projectId':'demo-painel'},'emulatorPort':8180}

def fill_info(page, label, value):
    page.get_by_label(label,exact=True).fill(value)

def edit_unit(page,key,status,profile=None,number=None,price=None):
    page.get_by_role('button',name=f'Editar {number or key}',exact=True).click()
    form=page.get_by_role('form',name='Ficha da unidade')
    if number:form.get_by_label('Número comercial',exact=True).fill(number)
    form.get_by_label('Disponibilidade',exact=True).select_option(status)
    if profile:
        form.get_by_label('Planta associada',exact=True).select_option(profile)
        form.get_by_role('checkbox').check()
    if price is not None:form.get_by_label('Preço (R$)',exact=True).fill(price)
    form.get_by_role('button',name='Salvar unidade',exact=True).click()
    page.get_by_role("form",name="Ficha da unidade").wait_for(state="detached")

def select_public(page,floor,final):
    if page.locator('#unitDetails').evaluate('(d)=>d.open'):page.keyboard.press('Escape')
    page.locator('#buildingMirror').evaluate('(d)=>d.open=true')
    id_=f'liv-ipanema/pavimento-modelo-{floor:02}/final-{final:02}'
    page.locator(f'[data-mirror-unit-id="{id_}"]').click()
    page.wait_for_function('document.getElementById("unitDetails").open')
    assert page.evaluate('__livViewer.selectedUnitId')==id_
    return page.locator('#detailsBody')

def main():
    original=(EXP/'estoque-config.json').read_bytes()
    report={'status':'RUNNING','recordedAt':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,'project':'demo-painel','syntheticOnly':True,'cases':[]}
    browser=None
    try:
        deadline=time.monotonic()+160
        while True:
            try:
                with urllib.request.urlopen(ADMIN+'/login',timeout=10) as response:
                    if response.status==200:break
            except Exception:
                if time.monotonic()>deadline:raise
                time.sleep(1)
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
            admin=context.new_page();errors=[];admin.on('pageerror',lambda e:errors.append(str(e)))
            admin.goto(ADMIN+'/login')
            admin.wait_for_function('''()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Operador · Operador'));return b&&Object.keys(b).some(k=>k.startsWith('__reactProps')&&b[k]?.onClick);}''')
            admin.get_by_role('button',name='Operador · Operador',exact=True).click()
            admin.wait_for_url('**/admin')
            admin.goto(ADMIN+'/admin/properties/units?id='+PID)
            admin.get_by_role('button',name='Cadastrar unidades do LIV',exact=True).click()
            admin.get_by_text('170 unidades cadastradas',exact=False).wait_for()
            assert '170 sem informação' in admin.inner_text('main')
            for profile,price,area in [('Canto','299000,01','47.59'),('Meio','279000,02','47.89')]:
                admin.get_by_role('button',name='Editar '+profile,exact=True).click()
                fill_info(admin,'Preço (R$)',price);fill_info(admin,'Área publicada (m²)',area)
                fill_info(admin,'Quartos','2');fill_info(admin,'Banheiros','1')
                fill_info(admin,'Descrição pública','DEMONSTRAÇÃO SEM OFERTA REAL <img src=x onerror=alert(1)>')
                admin.get_by_role('button',name='Salvar dados comuns',exact=True).click()
                admin.get_by_role("form",name="Dados comuns da planta").wait_for(state="detached")
            # Initial edits find the technical label; the commercial number is entered afterward.
            for key,status,profile,number,price in [('p08-f01','vendida','canto','QA-801',None),('p08-f02','disponivel','meio','QA-802',None),('p08-f03','disponivel','canto','QA-803','320000,03')]:
                admin.get_by_role('button',name='Editar '+key,exact=True).click()
                form=admin.get_by_role('form',name='Ficha da unidade')
                form.get_by_label('Número comercial',exact=True).fill(number)
                form.get_by_label('Disponibilidade',exact=True).select_option(status)
                form.get_by_label('Planta associada',exact=True).select_option(profile);form.get_by_role('checkbox').check()
                if price:form.get_by_label('Preço (R$)',exact=True).fill(price)
                form.get_by_role('button',name='Salvar unidade',exact=True).click()
                admin.get_by_role("form",name="Ficha da unidade").wait_for(state="detached")
            public_context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
            public=public_context.new_page();public.on('pageerror',lambda e:errors.append(str(e)))
            public.route('**/estoque-config.json',lambda route:route.fulfill(content_type='application/json',body=json.dumps(CONFIG)))
            public.goto(VIEW+f'?geometria=entrada&estoque={PID}&backend=webgpu');ready(public)
            public.wait_for_function('__livViewer.stockStatus==="nao-publicado"')
            assert all(u['commercial']['availability']=='nao_informada' for u in public.evaluate('__livViewer.units.units'))
            admin.get_by_role('button',name='Habilitar consulta pública',exact=True).click()
            public.wait_for_function('__livViewer.stockStatus==="ao-vivo"')
            body=select_public(public,8,2)
            assert 'Disponível' in body.inner_text() and '279.000,02' in body.inner_text() and '47,89 m²' in body.inner_text()
            assert body.locator('img').count()==0 and '<img' in body.inner_text()
            public_context.set_offline(True)
            public.wait_for_function('!document.getElementById("detailsStockWarning").hidden')
            assert 'desatualizada' in public.inner_text('#detailsStockWarning')
            public_context.set_offline(False)
            public.wait_for_function('document.getElementById("detailsStockWarning").hidden',timeout=30000)
            camera_before=public.evaluate('JSON.stringify(__livViewer.frame.contentWindow.__livProva.getState().camera)')
            # A save in the admin page changes the existing public tab without reload.
            edit_unit(admin,'p08-f02','vendida',number='QA-802')
            public.wait_for_function('document.getElementById("detailsBody").textContent.includes("Vendida")')
            assert public.evaluate('JSON.stringify(__livViewer.frame.contentWindow.__livProva.getState().camera)')==camera_before
            admin.get_by_role('button',name='Editar Meio',exact=True).click();fill_info(admin,'Preço (R$)','280000,04')
            admin.get_by_role('button',name='Salvar dados comuns',exact=True).click()
            public.wait_for_function('document.getElementById("detailsBody").textContent.includes("280.000,04")')
            for final,expected in [(1,'299.000,01'),(3,'320.000,03')]:assert expected in select_public(public,8,final).inner_text()
            body=select_public(public,8,2)
            assert public.evaluate('document.activeElement.id')=='closeDetails'
            public.locator('[data-unit-open="planta2d"]').click();ready(public,'planta2d')
            assert public.evaluate('__livViewer.typology')=='meio'
            public.evaluate('__livViewer.setMode("planta3d")');ready(public,'planta3d')
            public.evaluate('__livViewer.setMode("visita")');ready(public,'visita')
            assert public.evaluate('__livViewer.frame.contentWindow.__livInterior.typology')=='meio'
            public.evaluate('__livViewer.setMode("maquete")');ready(public)
            select_public(public,8,1);public.locator('[data-unit-open="visita"]').click();ready(public,'visita')
            assert public.evaluate('__livViewer.frame.contentWindow.__livInterior.typology')=='canto'
            public.evaluate('__livViewer.setMode("maquete")');ready(public)
            # Revocation removes offers and associations from the open public page.
            admin.get_by_role('button',name='Desabilitar consulta pública',exact=True).click()
            public.wait_for_function('__livViewer.stockStatus==="nao-publicado"')
            assert public.evaluate('__livViewer.units.units.every(u=>u.commercial.availability==="nao_informada"&&u.relation===null)')
            admin.get_by_role('button',name='Habilitar consulta pública',exact=True).click()
            public.wait_for_function('__livViewer.stockStatus==="ao-vivo"')
            public.reload();ready(public);public.wait_for_function('__livViewer.stockStatus==="ao-vivo"')
            select_public(public,8,2);public.screenshot(path=str(OUT/'ficha-publica-desktop.png'))
            admin.screenshot(path=str(OUT/'painel-estoque-desktop.png'),full_page=True)
            report['cases'].append({'name':'admin-public-desktop','stock':170,'unknown':167,'sold':2,'available':1,'liveStatus':True,'liveProfile':True,'ownOverrides':True,'cameraPreserved':True,'bothTours':True,'revocation':True,'reload':True,'safeText':True,'offlineNoticeInDialog':True,'status':'PASS'})
            public_context.close()
            for width in [320,390,768]:
                admin.set_viewport_size({'width':width,'height':900})
                assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            admin.set_viewport_size({'width':1440,'height':1000})
            mobile_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
            mobile=mobile_context.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)))
            mobile.route('**/estoque-config.json',lambda route:route.fulfill(content_type='application/json',body=json.dumps(CONFIG)))
            mobile.goto(VIEW+f'?geometria=entrada&estoque={PID}');ready(mobile);mobile.wait_for_function('__livViewer.stockStatus==="ao-vivo"')
            select_public(mobile,8,2);assert 'Vendida' in mobile.inner_text('#detailsBody')
            assert mobile.evaluate('document.getElementById("unitDetails").getBoundingClientRect().width<=innerWidth')
            mobile.screenshot(path=str(OUT/'ficha-publica-toque.png'))
            mobile.keyboard.press('Escape');assert not mobile.locator('#unitDetails').evaluate('(d)=>d.open')
            report['cases'].append({'name':'touch-emulated','dialog':True,'soldVisible':True,'close':True,'status':'PASS'})
            mobile_context.close();context.close();browser.close();browser=None
            assert not errors,errors
            assert (EXP/'estoque-config.json').read_bytes()==original
            report['errors']=errors;report['configUnchanged']=True;report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=repr(error);raise
    finally:
        report['sources']={str(p.relative_to(EXP.parent.parent)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in [EXP/'viewer.js',EXP/'estoque-adapter.js',EXP/'estoque-runtime.js',EXP/'maquete-liv-ipanema.html',EXP.parent.parent/'firebase/firestore.rules',EXP.parent.parent/'painel/src/lib/estoque.ts']}
        (OUT/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
        print(json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()

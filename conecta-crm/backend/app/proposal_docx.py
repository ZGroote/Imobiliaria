"""Derivado do timbrado original, sem biblioteca Office ou acesso à rede."""
import hashlib
import io
import re
from xml.etree import ElementTree as E
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException

from .branding_api import ASSETS, catalog
from .proposals import LABELS_BR, LABELS_US

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
E.register_namespace('w',W)


def paragraph(value,role='body',reviewed=False):
    p=E.Element('{'+W+'}p');prop=E.SubElement(p,'{'+W+'}pPr')
    def tag(parent,name,**attrs):return E.SubElement(parent,'{'+W+'}'+name,{'{'+W+'}'+k:str(v) for k,v in attrs.items()})
    if role in ('title','heading'):
        tag(prop,'pStyle',val='Title' if role=='title' else 'Heading1');tag(prop,'keepNext')
        borders=tag(prop,'pBdr');tag(borders,'bottom',val='nil')
    tag(prop,'widowControl');tag(prop,'spacing',before=180 if role=='heading' else 0,after=0 if role=='footer' else 120,line=240 if role=='footer' else 276,lineRule='auto')
    if role=='footer':tag(prop,'jc',val='center')
    run=E.SubElement(p,'{'+W+'}r');rp=E.SubElement(run,'{'+W+'}rPr')
    tag(rp,'rFonts',ascii='Arial',hAnsi='Arial',cs='Arial')
    tag(rp,'sz',val=44 if role=='title' else 24 if role=='heading' else 16 if role=='footer' else 18 if role=='status' else 22)
    tag(rp,'color',val='000000' if role=='title' else '071B3D' if role=='heading' or reviewed else '8C241A' if role in ('status','footer') else '1F2937')
    if role!='body':tag(rp,'b')
    text=E.SubElement(run,'{'+W+'}t',{'{http://www.w3.org/XML/1998/namespace}space':'preserve'});text.text=value.replace('\t','    ')
    return E.tostring(p,encoding='utf-8')


def price(amount,currency,us):
    if amount is None:return 'To be completed' if us else 'A preencher'
    whole,fraction=divmod(amount,100)
    value=f'{whole:,}.{fraction:02d}'
    return currency+' '+(value if us else value.replace(',','_').replace('.',',').replace('_','.'))


def build(row,reviewed=False):
    asset_id=row['snapshot']['source_assets']['letterhead']
    entry=next((a for a in catalog() if a['id']==asset_id),None)
    if not entry:raise HTTPException(409,'O timbrado desta versão não está disponível.')
    source=(ASSETS/entry['name']).read_bytes()
    if hashlib.sha256(source).hexdigest()!=asset_id:raise HTTPException(409,'O timbrado original foi alterado. Confira a biblioteca.')
    payload=row['payload'];snapshot=row['snapshot'];us=payload['profile_id']=='US'
    labels=LABELS_US if us else LABELS_BR
    status=('Internally reviewed' if us else 'Revisada internamente') if reviewed else ('DRAFT FOR REVIEW' if us else 'RASCUNHO PARA REVISÃO')
    reference=row['id'][:12].upper()+' · v'+str(row['selected_version'])
    parts=[paragraph('Commercial proposal' if us else 'Proposta comercial','title'),paragraph(status+' · '+reference,'status',reviewed),
        paragraph(('Company: ' if us else 'Empresa: ')+snapshot['company_name']),
        paragraph(('Opportunity: ' if us else 'Oportunidade: ')+snapshot['opportunity_title'])]
    empty='To be completed' if us else 'A preencher'
    for field in ('project_name','contact_name','sender_name'):
        parts.append(paragraph(labels[field]+': '+(payload[field] or empty)))
    valid=payload['valid_until']
    if valid:
        year,month,day=valid.split('-');valid=f'{month}/{day}/{year}' if us else f'{day}/{month}/{year}'
    parts.append(paragraph(('Valid until: ' if us else 'Validade: ')+(valid or empty)))
    for field in ('scope','deliverables','materials','timeline','revisions','support','payment_terms','exclusions'):
        if field=='exclusions' and not payload[field]:continue
        parts.append(paragraph(labels[field],'heading'))
        parts.extend(paragraph(line or ' ') for line in (payload[field] or empty).splitlines())
    parts.extend([paragraph('Proposal price' if us else 'Preço da proposta','heading'),paragraph(price(payload['amount_minor'],payload['currency'],us)),
        paragraph('Conecta Imóveis 3D'),paragraph('https://conectaimoveis3d.com' if us else 'https://conectaimoveis3d.com.br')])
    with ZipFile(io.BytesIO(source)) as original:
        raw=original.read('word/document.xml')
        body=E.fromstring(raw).find('{'+W+'}body')
        if body is None or any((node.text or '').strip() for node in body.iter('{'+W+'}t')):
            raise HTTPException(409,'O timbrado deixou de ter corpo vazio. Revise o modelo antes de exportar.')
        start=re.search(rb'<w:body\b[^>]*>',raw);end=re.search(rb'</w:body>',raw)
        section=re.search(rb'<w:sectPr\b.*?</w:sectPr>',raw,re.S)
        if not start or not end or not section:raise HTTPException(409,'Estrutura do timbrado incompatível.')
        document=raw[:start.end()]+b''.join(parts)+section.group()+raw[end.start():]
        footer=original.read('word/footer1.xml')
        if us:footer=footer.replace(b'conectaimoveis3d.com.br',b'conectaimoveis3d.com').replace(b'UMA NOVA PERSPECTIVA.',b'A NEW PERSPECTIVE.').replace(b'(16) 98128-8075',b'+55 (16) 98128-8075')
        footer_status=status+' · '+reference+(' · No client acceptance recorded' if us else ' · Não registra aceite do cliente')
        footer=footer.replace(b'</w:ftr>',paragraph(footer_status,'footer',reviewed)+b'</w:ftr>')
        output=io.BytesIO()
        with ZipFile(output,'w',compression=ZIP_DEFLATED) as archive:
            for info in original.infolist():
                archive.writestr(info,document if info.filename=='word/document.xml' else footer if info.filename=='word/footer1.xml' else original.read(info.filename))
    return output.getvalue()

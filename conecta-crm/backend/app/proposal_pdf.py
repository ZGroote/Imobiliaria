"""PDF em memória do mesmo DOCX derivado, sem Office, shell ou recursos externos."""
import io
import os
import threading
from html import escape
from pathlib import Path
from xml.etree import ElementTree as E
from zipfile import ZipFile

from fastapi import HTTPException
from reportlab import __file__ as reportlab_file
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph,SimpleDocTemplate

from .proposal_docx import W,build as docx

FONT_LOCK=threading.Lock()


def fonts():
    with FONT_LOCK:
        for name,file in [('Conecta','arial.ttf'),('ConectaBold','arialbd.ttf')]:
            if name in pdfmetrics.getRegisteredFontNames():continue
            source=Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/file
            if not source.is_file():source=Path(reportlab_file).parent/'fonts'/('Vera.ttf' if name=='Conecta' else 'VeraBd.ttf')
            pdfmetrics.registerFont(TTFont(name,str(source)))


def value(node,name,attribute='val',default='0'):
    child=node.find('.//{'+W+'}'+name)
    return child.get('{'+W+'}'+attribute,default) if child is not None else default


def build(row,reviewed=False):
    fonts()
    with ZipFile(io.BytesIO(docx(row,reviewed))) as package:
        document=E.fromstring(package.read('word/document.xml'))
        section=document.find('.//{'+W+'}sectPr')
        size=section.find('{'+W+'}pgSz');margins=section.find('{'+W+'}pgMar')
        width,height=[int(size.get('{'+W+'}'+a))/20 for a in ('w','h')]
        left,right,top,bottom=[int(margins.get('{'+W+'}'+a))/20 for a in ('left','right','top','bottom')]
        header=E.fromstring(package.read('word/header1.xml'))
        extent=header.find('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}extent')
        image_width,image_height=[int(extent.get(a))/12700 for a in ('cx','cy')]
        image=ImageReader(io.BytesIO(package.read('word/media/image1.png')))
        footer=E.fromstring(package.read('word/footer1.xml'))
        footer_lines=[]
        for paragraph in footer.findall('{'+W+'}p'):
            line=''.join((node.text or '') if node.tag=='{'+W+'}t' else '\n' if node.tag=='{'+W+'}br' else '' for node in paragraph.iter())
            footer_lines.extend(line.splitlines())
        paragraphs=document.find('{'+W+'}body').findall('{'+W+'}p')
    if len(paragraphs)>1000:raise HTTPException(422,'Reduza as quebras de linha para exportar o PDF.')
    story=[]
    for p in paragraphs:
        text=''.join(t.text or '' for t in p.iter('{'+W+'}t'))
        bold=p.find('.//{'+W+'}b') is not None
        font='ConectaBold' if bold else 'Conecta'
        if any(ord(c) not in pdfmetrics.getFont(font).face.charWidths for c in text if not c.isspace()):
            raise HTTPException(422,'O PDF contém um caractere sem representação na fonte. Revise o texto ou use o Word.')
        heading=value(p,'pStyle') in ('Title','Heading1')
        size_pt=int(value(p,'sz',default='22'))/2
        style=ParagraphStyle('proposal',fontName=font,fontSize=size_pt,textColor=HexColor('#'+value(p,'color',default='1F2937')),
            leading=size_pt*1.25,spaceBefore=int(value(p,'spacing','before'))/20,spaceAfter=int(value(p,'spacing','after'))/20,
            keepWithNext=heading,allowWidows=0,allowOrphans=0,splitLongWords=1)
        story.append(Paragraph(escape(text) if text.strip() else '&#160;',style))
    output=io.BytesIO()
    us=row['payload']['profile_id']=='US'
    def page(canvas,document):
        if document.page>50:raise HTTPException(422,'O PDF excede 50 páginas. Reduza o conteúdo ou exporte Word.')
        canvas.saveState()
        y=height-int(margins.get('{'+W+'}header'))/20-image_height
        canvas.drawImage(image,left,y,width=image_width,height=image_height,mask='auto')
        canvas.setStrokeColor(HexColor('#0879E8'));canvas.setLineWidth(1.625)
        canvas.line(left,y-6,width-right,y-6)
        canvas.setFillColor(HexColor('#0C2448'));canvas.setFont('Conecta',8)
        for i,line in enumerate(footer_lines):
            # Footer text comes only from the trusted letterhead and generated status.
            canvas.drawCentredString(width/2,54-i*11,line)
        canvas.setFont('Conecta',7);canvas.setFillColor(HexColor('#6B7280'))
        canvas.drawRightString(width-right,17,('Page ' if us else 'Página ')+str(document.page))
        canvas.restoreState()
    document=SimpleDocTemplate(output,pagesize=(width,height),leftMargin=left,rightMargin=right,topMargin=top,bottomMargin=bottom,
        title='Commercial proposal' if us else 'Proposta comercial',author='Conecta Imóveis 3D',pageCompression=1)
    try:document.build(story,onFirstPage=page,onLaterPages=page)
    except HTTPException:raise
    except Exception:raise HTTPException(422,'Não foi possível diagramar o PDF. Revise o conteúdo ou exporte Word.') from None
    return output.getvalue()

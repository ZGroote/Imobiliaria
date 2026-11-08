"""Materiais derivados locais; aprovação do material não aprova proposta ou envio."""
import hashlib
import io
from typing import Literal
from zipfile import ZipFile,ZIP_DEFLATED

from fastapi import APIRouter,HTTPException,Request
from fastapi.responses import Response
from pydantic import Field,StrictInt
from sqlalchemy import text

from .branding_api import ASSETS,catalog
from .analysis_contract import Data,Hash
from .mail import rows

router=APIRouter(prefix='/api/brand-materials')
KINDS=('letterhead','signature')


def original():
    entry=next(a for a in catalog() if a['name'].startswith('Papel_Timbrado_'))
    path=(ASSETS/entry['name']).resolve()
    if path.parent!=ASSETS.resolve() or not path.is_file():raise HTTPException(409,'Timbrado original indisponível.')
    content=path.read_bytes()
    if hashlib.sha256(content).hexdigest()!=entry['id']:raise HTTPException(409,'O timbrado original mudou. Confira a biblioteca.')
    return entry,content


def material(profile,kind):
    if profile not in ('BR','US') or kind not in KINDS:raise HTTPException(404,'Material não encontrado.')
    entry,source=original();us=profile=='US'
    if kind=='signature':
        preview='João Groote\nConecta Imóveis 3D\n'+('A new perspective.\n+55 (16) 98128-8075\nhttps://conectaimoveis3d.com' if us else 'Uma nova perspectiva.\n(16) 98128-8075\nhttps://conectaimoveis3d.com.br')+'\n'
        content=preview.encode('utf-8');extension='txt';mime='text/plain; charset=utf-8'
    else:
        output=io.BytesIO()
        with ZipFile(io.BytesIO(source)) as package,ZipFile(output,'w',compression=ZIP_DEFLATED) as target:
            for info in package.infolist():
                data=package.read(info.filename)
                if us and info.filename=='word/footer1.xml':
                    data=data.replace(b'conectaimoveis3d.com.br',b'conectaimoveis3d.com').replace(b'UMA NOVA PERSPECTIVA.',b'A NEW PERSPECTIVE.').replace(b'(16) 98128-8075',b'+55 (16) 98128-8075')
                target.writestr(info,data)
        content=output.getvalue();extension='docx';mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        preview=('Timbrado derivado com rodapé em inglês, site .com e telefone +55. O logotipo original conserva o lema incorporado em português.' if us else 'Timbrado derivado com rodapé em português e site .com.br. Corpo vazio para preenchimento manual.')
    return dict(profile_id=profile,kind=kind,source_hash=entry['id'],content_hash=hashlib.sha256(content).hexdigest(),
        filename=('timbrado' if kind=='letterhead' else 'assinatura')+'-'+profile.lower()+'-adaptacao.'+extension,
        locale='en-US' if us else 'pt-BR',preview=preview,content=content,media_type=mime)


def view(c,profile,kind):
    result=material(profile,kind)
    history=rows(c,'SELECT id,content_hash,approved,occurred_at FROM brand_material_reviews WHERE profile_id=:p AND kind=:k ORDER BY id DESC LIMIT 20',p=profile,k=kind)
    latest=history[0] if history else None
    return dict({k:v for k,v in result.items() if k not in ('content','media_type')},review_id=latest['id'] if latest else 0,
        approved=bool(latest and latest['approved'] and latest['content_hash']==result['content_hash']),history=history,send_enabled=False)


class Review(Data):
    confirm:Literal[True]
    content_hash:Hash
    review_id:StrictInt=Field(ge=0)
    action:Literal['approve','revoke']


@router.get('')
def listing(request:Request):
    with request.app.state.engine.connect() as c:return dict(items=[view(c,p,k) for p in ('BR','US') for k in KINDS])


@router.get('/{profile}/{kind}/download')
def download(profile:str,kind:str,request:Request,content_hash:Hash):
    result=material(profile,kind)
    if result['content_hash']!=content_hash:raise HTTPException(409,'O material mudou. Confira a versão atual antes de baixar.')
    return Response(result['content'],media_type=result['media_type'],headers={'Content-Disposition':'attachment; filename="'+result['filename']+'"','Cache-Control':'no-store'})


@router.post('/{profile}/{kind}/review')
def review(profile:str,kind:str,body:Review,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE');current=view(c,profile,kind)
        if current['content_hash']!=body.content_hash or current['review_id']!=body.review_id:raise HTTPException(409,'O material ou a revisão mudou. Confira a versão atual antes de confirmar.')
        approved=body.action=='approve'
        if approved!=current['approved']:
            c.execute(text('INSERT INTO brand_material_reviews(profile_id,kind,content_hash,approved,occurred_at) VALUES(:p,:k,:h,:a,:d)'),dict(p=profile,k=kind,h=body.content_hash,a=int(approved),d=request.app.state.clock().isoformat()))
        return view(c,profile,kind)

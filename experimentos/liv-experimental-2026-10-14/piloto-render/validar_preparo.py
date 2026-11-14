"""Valida referências locais e produz folhas de contato; não aprova o splat futuro."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import statistics
from PIL import Image, ImageDraw, ImageFont
from validar_captura import validar


def preparar_relatorio(root):
    source = root/'apartamento.blend'
    capture = validar(root/'dataset', fonte=source)
    config = json.loads((root/'dataset/plano-captura.json').read_text(encoding='utf-8'))
    selection = json.loads((root/'amostras.json').read_text(encoding='utf-8'))
    rendered = json.loads((root/'amostras-renderizadas.json').read_text(encoding='utf-8'))
    assert rendered['source_sha256'] == config['source_sha256'], 'Amostras de outra cena'
    assert rendered['samples'] == config['amostras']
    assert rendered['resolution'] == [config['dataset']['w'],config['dataset']['h']]
    frames = config['dataset']['frames']
    rooms = sorted({f['comodo'] for f in frames})
    coverage = {}
    for room in rooms:
        subset = [f for f in frames if f['comodo'] == room]
        assert {f['pitch'] for f in subset} == {-60,0,60}, room
        for split in ('train','eval'):
            assert {f['pitch'] for f in subset if f['split'] == split} == {-60,0,60}, (room,split)
        coverage[room] = {'frames':len(subset), 'positions':len({f['position_id'] for f in subset}),
                          'splits':dict(Counter(f['split'] for f in subset)),
                          'pitches':dict(Counter(f['pitch'] for f in subset))}
    assert len(rooms) == 6 and len(selection) == 18
    expected = {f"dataset/{s['frame']['file_path']}" for s in selection}
    assert all(s['frame'] in frames for s in selection), 'Pose fora do plano final'
    assert expected == {Path(s['file_path']).as_posix() for s in rendered['images']}, 'Amostragem incompleta'
    assert all(row['object'] == 'GEO-porta-entrada-fechada' for row in rendered['entry_rays'])
    font_path = Path('C:/Windows/Fonts/segoeui.ttf')
    font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
    sheet = Image.new('RGB', (1080, 6*235), '#eef0f2')
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(selection):
        image_path = root/'dataset'/row['frame']['file_path']
        with Image.open(image_path) as image:
            assert image.size == (config['dataset']['w'],config['dataset']['h'])
            image.verify()
        with Image.open(image_path) as image:
            preview = image.convert('RGB').resize((360,203), Image.Resampling.LANCZOS)
        x, y = i%3*360, i//3*235
        sheet.paste(preview, (x,y+32))
        label = {-60:'Piso',0:'Horizonte',60:'Teto'}[row['pitch']]
        draw.text((x+8,y+6), f"{row['room']} · {label}", font=font, fill='#18212b')
    evidence = root/'evidencias'
    sheet.save(evidence/'amostras-seis-ambientes.jpg', quality=93)
    with Image.open(evidence/'entrada-original.png') as image: before = image.convert('RGB')
    with Image.open(evidence/'entrada-corrigida.png') as image: after = image.convert('RGB')
    roi = (1085,245,1125,300)
    old_gray, new_gray = before.convert('L').crop(roi), after.convert('L').crop(roi)
    old_mean = statistics.mean(old_gray.getdata())
    new_mean = statistics.mean(new_gray.getdata())
    assert old_mean < 10 and new_mean > 80, ('Preto da entrada persiste',old_mean,new_mean)
    comparison = Image.new('RGB', (1265, 2*(468+32)), '#eef0f2')
    draw = ImageDraw.Draw(comparison)
    for i, (label, image) in enumerate((('Antes: entrada sem folha',before),('Depois: porta fechada nas medidas da planta',after))):
        y = i*500
        draw.text((10,y+6), label, font=font, fill='#18212b')
        comparison.paste(image,(0,y+32))
    comparison.save(evidence/'entrada-antes-depois.jpg', quality=94)
    originals = json.loads((root/'amostras-originais-renderizadas.json').read_text(encoding='utf-8'))
    assert originals['source_sha256'] == config['source_sha256'], 'Comparação de vidro com geometria diferente'
    assert originals['glass_override'] == 'MAT-vidro-volumetrico-original'
    assert originals['images'], 'Comparação original ausente'
    glass_sheet = Image.new('RGB', (1280, len(originals['images'])*392), '#eef0f2')
    draw = ImageDraw.Draw(glass_sheet)
    for i, row in enumerate(originals['images']):
        relative = Path(row['file_path']).relative_to('originais')
        with Image.open(root/row['file_path']) as image:
            old = image.convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
        with Image.open(root/'dataset'/relative) as image:
            new = image.convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
        y = i*392
        draw.text((8,y+6), row['room']+' · vidro original',font=font,fill='#18212b')
        draw.text((648,y+6), 'Vidro fino · mesma câmera',font=font,fill='#18212b')
        glass_sheet.paste(old,(0,y+32))
        glass_sheet.paste(new,(640,y+32))
    glass_sheet.save(evidence/'vidros-antes-depois.jpg',quality=94)
    balcony = next(s for s in selection if s['room'].startswith('Varanda') and s['pitch'] == 0)
    balcony_file = balcony['frame']['file_path']
    previous = root.parent/'correcao-20261016-antes-fundo/dataset'/balcony_file
    with Image.open(previous) as image: sky_before = image.convert('RGB')
    with Image.open(root/'dataset'/balcony_file) as image: sky_after = image.convert('RGB')
    sky_roi = (500,570,700,630)
    sky_old_mean = statistics.mean(sky_before.convert('L').crop(sky_roi).getdata())
    sky_new_mean = statistics.mean(sky_after.convert('L').crop(sky_roi).getdata())
    assert sky_old_mean < 50 and sky_new_mean > 80, ('Fundo externo continua preto',sky_old_mean,sky_new_mean)
    sky_sheet = Image.new('RGB',(1280,2*752),'#eef0f2')
    draw = ImageDraw.Draw(sky_sheet)
    for i, (label,image) in enumerate((('Antes: céu sem fundo abaixo do horizonte',sky_before),
                                      ('Depois: fundo neutro, sem representar a vista real',sky_after))):
        draw.text((8,i*752+6),label,font=font,fill='#18212b')
        sky_sheet.paste(image,(0,i*752+32))
    sky_sheet.save(evidence/'varanda-fundo-antes-depois.jpg',quality=94)
    report = {'stage':'REFERENCIAS_LOCAIS_VERIFICADAS_TREINO_PENDENTE',
              'corrected_source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
              'sample_count':len(selection), 'samples':config['amostras'],
              'coverage':coverage, 'entry_roi_mean_before':old_mean,'entry_roi_mean_after':new_mean,
              'balcony_background_mean_before':sky_old_mean,'balcony_background_mean_after':sky_new_mean,
              'capture':capture, 'splat_visually_approved':False,
              'note':'A inspeção destas referências não mede a nitidez de uma reconstrução ainda não treinada.'}
    (root/'validacao-local.json').write_text(json.dumps(report,ensure_ascii=False,indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pasta',type=Path)
    args = parser.parse_args()
    print(json.dumps(preparar_relatorio(args.pasta),ensure_ascii=False,indent=2))

"""
============================================================================
 FOLHAS DE IMAGEM -> pranchas do Design, com cotas em METROS
============================================================================

    python geracao-de-documentos/preparar-folhas-imagem.py <pasta de saida>
    node geracao-de-documentos/gerar-croqui-design.mjs --folhas-imagem <saida>/folhas-imagem.json          --blobs <mapa arquivo -> url do upload> --logo <url> --saida <pasta>

Seis croquis nao vem de plant.js: T-01, CR-01 e CR-02 (PDF vetorial de um colega) e F-01,
D-01 e F-02 (imagens). Este script os prepara para virar pranchas editaveis:

  - PDF vetorial de um colega: a vista do equipamento e uma imagem; cotas e textos sao vetor.
    A imagem sai limpa (so a parte visivel, aparada) e cada traco ou texto
    vetorial vira um elemento proprio, ja na posicao da folha.
  - Imagens: as cotas estao desenhadas na imagem, em mm. Cada numero e apagado
    e um rotulo novo, em m, entra por cima no mesmo lugar e do mesmo tamanho.

Saida: <pasta>/imagens/* (para subir ao canvas) e <pasta>/folhas-imagem.json.
Depende de PyMuPDF e Pillow.
"""
import json
import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
NOVOS = AQUI / 'Novos croquis'

# Area util da folha para o desenho, em mm: dentro da moldura e acima do carimbo.
AREA = {'x0': 14, 'x1': 196, 'y0': 16, 'y1': 250}
TITULO_GAP = 7.0          # da base da vista a linha de base do titulo


def recortes_imagem(caminho):
    """As duas vistas de uma imagem: separadas pela maior faixa em branco."""
    img = Image.open(caminho).convert('RGB')
    w, h = img.size
    tinta_ = img.convert('L').point(lambda v: 255 if v < 170 else 0)
    linhas = [tinta_.crop((0, y, w, y + 1)).getbbox() is not None for y in range(h)]
    melhor, ini = (0, 0), None
    for y in range(int(h * 0.2), int(h * 0.8)):
        if not linhas[y]:
            ini = y if ini is None else ini
            if y - ini > melhor[1] - melhor[0]:
                melhor = (ini, y)
        else:
            ini = None
    corte = (melhor[0] + melhor[1]) // 2
    partes = []
    for a, b in [(0, corte), (corte, h)]:
        bx = tinta_.crop((0, a, w, b)).getbbox()
        m = 10
        partes.append(img.crop((max(0, bx[0] - m), max(0, a + bx[1] - m),
                                min(w, bx[2] + m), min(h, a + bx[3] + m))))
    return partes


def empilhar(tamanhos):
    """Duas vistas empilhadas, mesma escala, centradas na area util.
    tamanhos: [(w, h)] na unidade da fonte -> [(Rect em mm, y do titulo)]."""
    largura = AREA['x1'] - AREA['x0']
    altura = AREA['y1'] - AREA['y0']
    folga_titulos = len(tamanhos) * (TITULO_GAP + 6)
    s = min(min(largura / w for w, _ in tamanhos),
            (altura - folga_titulos) / sum(h for _, h in tamanhos))
    total = sum(h * s for _, h in tamanhos) + folga_titulos
    y = AREA['y0'] + (altura - total) / 2
    cx = (AREA['x0'] + AREA['x1']) / 2
    saida = []
    for w, h in tamanhos:
        r = pymupdf.Rect(cx - w * s / 2, y, cx + w * s / 2, y + h * s)
        saida.append((r, r.y1 + TITULO_GAP))
        y = r.y1 + TITULO_GAP + 6
    return saida


SAIDA = Path(sys.argv[1])
IMGS = SAIDA / 'imagens'
IMGS.mkdir(parents=True, exist_ok=True)
VETORIAL = pymupdf.open(NOVOS / 'Croquis vetoriais.pdf')

ASC = 0.716   # altura dos algarismos da Arial, em em


def fmt_m(mm, d=2):
    return f'{mm / 1000:.{d}f}'.replace('.', ',') + ' m'


# ------------------------------------------------------------------ PNGs
# Janela (x0, y0, x1, y1) em px do recorte, que contem SO o numero;
# rot = texto vertical; maxlen = comprimento maximo do rotulo novo (px).
PNG = {
    'F-01': [
        [('2510', (535, 3, 605, 33), False, None), ('200', (115, 45, 170, 74), False, 68),
         ('2110', (540, 45, 605, 74), False, None), ('200', (995, 45, 1050, 74), False, 68),
         ('Ø 2090', (5, 200, 36, 300), True, None), ('700', (5, 385, 36, 445), True, 90),
         ('2910', (550, 468, 615, 498), False, None)],
        [('Ø 2090', (295, 3, 415, 34), False, None), ('700', (5, 295, 36, 365), True, 140),
         ('2710', (300, 445, 370, 478), False, None)],
    ],
    'F-02': [
        [('1770', (460, 3, 530, 35), False, None), ('150', (115, 50, 170, 80), False, 70),
         ('1470', (460, 50, 530, 80), False, None), ('150', (820, 50, 880, 80), False, 70),
         ('Ø 1480', (5, 205, 38, 305), True, None), ('500', (5, 380, 38, 432), True, 86),
         ('2070', (490, 462, 560, 495), False, None)],
        [('Ø 1480', (265, 3, 395, 35), False, None), ('500', (5, 270, 38, 330), True, 140),
         ('1760', (290, 405, 355, 438), False, None)],
    ],
    'D-01': [
        [('3100', (5, 270, 32, 340), True, None), ('2200', (65, 295, 92, 365), True, None),
         ('900', (65, 480, 92, 530), True, 100), ('Ø 1800', (325, 252, 410, 280), False, None)],
        [('2100', (235, 5, 295, 32), False, None), ('Ø 1800', (225, 43, 305, 72), False, None),
         ('2100', (5, 220, 32, 285), True, None)],
    ],
}
ARQ_PNG = {
    'F-01': 'Desenho técnico de tambor rotativo industrial.png',
    'D-01': 'Desenho técnico de tanque vertical com agitador.png',
    'F-02': 'Desenho técnico de tambor cilíndrico cotado (2).png',
}
TITULOS_PNG = {
    'F-01': ['VISTA LONGITUDINAL', 'VISTA TRANSVERSAL'],
    'F-02': ['VISTA LONGITUDINAL', 'VISTA TRANSVERSAL'],
    'D-01': ['VISTA FRONTAL', 'VISTA SUPERIOR'],
}


def tinta(img, caixa, limiar=150):
    x0, y0, x1, y1 = caixa
    bb = img.crop(caixa).convert('L').point(lambda v: 255 if v < limiar else 0).getbbox()
    if not bb:
        raise RuntimeError(f'sem tinta em {caixa}')
    return (x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3])


def u_larg(t):
    """Largura em em (Arial), so para os caracteres que aparecem aqui."""
    W = {'0': .556, '1': .556, '2': .556, '3': .556, '4': .556, '5': .556, '6': .556,
         '7': .556, '8': .556, '9': .556, ',': .278, ' ': .278, 'm': .833, 'Ø': .778}
    return sum(W.get(c, .556) for c in t)


def folha_png(tag):
    partes = recortes_imagem(NOVOS / ARQ_PNG[tag])
    vistas = []
    for k, (im, numeros) in enumerate(zip(partes, PNG[tag])):
        im = im.convert('RGB')
        limpa = im.copy()
        d = ImageDraw.Draw(limpa)
        rotulos = []
        for orig, janela, rot, maxlen in numeros:
            bx = tinta(im, janela)
            d.rectangle((bx[0] - 3, bx[1] - 3, bx[2] + 3, bx[3] + 3), fill=(255, 255, 255))
            valor = float(orig.replace('Ø', '').strip())
            novo = ('Ø ' if orig.startswith('Ø') else '') + fmt_m(valor)
            alt = (bx[2] - bx[0]) if rot else (bx[3] - bx[1])   # altura dos algarismos
            fs = alt / ASC * (0.93 if orig.startswith('Ø') else 1.0)
            if maxlen:
                fs = min(fs, maxlen / u_larg(novo))
            rotulos.append({'cx': (bx[0] + bx[2]) / 2, 'cy': (bx[1] + bx[3]) / 2,
                            't': novo, 'fs': fs, 'rot': rot, 'de': orig})
        arq = IMGS / f'{tag}-{k}.png'
        limpa.save(arq, optimize=True)
        vistas.append({'arq': arq, 'w': im.width, 'h': im.height, 'rotulos': rotulos,
                       'tracos': [], 'titulo': TITULOS_PNG[tag][k]})
    return vistas


# ------------------------------------------------------------------ PDF vetorial
def svg_do_desenho(dr):
    """Um desenho do PyMuPDF -> (d do path, atributos, pontos) em pt."""
    partes, pts, atual = [], [], None
    for it in dr['items']:
        op = it[0]
        if op == 'l':
            a, b = it[1], it[2]
            if atual is None or abs(atual.x - a.x) > 1e-3 or abs(atual.y - a.y) > 1e-3:
                partes.append(f'M{a.x:.2f},{a.y:.2f}')
            partes.append(f'L{b.x:.2f},{b.y:.2f}')
            pts += [a, b]; atual = b
        elif op == 'c':
            a, c1, c2, b = it[1:5]
            if atual is None or abs(atual.x - a.x) > 1e-3 or abs(atual.y - a.y) > 1e-3:
                partes.append(f'M{a.x:.2f},{a.y:.2f}')
            partes.append(f'C{c1.x:.2f},{c1.y:.2f} {c2.x:.2f},{c2.y:.2f} {b.x:.2f},{b.y:.2f}')
            pts += [a, c1, c2, b]; atual = b
        elif op == 're':
            r = it[1]
            partes.append(f'M{r.x0:.2f},{r.y0:.2f}H{r.x1:.2f}V{r.y1:.2f}H{r.x0:.2f}Z')
            pts += [r.tl, r.br]; atual = None
        elif op == 'qu':
            q = it[1]
            partes.append(f'M{q.ul.x:.2f},{q.ul.y:.2f}L{q.ur.x:.2f},{q.ur.y:.2f}'
                          f'L{q.lr.x:.2f},{q.lr.y:.2f}L{q.ll.x:.2f},{q.ll.y:.2f}Z')
            pts += [q.ul, q.lr]; atual = None
    if dr.get('closePath'):
        partes.append('Z')
    return ' '.join(partes), pts


def folha_vetorial(tag, paginas, titulos):
    vistas = []
    for k, pno in enumerate(paginas):
        pg = VETORIAL[pno]
        # imagem: so a parte visivel, aparada na tinta e ampliada 3x (a fonte
        # tem pouca resolucao; ampliar com Lanczos evita o serrilhado no PDF)
        # A imagem do Canva tem mais coisa do que aparece: o slide a recorta
        # (no CR-01 ha outra vista e uma faixa de titulo escondidas). Por isso
        # nao se extrai a imagem: renderiza-se a pagina sem os vetores e sem os
        # textos, com o recorte do slide valendo, a ~3x a resolucao da origem.
        info = pg.get_image_info(xrefs=True)[0]
        px_pt = info['width'] / pymupdf.Rect(info['bbox']).width
        dpi = round(px_pt * 3 * 72)
        so_img = pymupdf.open()
        so_img.insert_pdf(VETORIAL, from_page=pno, to_page=pno)
        sp = so_img[0]
        sp.add_redact_annot(sp.rect, fill=False)
        sp.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                            graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
                            text=pymupdf.PDF_REDACT_TEXT_REMOVE)
        pix = sp.get_pixmap(dpi=dpi, alpha=False)
        vis = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        kx = pix.width / sp.rect.width
        bb = vis.convert('L').point(lambda v: 255 if v < 200 else 0).getbbox()
        m = 12
        bb = (max(0, bb[0] - m), max(0, bb[1] - m), min(vis.width, bb[2] + m), min(vis.height, bb[3] + m))
        recorte = vis.crop(bb)
        img_pt = pymupdf.Rect(bb[0] / kx, bb[1] / kx, bb[2] / kx, bb[3] / kx)
        arq = IMGS / f'{tag}-{k}.jpg'           # a origem ja e JPEG
        recorte.save(arq, quality=90, optimize=True)

        tracos = []
        for dr in pg.get_drawings():
            visivel_f = dr.get('fill') is not None and (dr.get('fill_opacity') or 0) > 0
            visivel_s = dr.get('color') is not None and (dr.get('stroke_opacity') or 0) > 0
            if not (visivel_f or visivel_s):
                continue
            if dr['rect'].width >= pg.rect.width - 1:      # fundo branco da pagina
                continue
            d, pts = svg_do_desenho(dr)
            at = {}
            at['fill'] = '#000' if visivel_f else 'none'
            if visivel_s:
                at['stroke'] = '#000'
                at['stroke-width'] = dr['width']
                cap = (dr.get('lineCap') or (0,))[0]
                at['stroke-linecap'] = ['butt', 'round', 'square'][cap]
                at['stroke-linejoin'] = 'round'
            tracos.append({'d': d, 'at': at, 'pts': [[p.x, p.y] for p in pts]})

        rotulos = []
        for b in pg.get_text('dict')['blocks']:
            for ln in b.get('lines', []):
                for s in ln['spans']:
                    t = s['text'].strip()
                    if not t or s['font'].endswith('Bold'):      # titulo "CR - 01"
                        continue
                    if t.endswith(' mm'):                       # "5 mm" -> metros
                        t = fmt_m(float(t[:-3].replace(',', '.')), 3)
                    r = pymupdf.Rect(s['bbox'])
                    rotulos.append({'cx': (r.x0 + r.x1) / 2, 'cy': s['origin'][1] - s['size'] * 0.36,
                                    't': t, 'fs': s['size'], 'rot': False, 'de': s['text']})
        vistas.append({'arq': arq, 'img_pt': list(img_pt), 'tracos': tracos, 'rotulos': rotulos,
                       'titulo': titulos[k], 'pagina': pno})
    return vistas


# ------------------------------------------------------------------ layout
def montar(tag, vistas, fonte):
    """Converte tudo para mm da folha, empilhando as duas vistas."""
    caixas = []
    for v in vistas:
        if fonte == 'png':
            caixas.append(pymupdf.Rect(0, 0, v['w'], v['h']))
        else:
            r = pymupdf.Rect(v['img_pt'])
            for tr in v['tracos']:
                for x, y in tr['pts']:
                    r |= pymupdf.Point(x, y)
            for t in v['rotulos']:
                L = u_larg(t['t']) * t['fs']
                r |= pymupdf.Rect(t['cx'] - L / 2, t['cy'] - t['fs'] / 2, t['cx'] + L / 2, t['cy'] + t['fs'] / 2)
            caixas.append(r)
    pos = empilhar([(c.width, c.height) for c in caixas])
    saida = []
    for v, c, (alvo, y_tit) in zip(vistas, caixas, pos):
        s = alvo.width / c.width
        X = lambda x: alvo.x0 + (x - c.x0) * s
        Y = lambda y: alvo.y0 + (y - c.y0) * s
        if fonte == 'png':
            img = [alvo.x0, alvo.y0, alvo.width, alvo.height]
        else:
            ip = pymupdf.Rect(v['img_pt'])
            img = [X(ip.x0), Y(ip.y0), ip.width * s, ip.height * s]
        tracos = []
        for tr in v['tracos']:
            # o path vai em pt; o Node aplica a mesma transformacao
            tracos.append({'d': tr['d'], 'at': tr['at'], 'pts': [[X(x), Y(y)] for x, y in tr['pts']]})
        rotulos = [{'x': X(t['cx']), 'y': Y(t['cy']), 't': t['t'], 'fs': t['fs'] * s,
                    'rot': t['rot'], 'de': t['de']} for t in v['rotulos']]
        saida.append({'titulo': v['titulo'], 'tituloX': alvo.x0 + alvo.width / 2, 'tituloY': y_tit,
                      'img': img, 'arq': v['arq'].name, 'tracos': tracos, 'rotulos': rotulos,
                      'transf': [s, alvo.x0 - c.x0 * s, alvo.y0 - c.y0 * s]})
    return saida


FOLHAS = [
    ('T-01', 'vetorial', [4, 5], ['VISTA FRONTAL', 'VISTA SUPERIOR']),
    ('CR-01', 'vetorial', [0, 1], ['VISTA FRONTAL', 'VISTA SUPERIOR']),
    ('F-01', 'png', None, None),
    ('D-01', 'png', None, None),
    ('CR-02', 'vetorial', [2, 3], ['VISTA FRONTAL', 'VISTA SUPERIOR']),
    ('F-02', 'png', None, None),
]
spec_out = []
for tag, fonte, pags, tits in FOLHAS:
    vistas = folha_vetorial(tag, pags, tits) if fonte == 'vetorial' else folha_png(tag)
    spec_out.append({'tag': tag, 'vistas': montar(tag, vistas, fonte)})
    print(tag, [(v['arq'], len(v['tracos']), [r['t'] for r in v['rotulos']]) for v in spec_out[-1]['vistas']])

(SAIDA / 'folhas-imagem.json').write_text(json.dumps(spec_out, ensure_ascii=False, indent=1), encoding='utf-8')

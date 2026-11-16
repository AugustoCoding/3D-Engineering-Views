"""
Rosto do companion: recorta o rosto de uma foto e grava `src/data/rosto.local.js`.

A foto e de uma pessoa de verdade: nem ela nem o arquivo gerado entram no git
(`*.local.js` esta no .gitignore). Sem o arquivo, o companion sai sem rosto.

Uso: python scripts/rosto-companion.py [foto] [x0 y0 x1 y1]
  foto   padrao: a primeira imagem de `../Imagens para a maquete/`
  caixa  o retangulo do rosto na foto, do cabelo (acima da linha dele) ao
         queixo e de orelha a orelha; padrao: a fracao central abaixo
"""
import base64
import io
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA = RAIZ.parent / 'Imagens para a maquete'
SAIDA = RAIZ / 'src' / 'data' / 'rosto.local.js'
# fracao da foto (retrato de frente, rosto no meio) [ADOTADO, conferido na imagem]
CAIXA = (0.153, 0.125, 0.814, 0.762)
LARGURA = 256

args = sys.argv[1:]
foto = pathlib.Path(args[0]) if args and not args[0].replace('.', '').isdigit() else None
if foto is None:
    fotos = sorted(p for p in PASTA.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') and '.previa' not in p.name)
    if not fotos:
        sys.exit(f'nenhuma imagem em {PASTA.name}/')
    foto = fotos[0]
nums = [float(a) for a in args if a.replace('.', '').isdigit()]

im = Image.open(foto).convert('RGB')
W, H = im.size
caixa = tuple(nums) if len(nums) == 4 else (CAIXA[0] * W, CAIXA[1] * H, CAIXA[2] * W, CAIXA[3] * H)
rosto = im.crop(tuple(int(v) for v in caixa))
rosto = rosto.resize((LARGURA, round(LARGURA * rosto.height / rosto.width)), Image.LANCZOS)
w, h = rosto.size

# tom de pele: a media da testa (bem iluminada), que e a cor do resto do corpo
amostra = rosto.crop((int(w * 0.38), int(h * 0.13), int(w * 0.62), int(h * 0.19))).resize((1, 1), Image.BOX)
pele = amostra.getpixel((0, 0))

# as bordas dos lados e de baixo se desfazem no tom de pele (a cabeca tem essa
# cor); a de cima fica: e cabelo, e encosta no cabelo da figura
mascara = Image.new('L', (w, h), 0)
d = ImageDraw.Draw(mascara)
d.rectangle((int(w * 0.09), -40, int(w * 0.91), int(h * 0.5)), fill=255)
d.ellipse((int(w * 0.09), int(h * 0.02), int(w * 0.91), int(h * 0.97)), fill=255)   # o queixo: sem a gola nos cantos
mascara = mascara.filter(ImageFilter.GaussianBlur(w * 0.045))
final = Image.composite(rosto, Image.new('RGB', (w, h), pele), mascara)

buf = io.BytesIO()
final.save(buf, 'JPEG', quality=82)
dados = base64.b64encode(buf.getvalue()).decode()
cor = '0x%02x%02x%02x' % pele
SAIDA.write_text(
    '// Saida de scripts/rosto-companion.py: nao se edita, e NAO entra no git\n'
    '// (e o rosto de uma pessoa de verdade).\n'
    f"export const ROSTO = {{ pele: {cor}, imagem: 'data:image/jpeg;base64,{dados}' }};\n",
    encoding='utf-8')
print(f'{SAIDA.name}: {w}x{h}, {len(dados) // 1024} kB, pele {cor}')

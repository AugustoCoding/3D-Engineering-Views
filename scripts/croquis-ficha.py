"""
Croquis oficiais na ficha (Fase 24).

Le o `Croquis-unificados.pdf` da pasta dos documentos finais (so leitura: a
fonte da verdade nao se altera), acha em cada folha a TAG pelo carimbo
("Equipamento: ... — R-01"), rende a folha e grava `src/data/croquis.js`,
que a ficha do equipamento mostra. Saida de script: nao se edita a mao.

    npm run croquis-ficha        (precisa de PyMuPDF e Pillow)

A folha vai em WebP a 150 dpi: le-se a cota menor do carimbo e cada uma
pesa ~50 kB, o HTML unico cresce ~0,6 MB pelas dez.
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

import os
import pymupdf
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
# Os documentos finais ficam FORA do repositorio (ele e publico e eles
# trazem os nomes do grupo): na pasta ao lado, ou onde DOCS_PRIVADOS apontar.
# A saida (src/data/croquis.js) tambem leva os nomes do carimbo: esta no
# .gitignore e nao se commita.
DOCS = Path(os.environ.get('DOCS_PRIVADOS', RAIZ.parent / 'documentos-privados'))
PDF = DOCS / 'Especificações dos Equipamentos' / 'Croquis-unificados.pdf'
SAIDA = RAIZ / 'src' / 'data' / 'croquis.js'
DPI, QUALIDADE = 150, 72


def campo(texto, rotulo):
    m = re.search(rf'{rotulo}:\s*([^\n]+)', texto)
    return m.group(1).strip() if m else None


def main():
    doc = pymupdf.open(PDF)
    croquis = {}
    for i, pagina in enumerate(doc):
        texto = pagina.get_text()
        m = re.search(r'Equipamento:\s*(.+?)\s+[—-]\s+([A-Z]{1,2}-\d{2})', texto)
        if not m:
            sys.exit(f'folha {i + 1}: sem TAG no carimbo — o PDF mudou?')
        nome, tag = m.group(1).strip(), m.group(2)
        if tag in croquis:
            sys.exit(f'folha {i + 1}: {tag} repetida (ja na folha {croquis[tag]["folha"]})')
        escala = re.search(r'(Escala\s+1:\d+|Sem escala)', texto)
        pix = pagina.get_pixmap(dpi=DPI)
        img = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        buf = io.BytesIO()
        img.save(buf, 'webp', quality=QUALIDADE, method=6)
        croquis[tag] = {
            'folha': i + 1,
            'nome': nome,
            'escala': escala.group(1) if escala else None,
            'desenhado': campo(texto, 'Desenhado por'),
            'revisado': campo(texto, 'Revisado por'),
            'aprovado': campo(texto, 'Aprovado por'),
            'data': re.search(r'\d{2}/\d{2}/\d{4}', texto).group(0),
            'largura': img.width, 'altura': img.height,
            'img': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'),
        }
        print(f'folha {i + 1}: {tag} ({nome}) — {len(buf.getvalue()) // 1024} kB')

    linhas = [
        '/**',
        ' *  CROQUIS OFICIAIS NA FICHA (Fase 24) — gerado por scripts/croquis-ficha.py',
        ' *  a partir de "Especificações dos Equipamentos/Croquis-unificados.pdf".',
        ' *  Arquivo de saida: NAO edite a mao; rode `npm run croquis-ficha`.',
        ' *  [OFICIAL] cada folha como a equipe entregou; a TAG sai do carimbo.',
        ' */',
        'export const FONTE_CROQUIS = \'Croquis-unificados.pdf\';',
        'export const CROQUIS = {',
    ]
    for tag, c in croquis.items():
        linhas.append(f'  {json.dumps(tag)}: {json.dumps(c, ensure_ascii=False)},')
    linhas.append('};')
    SAIDA.write_text('\n'.join(linhas) + '\n', encoding='utf-8', newline='\n')
    total = SAIDA.stat().st_size // 1024
    print(f'{SAIDA.relative_to(RAIZ)}: {len(croquis)} folhas, {total} kB')


if __name__ == '__main__':
    main()

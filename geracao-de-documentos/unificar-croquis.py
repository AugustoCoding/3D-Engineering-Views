"""
============================================================================
 CROQUIS UNIFICADOS  ->  um PDF A4, um equipamento por folha, na ordem do
 processo, todos com a moldura e o carimbo do R-01 e cotas em metros.
============================================================================

    python geracao-de-documentos/unificar-croquis.py --pranchas <pasta> --assets <mapa.json>

Todas as folhas vem das pranchas do Design (.dc.html) — as mesmas que se
corrigem a mao no canvas. Baixe a versao editada para a pasta e rode de novo:
o PDF sai com as correcoes.

As imagens das pranchas sao uploads do canvas (/_blob/<id>). O mapa diz onde
esta a copia local de cada uma: {"<id>": "<caminho>"}. O logotipo, se faltar
no mapa, vem do Logo.png desta pasta.

Depende de: PyMuPDF (pip install pymupdf) e um Chrome ou Edge.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

AQUI = Path(__file__).resolve().parent
NOVOS = AQUI / 'Novos croquis'
LOGO = AQUI / 'Logo.png'

# Ordem do processo; o R-01 e a prancha de entrada do canvas.
FOLHAS = [('R-01', 'Main.dc.html'), ('V-01', 'V-01.dc.html'), ('V-02', 'V-02.dc.html'),
          ('TK-01', 'TK-01.dc.html'), ('T-01', 'T-01.dc.html'), ('CR-01', 'CR-01.dc.html'),
          ('F-01', 'F-01.dc.html'), ('D-01', 'D-01.dc.html'), ('CR-02', 'CR-02.dc.html'),
          ('F-02', 'F-02.dc.html')]


def chrome():
    for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
              r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
              os.environ.get('CHROME_PATH', '')]:
        if p and Path(p).exists():
            return p
    sys.exit('Nenhum Chrome/Edge encontrado. Defina CHROME_PATH.')


def corpo_da_prancha(arquivo, assets):
    """O conteudo de uma prancha .dc.html, pronto para a pagina de impressao."""
    src = arquivo.read_text(encoding='utf-8')
    m = re.search(r'<x-dc>(.*)</x-dc>', src, re.S)
    if not m:
        sys.exit(f'{arquivo} nao parece uma prancha do Design (sem <x-dc>).')
    corpo = re.sub(r'<helmet>.*?</helmet>', '', m.group(1), flags=re.S)
    if '{{' in corpo:
        print(f'  aviso: {arquivo.name} tem campos {{{{...}}}}, que saem como texto no PDF')

    def local(mt):
        bid = mt.group(1)
        if bid in assets:
            return Path(assets[bid]).resolve().as_uri()
        if 'logotipo' in corpo[max(0, mt.start() - 200):mt.start()]:
            return LOGO.as_uri()
        sys.exit(f'{arquivo.name}: imagem /_blob/{bid} sem copia local no mapa de --assets.')
    return re.sub(r'(?<=src=")[^"]*/_blob/([0-9a-f]{32})', local, corpo)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pranchas', required=True, type=Path, help='pasta com as 10 pranchas .dc.html')
    ap.add_argument('--assets', type=Path, help='mapa {id do upload: copia local}')
    ap.add_argument('--saida', type=Path, default=NOVOS / 'Croquis-unificados.pdf')
    a = ap.parse_args()
    assets = json.loads(a.assets.read_text(encoding='utf-8')) if a.assets else {}

    paginas, sumario = [], []
    for tag, arq in FOLHAS:
        corpo = corpo_da_prancha(a.pranchas / arq, assets)
        paginas.append(corpo)
        nome = re.search(r'Equipamento: ([^<]*) — ', corpo)
        sumario.append(f"{tag} — {nome.group(1) if nome else ''}".strip(' —'))

    tmp = Path(tempfile.mkdtemp(prefix='croquis-'))
    try:
        doc_html = ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>',
                    '@page { size: A4 portrait; margin: 0; }',
                    'html, body { margin: 0; padding: 0; background: #fff; }',
                    # o fundo branco dos rotulos faz o papel do halo do SVG; sem
                    # isto o Chrome nao o imprime e as linhas cruzam o texto
                    '* { print-color-adjust: exact; -webkit-print-color-adjust: exact; }',
                    'body { font-family: Arial, Helvetica, sans-serif; color: #000; }',
                    '.folha { position: relative; width: 210mm; height: 297mm; overflow: hidden;',
                    '         break-after: page; }',
                    '.folha:last-child { break-after: auto; }',
                    '</style></head><body>']
        doc_html += [f'<section class="folha">{p}</section>' for p in paginas]
        doc_html.append('</body></html>')
        html_path = tmp / 'croquis.html'
        html_path.write_text('\n'.join(doc_html), encoding='utf-8')

        base = tmp / 'base.pdf'
        subprocess.run([chrome(), '--headless', '--disable-gpu', '--no-pdf-header-footer',
                        f'--print-to-pdf={base}', html_path.as_uri()],
                       check=True, capture_output=True, timeout=180)

        doc = pymupdf.open(base)
        if doc.page_count != len(FOLHAS):
            sys.exit(f'O navegador gerou {doc.page_count} paginas, esperava {len(FOLHAS)}.')
        doc.set_toc([[1, s, k + 1] for k, s in enumerate(sumario)])
        doc.set_metadata({'title': 'Croquis dos equipamentos — Unidade de Ácido Benzoico',
                          'author': 'Benzoic Industries'})
        a.saida.parent.mkdir(parents=True, exist_ok=True)
        doc.save(a.saida, garbage=3, deflate=True)
        print(f'OK  {a.saida}  ({doc.page_count} folhas, {a.saida.stat().st_size // 1024} KB)')
        for k, s in enumerate(sumario):
            print(f'    {k + 1:2d}  {s}')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()

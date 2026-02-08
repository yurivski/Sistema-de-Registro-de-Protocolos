# -*- mode: python ; coding: utf-8 -*-
# SISREGIP - PyInstaller Spec File
# Sistema de Registro de Protocolos do Microfilme

import sys
from pathlib import Path

block_cipher = None

# Caminho base do projeto
base_path = Path('C:/Sistema_microfilme')

# Dados a serem incluídos (arquivos e pastas)
datas = [
    # Templates HTML
    (str(base_path / 'templates'), 'templates'),
    
    # Arquivos estáticos
    (str(base_path / 'static'), 'static'),
    
    # Imagens
    (str(base_path / 'intendencia.png'), '.'),
    (str(base_path / 'icone.ico'), '.'),
    
    # Service Worker
    (str(base_path / 'service-worker.js'), '.'),
    
    # Arquivo .env (IMPORTANTE: credenciais do banco)
    (str(base_path / '.env'), '.'),
]

# Imports ocultos necessários
hiddenimports = [
    # Flask e extensões
    'flask',
    'flask_cors',
    'flask.json',
    'flask.templating',
    
    # PostgreSQL
    'psycopg2',
    'psycopg2.extensions',
    'psycopg2.extras',
    
    # PDF
    'pypdf',
    'pypdf.generic',
    
    # ReportLab
    'reportlab',
    'reportlab.lib',
    'reportlab.lib.pagesizes',
    'reportlab.lib.styles',
    'reportlab.lib.units',
    'reportlab.lib.colors',
    'reportlab.platypus',
    'reportlab.pdfgen',
    'reportlab.pdfgen.canvas',
    
    # Eel (interface)
    'eel',
    'eel.browsers',
    
    # Outros
    'dotenv',
    'datetime',
    'threading',
    'webbrowser',
    'tempfile',
    'glob',
    'shutil',
    'platform',
    'subprocess',
    
    # Encoding
    'encodings.utf_8',
    'encodings.cp1252',
    'encodings.latin_1',
]

a = Analysis(
    ['app.py'],
    pathex=[str(base_path)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'tkinter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='SISREGIP',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # True = mostra janela CMD (para ver logs), False = sem janela
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(base_path / 'icone.ico'),  # Ícone do executável
    version_file=None,
)

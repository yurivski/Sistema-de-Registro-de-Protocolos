import glob
import logging
import os
import platform
import re
import subprocess
import sys
import tempfile
import threading
import webbrowser
import sqlite3
from datetime import datetime
from pathlib import Path

import eel
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pypdf import PdfReader, PdfWriter
from driftbrake import DriftBrake

load_dotenv()

DriftBrake.run_from_env()
# Se drift foi detectado e corresponde a fail_on, o processo encerra aqui com o código certo.
# Se não há drift, a execução continua.

# CONFIGURAÇÃO DE CAMINHOS
def get_application_path():
    """Retorna caminho base da aplicação (compatível com PyInstaller)."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

# Registro de logs de erros
def get_network_data_path():
    """Retorna pasta de dados, com fallback se rede não estiver disponível."""
    network_paths = [
        os.getenv('NETWORK_DATA_PATH', ''),
        r"",
    ]

    for path in network_paths:
        try:
            os.makedirs(path, exist_ok=True)
            test_file = os.path.join(path, '.write_test')
            with open(test_file, 'w') as f:
                f.write('ok')
            os.remove(test_file)
            print(f"Usando pasta de rede: {path}")
            return path
        except Exception as e:
            print(f"Caminho {path} não acessível: {e}")
            continue

    local_path = os.path.join(os.path.expanduser('~'), 'SISREGIP_Data')
    os.makedirs(local_path, exist_ok=True)
    print(f"AVISO: Usando pasta local: {local_path}")
    return local_path


application_path = get_application_path()
network_data_path = get_network_data_path()

log_file = os.path.join(network_data_path, 'app_errors.log')
logging.basicConfig(
    filename=log_file,
    level=logging.ERROR,
    format='%(asctime)s %(levelname)s:%(message)s'
)

# Primário: PostgreSQL via variáveis no .env
# Secundário: SQLite quando credenciais PostgreSQL não estiverem no .env
_PG_URL = os.getenv('DATABASE_URL')
_PG_HOST = os.getenv('DB_HOST')
_PG_PORT = os.getenv('DB_PORT')
_PG_NAME = os.getenv('DB_NAME')
_PG_USER = os.getenv('DB_USER')
_PG_PASS = os.getenv('DB_PASSWORD')
USE_POSTGRES = all([_PG_URL])

SQLITE_DB_PATH = os.getenv('SQLITE_DB_PATH')
SECRETARIA_DB_PATH = os.getenv('SECRETARIA_DB_PATH')

class _PgCursor:
    """Faz o cursor psycopg2 se comportar como sqlite3"""

    def __init__(self, cursor):
        self._c = cursor
        self.lastrowid = None

    def execute(self, query, params=None):
        sql = query.replace('?', '%s')
        is_insert = bool(re.match(r'\s*INSERT\b', sql, re.IGNORECASE))
        if is_insert and 'RETURNING' not in sql.upper():
            sql = sql.rstrip().rstrip(';') + ' RETURNING id'
            self._c.execute(sql, params or ())
            row = self._c.fetchone()
            self.lastrowid = row[0] if row else None
        else:
            self._c.execute(sql, params or ())

    def fetchall(self):
        return self._c.fetchall()

    def fetchone(self):
        return self._c.fetchone()


class _PgConnection:
    """Faz a conexão psycopg2 se comportar como sqlite3."""

    def __init__(self):
        if _PG_URL:
            self._conn = psycopg2.connect(_PG_URL)
        else:
            self._conn = psycopg2.connect(
                host=_PG_HOST, port=_PG_PORT,
                dbname=_PG_NAME, user=_PG_USER, password=_PG_PASS
            )

    def cursor(self):
        return _PgCursor(self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor))

    def execute(self, query, params=None):
        # Chamado apenas para PRAGMA no SQLite, ignorado no PostgreSQL
        pass

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


if not USE_POSTGRES and not os.path.exists(SQLITE_DB_PATH):
    print("=" * 60)
    print("ERRO: Sem credenciais PostgreSQL no .env e banco SQLite não encontrado:")
    print(f"  {SQLITE_DB_PATH}")
    print("=" * 60)
    input("\nPressione ENTER para sair...")
    sys.exit(1)

if USE_POSTGRES:
    print(f"Banco de dados: PostgreSQL ({_PG_HOST}:{_PG_PORT}/{_PG_NAME})")
else:
    print(f"Banco de dados: SQLite ({SQLITE_DB_PATH})")


def get_connection():
    """Retorna conexão com PostgreSQL (primário) ou SQLite (secundário)."""
    if USE_POSTGRES:
        return _PgConnection()
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def get_secretaria_connection():
    """Retorna conexão READ-ONLY com SQLite (Secretaria SAME)."""
    uri = f"file:{SECRETARIA_DB_PATH}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn

# FUNÇÕES AUXILIARES (extraídas para eliminar duplicação)
def registrar_acao(operador, acao, detalhes=''):
    """Registra ação de auditoria no banco. Falha silenciosa."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO registro_operacional (operador, acao, detalhes, data_hora)
            VALUES (?, ?, ?, ?)
        ''', (operador or 'NÃO IDENTIFICADO', acao, detalhes, datetime.now().strftime('%d/%m/%Y %H:%M:%S')))
        conn.commit()
        conn.close()
    except Exception:
        logging.error("Erro ao registrar auditoria", exc_info=True)

def parse_date(value, fmt='%d/%m/%Y'):
    """Converte string de data para date. Retorna None se inválido/vazio."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), fmt).date().isoformat()
    except ValueError:
        return None


def format_date_br(date_str):
    """Converte data ISO (YYYY-MM-DD) para formato BR (DD/MM/YYYY)."""
    if date_str is None:
        return ''
    # psycopg2 retorna datetime.date, não string
    if hasattr(date_str, 'strftime'):
        return date_str.strftime('%d/%m/%Y')
    if not str(date_str).strip():
        return ''
    try:
        return datetime.strptime(str(date_str).strip(), '%Y-%m-%d').strftime('%d/%m/%Y')
    except ValueError:
        return str(date_str)


def get_or_none(value):
    """Retorna None se valor for vazio/whitespace, senão retorna o valor."""
    if not value or not str(value).strip():
        return None
    return value


def resolve_usuario(cursor, nome, pmh=None):
    """Busca usuario por nome ou cria novo. Retorna id ou None."""
    if not nome or not nome.strip():
        return None

    cursor.execute('SELECT id FROM usuario WHERE nome = ?', (nome,))
    result = cursor.fetchone()
    if result:
        return result[0]

    cursor.execute(
        'INSERT INTO usuario (nome, prontuario) VALUES (?, ?)',
        (nome, get_or_none(pmh))
    )
    return cursor.lastrowid


def resolve_recebedor(cursor, nome):
    """Busca recebedor por nome ou cria novo. Retorna id ou None."""
    if not nome or not nome.strip():
        return None

    cursor.execute('SELECT id FROM recebedor WHERE nome = ?', (nome,))
    result = cursor.fetchone()
    if result:
        return result[0]

    cursor.execute(
        'INSERT INTO recebedor (nome) VALUES (?)',
        (nome,)
    )
    return cursor.lastrowid


def open_file(filepath):
    """Abre arquivo com aplicativo padrão do sistema."""
    try:
        system = platform.system()
        if system == "Windows":
            os.startfile(filepath)
        elif system == "Darwin":
            subprocess.Popen(['open', filepath])
        else:
            subprocess.Popen(['xdg-open', filepath])
    except Exception:
        logging.error(f"Erro ao abrir arquivo {filepath}", exc_info=True)


def is_page_blank(page, content_threshold=100):
    """Verifica se página PDF está em branco."""
    text = page.extract_text()
    if text and text.strip():
        return False
    content = page.get_contents()
    if not content or len(content.get_data()) < content_threshold:
        return True
    return False


def build_report_html(rows, total, entregues, pendentes):
    """Gera HTML do relatório de protocolos."""
    now = datetime.now().strftime('%d/%m/%Y %H:%M')

    # Monta linhas da tabela com escape básico contra XSS
    def esc(val):
        return str(val).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    rows_html = ""
    for row in rows:
        rows_html += (
            f"<tr>"
            f"<td>{esc(row[0])}</td>"
            f"<td>{esc(row[1])}</td>"
            f'<td style="text-align: left;">{esc(row[2])}</td>'
            f"<td>{esc(row[3])}</td>"
            f"<td>{esc(row[4])}</td>"
            f"<td>{esc(row[5])}</td>"
            f"</tr>\n"
        )

    return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Relatório de Protocolos</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ text-align: center; color: #333; }}
        .info {{ text-align: right; margin-bottom: 20px; color: #666; font-size: 14px; }}
        .resumo {{
            background-color: #f0f0f0;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }}
        .resumo-item {{
            text-align: center;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }}
        .resumo-item h3 {{ margin: 0; font-size: 24px; }}
        .resumo-item p {{ margin: 5px 0 0; color: #666; }}
        .pendente {{ color: #dc2626; }}
        .entregue {{ color: #166534; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 6px;
            text-align: center;
        }}
        th {{
            background-color: #f2f2f2;
            font-weight: bold;
        }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        .btn-print {{
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #4338ca;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }}
        .btn-print:hover {{ background-color: #3730a3; }}
        @media print {{
            .btn-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
    <h1>Relatório de Protocolos</h1>
    <div class="info">Data de Emissão: {now}</div>

    <div class="resumo">
        <div class="resumo-item">
            <h3>{total}</h3>
            <p>Total</p>
        </div>
        <div class="resumo-item entregue">
            <h3>{entregues}</h3>
            <p>Entregues</p>
        </div>
        <div class="resumo-item pendente">
            <h3>{pendentes}</h3>
            <p>Pendentes</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 10%">PROT</th>
                <th style="width: 12%">DATA</th>
                <th style="width: 35%">NOME</th>
                <th style="width: 10%">PMH</th>
                <th style="width: 12%">ENTREGA</th>
                <th style="width: 21%">RECEBIMENTO</th>
            </tr>
        </thead>
        <tbody>
{rows_html}
        </tbody>
    </table>
</body>
</html>'''

# APLICAÇÃO FLASK
app = Flask(__name__)
CORS(app)

# Rotas de API: Protocolos 
@app.route('/api/protocols', methods=['GET'])
def get_protocols():
    """Retorna todos os protocolos ativos."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                p.id as "ID",
                p.prot as "PROT",
                p.data_protocolo,
                u.nome as "NOME",
                p.pmh as "PMH",
                p.data_entrega,
                r.nome as "RECEBIMENTO"
            FROM protocolo p
            LEFT JOIN usuario u ON p.usuario_id = u.id
            LEFT JOIN recebedor r ON p.recebedor_id = r.id
            WHERE p.ativo = TRUE
            ORDER BY p.data_protocolo DESC
        ''')
        rows = cursor.fetchall()
        conn.close()

        # Formatar datas para DD/MM/YYYY no Python
        result = []
        for row in rows:
            result.append({
                "ID": row["ID"],
                "PROT": row["PROT"],
                "DATA": format_date_br(row["data_protocolo"]),
                "NOME": row["NOME"],
                "PMH": row["PMH"],
                "ENTREGA": format_date_br(row["data_entrega"]),
                "RECEBIMENTO": row["RECEBIMENTO"],
            })
        return jsonify(result)
    except Exception:
        logging.error("Erro em get_protocols", exc_info=True)
        return jsonify({"success": False, "message": "Erro ao buscar protocolos."}), 500


@app.route('/api/protocols/add', methods=['POST'])
def add_protocol():
    """Adiciona novo protocolo."""
    try:
        data = request.json
        conn = get_connection()
        cursor = conn.cursor()

        data_protocolo = parse_date(data.get('DATA'))
        data_entrega = parse_date(data.get('ENTREGA'))
        pmh = get_or_none(data.get('PMH'))
        usuario_id = resolve_usuario(cursor, data.get('NOME'), pmh)
        recebedor_id = resolve_recebedor(cursor, data.get('RECEBIMENTO'))

        cursor.execute('''
            INSERT INTO protocolo
            (prot, data_protocolo, usuario_id, pmh, data_entrega, recebedor_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data['PROT'],
            data_protocolo,
            usuario_id,
            pmh,
            data_entrega,
            recebedor_id,
        ))
        conn.commit()
        conn.close()
        operador = data.get('OPERADOR', 'NÃO IDENTIFICADO')
        registrar_acao(operador, 'ADICIONAR', f"Protocolo {data['PROT']} adicionado")
        return jsonify({"success": True, "message": "Protocolo adicionado com sucesso."})
    except Exception as e:
        logging.error("Erro em add_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


@app.route('/api/protocols/edit', methods=['POST'])
def edit_protocol():
    """Edita protocolo existente."""
    try:
        data = request.json
        conn = get_connection()
        cursor = conn.cursor()

        data_protocolo = parse_date(data.get('DATA'))
        data_entrega = parse_date(data.get('ENTREGA'))
        pmh = get_or_none(data.get('PMH'))
        usuario_id = resolve_usuario(cursor, data.get('NOME'), pmh)
        recebedor_id = resolve_recebedor(cursor, data.get('RECEBIMENTO'))

        cursor.execute('''
            UPDATE protocolo
            SET data_protocolo = ?,
                usuario_id = ?,
                pmh = ?,
                data_entrega = ?,
                recebedor_id = ?
            WHERE prot = ? AND ativo = TRUE
        ''', (
            data_protocolo,
            usuario_id,
            pmh,
            data_entrega,
            recebedor_id,
            data['PROT'],
        ))
        conn.commit()
        conn.close()
        operador = data.get('OPERADOR', 'NÃO IDENTIFICADO')
        registrar_acao(operador, 'EDITAR', f"Protocolo {data['PROT']} editado")
        return jsonify({"success": True, "message": "Protocolo editado com sucesso."})
    except Exception as e:
        logging.error("Erro em edit_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


@app.route('/api/protocols/delete', methods=['POST'])
def delete_protocol():
    """Deleta protocolo (soft delete)."""
    try:
        data = request.json
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE protocolo SET ativo = FALSE WHERE id = ?',
            (data['ID'],)
        )
        conn.commit()
        conn.close()
        operador = data.get('OPERADOR', 'NÃO IDENTIFICADO')
        registrar_acao(operador, 'EXCLUIR', f"Protocolo ID {data['ID']} excluído")
        return jsonify({"success": True, "message": "Protocolo excluído com sucesso."})
    except Exception as e:
        logging.error("Erro em delete_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


# Rota de API: Relatório 

@app.route('/api/print/preview', methods=['POST'])
def print_preview():
    """Gera preview HTML do relatório."""
    try:
        data = request.json
        filter_type = data.get('filter_type', 'all')
        filter_value = data.get('filter_value', '')

        conn = get_connection()
        cursor = conn.cursor()

        query = '''
            SELECT
                COALESCE(p.prot, '') as prot,
                p.data_protocolo,
                COALESCE(u.nome, '') as nome,
                COALESCE(p.pmh, '') as pmh,
                p.data_entrega,
                COALESCE(r.nome, '') as recebedor
            FROM protocolo p
            LEFT JOIN usuario u ON p.usuario_id = u.id
            LEFT JOIN recebedor r ON p.recebedor_id = r.id
            WHERE p.ativo = TRUE
        '''
        params = []

        if filter_type == 'month' and filter_value:
            if USE_POSTGRES:
                query += " AND to_char(p.data_protocolo, 'YYYY-MM') = ?"
            else:
                query += " AND strftime('%Y-%m', p.data_protocolo) = ?"
            params.append(filter_value)
        elif filter_type == 'year' and filter_value:
            if USE_POSTGRES:
                query += " AND to_char(p.data_protocolo, 'YYYY') = ?"
            else:
                query += " AND strftime('%Y', p.data_protocolo) = ?"
            params.append(str(filter_value))

        query += " ORDER BY p.prot"
        cursor.execute(query, params)
        raw_rows = cursor.fetchall()
        conn.close()

        # Formatar datas para DD/MM/YYYY
        rows = []
        for row in raw_rows:
            rows.append((
                row['prot'],
                format_date_br(row['data_protocolo']),
                row['nome'],
                row['pmh'],
                format_date_br(row['data_entrega']),
                row['recebedor'],
            ))

        total = len(rows)
        entregues = sum(1 for row in rows if row[4] and row[4].strip())
        pendentes = total - entregues

        html = build_report_html(rows, total, entregues, pendentes)

        temp_html = os.path.join(tempfile.gettempdir(), 'relatorio_preview.html')
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html)

        webbrowser.open('file://' + temp_html)
        operador = data.get('operador', 'NÃO IDENTIFICADO')
        if filter_type == 'month':
            registrar_acao(operador, 'RELATORIO', f"Relatório mês {filter_value}")
        elif filter_type == 'year':
            registrar_acao(operador, 'RELATORIO', f"Relatório ano {filter_value}")
        else:
            registrar_acao(operador, 'RELATORIO', "Relatório completo")
        return jsonify({"success": True, "message": "Preview aberto no navegador."})
    except Exception as e:
        logging.error("Erro em print_preview", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


# Rota de API: Secretaria SAME (somente leitura)
@app.route('/api/secretaria/protocols', methods=['GET'])
def get_secretaria_protocols():
    """Retorna todos os protocolos da Secretaria SAME (read-only)."""
    try:
        if not os.path.exists(SECRETARIA_DB_PATH):
            return jsonify({
                "success": False,
                "message": "Banco da Secretaria não encontrado na rede."
            }), 404

        conn = get_secretaria_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                id,
                COALESCE(protocolo, '') as protocolo,
                COALESCE(prontuario, '') as prontuario,
                COALESCE(nome, '') as nome,
                COALESCE(data_prot, '') as data_prot,
                COALESCE(finalidade, '') as finalidade,
                COALESCE(alta, '') as alta,
                COALESCE(obs, '') as obs
            FROM protocolos
            ORDER BY id DESC
        ''')
        rows = cursor.fetchall()
        conn.close()

        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "protocolo": row["protocolo"],
                "prontuario": row["prontuario"],
                "nome": row["nome"],
                "data_prot": row["data_prot"],
                "finalidade": row["finalidade"],
                "alta": row["alta"],
                "obs": row["obs"],
            })
        return jsonify(result)
    except Exception:
        logging.error("Erro em get_secretaria_protocols", exc_info=True)
        return jsonify({
            "success": False,
            "message": "Erro ao buscar dados da Secretaria."
        }), 500


# Rotas de API: PDF 
@app.route('/api/list_pdfs', methods=['POST'])
def list_pdfs():
    """Lista PDFs em uma pasta."""
    try:
        data = request.json
        folder_path = data.get('folder_path')
        if not folder_path or not os.path.isdir(folder_path):
            return jsonify({"success": False, "message": "Pasta inválida."}), 400

        pdf_files = glob.glob(os.path.join(folder_path, '*.pdf'))
        pdf_files.sort(key=os.path.getmtime)
        file_names = [os.path.basename(f) for f in pdf_files]
        return jsonify({"success": True, "files": file_names})
    except Exception:
        logging.error("Erro em list_pdfs", exc_info=True)
        return jsonify({"success": False, "message": "Erro ao listar arquivos."}), 500


@app.route('/api/merge_pdfs', methods=['POST'])
def merge_pdfs():
    """Mescla PDFs selecionados."""
    try:
        data = request.json
        folder_path = data.get('folder_path')
        files_to_merge = data.get('files_to_merge', [])
        remove_blank = data.get('remove_blank', False)

        if not folder_path or not os.path.isdir(folder_path):
            return jsonify({"success": False, "message": "Pasta inválida."}), 400
        if not files_to_merge:
            return jsonify({"success": False, "message": "Nenhum arquivo selecionado."}), 400

        writer = PdfWriter()
        for filename in files_to_merge:
            full_path = os.path.join(folder_path, filename)
            if not os.path.exists(full_path):
                continue
            try:
                reader = PdfReader(full_path)
                for page in reader.pages:
                    if remove_blank and is_page_blank(page):
                        continue
                    writer.add_page(page)
            except Exception as e:
                logging.warning(f"Erro ao ler {filename}: {e}")
                continue

        if len(writer.pages) == 0:
            return jsonify({"success": False, "message": "Nenhuma página válida encontrada."}), 400

        output_filename = os.path.join(folder_path, "_ARQUIVO_FINAL_MESCLADO.pdf")
        with open(output_filename, "wb") as f:
            writer.write(f)

        open_file(output_filename)
        return jsonify({"success": True, "message": "Arquivos mesclados!"})
    except Exception as e:
        logging.error("Erro em merge_pdfs", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {e}"}), 500


# Eel (ponte com desktop)
@eel.expose
def select_folder():
    """Abre janela para selecionar pasta - DESABILITADO EM EXECUTÁVEL."""
    print("Função de seleção de pasta não disponível no executável")
    return None


# Rotas para PWA / arquivos estáticos
@app.route('/login')
def login_page():
    """Serve a página de identificação do operador."""
    return send_from_directory('login', 'login.html')

@app.route('/static/login/<path:filename>')
def serve_login_static(filename):
    """Serve arquivos estáticos da pasta login (CSS, JS, imagens)."""
    return send_from_directory('login', filename)

@app.route('/')
def index():
    """Redireciona para login se pasta login existir, senão serve dashboard."""
    login_path = os.path.join(application_path, 'login', 'login.html')
    if os.path.exists(login_path):
        return send_from_directory('login', 'login.html')
    return send_from_directory('templates', 'index.html')

@app.route('/dashboard')
def dashboard():
    """Serve o dashboard principal (após identificação)."""
    return send_from_directory('templates', 'index.html')

@app.route('/templates/<path:filename>')
def serve_template(filename):
    """Serve arquivos HTML dos templates."""
    return send_from_directory('templates', filename)


@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve arquivos CSS/JS estáticos."""
    return send_from_directory('static', filename)

@app.route('/manifest.json')
def serve_manifest():
    """Serve o manifest.json."""
    return send_from_directory('static', 'manifest.json')

@app.route('/intendencia.png')
def serve_logo():
    """Serve logo da intendência."""
    return send_from_directory('.', 'intendencia.png')

@app.route('/api/auditoria/registrar', methods=['POST'])
def registrar_auditoria():
    """Registra ação do operador na tabela de auditoria."""
    try:
        # sendBeacon envia como text/plain, não application/json
        if request.content_type and 'json' in request.content_type:
            data = request.json
        else:
            import json
            data = json.loads(request.data.decode('utf-8'))

        operador = data.get('operador', 'NÃO IDENTIFICADO')
        acao = data.get('acao', '')
        detalhes = data.get('detalhes', '')

        if not acao:
            return jsonify({"success": False, "message": "Ação não informada."}), 400

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO registro_operacional (operador, acao, detalhes, data_hora)
            VALUES (?, ?, ?, ?)
        ''', (operador, acao, detalhes, datetime.now().strftime('%d/%m/%Y %H:%M:%S')))
        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Registrado."})
    except Exception as e:
        logging.error("Erro em registrar_auditoria", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"})

# INICIALIZAÇÃO
def run_flask():
    """Inicia servidor Flask."""
    app.run(host='0.0.0.0', port=8001, debug=False, use_reloader=False)


def is_running_as_service():
    """Detecta se está rodando como serviço do Windows."""
    try:
        return not sys.stdin or not sys.stdin.isatty()
    except Exception:
        return False


if __name__ == '__main__':
    is_service = is_running_as_service()

    _db_label = f"PostgreSQL ({_PG_HOST}/{_PG_NAME})" if USE_POSTGRES else f"SQLite ({SQLITE_DB_PATH})"

    if is_service:
        # MODO SERVIÇO: Apenas Flask, sem Eel
        print("=" * 60)
        print("SISREGIP - MODO SERVIÇO")
        print("=" * 60)
        print(f"Pasta de dados: {network_data_path}")
        print(f"Banco: {_db_label}")
        print("Acesse: http://localhost:8001")
        print("=" * 60)
        run_flask()
    else:
        # MODO DESKTOP: Eel + Flask
        print("=" * 60)
        print("SISREGIP - MODO DESKTOP")
        print("=" * 60)
        print(f"Pasta de dados: {network_data_path}")
        print(f"Banco: {_db_label}")
        print("Iniciando interface...")
        print("=" * 60)

        eel.init(application_path)
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        eel.sleep(2.0)

        try:
            eel.start(
                {'port': 8001},
                mode='chrome',
                size=(1280, 760),
                position=(100, 100),
                port=0
            )
        except (IOError, SystemError) as e:
            print(f"\nErro ao iniciar interface Eel: {e}")
            print("\nTente acessar via navegador: http://localhost:8001")
            input("\nPressione ENTER para sair...")

import glob
import logging
import os
import platform
import subprocess
import sys
import tempfile
import threading
import webbrowser
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
import eel
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from pypdf import PdfReader, PdfWriter

# CONFIGURAÇÃO DE CAMINHOS

def get_application_path():
    """Retorna caminho base da aplicação (compatível com PyInstaller)."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def get_network_data_path():
    """Retorna pasta de dados, com fallback se rede não estiver disponível."""
    network_paths = [
        r"/home/usuario\caminho_para_salvar_logs",
        r"\\\00.0.000.00\caminho_para_salvar_logs", # Mesmo local via IP
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

    local_path = os.path.join(os.path.expanduser('~'), '/home/usuario/caminho_do_arquivo') # os.path.join ignora o ~ quando o segundo arg é caminho absoluto
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

# CONFIGURAÇÃO DO POSTGRESQL

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'sistema_protocolos'),
    'user': os.getenv('DB_USER', 'app_protocolos'),
    'password': os.getenv('DB_PASSWORD'),
    'client_encoding': 'UTF8',
}

if not DB_CONFIG['password']:
    print("=" * 60)
    print("ERRO: Senha do banco de dados não configurada!")
    print("=" * 60)
    print("\nCrie um arquivo .env na raiz do projeto com:")
    print("DB_PASSWORD=sua_senha_aqui")
    print("=" * 60)
    input("\nPressione ENTER para sair...")
    sys.exit(1)


def get_connection():
    """Retorna conexão com PostgreSQL."""
    return psycopg2.connect(**DB_CONFIG)

# FUNÇÕES AUXILIARES (extraídas para eliminar duplicação)
def parse_date(value, fmt='%d/%m/%Y'):
    """Converte string de data para date. Retorna None se inválido/vazio."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), fmt).date()
    except ValueError:
        return None


def get_or_none(value):
    """Retorna None se valor for vazio/whitespace, senão retorna o valor."""
    if not value or not str(value).strip():
        return None
    return value


def resolve_usuario(cursor, nome, pmh=None):
    """Busca usuario por nome ou cria novo. Retorna id ou None."""
    if not nome or not nome.strip():
        return None

    cursor.execute('SELECT id FROM usuario WHERE nome = %s', (nome,))
    result = cursor.fetchone()
    if result:
        return result[0]

    cursor.execute(
        'INSERT INTO usuario (nome, prontuario) VALUES (%s, %s) RETURNING id',
        (nome, get_or_none(pmh))
    )
    return cursor.fetchone()[0]


def resolve_recebedor(cursor, nome):
    """Busca recebedor por nome ou cria novo. Retorna id ou None."""
    if not nome or not nome.strip():
        return None

    cursor.execute('SELECT id FROM recebedor WHERE nome = %s', (nome,))
    result = cursor.fetchone()
    if result:
        return result[0]

    cursor.execute(
        'INSERT INTO recebedor (nome) VALUES (%s) RETURNING id',
        (nome,)
    )
    return cursor.fetchone()[0]


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
        with get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # A query a seguir irá assimilar os títulos tanto do
                # dashboard quanto da tabela no relatório em PDF.
                cursor.execute('''
                    SELECT
                        p.id as "ID",
                        p.prot as "PROT",
                        TO_CHAR(p.data_protocolo, 'DD/MM/YYYY') as "DATA",
                        u.nome as "NOME",
                        p.pmh as "PMH",
                        TO_CHAR(p.data_entrega, 'DD/MM/YYYY') as "ENTREGA",
                        r.nome as "RECEBIMENTO"
                    FROM protocolo p
                    LEFT JOIN usuario u ON p.usuario_id = u.id
                    LEFT JOIN recebedor r ON p.recebedor_id = r.id
                    WHERE p.ativo = TRUE
                    ORDER BY p.data_protocolo DESC
                ''')
                rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception:
        logging.error("Erro em get_protocols", exc_info=True)
        return jsonify({"success": False, "message": "Erro ao buscar protocolos."}), 500


@app.route('/api/protocols/add', methods=['POST'])
def add_protocol():
    """Adiciona novo protocolo."""
    try:
        data = request.json
        with get_connection() as conn:
            with conn.cursor() as cursor:
                data_protocolo = parse_date(data.get('DATA'))
                data_entrega = parse_date(data.get('ENTREGA'))
                pmh = get_or_none(data.get('PMH'))
                usuario_id = resolve_usuario(cursor, data.get('NOME'), pmh)
                recebedor_id = resolve_recebedor(cursor, data.get('RECEBIMENTO'))

                cursor.execute('''
                    INSERT INTO protocolo
                    (prot, data_protocolo, usuario_id, pmh, data_entrega, recebedor_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (
                    data['PROT'],
                    data_protocolo,
                    usuario_id,
                    pmh,
                    data_entrega,
                    recebedor_id,
                ))
            conn.commit()
        return jsonify({"success": True, "message": "Protocolo adicionado com sucesso."})
    except Exception as e:
        logging.error("Erro em add_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


@app.route('/api/protocols/edit', methods=['POST'])
def edit_protocol():
    """Edita protocolo existente."""
    try:
        data = request.json
        with get_connection() as conn:
            with conn.cursor() as cursor:
                data_protocolo = parse_date(data.get('DATA'))
                data_entrega = parse_date(data.get('ENTREGA'))
                pmh = get_or_none(data.get('PMH'))
                usuario_id = resolve_usuario(cursor, data.get('NOME'), pmh)
                recebedor_id = resolve_recebedor(cursor, data.get('RECEBIMENTO'))

                cursor.execute('''
                    UPDATE protocolo
                    SET data_protocolo = %s,
                        usuario_id = %s,
                        pmh = %s,
                        data_entrega = %s,
                        recebedor_id = %s
                    WHERE prot = %s AND ativo = TRUE
                ''', (
                    data_protocolo,
                    usuario_id,
                    pmh,
                    data_entrega,
                    recebedor_id,
                    data['PROT'],
                ))
            conn.commit()
        return jsonify({"success": True, "message": "Protocolo editado com sucesso."})
    except Exception as e:
        logging.error("Erro em edit_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


@app.route('/api/protocols/delete', methods=['POST'])
def delete_protocol():
    """Deleta protocolo (soft delete)."""
    try:
        data = request.json
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    'UPDATE protocolo SET ativo = FALSE WHERE id = %s',
                    (data['ID'],)
                )
            conn.commit()
        return jsonify({"success": True, "message": "Protocolo excluído com sucesso."})
    except Exception as e:
        logging.error("Erro em delete_protocol", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


# Rota de API: Relatório 

@app.route('/api/print/preview', methods=['POST'])
def print_preview():
    """Gera preview HTML do relatório - com COALESCE para campos vazios."""
    try:
        data = request.json
        filter_type = data.get('filter_type', 'all')
        filter_value = data.get('filter_value', '')

        with get_connection() as conn:
            with conn.cursor() as cursor:
                query = '''
                    SELECT
                        COALESCE(p.prot, '') as prot,
                        COALESCE(TO_CHAR(p.data_protocolo, 'DD/MM/YYYY'), '') as data,
                        COALESCE(u.nome, '') as nome,
                        COALESCE(p.pmh, '') as pmh,
                        COALESCE(TO_CHAR(p.data_entrega, 'DD/MM/YYYY'), '') as entrega,
                        COALESCE(r.nome, '') as recebedor
                    FROM protocolo p
                    LEFT JOIN usuario u ON p.usuario_id = u.id
                    LEFT JOIN recebedor r ON p.recebedor_id = r.id
                    WHERE p.ativo = TRUE
                '''
                params = []

                if filter_type == 'month' and filter_value:
                    query += " AND TO_CHAR(p.data_protocolo, 'YYYY-MM') = %s"
                    params.append(filter_value)
                elif filter_type == 'year' and filter_value:
                    query += " AND EXTRACT(YEAR FROM p.data_protocolo) = %s"
                    params.append(int(filter_value))

                query += " ORDER BY p.prot"
                cursor.execute(query, params)
                rows = cursor.fetchall()

        total = len(rows)
        entregues = sum(1 for row in rows if row[4] and row[4].strip())
        pendentes = total - entregues

        html = build_report_html(rows, total, entregues, pendentes)

        temp_html = os.path.join(tempfile.gettempdir(), 'relatorio_preview.html')
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html)

        webbrowser.open('file://' + temp_html)
        return jsonify({"success": True, "message": "Preview aberto no navegador."})
    except Exception as e:
        logging.error("Erro em print_preview", exc_info=True)
        return jsonify({"success": False, "message": f"Erro: {str(e)}"}), 500


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

@app.route('/')
def index():
    """Serve o dashboard principal."""
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


@app.route('/service-worker.js')
def serve_sw():
    """Serve o service worker."""
    response = send_from_directory('.', 'service-worker.js')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response


@app.route('/intendencia.png')
def serve_logo():
    """Serve logo da intendência."""
    return send_from_directory('.', 'intendencia.png')


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

    if is_service:
        # MODO SERVIÇO: Apenas Flask, sem Eel
        print("=" * 60)
        print("SISREGIP - MODO SERVIÇO")
        print("=" * 60)
        print(f"Pasta de dados: {network_data_path}")
        print("Acesse: http://localhost:8001")
        print("=" * 60)
        run_flask()
    else:
        # MODO DESKTOP: Eel + Flask
        print("=" * 60)
        print("SISREGIP - MODO DESKTOP")
        print("=" * 60)
        print(f"Pasta de dados: {network_data_path}")
        print("Iniciando interface...")
        print("=" * 60)

        eel.init(application_path)
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        eel.sleep(2.0)

        try:
            eel.start(
                'templates/index.html',
                mode='chrome',
                size=(1280, 760),
                position=(100, 100),
            )
        except (IOError, SystemError) as e:
            print(f"\nErro ao iniciar interface Eel: {e}")
            print("\nTente acessar via navegador: http://localhost:8001")
            input("\nPressione ENTER para sair...")
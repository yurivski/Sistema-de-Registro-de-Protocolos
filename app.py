import tkinter as tk
from tkinter import messagebox, filedialog
import sqlite3
from datetime import datetime
import os
import subprocess
import sys
import platform
import threading
import logging
from pathlib import Path
import glob
import shutil

import eel
from flask import Flask, jsonify, request
from flask_cors import CORS
from pypdf import PdfReader, PdfWriter

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.units import cm
    from reportlab.lib import colors
except ImportError as e:
    root = tk.Tk(); root.withdraw()
    messagebox.showerror("Erro de Dependência", f"Biblioteca necessária não encontrada: {e.name}.\n\nPor favor, instale com 'pip install {e.name}'.")
    sys.exit(1)

def get_application_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

application_path = get_application_path()

# CAMINHO 1: Onde os DADOS serão salvos (PASTA DA REDE)
network_db_full_path = r"S:\sua_pasta\banco de dados\protocolos.db"
network_data_path = os.path.dirname(network_db_full_path)

# Cria a pasta na rede se ela não existir
os.makedirs(network_data_path, exist_ok=True)

# O banco de dados aponta para o arquivo na REDE
DB_FILE = network_db_full_path
log_file = os.path.join(network_data_path, 'app_errors.log')

logging.basicConfig(filename=log_file, level=logging.ERROR,
                    format='%(asctime)s %(levelname)s:%(message)s')

# Copia o banco de dados "modelo" para a rede, APENAS se ele não existir lá
if not os.path.exists(DB_FILE):
    template_db_path = os.path.join(application_path, "protocolos.db")
    if os.path.exists(template_db_path):
        shutil.copy2(template_db_path, DB_FILE)
        logging.info(f"Banco de dados inicial copiado para a rede: {DB_FILE}")

app = Flask(__name__)
CORS(app)

def get_connection():
    return sqlite3.connect(DB_FILE)

def init_db():
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        new_schema = '''
            CREATE TABLE IF NOT EXISTS protocolos (
                PROT TEXT PRIMARY KEY NOT NULL, DATA TEXT, NOME TEXT NOT NULL,
                PMH TEXT, ENTREGA TEXT, RECEBIMENTO TEXT
            )
        '''
        cursor.execute(new_schema)
        cursor.execute("PRAGMA table_info(protocolos)")
        columns = cursor.fetchall()
        pmh_column_info = next((col for col in columns if col[1] == 'PMH'), None)
        if pmh_column_info and pmh_column_info[3] == 1:
            logging.info("Detectada estrutura antiga da tabela. Iniciando migração da coluna PMH.")
            cursor.execute("ALTER TABLE protocolos RENAME TO protocolos_old")
            cursor.execute(new_schema)
            cursor.execute('''
                INSERT INTO protocolos (PROT, DATA, NOME, PMH, ENTREGA, RECEBIMENTO)
                SELECT PROT, DATA, NOME, PMH, ENTREGA, RECEBIMENTO FROM protocolos_old
            ''')
            cursor.execute("DROP TABLE protocolos_old")
            logging.info("Migração da tabela concluída com sucesso.")
        conn.commit()
    except Exception as e:
        logging.error("Falha ao inicializar ou migrar o banco de dados.", exc_info=True)
        if conn: conn.rollback()
        raise e
    finally:
        if conn: conn.close()

# Rotas da API (Flask)

@app.route('/api/protocols', methods=['GET'])
def get_protocols():
    conn = None
    try:
        conn = get_connection(); conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        query = "SELECT * FROM protocolos ORDER BY substr(DATA, 7, 4) DESC, substr(DATA, 4, 2) DESC, substr(DATA, 1, 2) DESC"
        cursor.execute(query)
        rows = cursor.fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        logging.error("Erro em get_protocols", exc_info=True)
        return jsonify({"success": False, "message": "Erro ao buscar protocolos."}), 500
    finally:
        if conn: conn.close()

@app.route('/api/protocols/add', methods=['POST'])
def add_protocol():
    conn = None;
    try:
        data = request.json; conn = get_connection(); cursor = conn.cursor()
        cursor.execute('INSERT INTO protocolos (PROT, DATA, NOME, PMH, ENTREGA, RECEBIMENTO) VALUES (?, ?, ?, ?, ?, ?)',(data['PROT'], data['DATA'], data['NOME'], data['PMH'], data['ENTREGA'], data['RECEBIMENTO']))
        conn.commit(); return jsonify({"success": True, "message": "Protocolo adicionado com sucesso."})
    except sqlite3.IntegrityError: return jsonify({"success": False, "message": f"Erro: Protocolo {data['PROT']} já existe."}), 409
    except Exception as e: logging.error("Erro em add_protocol", exc_info=True); return jsonify({"success": False, "message": "Erro interno ao adicionar protocolo."}), 500
    finally:
        if conn: conn.close()

@app.route('/api/protocols/edit', methods=['POST'])
def edit_protocol():
    conn = None;
    try:
        data = request.json; conn = get_connection(); cursor = conn.cursor()
        cursor.execute('UPDATE protocolos SET DATA=?, NOME=?, PMH=?, ENTREGA=?, RECEBIMENTO=? WHERE PROT=?',(data['DATA'], data['NOME'], data['PMH'], data['ENTREGA'], data['RECEBIMENTO'], data['PROT']))
        conn.commit(); return jsonify({"success": True, "message": "Protocolo editado com sucesso."})
    except Exception as e: logging.error("Erro em edit_protocol", exc_info=True); return jsonify({"success": False, "message": "Erro interno ao editar protocolo."}), 500
    finally:
        if conn: conn.close()

@app.route('/api/protocols/delete', methods=['POST'])
def delete_protocol():
    conn = None;
    try:
        data = request.json; conn = get_connection(); cursor = conn.cursor()
        cursor.execute('DELETE FROM protocolos WHERE PROT = ?', (data['PROT'],)); conn.commit()
        return jsonify({"success": True, "message": "Protocolo excluído com sucesso."})
    except Exception as e: logging.error("Erro em delete_protocol", exc_info=True); return jsonify({"success": False, "message": "Erro interno ao excluir protocolo."}), 500
    finally:
        if conn: conn.close()

@app.route('/api/print', methods=['GET'])
def print_report():
    conn = None;
    try:
        pdf_filename = os.path.join(network_data_path, 'relatorio_protocolos.pdf'); conn = get_connection(); cursor = conn.cursor()
        cursor.execute("SELECT PROT, DATA, NOME, PMH, ENTREGA, RECEBIMENTO FROM protocolos ORDER BY PROT"); rows = cursor.fetchall()
        doc = SimpleDocTemplate(pdf_filename, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1*cm, bottomMargin=1.5*cm)
        story = []; styles = getSampleStyleSheet(); title_style = styles['h1']; title_style.alignment = TA_CENTER
        story.append(Paragraph('Relatório de Protocolos', title_style)); story.append(Spacer(1, 0.5*cm))
        date_style = styles['Normal']; date_style.alignment = TA_LEFT
        story.append(Paragraph(f"Data de Emissão: {datetime.now().strftime('%d/%m/%Y %H:%M')}", date_style)); story.append(Spacer(1, 0*cm))
        headers = ['PROT', 'DATA', 'NOME', 'PMH', 'ENTREGA', 'RECEBIMENTO']; col_widths = [1.5*cm, 2.2*cm, 8.0*cm, 2*cm, 2.2*cm, 3.4*cm]
        table_data = [headers]
        for row_data in rows: table_data.append([Paragraph(str(cell or ''), styles['Normal']) for cell in row_data])
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),('TEXTCOLOR', (0, 0), (-1, 0), colors.black),('ALIGN', (0, 0), (-1, -1), 'CENTER'),('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),('GRID', (0, 0), (-1, -1), 0.5, colors.black),]))
        story.append(table); doc.build(story)
        open_file(pdf_filename)
        return jsonify({"success": True, "message": "Relatório gerado e aberto."})
    except Exception as e: logging.error("Erro em print_report", exc_info=True); return jsonify({"success": False, "message": "Erro ao gerar ou abrir o relatório PDF."}), 500
    finally:
        if conn: conn.close()

# Mesclar PDFs

def open_file(filepath):
    """Abre um arquivo com o aplicativo padrão do sistema operacional."""
    try:
        if platform.system() == "Windows":
            os.startfile(filepath)
        elif platform.system() == "Darwin":
            subprocess.Popen(['open', filepath])
        else:
            subprocess.Popen(['xdg-open', filepath])
    except Exception as e:
        logging.error(f"Erro ao abrir arquivo {filepath}", exc_info=True)
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("Erro", f"Não foi possível abrir o arquivo PDF mesclado:\n{e}")

@eel.expose
def select_folder():
    """Abre uma janela para selecionar uma pasta e então avisa o JS para abrir a janela de mesclagem."""
    root = tk.Tk()
    root.withdraw()
    root.wm_attributes('-topmost', 1)
    folder_path = filedialog.askdirectory(title="Selecione a pasta com os PDFs")
    if folder_path:
        eel.open_merger_window(folder_path)

@app.route('/api/list_pdfs', methods=['POST'])
def list_pdfs():
    """Lista os arquivos PDF em uma pasta, ordenados por data de modificação."""
    try:
        data = request.json
        folder_path = data.get('folder_path')
        if not folder_path or not os.path.isdir(folder_path):
            return jsonify({"success": False, "message": "Pasta inválida."}), 400

        pdf_files = glob.glob(os.path.join(folder_path, '*.pdf'))
        pdf_files.sort(key=os.path.getmtime)
        
        file_names = [os.path.basename(f) for f in pdf_files]
        return jsonify({"success": True, "files": file_names})
    except Exception as e:
        logging.error("Erro em list_pdfs", exc_info=True)
        return jsonify({"success": False, "message": "Erro ao listar arquivos."}), 500

def is_page_blank(page, content_threshold=100):
    text = page.extract_text().strip()
    if text:
        return False
    content = page.get_contents()
    if not content or len(content.get_data()) < content_threshold:
        return True
    return False

@app.route('/api/merge_pdfs', methods=['POST'])
def merge_pdfs():
    try:
        data = request.json
        folder_path = data.get('folder_path')
        files_to_merge = data.get('files_to_merge', [])
        remove_blank = data.get('remove_blank', False)
        if not folder_path or not os.path.isdir(folder_path):
            return jsonify({"success": False, "message": "Pasta inválida."}), 400
        if not files_to_merge:
            return jsonify({"success": False, "message": "Nenhum arquivo foi selecionado para mesclagem."}), 400

        writer = PdfWriter()
        for filename in files_to_merge:
            full_path = os.path.join(folder_path, filename)
            if not os.path.exists(full_path):
                logging.warning(f"Arquivo selecionado não encontrado: {filename}")
                continue
            try:
                reader = PdfReader(full_path)
                for page in reader.pages:
                    if remove_blank and is_page_blank(page):
                        continue 
                    writer.add_page(page)
            except Exception as e:
                logging.warning(f"Não foi possível ler o arquivo {filename}: {e}")
                continue
        if len(writer.pages) == 0:
            return jsonify({"success": False, "message": "Nenhuma página válida foi encontrada nos arquivos selecionados."}), 400

        output_filename = os.path.join(folder_path, "_ARQUIVO_FINAL_MESCLADO.pdf")
        with open(output_filename, "wb") as f:
            writer.write(f)

        open_file(output_filename)
        return jsonify({"success": True, "message": f"Arquivos mesclados com sucesso em:\n{output_filename}"})
    except Exception as e:
        logging.error("Erro em merge_pdfs", exc_info=True)
        return jsonify({"success": False, "message": f"Erro crítico ao mesclar PDFs: {e}"}), 500

# Inicia a aplicação

def run_flask():
    app.run(host='localhost', port=8001, debug=False, use_reloader=False)

if __name__ == '__main__':
    init_db()
    eel.init(application_path)
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    eel.sleep(2.0)
    try:
        eel.start('templates/index.html', mode='chrome', size=(1280, 760), position=(100, 100))
    except (IOError, SystemError) as e:
        print(f"Não foi possível iniciar o aplicativo. Verifique se o Chrome/Edge está instalado.\n{e}")
        root = tk.Tk(); root.withdraw()
        messagebox.showerror("Erro de Inicialização", "Não foi possível iniciar o aplicativo.\n\nVerifique se o Google Chrome ou Microsoft Edge estão instalados em seu sistema.")
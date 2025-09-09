# SISREGIP - Sistema de Registro de Protocolos

[![Licença: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Sistema de desktop para gerenciamento de protocolos, construído com Python e tecnologias web. Oferece um CRUD completo, dashboard, geração de relatórios e um utilitário para manipulação de arquivos PDF.

![Screenshot da Interface](imagem.png)

---

## 📖 Table of Contents

- [SISREGIP - Sistema de Registro de Protocolos](#sisregip---sistema-de-registro-de-protocolos)
  - [📖 Table of Contents](#-table-of-contents)
  - [💡 About](#-about)
  - [🚀 Features](#-features)
  - [🛠️ Tech Stack](#️-tech-stack)
  - [⚙️ Prerequisites](#️-prerequisites)
  - [🔧 Installation](#-installation)
  - [▶️ Usage](#️-usage)
  - [📁 Project Structure](#-project-structure)
  - [📄 License](#-license)

---

## <a name="about"></a>💡 About

Este sistema foi criado para modernizar e centralizar o controle sobre a entrada e saída de protocolos. Ele permite que múltiplos usuários em uma rede local registrem, editem, consultem e gerenciem o status de cada protocolo (Pendente ou Entregue) de forma centralizada em um único banco de dados SQLite.

Além do gerenciamento de protocolos, a aplicação inclui ferramentas para o dia a dia, como a geração de relatórios em PDF e um utilitário para mesclar múltiplos arquivos PDF em um só, com a opção de remover páginas em branco automaticamente.

---

## <a name="features"></a>🚀 Features

* **Gerenciamento CRUD Completo:** Crie, leia, atualize e delete registros de protocolos.
* **Banco de Dados Centralizado:** Permite acesso simultâneo em rede local.
* **Dashboard Visual:** Gráfico em tempo real exibe a proporção de protocolos pendentes e entregues.
* **Filtro Dinâmico:** Pesquisa instantânea por número de protocolo ou nome.
* **Geração de Relatórios:** Exporta todos os registros para um arquivo PDF com um único clique.
* **Utilitário de PDF Integrado:**
    * Mescla múltiplos arquivos PDF em um único documento.
    * Remove páginas em branco automaticamente durante a mesclagem.

---

## <a name="tech-stack"></a>🛠️ Tech Stack

As seguintes tecnologias foram utilizadas na construção do projeto:

* **Backend:** Python 3, Flask, SQLite 3, ReportLab, PyPDF
* **GUI Híbrida:** Eel (Python + Web)
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS), Chart.js

---

## <a name="prerequisites"></a>⚙️ Prerequisites

Para rodar este projeto, você precisará ter o seguinte instalado:

* Python 3.8+
* PIP (Gerenciador de Pacotes Python)
* Google Chrome ou Microsoft Edge

---

## <a name="installation"></a>🔧 Installation

Siga os passos abaixo para configurar o ambiente de desenvolvimento.

1.  Clone o repositório para sua máquina local:
    ```bash
    git clone [https://github.com/yurivski/Sistema-de-Registro-de-Protocolos.git](https://github.com/yurivski/Sistema-de-Registro-de-Protocolos.git)
    cd Sistema-de-Registro-de-Protocolos
    ```

2.  Crie e ative um ambiente virtual:
    ```bash
    # Criar o ambiente
    python -m venv venv
    
    # Ativar no Windows
    .\venv\Scripts\activate
    
    # Ativar no macOS/Linux: source venv/bin/activate
    ```

3.  Instale as dependências do projeto a partir do arquivo `requirements.txt`:
    ```bash
    pip install -r requirements.txt
    ```

4.  Configure o caminho do banco de dados em rede editando a variável `network_db_full_path` no arquivo `app.py`.

---

## <a name="usage"></a>▶️ Usage

Com o ambiente virtual ativado, inicie a aplicação executando o script principal:

```bash
python app.py
```

A janela do sistema será aberta automaticamente.

---

## <a name="project-structure"></a>📁 Project Structure

```
/Sistema-de-Registro-de-Protocolos/
├── static/
│   ├── script.js
│   ├── marger.js
│   └── style.css
├── templates/
│   ├── index.html
│   └── marger.html
├── assets/
│   ├── dashboard.png
│   └── dashboard2.png
│   └── graphic.png
│   └── graphic2.png
├── .gitignore
├── app.py
├── icone.ico
├── imagem.png
├── LICENSE
└── README.md
```

---

## <a name="license"></a>📄 License

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
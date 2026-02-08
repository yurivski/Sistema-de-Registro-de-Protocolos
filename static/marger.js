document.addEventListener('DOMContentLoaded', () => {

    // MAPEAMENTO DOS ELEMENTOS

    const pdfList = document.getElementById('pdf-list');
    const btnMerge = document.getElementById('btn-merge');
    const btnMergeBlank = document.getElementById('btn-merge-blank');
    const btnNewFolder = document.getElementById('btn-new-folder');
    const selectAllCheckbox = document.getElementById('select-all');

    let currentFolderPath = '';

    // FIX: Resolve URL do servidor dinamicamente (igual ao app.js principal)
    const serverUrl = `${window.location.protocol}//${window.location.hostname}:8001`;

    // FUNÇÕES AUXILIARES

    /** Requisição à API com feedback e fechamento automático em sucesso. */
    async function apiRequest(endpoint, method = 'POST', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${serverUrl}${endpoint}`, options);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Erro ${response.status}`);
            }

            const result = await response.json();
            alert(result.message);

            if (result.success) {
                window.close();
            }
        } catch (error) {
            alert(`Erro de comunicação: ${error.message}`);
        }
    }

    /** Coleta nomes dos PDFs com checkbox marcado. */
    function getSelectedFiles() {
        const checked = document.querySelectorAll('.pdf-checkbox:checked');
        return Array.from(checked).map(cb => cb.value);
    }

    /** Valida seleção e dispara merge com ou sem remoção de páginas em branco. */
    function handleMerge(removeBlank) {
        if (!currentFolderPath) return;

        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            alert('Por favor, selecione ao menos um arquivo para mesclar.');
            return;
        }

        apiRequest('/api/merge_pdfs', 'POST', {
            folder_path: currentFolderPath,
            files_to_merge: selectedFiles,
            remove_blank: removeBlank,
        });
    }

    // CARREGAMENTO DA LISTA DE PDFS

    async function loadPdfList() {
        const params = new URLSearchParams(window.location.search);
        const rawPath = params.get('folder_path');

        // FIX: params.get retorna null se ausente; decodeURIComponent(null) vira "null"
        currentFolderPath = rawPath ? decodeURIComponent(rawPath) : '';

        if (!currentFolderPath) {
            pdfList.innerHTML = '<li>Erro: Nenhuma pasta foi selecionada.</li>';
            return;
        }

        try {
            const response = await fetch(`${serverUrl}/api/list_pdfs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: currentFolderPath }),
            });

            const result = await response.json();
            pdfList.innerHTML = '';

            if (!result.success) {
                pdfList.innerHTML = `<li>Erro: ${result.message}</li>`;
                return;
            }

            if (result.files.length === 0) {
                pdfList.innerHTML = '<li>Nenhum arquivo PDF encontrado nesta pasta.</li>';
                return;
            }

            result.files.forEach(fileName => {
                const li = document.createElement('li');
                const label = document.createElement('label');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'pdf-checkbox';
                checkbox.value = fileName;
                checkbox.checked = true;

                const span = document.createElement('span');
                span.textContent = fileName;

                label.appendChild(checkbox);
                label.appendChild(span);
                li.appendChild(label);
                pdfList.appendChild(li);
            });

            selectAllCheckbox.checked = true;
        } catch (error) {
            pdfList.innerHTML = `<li>Erro ao carregar PDFs: ${error.message}</li>`;
        }
    }

    // EVENT LISTENERS

    selectAllCheckbox.addEventListener('change', () => {
        const allCheckboxes = document.querySelectorAll('.pdf-checkbox');
        allCheckboxes.forEach(cb => { cb.checked = selectAllCheckbox.checked; });
    });

    btnMerge.addEventListener('click', () => handleMerge(false));
    btnMergeBlank.addEventListener('click', () => handleMerge(true));

    btnNewFolder.addEventListener('click', () => {
        eel.select_folder()();
        window.close();
    });

    // INICIALIZAÇÃO

    loadPdfList();
});
document.addEventListener('DOMContentLoaded', () => {
    const pdfList = document.getElementById('pdf-list');
    const btnMerge = document.getElementById('btn-merge');
    const btnMergeBlank = document.getElementById('btn-merge-blank');
    const btnNewFolder = document.getElementById('btn-new-folder');
    const selectAllCheckbox = document.getElementById('select-all');
    let currentFolderPath = '';

    // Fazer requisições à API
    async function apiRequest(endpoint, method = 'POST', body = null) {
        const serverUrl = 'http://localhost:8001';
        try {
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) { options.body = JSON.stringify(body); }
            const response = await fetch(`${serverUrl}${endpoint}`, options);
            const result = await response.json();
            alert(result.message);
            if (result.success) {
                window.close(); // Fecha a janela após sucesso
            }
        } catch (error) {
            alert(`Erro de comunicação: ${error.message}`);
        }
    }

    // Pega o caminho da pasta da URL e busca a lista de PDFs
    async function loadPdfList() {
        const params = new URLSearchParams(window.location.search);
        currentFolderPath = decodeURIComponent(params.get('folder_path'));
        
        if (!currentFolderPath) {
            pdfList.innerHTML = '<li>Erro: Nenhuma pasta foi selecionada.</li>';
            return;
        }

        const serverUrl = 'http://localhost:8001';
        const response = await fetch(`${serverUrl}/api/list_pdfs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: currentFolderPath })
        });
        const result = await response.json();

        pdfList.innerHTML = '';
        if (result.success) {
            if (result.files.length === 0) {
                pdfList.innerHTML = '<li>Nenhum arquivo PDF encontrado nesta pasta.</li>';
            } else {
                result.files.forEach(fileName => {
                    const li = document.createElement('li');
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'pdf-checkbox';
                    checkbox.value = fileName;
                    checkbox.checked = true; // Começa com todos selecionados por padrão

                    const span = document.createElement('span');
                    span.textContent = fileName;

                    label.appendChild(checkbox);
                    label.appendChild(span);
                    li.appendChild(label);
                    pdfList.appendChild(li);
                });

                selectAllCheckbox.checked = true;
            }
        } else {
            pdfList.innerHTML = `<li>Erro: ${result.message}</li>`;
        }
    }

    // --- Coletar arquivos selecionados
    function getSelectedFiles() {
        const selectedCheckboxes = document.querySelectorAll('.pdf-checkbox:checked');
        return Array.from(selectedCheckboxes).map(cb => cb.value);
    }

    selectAllCheckbox.addEventListener('change', () => {
        const allCheckboxes = document.querySelectorAll('.pdf-checkbox');
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
    });

    btnMerge.addEventListener('click', () => {
        if (!currentFolderPath) return;
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            alert('Por favor, selecione ao menos um arquivo para mesclar.');
            return;
        }
        apiRequest('/api/merge_pdfs', 'POST', { 
            folder_path: currentFolderPath,
            files_to_merge: selectedFiles, // Envia a lista de arquivos selecionados
            remove_blank: false 
        });
    });

    btnMergeBlank.addEventListener('click', () => {
        if (!currentFolderPath) return;
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            alert('Por favor, selecione ao menos um arquivo para mesclar.');
            return;
        }
        apiRequest('/api/merge_pdfs', 'POST', { 
            folder_path: currentFolderPath,
            files_to_merge: selectedFiles,
            remove_blank: true 
        });
    });
    
    btnNewFolder.addEventListener('click', () => {
        eel.select_folder()();
        window.close(); 
    });

    // Carrega a lista de PDFs assim que a janela abre
    loadPdfList();
});
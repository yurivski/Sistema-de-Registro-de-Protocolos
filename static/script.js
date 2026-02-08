document.addEventListener('DOMContentLoaded', () => {
    // --- MAPEAMENTO DOS ELEMENTOS ---
    const listContainer = document.getElementById('protocol-list');
    const mainTemplate = document.getElementById('list-item-template');
    const detailContent = document.getElementById('detail-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const detailsHeader = document.getElementById('details-header');
    const filtroInput = document.getElementById('filtro-input');
    const form = document.getElementById('protocol-form');
    
    const formFields = {
        prot: document.getElementById('prot'), 
        data: document.getElementById('data'),
        nome: document.getElementById('nome'), 
        pmh: document.getElementById('pmh'),
        entrega: document.getElementById('entrega'), 
        recebimento: document.getElementById('recebimento')
    };

    const mainButtons = {
        imprimir: document.getElementById('btn-imprimir'),
        salvar: document.getElementById('btn-salvar'), 
        limpar: document.getElementById('btn-limpar'),
        excluir: document.getElementById('btn-excluir'),
        abrirMerger: document.getElementById('btn-open-merger')
    };

    // Modal de impressão
    const printModal = document.getElementById('print-modal');
    const closeModal = document.getElementById('close-modal');
    const btnCancelPrint = document.getElementById('btn-cancel-print');
    const btnConfirmPrint = document.getElementById('btn-confirm-print');
    const monthSelect = document.getElementById('month-select');
    const monthYearSelect = document.getElementById('month-year-select');
    const yearSelect = document.getElementById('year-select');
    const monthFilterGroup = document.getElementById('month-filter-group');
    const yearFilterGroup = document.getElementById('year-filter-group');

    let allProtocols = [];
    let selectedProtId = null;
    let protocolChart = null;
    let availableYears = []; // Anos que têm protocolos

    // --- LÓGICA DE UI E RENDERIZAÇÃO ---
    const determineStatus = (protocol) => {
        return (protocol.ENTREGA && protocol.ENTREGA.trim() !== '') 
            ? { text: 'Entregue', class: 'status-Entregue' } 
            : { text: 'Pendente', class: 'status-Pendente' };
    };

    const renderList = (protocols) => {
        const scrollPosition = listContainer.scrollTop;
        listContainer.innerHTML = '';
        protocols.forEach(p => {
            const item = mainTemplate.content.cloneNode(true).firstElementChild;
            const status = determineStatus(p);
            item.dataset.id = p.ID;
            item.querySelector('.item-title').textContent = p.NOME || '(sem nome)';
            item.querySelector('.item-subtitle').textContent = `PROT: ${p.PROT}`;
            item.querySelector('.status-tag').textContent = status.text;
            item.querySelector('.status-tag').className = `status-tag ${status.class}`;
            if (p.ID === selectedProtId) {
                item.classList.add('selected');
            }
            listContainer.appendChild(item);
        });
        listContainer.scrollTop = scrollPosition;
    };

    const showDetailsView = (protocol) => {
        welcomeMessage.style.display = 'none';
        detailContent.style.display = 'block';
        
        Object.values(formFields).forEach(field => field.readOnly = false);

        if (protocol) {
            detailsHeader.textContent = `Editando Protocolo #${protocol.PROT}`;
            formFields.prot.value = protocol.PROT || '';
            formFields.data.value = protocol.DATA || '';
            formFields.nome.value = protocol.NOME || '';
            formFields.pmh.value = protocol.PMH || '';
            formFields.entrega.value = protocol.ENTREGA || '';
            formFields.recebimento.value = protocol.RECEBIMENTO || '';
            
            formFields.prot.readOnly = true;
            mainButtons.excluir.disabled = false;
        } else {
            detailsHeader.textContent = 'Incluir Novo Protocolo';
            form.reset();
            formFields.prot.focus();
            mainButtons.excluir.disabled = true;
        }
    };

    // Plugin para texto no centro do gráfico
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: (chart) => {
            if (chart.config.options.plugins.centerText.display) {
                const { ctx, data } = chart;
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                const centerX = chart.getDatasetMeta(0).data[0].x;
                const centerY = chart.getDatasetMeta(0).data[0].y;
        
                ctx.save();
                ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
                ctx.fillStyle = 'var(--font-color)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(total, centerX, centerY - 8);
                
                ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
                ctx.fillStyle = 'var(--font-color-light)';
                ctx.fillText('Total', centerX, centerY + 12);
                ctx.restore();
            }
        }
    };
    
    Chart.register(centerTextPlugin);

    const updateChart = (protocols) => {
        let pendentes = 0;
        let entregues = 0;

        protocols.forEach(p => {
            if (p.ENTREGA && p.ENTREGA.trim() !== '') {
                entregues++;
            } else {
                pendentes++;
            }
        });

        if (protocolChart) {
            protocolChart.data.datasets[0].data = [pendentes, entregues];
            protocolChart.update();
        } else {
            const ctx = document.getElementById('protocolChart').getContext('2d');
            protocolChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Pendentes', 'Entregues'],
                    datasets: [{
                        label: 'Status dos Protocolos',
                        data: [pendentes, entregues],
                        backgroundColor: ['#dc2626', '#166534'],
                        borderColor: ['#eef2ff', '#eef2ff'],
                        borderWidth: 3,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '70%',
                    plugins: {
                        centerText: { display: true },
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                boxWidth: 12,
                                font: { size: 12, weight: '500' }
                            }
                        }
                    }
                }
            });
        }
    };

    // Extrai anos dos protocolos e popula dropdowns
    const populateFilters = () => {
        // Extrai anos únicos dos protocolos
        const years = new Set();
        allProtocols.forEach(p => {
            if (p.DATA && p.DATA.trim()) {
                // DATA está em DD/MM/YYYY
                const parts = p.DATA.split('/');
                if (parts.length === 3) {
                    const year = parseInt(parts[2]);
                    if (!isNaN(year) && year > 2000) {
                        years.add(year);
                    }
                }
            }
        });

        // Converte para array e ordena (mais recente primeiro)
        availableYears = Array.from(years).sort((a, b) => b - a);

        // Se não houver anos, usa ano atual
        if (availableYears.length === 0) {
            availableYears = [new Date().getFullYear()];
        }

        // Popula dropdown de ano para mês específico
        monthYearSelect.innerHTML = '<option value="">Escolha um ano...</option>';
        availableYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            monthYearSelect.appendChild(option);
        });

        // Popula dropdown de ano específico
        yearSelect.innerHTML = '<option value="">Escolha um ano...</option>';
        availableYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
    };

    // --- CHAMADAS À API ---
    // ✅ FIX: Detecta automaticamente o IP do servidor
    async function apiRequest(endpoint, method = 'GET', body = null) {
        // Usa o mesmo host e protocolo da página, mas força porta 8001
        const serverUrl = `${window.location.protocol}//${window.location.hostname}:8001`;
        
        try {
            const options = { 
                method, 
                headers: { 'Content-Type': 'application/json' }
            };
            if (body) { 
                options.body = JSON.stringify(body); 
            }
            
            const response = await fetch(`${serverUrl}${endpoint}`, options);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro no servidor');
            }
            
            if (response.headers.get("content-type")?.includes("application/json")) {
                return response.json();
            }
            
            return { success: true, message: "Ação concluída." };
        } catch (error) {
            console.error(`Erro na requisição para ${endpoint}:`, error);
            alert(`Erro de comunicação: ${error.message}`);
            return null;
        }
    }

    async function refreshProtocols() {
        const data = await apiRequest('/api/protocols');
        if (data) {
            allProtocols = data;
            renderList(allProtocols);
            updateChart(allProtocols);
            populateFilters(); // Atualiza anos disponíveis
        }
    }

    // --- MODAL DE IMPRESSÃO ---
    const openPrintModal = () => {
        printModal.style.display = 'flex';
    };

    const closePrintModal = () => {
        printModal.style.display = 'none';
    };

    // Controla visibilidade dos grupos de filtro
    document.querySelectorAll('input[name="print-filter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const value = e.target.value;
            
            // Esconde todos os grupos
            monthFilterGroup.style.display = 'none';
            yearFilterGroup.style.display = 'none';
            
            // Desabilita todos os selects
            monthSelect.disabled = true;
            monthYearSelect.disabled = true;
            yearSelect.disabled = true;
            
            // Mostra e habilita o grupo correto
            if (value === 'month') {
                monthFilterGroup.style.display = 'block';
                monthSelect.disabled = false;
                monthYearSelect.disabled = false;
            } else if (value === 'year') {
                yearFilterGroup.style.display = 'block';
                yearSelect.disabled = false;
            }
        });
    });

    // --- EVENT LISTENERS ---
    listContainer.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (li) {
            const protocolId = li.dataset.id;
            const protocol = allProtocols.find(p => p.ID == protocolId);

            if (protocol) {
                const currentlySelected = listContainer.querySelector('.selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('selected');
                }
                li.classList.add('selected');
                selectedProtId = protocolId;
                showDetailsView(protocol);
            }
        }
    });

    mainButtons.limpar.addEventListener('click', () => {
        const currentlySelected = listContainer.querySelector('.selected');
        if (currentlySelected) {
            currentlySelected.classList.remove('selected');
        }
        selectedProtId = null;
        showDetailsView(null);
    });

    mainButtons.abrirMerger.addEventListener('click', () => {
        eel.select_folder()();
    });

    mainButtons.imprimir.addEventListener('click', () => {
        openPrintModal();
    });

    closeModal.addEventListener('click', closePrintModal);
    btnCancelPrint.addEventListener('click', closePrintModal);

    btnConfirmPrint.addEventListener('click', async () => {
        const filterType = document.querySelector('input[name="print-filter"]:checked').value;
        let filterValue = '';

        if (filterType === 'month') {
            const month = monthSelect.value;
            const year = monthYearSelect.value;
            
            if (!month) {
                alert('Por favor, selecione um mês.');
                return;
            }
            if (!year) {
                alert('Por favor, selecione um ano.');
                return;
            }
            
            filterValue = `${year}-${month}`; // Formato: 2024-04
            
        } else if (filterType === 'year') {
            filterValue = yearSelect.value;
            
            if (!filterValue) {
                alert('Por favor, selecione um ano.');
                return;
            }
        }

        const result = await apiRequest('/api/print/preview', 'POST', {
            filter_type: filterType,
            filter_value: filterValue
        });

        if (result && result.success) {
            alert('Relatório gerado! Verifique seu navegador.');
            closePrintModal();
        }
    });
    
    mainButtons.excluir.addEventListener('click', async () => {
        if (!selectedProtId) return;
        if (confirm(`Tem certeza que deseja excluir o protocolo ${selectedProtId}?`)) {
            const result = await apiRequest('/api/protocols/delete', 'POST', { ID: selectedProtId });
            if (result && result.success) {
                alert(result.message); 
                selectedProtId = null;
                await refreshProtocols();
                showDetailsView(null);
            }
        }
    });

    mainButtons.salvar.addEventListener('click', async () => {
        const data = {
            PROT: formFields.prot.value, 
            DATA: formFields.data.value, 
            NOME: formFields.nome.value,
            PMH: formFields.pmh.value, 
            ENTREGA: formFields.entrega.value, 
            RECEBIMENTO: formFields.recebimento.value,
        };
        
        if (!data.PROT || !data.PROT.trim()) {
            alert('O campo PROT é obrigatório.'); 
            return;
        }
        
        const endpoint = selectedProtId ? '/api/protocols/edit' : '/api/protocols/add';
        const result = await apiRequest(endpoint, 'POST', data);
        
        if (result && result.success) {
            alert(result.message);
            selectedProtId = null;
            await refreshProtocols();
            showDetailsView(null);
        }
    });
    
    filtroInput.addEventListener('input', () => {
        const searchTerm = filtroInput.value.toLowerCase();
        const filteredData = allProtocols.filter(p => 
            String(p.NOME).toLowerCase().includes(searchTerm) || 
            String(p.PROT).toLowerCase().includes(searchTerm)
        );
        renderList(filteredData);
    });

    // Fechar modal ao clicar fora
    printModal.addEventListener('click', (e) => {
        if (e.target === printModal) {
            closePrintModal();
        }
    });

    // --- INICIALIZAÇÃO ---
    welcomeMessage.style.display = 'block';
    detailContent.style.display = 'none';
    refreshProtocols();
});

// Função exposta para o Python
eel.expose(openMergerWindow, 'open_merger_window');
function openMergerWindow(folderPath) {
    const url = `marger.html?folder_path=${encodeURIComponent(folderPath)}`;
    window.open(url, '_blank', 'width=700,height=600,left=200,top=200,resizable=yes');
}
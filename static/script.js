document.addEventListener('DOMContentLoaded', () => {

    // MAPEAMENTO DOS ELEMENTOS

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
        recebimento: document.getElementById('recebimento'),
    };

    const mainButtons = {
        imprimir: document.getElementById('btn-imprimir'),
        salvar: document.getElementById('btn-salvar'),
        limpar: document.getElementById('btn-limpar'),
        excluir: document.getElementById('btn-excluir'),
        abrirMerger: document.getElementById('btn-open-merger'),
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
    let availableYears = [];

    // FUNÇÕES AUXILIARES

    /**
     * Resolve cor CSS variable para valor computado (Canvas não interpreta var()).
     * Retorna fallback se a variável não existir.
     */
    const resolveCssColor = (varName, fallback) => {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
        return value || fallback;
    };

    /**
     * Extrai ano (number) de uma data no formato DD/MM/YYYY.
     * Retorna null se inválido.
     */
    const extractYear = (dateStr) => {
        if (!dateStr || !dateStr.trim()) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[2], 10);
        return (!isNaN(year) && year > 2000) ? year : null;
    };

    /** Popula um <select> com lista de anos, precedido de placeholder. */
    const populateYearSelect = (selectEl, years, placeholder) => {
        selectEl.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = placeholder;
        selectEl.appendChild(defaultOpt);

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            selectEl.appendChild(option);
        });
    };

    /** Debounce simples — atrasa execução até parar de digitar. */
    const debounce = (fn, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    };

    // LÓGICA DE UI E RENDERIZAÇÃO
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

            const statusTag = item.querySelector('.status-tag');
            statusTag.textContent = status.text;
            statusTag.className = `status-tag ${status.class}`;

            // FIX: Comparação consistente de tipos (ambos como Number)
            if (Number(p.ID) === Number(selectedProtId)) {
                item.classList.add('selected');
            }

            listContainer.appendChild(item);
        });

        listContainer.scrollTop = scrollPosition;
    };

    const showDetailsView = (protocol) => {
        welcomeMessage.style.display = 'none';
        detailContent.style.display = 'block';

        Object.values(formFields).forEach(field => { field.readOnly = false; });

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

    // --- Chart.js: Plugin de texto central ---
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: (chart) => {
            if (!chart.config.options.plugins.centerText.display) return;

            const { ctx, data } = chart;
            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
            const meta = chart.getDatasetMeta(0).data[0];
            const centerX = meta.x;
            const centerY = meta.y;

            // FIX: Canvas não interpreta var(). Resolve para valor real.
            const fontColor = resolveCssColor('--font-color', '#1e293b');
            const fontColorLight = resolveCssColor('--font-color-light', '#64748b');
            const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';

            ctx.save();
            ctx.font = `bold 24px ${fontFamily}`;
            ctx.fillStyle = fontColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total, centerX, centerY - 8);

            ctx.font = `600 12px ${fontFamily}`;
            ctx.fillStyle = fontColorLight;
            ctx.fillText('Total', centerX, centerY + 12);
            ctx.restore();
        },
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
                        hoverOffset: 4,
                    }],
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
                                font: { size: 12, weight: '500' },
                            },
                        },
                    },
                },
            });
        }
    };

    const populateFilters = () => {
        const years = new Set();
        allProtocols.forEach(p => {
            const year = extractYear(p.DATA);
            if (year) years.add(year);
        });

        availableYears = Array.from(years).sort((a, b) => b - a);

        if (availableYears.length === 0) {
            availableYears = [new Date().getFullYear()];
        }

        // Popula ambos os dropdowns de ano (eliminando duplicação)
        populateYearSelect(monthYearSelect, availableYears, 'Escolha um ano...');
        populateYearSelect(yearSelect, availableYears, 'Escolha um ano...');
    };

    // CHAMADAS À API

    async function apiRequest(endpoint, method = 'GET', body = null) {
        const serverUrl = `${window.location.protocol}//${window.location.hostname}:8001`;

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
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro no servidor');
            }

            if (response.headers.get('content-type')?.includes('application/json')) {
                return response.json();
            }

            return { success: true, message: 'Ação concluída.' };
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
            populateFilters();
        }
    }

    // MODAL DE IMPRESSÃO

    const openPrintModal = () => { printModal.style.display = 'flex'; };
    const closePrintModal = () => { printModal.style.display = 'none'; };

    // Controla visibilidade dos grupos de filtro
    document.querySelectorAll('input[name="print-filter"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const value = e.target.value;

            monthFilterGroup.style.display = 'none';
            yearFilterGroup.style.display = 'none';
            monthSelect.disabled = true;
            monthYearSelect.disabled = true;
            yearSelect.disabled = true;

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

    // EVENT LISTENERS

    // --- Lista: Selecionar protocolo ---
    listContainer.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        const protocolId = Number(li.dataset.id);
        const protocol = allProtocols.find(p => Number(p.ID) === protocolId);
        if (!protocol) return;

        const currentlySelected = listContainer.querySelector('.selected');
        if (currentlySelected) currentlySelected.classList.remove('selected');

        li.classList.add('selected');
        selectedProtId = protocolId;
        showDetailsView(protocol);
    });

    // --- Botão: Limpar ---
    mainButtons.limpar.addEventListener('click', () => {
        const currentlySelected = listContainer.querySelector('.selected');
        if (currentlySelected) currentlySelected.classList.remove('selected');

        selectedProtId = null;
        showDetailsView(null);
    });

    // --- Botão: Abrir Merger ---
    mainButtons.abrirMerger.addEventListener('click', () => {
        eel.select_folder()();
    });

    // --- Botão: Imprimir (abre modal) ---
    mainButtons.imprimir.addEventListener('click', openPrintModal);

    // --- Modal: Fechar ---
    closeModal.addEventListener('click', closePrintModal);
    btnCancelPrint.addEventListener('click', closePrintModal);
    printModal.addEventListener('click', (e) => {
        if (e.target === printModal) closePrintModal();
    });

    // --- Modal: Confirmar impressão ---
    btnConfirmPrint.addEventListener('click', async () => {
        const filterType = document.querySelector('input[name="print-filter"]:checked').value;
        let filterValue = '';

        if (filterType === 'month') {
            const month = monthSelect.value;
            const year = monthYearSelect.value;

            if (!month) { alert('Por favor, selecione um mês.'); return; }
            if (!year)  { alert('Por favor, selecione um ano.'); return; }

            filterValue = `${year}-${month}`;
        } else if (filterType === 'year') {
            filterValue = yearSelect.value;
            if (!filterValue) { alert('Por favor, selecione um ano.'); return; }
        }

        const result = await apiRequest('/api/print/preview', 'POST', {
            filter_type: filterType,
            filter_value: filterValue,
        });

        if (result && result.success) {
            alert('Relatório gerado! Verifique seu navegador.');
            closePrintModal();
        }
    });

    // --- Botão: Excluir ---
    mainButtons.excluir.addEventListener('click', async () => {
        if (!selectedProtId) return;

        if (!confirm(`Tem certeza que deseja excluir o protocolo ${selectedProtId}?`)) return;

        const result = await apiRequest('/api/protocols/delete', 'POST', { ID: selectedProtId });
        if (result && result.success) {
            alert(result.message);
            selectedProtId = null;
            await refreshProtocols();
            showDetailsView(null);
        }
    });

    // --- Botão: Salvar ---
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

    // --- Filtro de busca (com debounce) ---
    filtroInput.addEventListener('input', debounce(() => {
        const searchTerm = filtroInput.value.toLowerCase();
        const filteredData = allProtocols.filter(p =>
            String(p.NOME).toLowerCase().includes(searchTerm) ||
            String(p.PROT).toLowerCase().includes(searchTerm)
        );
        renderList(filteredData);
    }, 200));

    // INICIALIZAÇÃO

    welcomeMessage.style.display = 'block';
    detailContent.style.display = 'none';
    refreshProtocols();
});

// FUNÇÃO EXPOSTA PARA O PYTHON (Eel) — fora do DOMContentLoaded intencionalmente

eel.expose(openMergerWindow, 'open_merger_window');
function openMergerWindow(folderPath) {
    const url = `marger.html?folder_path=${encodeURIComponent(folderPath)}`;
    window.open(url, '_blank', 'width=700,height=600,left=200,top=200,resizable=yes');
}
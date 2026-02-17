// script.js

document.addEventListener('DOMContentLoaded', () => {

    // MAPEAMENTO DOS ELEMENTOS

    const listContainer = document.getElementById('protocol-list');
    const mainTemplate = document.getElementById('list-item-template');
    const detailContent = document.getElementById('detail-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const detailsHeader = document.getElementById('details-header');
    const filtroInput = document.getElementById('filtro-input');
    const form = document.getElementById('protocol-form');
    const listCount = document.getElementById('list-count');

    // Stat cards
    const statTotal = document.getElementById('stat-total');
    const statEntregues = document.getElementById('stat-entregues');
    const statPendentes = document.getElementById('stat-pendentes');

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
        secretaria: document.getElementById('btn-secretaria'),
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

    const extractYear = (dateStr) => {
        if (!dateStr || !dateStr.trim()) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[2], 10);
        return (!isNaN(year) && year > 2000) ? year : null;
    };

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
            item.querySelector('.item-subtitle').textContent = `PROT ${p.PROT}`;

            const statusTag = item.querySelector('.status-tag');
            statusTag.textContent = status.text;
            statusTag.className = `status-tag ${status.class}`;

            if (Number(p.ID) === Number(selectedProtId)) {
                item.classList.add('selected');
            }

            listContainer.appendChild(item);
        });

        listContainer.scrollTop = scrollPosition;

        // Atualiza contador
        if (listCount) listCount.textContent = protocols.length;
    };

    const showDetailsView = (protocol) => {
        welcomeMessage.style.display = 'none';
        detailContent.style.display = 'block';

        Object.values(formFields).forEach(field => { field.readOnly = false; });

        if (protocol) {
            detailsHeader.textContent = `PROTOCOLO #${protocol.PROT}`;
            formFields.prot.value = protocol.PROT || '';
            formFields.data.value = protocol.DATA || '';
            formFields.nome.value = protocol.NOME || '';
            formFields.pmh.value = protocol.PMH || '';
            formFields.entrega.value = protocol.ENTREGA || '';
            formFields.recebimento.value = protocol.RECEBIMENTO || '';

            formFields.prot.readOnly = true;
            mainButtons.excluir.disabled = false;
        } else {
            detailsHeader.textContent = 'NOVO REGISTRO';
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
            if (!meta) return;
            const centerX = meta.x;
            const centerY = meta.y;

            ctx.save();
            ctx.font = `bold 22px 'JetBrains Mono', monospace`;
            ctx.fillStyle = '#E2E4E9';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total, centerX, centerY - 6);

            ctx.font = `600 9px 'Barlow Condensed', sans-serif`;
            ctx.fillStyle = '#5C6073';
            ctx.letterSpacing = '0.15em';
            ctx.fillText('TOTAL', centerX, centerY + 12);
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

        // Atualiza stat cards
        if (statTotal) statTotal.textContent = protocols.length;
        if (statEntregues) statEntregues.textContent = entregues;
        if (statPendentes) statPendentes.textContent = pendentes;

        if (protocolChart) {
            protocolChart.destroy();
            protocolChart = null;
        }

        const ctx = document.getElementById('protocolChart').getContext('2d');
        protocolChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pendentes', 'Entregues'],
                datasets: [{
                    data: [pendentes, entregues],
                    backgroundColor: ['#EF4444', '#22C55E'],
                    borderColor: ['#161920', '#161920'],
                    borderWidth: 3,
                    hoverOffset: 4,
                }],
            },
            options: {
                responsive: true,
                cutout: '72%',
                plugins: {
                    centerText: { display: true },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 14,
                            boxWidth: 10,
                            color: '#8B8FA3',
                            font: {
                                family: "'Barlow Condensed', sans-serif",
                                size: 11,
                                weight: '600',
                            },
                        },
                    },
                },
            },
        });
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

        populateYearSelect(monthYearSelect, availableYears, 'Selecione...');
        populateYearSelect(yearSelect, availableYears, 'Selecione...');
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
                // Injeta nome do operador em toda requisição POST
                body.OPERADOR = sessionStorage.getItem('operador') || 'NÃO IDENTIFICADO';
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

    mainButtons.limpar.addEventListener('click', () => {
        const currentlySelected = listContainer.querySelector('.selected');
        if (currentlySelected) currentlySelected.classList.remove('selected');

        selectedProtId = null;
        showDetailsView(null);
    });

    // SECRETARIA SAME MODAL

    const secModal = document.getElementById('secretaria-modal');
    const closeSecretaria = document.getElementById('close-secretaria');
    const secFiltro = document.getElementById('sec-filtro');
    const secTableBody = document.getElementById('sec-table-body');
    const secTotalBadge = document.getElementById('sec-total-badge');
    const secStatFiltered = document.getElementById('sec-stat-filtered');
    const secStatTotal = document.getElementById('sec-stat-total');

    let secAllData = [];
    let secChart = null;
    let secDataLoaded = false;

    const openSecModal = async () => {
        secModal.style.display = 'flex';
        if (!secDataLoaded) {
            await loadSecretariaData();
        }
    };

    const closeSecModal = () => {
        secModal.style.display = 'none';
    };

    async function loadSecretariaData() {
        const data = await apiRequest('/api/secretaria/protocols');
        if (!data || data.success === false) {
            secTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-red);padding:40px;">Erro ao carregar dados da Secretaria.</td></tr>';
            return;
        }

        secAllData = data;
        secDataLoaded = true;

        if (secStatTotal) secStatTotal.textContent = secAllData.length;
        if (secTotalBadge) secTotalBadge.textContent = `${secAllData.length} registros`;

        renderSecTable(secAllData);
        renderSecChart(secAllData);
    }

    function renderSecTable(rows) {
        secTableBody.innerHTML = '';

        if (rows.length === 0) {
            secTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px;">Nenhum registro encontrado.</td></tr>';
            if (secStatFiltered) secStatFiltered.textContent = '0';
            return;
        }

        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mono">${esc(r.protocolo)}</td>
                <td class="mono">${esc(r.prontuario)}</td>
                <td>${esc(r.nome)}</td>
                <td class="mono">${esc(r.data_prot)}</td>
                <td>${esc(r.finalidade)}</td>
                <td>${esc(r.alta)}</td>
                <td>${esc(r.obs)}</td>
            `;
            secTableBody.appendChild(tr);
        });

        if (secStatFiltered) secStatFiltered.textContent = rows.length;
    }

    function esc(val) {
        if (!val) return '';
        return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderSecChart(data) {
        // Agrupar por mês (YYYY-MM)
        const monthCounts = {};
        const monthNames = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

        data.forEach(r => {
            const dp = r.data_prot || '';
            // Tenta extrair mês/ano de formatos comuns: DD/MM/YYYY ou YYYY-MM-DD
            let key = null;
            if (dp.includes('/')) {
                const parts = dp.split('/');
                if (parts.length === 3 && parts[2].length === 4) {
                    key = `${parts[2]}-${parts[1].padStart(2, '0')}`;
                }
            } else if (dp.includes('-')) {
                const parts = dp.split('-');
                if (parts.length >= 2) {
                    key = `${parts[0]}-${parts[1].padStart(2, '0')}`;
                }
            }
            if (key) {
                monthCounts[key] = (monthCounts[key] || 0) + 1;
            }
        });

        // Ordenar por chave e pegar últimos 12 meses
        const sortedKeys = Object.keys(monthCounts).sort();
        const last12 = sortedKeys.slice(-12);

        const labels = last12.map(k => {
            const [y, m] = k.split('-');
            const mIdx = parseInt(m, 10) - 1;
            return `${monthNames[mIdx] || m}/${y.slice(2)}`;
        });
        const values = last12.map(k => monthCounts[k]);

        if (secChart) {
            secChart.destroy();
            secChart = null;
        }

        const ctx = document.getElementById('secChart').getContext('2d');
        secChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Registros',
                    data: values,
                    backgroundColor: 'rgba(196, 168, 100, 0.35)',
                    borderColor: '#C4A864',
                    borderWidth: 1,
                    borderRadius: 3,
                    maxBarThickness: 40,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            color: '#5C6073',
                            font: { family: "'Barlow Condensed'", size: 10, weight: '600' },
                        },
                        grid: { display: false },
                        border: { color: '#2A2D3A' },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#5C6073',
                            font: { family: "'JetBrains Mono'", size: 10 },
                            precision: 0,
                        },
                        grid: { color: '#1E2130' },
                        border: { display: false },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1C1F2A',
                        titleColor: '#C4A864',
                        bodyColor: '#E2E4E9',
                        borderColor: '#2A2D3A',
                        borderWidth: 1,
                        titleFont: { family: "'Barlow Condensed'", weight: '600' },
                        bodyFont: { family: "'JetBrains Mono'" },
                    },
                },
            },
        });
    }

    // Secretaria event listeners
    mainButtons.secretaria.addEventListener('click', openSecModal);
    closeSecretaria.addEventListener('click', closeSecModal);
    secModal.addEventListener('click', (e) => {
        if (e.target === secModal) closeSecModal();
    });

    secFiltro.addEventListener('input', debounce(() => {
        const term = secFiltro.value.toLowerCase();
        if (!term) {
            renderSecTable(secAllData);
            return;
        }
        const filtered = secAllData.filter(r =>
            String(r.nome).toLowerCase().includes(term) ||
            String(r.prontuario).toLowerCase().includes(term) ||
            String(r.protocolo).toLowerCase().includes(term)
        );
        renderSecTable(filtered);
    }, 200));

    mainButtons.imprimir.addEventListener('click', openPrintModal);

    closeModal.addEventListener('click', closePrintModal);
    btnCancelPrint.addEventListener('click', closePrintModal);
    printModal.addEventListener('click', (e) => {
        if (e.target === printModal) closePrintModal();
    });

    btnConfirmPrint.addEventListener('click', async () => {
        const filterType = document.querySelector('input[name="print-filter"]:checked').value;
        let filterValue = '';

        if (filterType === 'month') {
            const month = monthSelect.value;
            const year = monthYearSelect.value;

            if (!month) { alert('Selecione um mês.'); return; }
            if (!year)  { alert('Selecione um ano.'); return; }

            filterValue = `${year}-${month}`;
        } else if (filterType === 'year') {
            filterValue = yearSelect.value;
            if (!filterValue) { alert('Selecione um ano.'); return; }
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

    mainButtons.excluir.addEventListener('click', async () => {
        if (!selectedProtId) return;

        if (!confirm(`Confirma exclusão do protocolo ${selectedProtId}?`)) return;

        const result = await apiRequest('/api/protocols/delete', 'POST', { ID: selectedProtId });
        if (result && result.success) {
            alert(result.message);
            selectedProtId = null;
            await refreshProtocols();
            showDetailsView(null);
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
            alert('O campo PROTOCOLO é obrigatório.');
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

// FUNÇÃO EXPOSTA PARA O PYTHON (Eel)

eel.expose(openMergerWindow, 'open_merger_window');
function openMergerWindow(folderPath) {
    const url = `marger.html?folder_path=${encodeURIComponent(folderPath)}`;
    window.open(url, '_blank', 'width=700,height=600,left=200,top=200,resizable=yes');
}
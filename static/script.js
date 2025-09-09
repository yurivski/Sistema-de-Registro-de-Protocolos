document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('protocol-list');
    const mainTemplate = document.getElementById('list-item-template');
    const detailContent = document.getElementById('detail-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const detailsHeader = document.getElementById('details-header');
    const filtroInput = document.getElementById('filtro-input');
    const form = document.getElementById('protocol-form');
    
    const formFields = {
        prot: document.getElementById('prot'), data: document.getElementById('data'),
        nome: document.getElementById('nome'), pmh: document.getElementById('pmh'),
        entrega: document.getElementById('entrega'), recebimento: document.getElementById('recebimento')
    };

    const mainButtons = {
        imprimir: document.getElementById('btn-imprimir'),
        salvar: document.getElementById('btn-salvar'), limpar: document.getElementById('btn-limpar'),
        excluir: document.getElementById('btn-excluir'),
        abrirMerger: document.getElementById('btn-open-merger')
    };

    let allProtocols = [];
    let selectedProtId = null;
    let protocolChart = null; 

    // UI e Renderização
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
            item.dataset.id = p.PROT;
            item.querySelector('.item-title').textContent = p.NOME;
            item.querySelector('.item-subtitle').textContent = `PROT: ${p.PROT}`;
            item.querySelector('.status-tag').textContent = status.text;
            item.querySelector('.status-tag').className = `status-tag ${status.class}`;
            if (p.PROT === selectedProtId) {
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
            formFields.prot.value = protocol.PROT || ''; formFields.data.value = protocol.DATA || '';
            formFields.nome.value = protocol.NOME || ''; formFields.pmh.value = protocol.PMH || '';
            formFields.entrega.value = protocol.ENTREGA || ''; formFields.recebimento.value = protocol.RECEBIMENTO || '';
            
            formFields.prot.readOnly = true;
            mainButtons.excluir.disabled = false;
        } else {
            detailsHeader.textContent = 'Incluir Novo Protocolo';
            form.reset();
            formFields.prot.focus();
            mainButtons.excluir.disabled = true;
        }
    };

    // Desenhar o texto no centro do gráfico
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
            // Atualiza os dados
            protocolChart.data.datasets[0].data = [pendentes, entregues];
            protocolChart.update();
        } else {
            // Se não, cria o gráfico pela primeira vez
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
                        // Ativa o plugin para o gráfico
                        centerText: {
                            display: true
                        },
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

    // Chamada à API
    async function apiRequest(endpoint, method = 'GET', body = null) {
        const serverUrl = 'http://localhost:8001';
        try {
            const options = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) { options.body = JSON.stringify(body); }
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
        }
    }

    listContainer.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (li) {
            const protocolId = li.dataset.id;
            const protocol = allProtocols.find(p => p.PROT == protocolId);

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

    mainButtons.imprimir.addEventListener('click', () => apiRequest('/api/print'));
    
    mainButtons.excluir.addEventListener('click', async () => {
        if (!selectedProtId) return;
        if (confirm(`Tem certeza que deseja excluir o protocolo ${selectedProtId}?`)) {
            const result = await apiRequest('/api/protocols/delete', 'POST', { PROT: selectedProtId });
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
            PROT: formFields.prot.value, DATA: formFields.data.value, NOME: formFields.nome.value,
            PMH: formFields.pmh.value, ENTREGA: formFields.entrega.value, RECEBIMENTO: formFields.recebimento.value,
        };
        if (!data.PROT || !data.NOME) {
            alert('Os campos PROT e NOME são obrigatórios.'); return;
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
            String(p.NOME).toLowerCase().includes(searchTerm) || String(p.PROT).toLowerCase().includes(searchTerm)
        );
        renderList(filteredData);
    });

    // Inicialização
    welcomeMessage.style.display = 'block';
    detailContent.style.display = 'none';
    refreshProtocols();
});

eel.expose(openMergerWindow, 'open_merger_window');
function openMergerWindow(folderPath) {
    const url = `marger.html?folder_path=${encodeURIComponent(folderPath)}`;

    window.open(url, '_blank', 'width=700,height=600,left=200,top=200,resizable=yes');
}
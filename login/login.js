const serverUrl = `${window.location.protocol}//${window.location.hostname}:8001`;
document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('operador-input');
    const btnEntrar = document.getElementById('btn-entrar');
    const btnChangelog = document.getElementById('btn-changelog');
    const changelogPanel = document.getElementById('changelog-panel');
    const loginScreen = document.getElementById('login-screen');
    const successScreen = document.getElementById('success-screen');
    const successName = document.getElementById('success-name');
    const countdownEl = document.getElementById('countdown');
    

    // Toggle changelog
    btnChangelog.addEventListener('click', () => {
        const isOpen = changelogPanel.classList.toggle('open');
        btnChangelog.classList.toggle('expanded', isOpen);
        btnChangelog.querySelector('span').textContent =
            isOpen ? 'Ocultar atualizações' : 'Ver atualizações do sistema';
    });

    // Habilita botão conforme digitação (mínimo 2 caracteres)
    input.addEventListener('input', () => {
        btnEntrar.disabled = input.value.trim().length < 2;
    });

    // Enter no input
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !btnEntrar.disabled) entrar();
    });

    btnEntrar.addEventListener('click', entrar);

    async function entrar() {
        const nome = input.value.trim().toUpperCase();
        if (nome.length < 2) return;

        // Desabilita botão durante processamento
        btnEntrar.disabled = true;
        btnEntrar.textContent = 'ENTRANDO...';

        try {
            // Registra sessão no backend
            const response = await fetch(`${serverUrl}/api/auditoria/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operador: nome,
                    acao: 'SESSAO_INICIO',
                    detalhes: 'Login no sistema',
                }),
            });

            if (!response.ok) {
                throw new Error('Erro ao registrar sessão');
            }
        } catch (error) {
            console.warn('[AUDITORIA] Falha ao registrar sessão:', error.message);
            // Continua mesmo se a auditoria falhar — não trava o operador
        }

        // Salva operador na sessão do navegador
        sessionStorage.setItem('operador', nome);

        // Mostra tela de sucesso
        successName.textContent = nome;
        loginScreen.style.display = 'none';
        successScreen.classList.add('active');

        // Countdown e redirecionamento
        let count = 3;
        const timer = setInterval(() => {
            count--;
            countdownEl.textContent = count;
            if (count <= 0) {
                clearInterval(timer);
                // Redireciona para o dashboard
                window.location.href = '/dashboard';
            }
        }, 1000);
    }
});
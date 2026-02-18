# SISREGIP

**Sistema de Registro de Protocolos do SAME — Hospital Central do Exército**

Desenvolvido por Cb Yuri (2018/01) — Seção de Microfilme / Estatística - SAME - HCE

---

## Sobre o sistema

O SISREGIP é um sistema interno para gerenciar os protocolos da seção de estatística e microfilme do Serviço de Arquivo Médico e Estatística do Hospital Central do Exército. Ele registra a entrada, saída e entrega de documentos microfilmados / copiados, permitindo controle completo do fluxo de protocolos entre as seções do setor.

Na prática, ele substitui a planilha Excel que todos no setor se confundem para salvar, editar ou acrescentar dados, gerando diversos arquivos mal formatados, com nomes de arquivos renomeados cada vez que fosse usado e salvando como novo, gerando confusão e ocupando armazenamento devido à pouca instrução sobre o uso de Excel por parte dos militares.   

---

## Tela inicial
O sistema possui uma tela inicial para registrar o acesso dos miltares ao sistema. Ao se identificar, o sistema registrará as movimentações que o usuário fez.   

Imagem da tela inicial (Tela nativa e Web):

![Dashboard principal do SISREGIP](/imagens/tela_web.png)
![Dashboard principal do SISREGIP](/imagens/tela_nativa.png) 
![Dashboard principal do SISREGIP](/imagens/tela_inicial_1.png)   
![Dashboard principal do SISREGIP](/imagens/tela_inicial_2.png)

---

## O que ele faz

O sistema permite cadastrar, editar e excluir protocolos com controle de status (pendente ou entregue), consultar os dados da Secretaria SAME em modo somente leitura direto do dashboard, gerar relatórios filtrados por mês ou ano com preview no navegador, e acompanhar a situação operacional com gráficos em tempo real.

Ele roda como um servidor local acessível por qualquer máquina da rede interna do setor via navegador, sem necessidade de instalar nada nos computadores clientes.   

Imagem da tela inicial, visão web:

![Lista de protocolos com status](/imagens/visao_web.png)
![Lista de protocolos com status](/imagens/visao_web_2.png)
---

## Consulta à Secretaria SAME

Uma das funcionalidades acrescentadas em substituição à anterior (Mesclar PDF) do sistema é a visualização dos protocolos da Secretaria SAME. Ao clicar no botão no painel lateral, abre um painel com todos os registros da Secretaria em formato de tabela, com busca por nome, prontuário ou protocolo, e um gráfico mostrando o volume de registros por mês.

Essa consulta é somente leitura. O SISREGIP não altera nenhum dado da Secretaria — ele apenas lê o banco deles para facilitar a conferência cruzada entre as seções.

![Modal da Secretaria SAME](/imagens/dados_da_secretaria.png)
![Modal da Secretaria SAME](/imagens/dados_da_secretaria_2.png)

---

## Auditoria (tabela: registro_operacional)
O banco de dados possui duas tabelas de auditoria, a tabela `registro_operacional` salva as movimentações do usuário no dashboard, seja: adicionando protocolo, excluindo ou editando, tudo será salvo no banco de dados.   

Exemplo:

![Dashboard principal do SISREGIP](/imagens/tabela_auditoria.png)

---

## Relatórios

O sistema gera relatórios em HTML que abrem direto no navegador, prontos para imprimir. Dá para filtrar por todos os protocolos, por um mês específico ou por ano. O relatório mostra o resumo de totais (entregues, pendentes) e a tabela completa.

Imagem do modelo de relatório:

![Preview do relatório](/imagens/relatorio_1.png)
![Preview do relatório](/imagens/relatorio_2.png)
![Preview do relatório](/imagens/gerar_relatorio_1.png)
![Preview do relatório](/imagens/gerar_relatorio_2.png)
---

## Stack técnica

O backend é Python com Flask servindo uma API REST. O frontend é HTML, CSS e JavaScript. Os gráficos são feitos com Chart.js. O banco de dados é SQLite. O sistema é empacotado como executável Windows com PyInstaller e distribuído com instalador Inno Setup.

---

## Por que SQLite e não PostgreSQL

O sistema nasceu usando SQLite no princípio, migrei para PostgreSQL e precisei voltar com SQLite devido ao meu limite de tempo de serviço como militar temporário e sem militar substituto com conhecimento prático em Gerenciamento de Banco de Dados. Funcionava bem enquanto eu estava presente pra administrar o servidor. O problema é que o PostgreSQL precisa de um serviço rodando na máquina, precisa de configuração (host, porta, usuário, senha), e precisa de alguém que saiba o que fazer quando ele para de funcionar.

Quando eu sair do Exército em março de 2026, ninguém aqui vai saber dar manutenção num servidor PostgreSQL. Ninguém vai saber reiniciar o serviço, verificar logs, ajustar permissões ou recriar o banco se algo corromper. E eu não posso deixar um sistema que depende de mim pra continuar funcionando.

O SQLite resolve isso. O banco é um arquivo único que fica numa pasta de rede. Não tem servidor, não tem serviço, não tem senha. Se o sistema travar, é só reiniciar o executável. Se o banco corromper (improvável, mas possível), é só restaurar o backup — que é literalmente copiar um arquivo. Qualquer pessoa consegue fazer isso.

Essa decisão não foi técnica. Foi operacional. O PostgreSQL é tecnicamente superior em quase tudo. Mas superioridade técnica não importa se o sistema para de funcionar no dia seguinte à minha saída porque ninguém sabe manter o que eu deixei.

Regredir de tecnologia às vezes é a decisão certa dependendo do contexto.

---

## Requisitos

O sistema roda em Windows 10/11 (64-bit) e precisa de acesso à rede interna do hospital para ler os bancos de dados na unidade S:\. Pode ser usado com o navegador preferido do usuário. Não é necessário instalar Python, PostgreSQL ou qualquer outra dependência nas máquinas clientes.

---

## Instalação

Basta executar o instalador SISREGIP_Setup_v2.0.0.exe como administrador. Ele cria o atalho na área de trabalho, configura o firewall automaticamente e já deixa o sistema pronto pra uso. Sem wizard de banco de dados, sem configuração manual.

---

## Contato

Desenvolvido durante o período de serviço militar no HCE (2018-2026).

Em caso de problemas técnicos após minha saída, o sistema foi projetado pra não precisar de suporte. Mas se precisar, o código-fonte está documentado e acessível na pasta do projeto.
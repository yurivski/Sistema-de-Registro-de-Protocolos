; =======================================================================================================
; SISREGIP - Inno Setup Script v2.5 (SQLite + Login + Auditoria), aberto em janela de navegador separado 
; Sistema de Registro de Protocolos — SAME / HCE
; Créditos: Cb Yuri
; =======================================================================================================

#define MyAppName "SISREGIP"
#define MyAppVersion "2.5.0"
#define MyAppPublisher "Cb Yuri (2018/01) - SAME/HCE"
#define MyAppURL "http://localhost:8001"
#define MyAppExeName "SISREGIP.exe"

[Setup]
AppId={{B8E9F2A4-3C5D-4E6F-8A9B-1D2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

OutputDir=C:\Sistema-de-Registro-de-Protocolos\installer_output
OutputBaseFilename=SISREGIP_Setup_v{#MyAppVersion}
SetupIconFile=C:\Sistema-de-Registro-de-Protocolos\icone.ico

MinVersion=6.1sp1
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

DisableProgramGroupPage=yes
DisableWelcomePage=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"
Name: "startupicon"; Description: "Iniciar automaticamente com o Windows"; GroupDescription: "Inicialização:"

[Files]
; Executável principal
Source: "C:\Sistema-de-Registro-de-Protocolos\dist\SISREGIP.exe"; DestDir: "{app}"; Flags: ignoreversion

; Frontend - Dashboard
Source: "C:\Sistema-de-Registro-de-Protocolos\templates\index.html"; DestDir: "{app}\templates"; Flags: ignoreversion
Source: "C:\Sistema-de-Registro-de-Protocolos\static\style.css"; DestDir: "{app}\static"; Flags: ignoreversion
Source: "C:\Sistema-de-Registro-de-Protocolos\static\script.js"; DestDir: "{app}\static"; Flags: ignoreversion
Source: "C:\Sistema-de-Registro-de-Protocolos\static\manifest.json"; DestDir: "{app}\static"; Flags: ignoreversion skipifsourcedoesntexist
Source: "C:\Sistema-de-Registro-de-Protocolos\static\icon-192.png"; DestDir: "{app}\static"; Flags: ignoreversion skipifsourcedoesntexist
Source: "C:\Sistema-de-Registro-de-Protocolos\static\icon-512.png"; DestDir: "{app}\static"; Flags: ignoreversion skipifsourcedoesntexist

; Frontend - Login (pasta inteira)
Source: "C:\Sistema-de-Registro-de-Protocolos\login\*"; DestDir: "{app}\login"; Flags: ignoreversion recursesubdirs createallsubdirs

; Assets
Source: "C:\Sistema-de-Registro-de-Protocolos\intendencia.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema-de-Registro-de-Protocolos\icone.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema-de-Registro-de-Protocolos\service-worker.js"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "Iniciar {#MyAppName}"
Name: "{group}\{#MyAppName} (Navegador)"; Filename: "http://localhost:8001"; Comment: "Abrir no navegador"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\icone.ico"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""SISREGIP Flask"" dir=in action=allow protocol=TCP localport=8001"; Flags: runhidden; StatusMsg: "Configurando firewall..."
Filename: "{app}\{#MyAppExeName}"; Description: "Executar {#MyAppName} agora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""SISREGIP Flask"""; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\templates"
Type: filesandordirs; Name: "{app}\static"
Type: filesandordirs; Name: "{app}\login"
Type: files; Name: "{app}\*.log"

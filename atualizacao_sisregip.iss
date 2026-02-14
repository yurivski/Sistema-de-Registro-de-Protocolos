; ==============================================================================
; SISREGIP - Inno Setup Script v2.0 (SQLite)
; Sistema de Registro de Protocolos do Microfilme
; ==============================================================================

#define MyAppName "SISREGIP"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Cb Yuri (2018/01) - HCE"
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

OutputDir=C:\Sistema_microfilme\installer_output
OutputBaseFilename=SISREGIP_Setup_v{#MyAppVersion}
SetupIconFile=C:\Sistema_microfilme\icone.ico

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
Source: "C:\Sistema_microfilme\dist\SISREGIP.exe"; DestDir: "{app}"; Flags: ignoreversion

; Frontend
Source: "C:\Sistema_microfilme\templates\index.html"; DestDir: "{app}\templates"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\static\style.css"; DestDir: "{app}\static"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\static\script.js"; DestDir: "{app}\static"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\static\manifest.json"; DestDir: "{app}\static"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\static\icon-192.png"; DestDir: "{app}\static"; Flags: ignoreversion skipifsourcedoesntexist
Source: "C:\Sistema_microfilme\static\icon-512.png"; DestDir: "{app}\static"; Flags: ignoreversion skipifsourcedoesntexist

; Assets
Source: "C:\Sistema_microfilme\intendencia.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\icone.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\service-worker.js"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "Iniciar {#MyAppName}"
Name: "{group}\{#MyAppName} (Navegador)"; Filename: "http://localhost:8001"; Comment: "Abrir no navegador"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""SISREGIP Flask"" dir=in action=allow protocol=TCP localport=8001"; Flags: runhidden; StatusMsg: "Configurando firewall..."
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""SISREGIP Eel"" dir=in action=allow protocol=TCP localport=8000"; Flags: runhidden
Filename: "http://localhost:8001"; Description: "Abrir {#MyAppName} no navegador"; Flags: postinstall shellexec skipifsilent
Filename: "{app}\{#MyAppExeName}"; Description: "Executar {#MyAppName} agora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""SISREGIP Flask"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""SISREGIP Eel"""; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\templates"
Type: filesandordirs; Name: "{app}\static"
Type: files; Name: "{app}\*.log"

; ==============================================================================
; SISREGIP - Inno Setup Script SIMPLES
; Sistema de Registro de Protocolos do Microfilme
; ==============================================================================

#define MyAppName "SISREGIP"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Cb Yuri - HCE"
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
Source: "C:\Sistema_microfilme\dist\SISREGIP.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\.env"; DestDir: "{app}"; Flags: ignoreversion confirmoverwrite
Source: "C:\Sistema_microfilme\templates\*"; DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "C:\Sistema_microfilme\static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "C:\Sistema_microfilme\intendencia.png"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\icone.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "C:\Sistema_microfilme\service-worker.js"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "Iniciar {#MyAppName}"
Name: "{group}\{#MyAppName} (Navegador)"; Filename: "http://localhost:8001"; Comment: "Abrir no navegador"
Name: "{group}\Configurar Banco de Dados"; Filename: "notepad.exe"; Parameters: "{app}\.env"
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

[Code]
var
  PostgreSQLPage: TInputQueryWizardPage;
  
procedure InitializeWizard;
begin
  PostgreSQLPage := CreateInputQueryPage(wpSelectTasks,
    'Configuração do Banco de Dados',
    'Configure a conexão com o PostgreSQL',
    'Informe os dados de conexão. Você pode alterar depois editando o arquivo .env');
  
  PostgreSQLPage.Add('Servidor (IP ou localhost):', False);
  PostgreSQLPage.Add('Porta:', False);
  PostgreSQLPage.Add('Nome do Banco:', False);
  PostgreSQLPage.Add('Usuário:', False);
  PostgreSQLPage.Add('Senha:', True);
  
  PostgreSQLPage.Values[0] := 'localhost';
  PostgreSQLPage.Values[1] := '5432';
  PostgreSQLPage.Values[2] := 'sistema_protocolos';
  PostgreSQLPage.Values[3] := 'postgres';
  PostgreSQLPage.Values[4] := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: TStringList;
  EnvPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    EnvPath := ExpandConstant('{app}\.env');
    EnvFile := TStringList.Create;
    try
      EnvFile.Add('# CONFIGURACAO DO BANCO DE DADOS');
      EnvFile.Add('DB_HOST=' + PostgreSQLPage.Values[0]);
      EnvFile.Add('DB_PORT=' + PostgreSQLPage.Values[1]);
      EnvFile.Add('DB_NAME=' + PostgreSQLPage.Values[2]);
      EnvFile.Add('DB_USER=' + PostgreSQLPage.Values[3]);
      EnvFile.Add('DB_PASSWORD=' + PostgreSQLPage.Values[4]);
      EnvFile.SaveToFile(EnvPath);
    finally
      EnvFile.Free;
    end;
  end;
end;

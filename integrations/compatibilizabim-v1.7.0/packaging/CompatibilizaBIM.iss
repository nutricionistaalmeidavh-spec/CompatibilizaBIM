#define MyAppName "CompatibilizaBIM"
#define MyAppVersion "0.9.0"
#define MyAppExeName "CompatibilizaBIM.exe"

[Setup]
AppId={{C1F83985-DA11-4D47-9E11-BF8B4BDB24EF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\CompatibilizaBIM
DefaultGroupName={#MyAppName}
OutputDir=..\dist\installer
OutputBaseFilename=CompatibilizaBIM-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos adicionais:"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir CompatibilizaBIM"; Flags: nowait postinstall skipifsilent

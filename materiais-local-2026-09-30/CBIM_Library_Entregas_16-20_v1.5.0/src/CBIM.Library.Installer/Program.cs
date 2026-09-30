using Microsoft.Win32;
using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;

const string Product = "CBIM Library";
const string Version = "1.5.0";
var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "CBIM Library");
var addinDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Autodesk", "Revit", "Addins", "2027");
var addinFile = Path.Combine(addinDir, "CBIM.Library.addin");
var uninstall = args.Any(a => a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase));
try { if(uninstall){Uninstall();return 0;} Install();return 0; }
catch(Exception ex){Console.Error.WriteLine("CBIM Library: "+ex.Message);Console.WriteLine("Pressione ENTER para sair.");Console.ReadLine();return 1;}

void Install()
{
    if(Process.GetProcessesByName("Revit").Length>0)throw new InvalidOperationException("Feche o Revit antes de instalar/atualizar o CBIM Library.");
    Directory.CreateDirectory(installDir);Directory.CreateDirectory(addinDir);ExtractPayload(installDir);
    var dll=Path.Combine(installDir,"CBIM.Library.Revit2027.dll");if(!File.Exists(dll))throw new FileNotFoundException("Payload não contém CBIM.Library.Revit2027.dll.");File.WriteAllText(addinFile,AddinXml(dll));
    var libraryRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"CBIM Library");
    foreach(var p in new[]{"Official\\Current","Official\\Previous","My Library","Inbox","Cache","Thumbnails","Downloads","Database","Reports","Bridge\\Inbox","Bridge\\Outbox"})Directory.CreateDirectory(Path.Combine(libraryRoot,p));
    var self=Environment.ProcessPath!;var uninstallExe=Path.Combine(installDir,"CBIM.Library.Uninstall.exe");if(!Path.GetFullPath(self).Equals(Path.GetFullPath(uninstallExe),StringComparison.OrdinalIgnoreCase))File.Copy(self,uninstallExe,true);
    using var key=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\CBIM.Library");key.SetValue("DisplayName",Product);key.SetValue("DisplayVersion",Version);key.SetValue("Publisher","CBIM");key.SetValue("InstallLocation",installDir);key.SetValue("UninstallString",$"\"{uninstallExe}\" /uninstall");key.SetValue("NoModify",1,RegistryValueKind.DWord);key.SetValue("NoRepair",1,RegistryValueKind.DWord);
    Console.WriteLine("CBIM Library 1.5 instalado para Revit 2027.");Console.WriteLine("Entregas 16–20: catálogo inteligente, distribuição segura, project intelligence, diagnósticos e ponte de aprendizagem.");
}
void Uninstall(){if(Process.GetProcessesByName("Revit").Length>0)throw new InvalidOperationException("Feche o Revit antes de desinstalar.");if(File.Exists(addinFile))File.Delete(addinFile);Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\CBIM.Library",false);Console.WriteLine("Plugin removido. Bibliotecas e dados de aprendizagem locais foram preservados.");var cmd=$"/c timeout /t 2 /nobreak >nul & rmdir /s /q \"{installDir}\"";Process.Start(new ProcessStartInfo("cmd.exe",cmd){CreateNoWindow=true,UseShellExecute=false});}
void ExtractPayload(string destination){var asm=Assembly.GetExecutingAssembly();var name=asm.GetManifestResourceNames().FirstOrDefault(n=>n.EndsWith("payload.zip",StringComparison.OrdinalIgnoreCase))??throw new InvalidOperationException("payload.zip não foi incorporado. Execute BUILD_RELEASE.ps1.");using var stream=asm.GetManifestResourceStream(name)!;using var archive=new ZipArchive(stream,ZipArchiveMode.Read);foreach(var entry in archive.Entries){var target=Path.GetFullPath(Path.Combine(destination,entry.FullName));if(!target.StartsWith(Path.GetFullPath(destination),StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Entrada ZIP inválida.");if(string.IsNullOrEmpty(entry.Name)){Directory.CreateDirectory(target);continue;}Directory.CreateDirectory(Path.GetDirectoryName(target)!);entry.ExtractToFile(target,true);}}
string AddinXml(string dll)=>$"""
<?xml version="1.0" encoding="utf-8"?>
<RevitAddIns><AddIn Type="Application"><Name>CBIM Library</Name><Assembly>{System.Security.SecurityElement.Escape(dll)}</Assembly><FullClassName>CBIM.Library.Revit2027.App</FullClassName><ClientId>58A58C63-927D-4A0A-BF1E-66FF11A67C20</ClientId><VendorId>CBIM</VendorId><VendorDescription>CBIM Library — biblioteca BIM local, oficial somente leitura e Learning Ready.</VendorDescription></AddIn></RevitAddIns>
""";

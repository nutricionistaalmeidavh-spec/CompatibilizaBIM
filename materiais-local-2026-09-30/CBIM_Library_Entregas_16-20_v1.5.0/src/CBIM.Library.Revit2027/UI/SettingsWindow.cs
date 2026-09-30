using System.Windows;
using System.Windows.Controls;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.UI;

public sealed class SettingsWindow:Window
{
    private readonly TextBox _root=new(),_manifest=new(),_team=new(),_key=new(){AcceptsReturn=true,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};
    private readonly ComboBox _channel=new();private readonly CheckBox _requireSignature=new(){Content="Exigir assinatura do manifest"},_learning=new(){Content="Registrar aprendizagem local"};
    public AppSettings Settings{get;}
    public SettingsWindow(AppSettings settings)
    {
        Settings=settings;Title="CBIM Library - Configurações";Width=760;Height=560;WindowStartupLocation=WindowStartupLocation.CenterOwner;
        var panel=new StackPanel{Margin=new Thickness(18)};panel.Children.Add(Label("Biblioteca local"));_root.Text=settings.LibraryRootPath;panel.Children.Add(_root);
        panel.Children.Add(Label("Biblioteca da empresa (opcional, somente leitura local/rede)"));_team.Text=settings.TeamLibraryPath;panel.Children.Add(_team);
        panel.Children.Add(Label("Manifest oficial (HTTP/HTTPS somente leitura)"));_manifest.Text=settings.ManifestUrl;panel.Children.Add(_manifest);
        panel.Children.Add(Label("Canal"));_channel.ItemsSource=new[]{"stable","preview"};_channel.SelectedItem=settings.UpdateChannel;panel.Children.Add(_channel);
        _requireSignature.IsChecked=settings.RequireSignedManifest;_requireSignature.Margin=new Thickness(0,8,0,4);panel.Children.Add(_requireSignature);
        panel.Children.Add(Label("Chave pública PEM confiável (nunca a chave privada)"));_key.Text=settings.TrustedManifestPublicKeyPem;_key.Height=120;panel.Children.Add(_key);
        _learning.IsChecked=settings.LearningEnabled;_learning.Margin=new Thickness(0,8,0,8);panel.Children.Add(_learning);
        panel.Children.Add(new TextBlock{Text="O plugin do cliente não contém upload. Drag-and-drop permanece local; a integração CBIM usa apenas arquivos Bridge/Inbox e Bridge/Outbox.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,5,0,12)});
        var buttons=new StackPanel{Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right};var save=Btn("Salvar");save.Click+=(_,_)=>{Settings.LibraryRootPath=_root.Text.Trim();Settings.TeamLibraryPath=_team.Text.Trim();Settings.ManifestUrl=_manifest.Text.Trim();Settings.UpdateChannel=_channel.SelectedItem?.ToString()??"stable";Settings.RequireSignedManifest=_requireSignature.IsChecked==true;Settings.TrustedManifestPublicKeyPem=_key.Text.Trim();Settings.LearningEnabled=_learning.IsChecked==true;DialogResult=true;Close();};var cancel=Btn("Cancelar");cancel.Click+=(_,_)=>{DialogResult=false;Close();};buttons.Children.Add(save);buttons.Children.Add(cancel);panel.Children.Add(buttons);Content=new ScrollViewer{Content=panel};
    }
    private static TextBlock Label(string t)=>new(){Text=t,Margin=new Thickness(0,8,0,3),FontWeight=FontWeights.SemiBold};private static Button Btn(string t)=>new(){Content=t,Width=100,Margin=new Thickness(6),Padding=new Thickness(6)};
}

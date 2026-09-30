using Autodesk.Revit.UI;
using Microsoft.Win32;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using TextBox = System.Windows.Controls.TextBox;
using ComboBox = System.Windows.Controls.ComboBox;
using CBIM.Library.Revit2027.Models;
using CBIM.Library.Revit2027.Services;

namespace CBIM.Library.Revit2027.UI;

public sealed class LibraryWindow : Window
{
    private readonly RevitActionHandler _handler;
    private readonly ExternalEvent _externalEvent;
    private readonly SettingsService _settingsService = new();
    private AppSettings _settings;
    private LibraryPaths _paths = null!;
    private LibraryIndexService _index = null!;
    private LibraryImportService _import = null!;
    private RemoteUpdateService _updater = null!;
    private CbimBridgeService _bridge = null!;
    private CatalogSearchService _searchService = null!;
    private MetadataEnrichmentService _metadata = new();
    private LibraryDiagnosticsService _diagnostics = null!;
    private ProjectKitService _kits = null!;
    private RollbackService _rollback = null!;
    private readonly List<LibraryItem> _all = new();
    private readonly ObservableCollection<LibraryItem> _visible = new();
    private readonly ListView _list = new();
    private readonly TextBox _search = new();
    private readonly ComboBox _discipline = new();
    private readonly ComboBox _type = new();
    private readonly CheckBox _favorites = new() { Content = "Só favoritos" };
    private readonly TextBlock _status = new();
    private readonly TextBlock _details = new();
    private readonly Image _preview = new() { Width=260,Height=220,Stretch=System.Windows.Media.Stretch.Uniform };

    public LibraryWindow(RevitActionHandler handler, ExternalEvent externalEvent)
    {
        _handler=handler;_externalEvent=externalEvent;_handler.Completed+=OnRevitActionCompleted;
        _settings=_settingsService.Load();CreateServices();
        Title="CBIM Library 1.5 — Entregas 16–20 — Revit 2027";Width=1260;Height=790;MinWidth=980;MinHeight=620;WindowStartupLocation=WindowStartupLocation.CenterScreen;
        AllowDrop=true;Drop+=OnDrop;Content=BuildUi();Loaded+=async(_,_)=>await RefreshAsync(true);Closed+=(_,_)=>_handler.Completed-=OnRevitActionCompleted;
    }

    private void CreateServices()
    {
        _paths=new LibraryPaths(_settings);_index=new LibraryIndexService(_paths);_import=new LibraryImportService(_paths,_index);_updater=new RemoteUpdateService(_paths);
        _bridge=new CbimBridgeService(_paths);_bridge.WriteContractFile();_searchService=new CatalogSearchService(_bridge);_diagnostics=new LibraryDiagnosticsService(_paths);_kits=new ProjectKitService(_paths);_rollback=new RollbackService(_paths);
    }

    private UIElement BuildUi()
    {
        var root=new DockPanel{Margin=new Thickness(12)};
        var top=new Grid{Margin=new Thickness(0,0,0,10)};top.ColumnDefinitions.Add(new ColumnDefinition());top.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(170)});top.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(120)});top.ColumnDefinitions.Add(new ColumnDefinition{Width=GridLength.Auto});
        _search.ToolTip="Busca inteligente: nome, fabricante, material, sistema, DN, tipo, código ou alias aprendido";_search.Margin=new Thickness(0,0,8,0);_search.TextChanged+=(_,_)=>ApplySearch();Grid.SetColumn(_search,0);top.Children.Add(_search);
        _discipline.ItemsSource=new[]{"Todas","Arquitetura","Estrutural","Hidráulica","Elétrica","HVAC","Incêndio","Outros"};_discipline.SelectedIndex=0;_discipline.Margin=new Thickness(0,0,8,0);_discipline.SelectionChanged+=(_,_)=>ApplySearch();Grid.SetColumn(_discipline,1);top.Children.Add(_discipline);
        _favorites.VerticalAlignment=VerticalAlignment.Center;_favorites.Checked+=(_,_)=>ApplySearch();_favorites.Unchecked+=(_,_)=>ApplySearch();Grid.SetColumn(_favorites,2);top.Children.Add(_favorites);
        var settings=Button("Configurações",(_,_)=>OpenSettings());Grid.SetColumn(settings,3);top.Children.Add(settings);DockPanel.SetDock(top,Dock.Top);root.Children.Add(top);

        var bottom=new StackPanel{Margin=new Thickness(0,10,0,0)};var actions=new WrapPanel{HorizontalAlignment=HorizontalAlignment.Right};
        foreach(var b in new[]{
            Button("Usar",(_,_)=>UseSelected(false)),Button("Inserir",(_,_)=>UseSelected(true)),Button("Substituir",(_,_)=>ReplaceSelected()),Button("Analisar RFA",(_,_)=>InspectSelected()),Button("Comparar",(_,_)=>CompareSelected()),Button("★ Favorito",(_,_)=>ToggleFavorite()),Button("✓ Correto",(_,_)=>ConfirmSelected()),Button("Classificar",(_,_)=>ClassifySelected()),
            Button("Kits",(_,_)=>OpenKits()),Button("Padrões",(_,_)=>ImportStandards()),Button("Diagnóstico",(_,_)=>GenerateDiagnostics()),Button("Exportar CBIM",(_,_)=>ExportBridge()),Button("Feedback CBIM",(_,_)=>ApplyFeedback()),Button("Rollback",(_,_)=>OpenRollback()),Button("Reindexar",async(_,_)=>await RefreshAsync(true)),Button("Atualizar",async(_,_)=>await UpdateOfficialAsync())}) actions.Children.Add(b);
        bottom.Children.Add(actions);_status.Text="Arraste arquivos, ZIPs ou pastas: tudo entra apenas em Minha Biblioteca local.";_status.Margin=new Thickness(3,7,3,0);bottom.Children.Add(_status);DockPanel.SetDock(bottom,Dock.Bottom);root.Children.Add(bottom);

        var main=new Grid();main.ColumnDefinitions.Add(new ColumnDefinition());main.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(330)});_list.ItemsSource=_visible;_list.MouseDoubleClick+=(_,_)=>UseSelected(false);_list.SelectionChanged+=(_,_)=>ShowDetails();
        var view=new GridView();foreach(var c in new[]{("Nome","Name",270d),("Disciplina","Discipline",100d),("Fabricante","Manufacturer",120d),("Categoria","Category",145d),("Material","Material",80d),("DN","DiameterDisplay",65d),("Tipos","TypesDisplay",90d),("Q","QualityDisplay",55d)})view.Columns.Add(new GridViewColumn{Header=c.Item1,Width=c.Item3,DisplayMemberBinding=new Binding(c.Item2)});_list.View=view;Grid.SetColumn(_list,0);main.Children.Add(_list);
        var detailPanel=new StackPanel{Margin=new Thickness(12,0,0,0)};detailPanel.Children.Add(_preview);detailPanel.Children.Add(new TextBlock{Text="Tipo a carregar",FontWeight=FontWeights.SemiBold,Margin=new Thickness(0,8,0,3)});_type.MinWidth=250;detailPanel.Children.Add(_type);_details.TextWrapping=TextWrapping.Wrap;_details.Margin=new Thickness(0,10,0,0);detailPanel.Children.Add(_details);var scroll=new ScrollViewer{Content=detailPanel,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};Grid.SetColumn(scroll,1);main.Children.Add(scroll);root.Children.Add(main);return root;
    }

    private static Button Button(string text,RoutedEventHandler click){var b=new Button{Content=text,Padding=new Thickness(9,5,9,5),Margin=new Thickness(3),MinWidth=82};b.Click+=click;return b;}

    private async Task RefreshAsync(bool reindex)
    {
        try
        {
            _status.Text=reindex?"Indexando (hash incremental)...":"Atualizando catálogo...";var data=reindex?await _index.ReindexAsync():_index.LoadCatalog();_all.Clear();_all.AddRange(data);var applied=_bridge.ApplyFeedback(_all);if(applied>0)_index.SaveCatalog(_all);ApplySearch();_status.Text=$"{_all.Count} itens — Oficial + Pessoal{(string.IsNullOrWhiteSpace(_paths.TeamLibrary)?"":" + Empresa")} — {_paths.Root}";
        }
        catch(Exception ex){_status.Text=ex.Message;}
    }

    private void ApplySearch()
    {
        if(_searchService is null)return;var hits=_searchService.Search(_all,_search.Text,_discipline.SelectedItem?.ToString()??"Todas").Where(x=>_favorites.IsChecked!=true||x.Item.Favorite).Take(2000).ToList();var selected=(_list.SelectedItem as LibraryItem)?.Sha256;_visible.Clear();foreach(var h in hits)_visible.Add(h.Item);if(selected is not null)_list.SelectedItem=_visible.FirstOrDefault(x=>x.Sha256==selected);
    }

    private void ShowDetails()
    {
        if(_list.SelectedItem is not LibraryItem x){_details.Text="Selecione um componente.";_type.ItemsSource=null;_preview.Source=null;return;}
        _type.ItemsSource=x.TypeNames.Count>0?x.TypeNames:new[]{"(família completa)"};_type.SelectedIndex=0;
        _details.Text=$"{x.Name}\n\nOrigem: {x.Source}\nFabricante: {x.Manufacturer}\nDisciplina: {x.Discipline}\nCategoria: {x.Category}\nSistema: {Blank(x.System)}\nMaterial: {Blank(x.Material)}\nDN: {Blank(x.DiameterDisplay)}\nCódigo: {Blank(x.ProductCode)}\nRevit: {Blank(x.RevitVersionHint)}\nConectores: {x.ConnectorCount}\nParâmetros: {x.ParameterNames.Count}\nQualidade: {x.QualityScore}/100\nUso: {x.UseCount} vez(es)\nSINAPI: {Blank(x.SinapiCode)}\n\n{string.Join("\n",x.QualityIssues.Select(i=>"• "+i))}\n\n{x.Path}";
        _preview.Source=null;if(File.Exists(x.ThumbnailPath)){try{var img=new BitmapImage();img.BeginInit();img.CacheOption=BitmapCacheOption.OnLoad;img.UriSource=new Uri(x.ThumbnailPath);img.EndInit();_preview.Source=img;}catch{}}
    }

    private string SelectedType()=>_type.SelectedItem?.ToString() is string t&&t!="(família completa)"?t:"";
    private async void OnDrop(object sender,DragEventArgs e){if(!e.Data.GetDataPresent(DataFormats.FileDrop))return;var paths=(string[])e.Data.GetData(DataFormats.FileDrop)!;_status.Text="Importando localmente...";var r=await _import.ImportAsync(paths);await RefreshAsync(false);_status.Text=$"Importados {r.Imported}; duplicados {r.Duplicates}; ignorados {r.Ignored}; erros {r.Errors.Count}.";}
    private void ToggleFavorite(){if(_list.SelectedItem is not LibraryItem x)return;x.Favorite=!x.Favorite;_index.SaveCatalog(_all);ApplySearch();}
    private void UseSelected(bool insert){if(_list.SelectedItem is not LibraryItem x)return;var action=insert?RevitAction.SmartInsert:RevitAction.UseFile;_handler.SetAction(action,x.Path,SelectedType(),x.ThumbnailPath);_externalEvent.Raise();_status.Text="Enviado ao Revit...";}
    private void ReplaceSelected(){if(_list.SelectedItem is not LibraryItem x)return;_handler.SetAction(RevitAction.ReplaceSelected,x.Path,SelectedType(),x.ThumbnailPath);_externalEvent.Raise();_status.Text="Substituição enviada ao Revit...";}
    private void InspectSelected(){if(_list.SelectedItem is not LibraryItem x||x.Extension!="RFA"){_status.Text="Selecione uma família RFA.";return;}_handler.SetAction(RevitAction.InspectFamily,x.Path);_externalEvent.Raise();_status.Text="Analisando tipos, parâmetros e conectores no Revit...";}
    private void RecordUse(LibraryItem x,string action){x.UseCount++;x.LastUsedUtc=DateTime.UtcNow;if(_settings.LearningEnabled)_bridge.Record(_search.Text,action,x);_index.SaveCatalog(_all);ShowDetails();}
    private void ConfirmSelected(){if(_list.SelectedItem is not LibraryItem x)return;if(_settings.LearningEnabled)_bridge.Record(_search.Text,"confirmed",x,confidence:1.0);_status.Text="Escolha registrada como exemplo positivo para a futura aprendizagem.";}

    private void CompareSelected(){if(_list.SelectedItem is not LibraryItem x)return;var similar=_searchService.Similar(x,_all);var d=new ComparisonWindow(x,similar){Owner=this};if(d.ShowDialog()==true&&d.Selected is not null){_list.SelectedItem=_visible.FirstOrDefault(i=>i.Sha256==d.Selected.Sha256)??d.Selected;if(_settings.LearningEnabled)_bridge.Record(_search.Text,"compare-select",d.Selected);ShowDetails();}}
    private async void ClassifySelected(){if(_list.SelectedItem is not LibraryItem x)return;var d=new ClassificationWindow(x){Owner=this};if(d.ShowDialog()!=true)return;_index.SaveOverride(d.Value);await RefreshAsync(true);_status.Text="Classificação salva e reaplicada.";}
    private void OpenKits()=>new ProjectKitsWindow(_kits,_handler,_externalEvent){Owner=this}.Show();
    private void ImportStandards(){var dlg=new OpenFileDialog{Filter="Revit Project (*.rvt)|*.rvt",Title="Selecione o RVT de padrões"};if(dlg.ShowDialog(this)!=true)return;_handler.SetAction(RevitAction.ImportStandards,dlg.FileName);_externalEvent.Raise();}
    private void GenerateDiagnostics(){var file=_diagnostics.Generate(_all);Process.Start(new ProcessStartInfo(file){UseShellExecute=true});_status.Text="Diagnóstico gerado em Reports.";}
    private void ExportBridge(){_bridge.ExportVocabulary(_all);_bridge.WriteContractFile();_status.Text="Vocabulário e catálogo quantitativo exportados para Bridge/Outbox.";}
    private void ApplyFeedback(){var n=_bridge.ApplyFeedback(_all);_index.SaveCatalog(_all);ApplySearch();_status.Text=$"Feedback CBIM aplicado: {n} novo(s) alias.";}
    private void OpenRollback()=>new RollbackWindow(_paths,_rollback){Owner=this}.Show();

    private async Task UpdateOfficialAsync(){try{_status.Text="Consultando biblioteca oficial...";var progress=new Progress<string>(s=>_status.Text=s);var r=await _updater.UpdateAsync(_settings,progress);await RefreshAsync(true);_status.Text=$"Atualizado: {r.Updated}; atuais: {r.Current}; baixados: {r.DownloadedFiles}; reaproveitados: {r.ReusedFiles}; erros: {r.Errors.Count}.";}catch(Exception ex){_status.Text=ex.Message;}}
    private void OpenSettings(){var d=new SettingsWindow(new AppSettings{LibraryRootPath=_settings.LibraryRootPath,ManifestUrl=_settings.ManifestUrl,UpdateChannel=_settings.UpdateChannel,TrustedManifestPublicKeyPem=_settings.TrustedManifestPublicKeyPem,TeamLibraryPath=_settings.TeamLibraryPath,RequireSignedManifest=_settings.RequireSignedManifest,LearningEnabled=_settings.LearningEnabled}){Owner=this};if(d.ShowDialog()!=true)return;_settings=d.Settings;_settingsService.Save(_settings);CreateServices();_ = RefreshAsync(true);}

    private void OnRevitActionCompleted(object? sender,RevitActionResult result)=>Dispatcher.Invoke(()=>
    {
        if(result.Action==RevitAction.InspectFamily&&result.Success&&result.Inspection is not null)
        {
            var item=_all.FirstOrDefault(x=>x.Path.Equals(result.Inspection.Path,StringComparison.OrdinalIgnoreCase));if(item is not null){_metadata.ApplyInspection(item,result.Inspection);_index.SaveCatalog(_all);ApplySearch();_list.SelectedItem=_visible.FirstOrDefault(x=>x.Sha256==item.Sha256);ShowDetails();}
        }
        if(result.Success && result.Action is RevitAction.UseFile or RevitAction.SmartInsert or RevitAction.ReplaceSelected)
        {
            var item=_all.FirstOrDefault(x=>x.Path.Equals(result.Path,StringComparison.OrdinalIgnoreCase));
            if(item is not null) RecordUse(item,result.Action==RevitAction.SmartInsert?"smart-insert":result.Action==RevitAction.ReplaceSelected?"replace":"use");
        }
        _status.Text=result.Success?result.Message:"Revit: "+result.Message;
    });
    private static string Blank(string s)=>string.IsNullOrWhiteSpace(s)?"—":s;
}

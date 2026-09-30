using Autodesk.Revit.UI;
using System.Windows;
using System.Windows.Controls;
using CBIM.Library.Contracts;
using CBIM.Library.Revit2027.Services;

namespace CBIM.Library.Revit2027.UI;

public sealed class ProjectKitsWindow:Window
{
    public ProjectKitsWindow(ProjectKitService service,RevitActionHandler handler,ExternalEvent externalEvent)
    {
        Title="CBIM - Kits de novo projeto";Width=700;Height=420;WindowStartupLocation=WindowStartupLocation.CenterOwner;var root=new DockPanel{Margin=new Thickness(12)};var list=new ListBox{ItemsSource=service.Load(),DisplayMemberPath="Name"};root.Children.Add(list);var note=new TextBlock{Text="Os kits ficam em Database/project-kits.json. Podem carregar template, famílias/tipos e um RVT de padrões.",TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,8,0,8)};DockPanel.SetDock(note,Dock.Bottom);root.Children.Add(note);var run=new Button{Content="Criar projeto",Width=120,Margin=new Thickness(6),HorizontalAlignment=HorizontalAlignment.Right};run.Click+=(_,_)=>{if(list.SelectedItem is ProjectKit kit){handler.SetAction(RevitAction.CreateProjectKit,kit:kit);externalEvent.Raise();}};DockPanel.SetDock(run,Dock.Bottom);root.Children.Add(run);Content=root;
    }
}

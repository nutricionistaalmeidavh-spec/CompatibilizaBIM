using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.UI;

public sealed class ComparisonWindow:Window
{
    public LibraryItem? Selected{get;private set;}
    public ComparisonWindow(LibraryItem source,IReadOnlyList<LibraryItem> items)
    {
        Title=$"Comparar similares — {source.Name}";Width=900;Height=500;WindowStartupLocation=WindowStartupLocation.CenterOwner;var root=new DockPanel{Margin=new Thickness(12)};var info=new TextBlock{Text=$"Base: {source.Category} | {source.Material} | {source.DiameterDisplay} | {source.Manufacturer}",Margin=new Thickness(0,0,0,8)};DockPanel.SetDock(info,Dock.Top);root.Children.Add(info);
        var list=new ListView{ItemsSource=items};var v=new GridView();foreach(var c in new[]{("Nome","Name",270d),("Fabricante","Manufacturer",130d),("Categoria","Category",160d),("Material","Material",90d),("DN","DiameterDisplay",70d),("Qualidade","QualityDisplay",75d)})v.Columns.Add(new GridViewColumn{Header=c.Item1,Width=c.Item3,DisplayMemberBinding=new Binding(c.Item2)});list.View=v;root.Children.Add(list);
        var use=new Button{Content="Selecionar",Width=110,Margin=new Thickness(6),HorizontalAlignment=HorizontalAlignment.Right};use.Click+=(_,_)=>{Selected=list.SelectedItem as LibraryItem;if(Selected is not null){DialogResult=true;Close();}};DockPanel.SetDock(use,Dock.Bottom);root.Children.Add(use);Content=root;
    }
}

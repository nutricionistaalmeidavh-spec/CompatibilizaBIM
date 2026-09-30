using System.Windows;
using System.Windows.Controls;
using CBIM.Library.Revit2027.Services;

namespace CBIM.Library.Revit2027.UI;

public sealed class RollbackWindow:Window
{
    public RollbackWindow(LibraryPaths paths,RollbackService rollback)
    {
        Title="CBIM - Rollback por pacote";Width=760;Height=440;WindowStartupLocation=WindowStartupLocation.CenterOwner;var root=new Grid{Margin=new Thickness(12)};root.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(220)});root.ColumnDefinitions.Add(new ColumnDefinition());root.RowDefinitions.Add(new RowDefinition());root.RowDefinitions.Add(new RowDefinition{Height=GridLength.Auto});var packages=new ListBox{ItemsSource=Directory.Exists(paths.OfficialCurrent)?Directory.GetDirectories(paths.OfficialCurrent).Select(Path.GetFileName).OrderBy(x=>x).ToList():new()};var backups=new ListBox();packages.SelectionChanged+=(_,_)=>{var id=packages.SelectedItem?.ToString()??"";backups.ItemsSource=rollback.Backups(id);};Grid.SetColumn(packages,0);root.Children.Add(packages);Grid.SetColumn(backups,1);root.Children.Add(backups);var restore=new Button{Content="Restaurar selecionado",Width=160,Margin=new Thickness(6),HorizontalAlignment=HorizontalAlignment.Right};restore.Click+=(_,_)=>{var id=packages.SelectedItem?.ToString();var b=backups.SelectedItem?.ToString();if(id is not null&&b is not null){rollback.Restore(id,b);MessageBox.Show("Pacote restaurado. Reindexe a biblioteca.");}};Grid.SetRow(restore,1);Grid.SetColumnSpan(restore,2);root.Children.Add(restore);Content=root;
    }
}

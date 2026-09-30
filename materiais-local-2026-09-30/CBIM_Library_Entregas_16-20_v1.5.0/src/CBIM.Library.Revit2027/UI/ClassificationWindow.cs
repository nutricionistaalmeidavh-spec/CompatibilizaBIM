using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.UI;

public sealed class ClassificationWindow:Window
{
    private readonly TextBox _discipline=new(),_category=new(),_system=new(),_material=new(),_diameter=new(),_code=new(),_unit=new(),_sinapi=new(),_description=new();
    public ClassificationOverride Value{get;}
    public ClassificationWindow(LibraryItem item)
    {
        Value=new ClassificationOverride{Sha256=item.Sha256,Discipline=item.Discipline,Category=item.Category,System=item.System,Material=item.Material,NominalDiameterMm=item.NominalDiameterMm,ProductCode=item.ProductCode,QuantityUnit=item.QuantityUnit,SinapiCode=item.SinapiCode,CostDescription=item.CostDescription};
        Title="CBIM - Classificação técnica";Width=570;Height=540;WindowStartupLocation=WindowStartupLocation.CenterOwner;var p=new StackPanel{Margin=new Thickness(16)};
        foreach(var pair in new[]{("Disciplina",_discipline,item.Discipline),("Categoria",_category,item.Category),("Sistema",_system,item.System),("Material",_material,item.Material),("DN (mm)",_diameter,item.NominalDiameterMm?.ToString(CultureInfo.InvariantCulture)??""),("Código produto",_code,item.ProductCode),("Unidade quantitativo",_unit,item.QuantityUnit),("SINAPI",_sinapi,item.SinapiCode),("Descrição custo",_description,item.CostDescription)}){p.Children.Add(new TextBlock{Text=pair.Item1,Margin=new Thickness(0,6,0,2)});pair.Item2.Text=pair.Item3;p.Children.Add(pair.Item2);}
        var b=new Button{Content="Salvar",Width=110,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(0,14,0,0)};b.Click+=(_,_)=>{Value.Discipline=_discipline.Text.Trim();Value.Category=_category.Text.Trim();Value.System=_system.Text.Trim();Value.Material=_material.Text.Trim();Value.NominalDiameterMm=double.TryParse(_diameter.Text.Replace(',','.'),NumberStyles.Float,CultureInfo.InvariantCulture,out var d)?d:null;Value.ProductCode=_code.Text.Trim();Value.QuantityUnit=_unit.Text.Trim();Value.SinapiCode=_sinapi.Text.Trim();Value.CostDescription=_description.Text.Trim();DialogResult=true;Close();};p.Children.Add(b);Content=p;
    }
}

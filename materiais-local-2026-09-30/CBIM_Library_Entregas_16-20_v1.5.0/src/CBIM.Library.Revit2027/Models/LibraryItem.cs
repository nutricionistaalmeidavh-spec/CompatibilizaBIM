namespace CBIM.Library.Revit2027.Models;

public sealed class LibraryItem
{
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string Extension { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Size { get; set; }
    public long LastWriteTicksUtc { get; set; }
    public string Source { get; set; } = "";
    public string Discipline { get; set; } = "Outros";
    public string Manufacturer { get; set; } = "Não identificado";
    public string Category { get; set; } = "Não classificado";
    public string System { get; set; } = "";
    public string Material { get; set; } = "";
    public double? NominalDiameterMm { get; set; }
    public string ProductCode { get; set; } = "";
    public string RevitVersionHint { get; set; } = "";
    public string PackageId { get; set; } = "";
    public string PackageVersion { get; set; } = "";
    public List<string> TypeNames { get; set; } = new();
    public List<string> ParameterNames { get; set; } = new();
    public List<string> Aliases { get; set; } = new();
    public int ConnectorCount { get; set; }
    public int ElementCount { get; set; }
    public int QualityScore { get; set; }
    public List<string> QualityIssues { get; set; } = new();
    public string TechnicalSignature { get; set; } = "";
    public string ThumbnailPath { get; set; } = "";
    public DateTime IndexedAtUtc { get; set; }
    public DateTime? LastUsedUtc { get; set; }
    public int UseCount { get; set; }
    public bool Favorite { get; set; }
    public string QuantityUnit { get; set; } = "un";
    public string SinapiCode { get; set; } = "";
    public string CostDescription { get; set; } = "";

    public string SizeDisplay => Size switch
    {
        >= 1_073_741_824 => $"{Size / 1_073_741_824d:F2} GB",
        >= 1_048_576 => $"{Size / 1_048_576d:F1} MB",
        >= 1024 => $"{Size / 1024d:F1} KB",
        _ => $"{Size} B"
    };

    public string DiameterDisplay => NominalDiameterMm is double d ? $"DN {d:0.#}" : "";
    public string QualityDisplay => $"{QualityScore}/100";
    public string TypesDisplay => TypeNames.Count == 0 ? "—" : TypeNames.Count == 1 ? TypeNames[0] : $"{TypeNames.Count} tipos";
}

public sealed class RevitInspectionResult
{
    public string Path { get; set; } = "";
    public string Category { get; set; } = "";
    public List<string> TypeNames { get; set; } = new();
    public List<string> ParameterNames { get; set; } = new();
    public int ConnectorCount { get; set; }
    public int ElementCount { get; set; }
    public string Error { get; set; } = "";
}

public sealed class IndexStateEntry
{
    public string Path { get; set; } = "";
    public long Size { get; set; }
    public long LastWriteTicksUtc { get; set; }
    public string Sha256 { get; set; } = "";
}

public sealed class ClassificationOverride
{
    public string Sha256 { get; set; } = "";
    public string Discipline { get; set; } = "";
    public string Category { get; set; } = "";
    public string System { get; set; } = "";
    public string Material { get; set; } = "";
    public double? NominalDiameterMm { get; set; }
    public string ProductCode { get; set; } = "";
    public string QuantityUnit { get; set; } = "";
    public string SinapiCode { get; set; } = "";
    public string CostDescription { get; set; } = "";
}

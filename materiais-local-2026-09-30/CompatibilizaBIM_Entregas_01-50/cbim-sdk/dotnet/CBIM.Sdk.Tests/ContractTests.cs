using CBIM.Sdk;
using Xunit;

public class ContractTests
{
    [Fact]
    public void RoundTripPreservesWall()
    {
        var project = new CBIMProject
        {
            Name = "Teste",
            Elements =
            [
                new Wall { Start = new Point3D(0,0), End = new Point3D(5,0), Thickness = .14, Height = 2.8 }
            ]
        };
        var json = CBIMSerializer.Serialize(project);
        var loaded = CBIMSerializer.Deserialize(json);
        Assert.Single(loaded.Elements);
        Assert.IsType<Wall>(loaded.Elements[0]);
    }
}

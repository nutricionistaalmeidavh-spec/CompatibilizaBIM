# CBIM.Sdk .NET 0.4.0

SDK C# neutro para futuros adapters, inclusive o plugin Revit.

## Build esperado

```bash
dotnet test CBIM.Sdk.Tests/CBIM.Sdk.Tests.csproj
dotnet pack CBIM.Sdk/CBIM.Sdk.csproj -c Release -o dist
```

Não existe referência a `RevitAPI.dll`: a integração Autodesk será um projeto separado.


param(
  [string]$Destino = "C:\tmp\BiblioRVT",
  [int]$MaxPaginasPorFonte = 60,
  [int]$MaxArquivosPorFonte = 500,
  [int]$DelayMs = 250
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Extensoes = @(".rfa",".rvt",".ifc",".ifczip",".rte",".rft",".zip",".dwg",".dxf",".sat",".step",".stp",".skp")
$PalavrasNavegacao = @("bim","revit","cad","download","downloads","library","biblioteca","catalog","catalogue","object","objects","family","families","model","models","produto","product")

function Log([string]$msg) {
  $stamp = Get-Date -Format "HH:mm:ss"
  Write-Host "[$stamp] $msg"
  Add-Content -Encoding UTF8 -Path $script:LogFile -Value "[$stamp] $msg"
}
function Pasta([string]$p) {
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}
function NomeSeguro([string]$n) {
  foreach($c in [IO.Path]::GetInvalidFileNameChars()) { $n = $n.Replace($c,'_') }
  if ($n.Length -gt 150) { $n = $n.Substring(0,150) }
  return $n
}
function UriAbs([string]$base,[string]$href) {
  try { return ([Uri]::new([Uri]$base,$href)).AbsoluteUri } catch { return $null }
}
function PareceArquivo([string]$url) {
  $u=$url.ToLower().Split("?")[0].Split("#")[0]
  foreach($e in $script:Extensoes) { if($u.EndsWith($e)) { return $true } }
  return $false
}
function ExtensaoAceita([string]$url) {
  $u=$url.ToLower().Split("?")[0].Split("#")[0]
  foreach($e in $script:Extensoes) { if($u.EndsWith($e)) { return $e } }
  return ""
}
function NomeDoUrl([string]$url) {
  try {
    $uri=[Uri]$url
    $n=[IO.Path]::GetFileName($uri.LocalPath)
    if([string]::IsNullOrWhiteSpace($n)) { $n="arquivo_"+([guid]::NewGuid().ToString("N")) }
    return (NomeSeguro $n)
  } catch { return "arquivo_"+([guid]::NewGuid().ToString("N")) }
}
function BaixarArquivo([string]$url,[string]$saida) {
  try {
    if(Test-Path $saida) {
      if((Get-Item $saida).Length -gt 1024) { return $true }
      Remove-Item $saida -Force -ErrorAction SilentlyContinue
    }
    Pasta (Split-Path $saida)
    Log "DOWNLOAD $url"
    Invoke-WebRequest -Uri $url -OutFile $saida -UseBasicParsing -MaximumRedirection 10 -TimeoutSec 180
    if((Test-Path $saida) -and ((Get-Item $saida).Length -gt 1024)) {
      return $true
    }
  } catch {
    Log "FALHA DOWNLOAD $url :: $($_.Exception.Message)"
  }
  Remove-Item $saida -Force -ErrorAction SilentlyContinue
  return $false
}
function ExtrairZip([string]$arquivo,[string]$destino) {
  try {
    if(Test-Path $arquivo) {
      Pasta $destino
      Expand-Archive -Path $arquivo -DestinationPath $destino -Force
      Log "EXTRAIDO $arquivo"
      return $true
    }
  } catch {
    Log "FALHA EXTRACAO $arquivo :: $($_.Exception.Message)"
  }
  return $false
}
function DeveNavegar([string]$url,[string]$texto,[string]$host) {
  try {
    $u=[Uri]$url
    if($u.Host -ne $host) { return $false }
    $combo=($url+" "+$texto).ToLower()
    foreach($p in $script:PalavrasNavegacao) { if($combo.Contains($p)) { return $true } }
  } catch {}
  return $false
}
function CrawlPublico {
  param(
    [string]$Nome,
    [string]$Inicio,
    [string]$PastaDestino,
    [int]$MaxPaginas = 50,
    [int]$MaxArquivos = 300
  )
  Pasta $PastaDestino
  $status = [ordered]@{
    Fonte=$Nome; Inicio=$Inicio; Paginas=0; Arquivos=0; Bytes=0; Status="INICIADA"; Observacao=""
  }

  try { $host=([Uri]$Inicio).Host } catch {
    $status.Status="URL_INVALIDA"; return [pscustomobject]$status
  }

  $fila = New-Object System.Collections.Generic.Queue[string]
  $fila.Enqueue($Inicio)
  $visitadas = New-Object 'System.Collections.Generic.HashSet[string]'
  $arquivosVistos = New-Object 'System.Collections.Generic.HashSet[string]'

  while($fila.Count -gt 0 -and $status.Paginas -lt $MaxPaginas -and $status.Arquivos -lt $MaxArquivos) {
    $pagina=$fila.Dequeue()
    if($visitadas.Contains($pagina)) { continue }
    [void]$visitadas.Add($pagina)

    try {
      Start-Sleep -Milliseconds $script:DelayMs
      Log "SCAN [$Nome] $pagina"
      $r=Invoke-WebRequest -Uri $pagina -UseBasicParsing -MaximumRedirection 10 -TimeoutSec 90
      $status.Paginas++

      # links parsed by PowerShell
      foreach($l in $r.Links) {
        $href=$l.href
        if([string]::IsNullOrWhiteSpace($href)) { continue }
        $abs=UriAbs $pagina $href
        if($null -eq $abs) { continue }

        if(PareceArquivo $abs) {
          if(!$arquivosVistos.Contains($abs) -and $status.Arquivos -lt $MaxArquivos) {
            [void]$arquivosVistos.Add($abs)
            $nomeArq=NomeDoUrl $abs
            $out=Join-Path $PastaDestino $nomeArq
            if(BaixarArquivo $abs $out) {
              $status.Arquivos++
              $status.Bytes += (Get-Item $out).Length
            }
          }
        } elseif(DeveNavegar $abs ([string]$l.innerText) $host) {
          if(!$visitadas.Contains($abs) -and $fila.Count -lt 500) { $fila.Enqueue($abs) }
        }
      }

      # raw URLs embedded in HTML / JSON
      $raw=$r.Content.Replace('\/','/')
      $matches=[regex]::Matches($raw,'https?://[^"''<>\s\\]+')
      foreach($m in $matches) {
        $u=$m.Value.TrimEnd(')',']','}',',',';')
        if(PareceArquivo $u) {
          if(!$arquivosVistos.Contains($u) -and $status.Arquivos -lt $MaxArquivos) {
            [void]$arquivosVistos.Add($u)
            $out=Join-Path $PastaDestino (NomeDoUrl $u)
            if(BaixarArquivo $u $out) {
              $status.Arquivos++
              $status.Bytes += (Get-Item $out).Length
            }
          }
        }
      }
    } catch {
      Log "FALHA SCAN [$Nome] $pagina :: $($_.Exception.Message)"
    }
  }

  if($status.Arquivos -gt 0) {
    $status.Status="OK"
  } elseif($status.Paginas -gt 0) {
    $status.Status="SEM_BINARIO_PUBLICO"
    $status.Observacao="Página acessível, mas nenhum arquivo BIM/CAD público direto foi encontrado dentro dos limites."
  } else {
    $status.Status="INACESSIVEL_OU_BLOQUEADO"
  }
  return [pscustomobject]$status
}

# ---- structure ----
$Estrutura=@(
 "01_Templates_Revit",
 "02_Familias_Arquitetura",
 "03_Familias_Estrutural",
 "04_MEP_Hidraulica",
 "05_MEP_Eletrica_HVAC_Incendio",
 "06_Projetos_Completos_RVT_IFC",
 "07_Bibliotecas_Fabricantes",
 "08_Documentacao_Licencas_Fontes"
)
foreach($p in $Estrutura) { Pasta (Join-Path $Destino $p) }
$tmp=Join-Path $Destino "_downloads"
Pasta $tmp
$script:LogFile=Join-Path $Destino "DOWNLOAD_LOG.txt"
"" | Set-Content -Encoding UTF8 $script:LogFile
$Resultados=New-Object System.Collections.Generic.List[object]

# ---- direct open packages ----
$Diretos=@(
  @("BIM4LCA_ARCH","https://www.nordicsustainableconstruction.com/Media/638593249820446520/ARCH.zip","06_Projetos_Completos_RVT_IFC\BIM4LCA_ARCH"),
  @("BIM4LCA_STRUCTURAL","https://www.nordicsustainableconstruction.com/Media/638615141390369983/STRUCTURAL.zip","03_Familias_Estrutural\BIM4LCA_STRUCTURAL"),
  @("BIM4LCA_HVAC","https://www.nordicsustainableconstruction.com/Media/638596535832776143/HVAC.zip","05_MEP_Eletrica_HVAC_Incendio\BIM4LCA_HVAC"),
  @("buildingSMART_Official","https://github.com/buildingSMART/Sample-Test-Files/archive/refs/heads/main.zip","06_Projetos_Completos_RVT_IFC\buildingSMART_Official"),
  @("buildingSMART_Community","https://github.com/buildingsmart-community/Community-Sample-Test-Files/archive/refs/heads/main.zip","06_Projetos_Completos_RVT_IFC\buildingSMART_Community"),
  @("FreeCAD_BIM_Examples","https://github.com/yorikvanhavre/FreeCAD-BIM-examples/archive/refs/heads/main.zip","06_Projetos_Completos_RVT_IFC\FreeCAD_BIM_Examples")
)
foreach($d in $Diretos) {
  $z=Join-Path $tmp ($d[0]+".zip")
  $before=0
  if(BaixarArquivo $d[1] $z) {
    $bytes=(Get-Item $z).Length
    $ok=ExtrairZip $z (Join-Path $Destino $d[2])
    $Resultados.Add([pscustomobject]@{Fonte=$d[0];Inicio=$d[1];Paginas=0;Arquivos=1;Bytes=$bytes;Status=$(if($ok){"OK"}else{"DOWNLOAD_OK_EXTRACAO_FALHOU"});Observacao=""})
  } else {
    $Resultados.Add([pscustomobject]@{Fonte=$d[0];Inicio=$d[1];Paginas=0;Arquivos=0;Bytes=0;Status="FALHOU";Observacao=""})
  }
}

# ---- public-only manufacturer/directory crawls ----
$Crawls=@(
 @("Legrand","https://www.legrand.com/ecatalogue/","Legrand"),
 @("KSB","https://www.ksb.com/en-rs/tools/digital-product-data/revit-data-records","KSB_Bombas_Valvulas"),
 @("Daikin","https://www.daikin-bim-library.daikin.com/","Daikin_HVAC"),
 @("Mitsubishi Electric","https://les.mitsubishielectric.co.uk/installers/tools-and-software-downloads?stage=Live","Mitsubishi_Electric_HVAC"),
 @("ARCAT","https://www.arcat.com/content-type/bim","ARCAT_Multidisciplinar"),
 @("ARCAT Plumbing","https://www.arcat.com/content-type/bim/22","ARCAT_Plumbing"),
 @("ARCAT HVAC","https://www.arcat.com/content-type/bim/23","ARCAT_HVAC"),
 @("ARCAT Electrical","https://www.arcat.com/content-type/bim/26","ARCAT_Electrical"),
 @("ARCAT Metals","https://www.arcat.com/content-type/bim/05","ARCAT_Metals"),
 @("ARCAT Openings","https://www.arcat.com/content-type/bim/08","ARCAT_Openings"),
 @("Simpson Strong-Tie","https://www.strongtie.com/resources/drawings","Simpson_StrongTie"),
 @("Unistrut","https://www.unistrut.us/resources/bim-cad-library","Unistrut_Atkore"),
 @("Systemair","https://www.systemair.com/pt-pt/contacto/downloads/building-information-modelling","Systemair_HVAC"),
 @("Swegon","https://www.swegon.com/support/software/bim/","Swegon_HVAC"),
 @("Victaulic","https://www.victaulic.com/resources/cad-bim/","Victaulic_MEP"),
 @("Duravit","https://www.duravit.com/service/downloads/bim_cad.com-en.html","Duravit_Sanitarios"),
 @("Eliane","https://www.eliane.com/produtos","Eliane_Revestimentos"),
 @("Grundfos","https://product-selection.grundfos.com/","Grundfos_Bombas"),
 @("Geberit","https://www.geberit.com/know-how/digital-tools/bim/","Geberit_Sanitaria"),
 @("ABB","https://new.abb.com/low-voltage/launches/bimagic","ABB_Eletrica"),
 @("VELUX","https://www.velux.com/professional/tools/bim-objects","VELUX_Arquitetura"),
 @("Tigre","https://www.tigre.com.br/tigre-bim","Tigre_Hidraulica"),
 @("Amanco Wavin","https://bim.amanco.com.br/librerias-bim/","Amanco_Wavin"),
 @("ArcelorMittal","https://brasil.arcelormittal.com/biblioteca-bim","ArcelorMittal"),
 @("Gerdau","https://voce.mais.gerdau.com.br/bibliotecas-bim","Gerdau"),
 @("Docol","https://www.docol.com.br/br/downloads","Docol"),
 @("Tramontina","https://www.tramontina.com.br/biblioteca","Tramontina"),
 @("Schneider Electric","https://www.se.com/us/en/work/support/resources-and-tools/cad-drawings/","Schneider_Electric"),
 @("Hilti","https://www.hilti.com.br/content/hilti/W2/BR/pt/business/business/trends/bim-equipment-and-services/building-information-modeling-bim.html","Hilti")
)

foreach($c in $Crawls) {
  $dest=Join-Path $Destino ("07_Bibliotecas_Fabricantes\"+$c[2])
  $res=CrawlPublico -Nome $c[0] -Inicio $c[1] -PastaDestino $dest -MaxPaginas $MaxPaginasPorFonte -MaxArquivos $MaxArquivosPorFonte
  $Resultados.Add($res)
}

# ---- copy source registry alongside library ----
@"
BIBLIOTECA BIM ONE-CLICK V4
===========================

REGRA:
- Nenhum cadastro é criado.
- Nenhum navegador é aberto.
- Nenhum CAPTCHA é contornado.
- Nenhuma autenticação é burlada.
- O script baixa somente arquivos expostos publicamente e anonimamente.
- Fontes com login/formulário são registradas como SEM_BINARIO_PUBLICO ou INACESSIVEL_OU_BLOQUEADO.

FORMATOS BUSCADOS:
RFA, RVT, IFC, IFCZIP, RTE, RFT, ZIP, DWG, DXF, SAT, STEP, STP e SKP.

A execução pode baixar vários GB. Espaço livre recomendado: 10 GB ou mais.
"@ | Set-Content -Encoding UTF8 (Join-Path $Destino "08_Documentacao_Licencas_Fontes\LEIA-ME_REGRAS.txt")

# ---- final reports ----
$Resultados | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $Destino "RELATORIO_FONTES.csv")

$arquivos=Get-ChildItem -Recurse -File $Destino | Where-Object {
  $_.FullName -notlike "$tmp*" -and
  $_.Name -notin @("RELATORIO_FINAL.txt","RELATORIO_FONTES.csv","DOWNLOAD_LOG.txt")
}
$bytes=($arquivos | Measure-Object Length -Sum).Sum
if($null -eq $bytes){$bytes=0}
$mb=[math]::Round($bytes/1MB,2)
$gb=[math]::Round($bytes/1GB,2)
function Qtd($ext){ return ($arquivos | Where-Object {$_.Extension -ieq $ext}).Count }

$ok=($Resultados | Where-Object {$_.Status -eq "OK"}).Count
$sem=($Resultados | Where-Object {$_.Status -eq "SEM_BINARIO_PUBLICO"}).Count
$falhas=($Resultados | Where-Object {$_.Status -notin @("OK","SEM_BINARIO_PUBLICO")}).Count

$rel=@"
BIBLIOTECA BIM - RELATORIO FINAL
================================
Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Destino: $Destino

Tamanho atual: $mb MB ($gb GB)
Total de arquivos armazenados: $($arquivos.Count)

RFA: $(Qtd ".rfa")
RVT: $(Qtd ".rvt")
IFC: $(Qtd ".ifc")
RTE: $(Qtd ".rte")
RFT: $(Qtd ".rft")
DWG: $(Qtd ".dwg")
DXF: $(Qtd ".dxf")
SKP: $(Qtd ".skp")

Fontes com download bem-sucedido: $ok
Fontes acessíveis sem binário público direto: $sem
Fontes bloqueadas/falhas: $falhas

Consulte:
- RELATORIO_FONTES.csv para resultado por fabricante/fonte.
- DOWNLOAD_LOG.txt para detalhes técnicos.

META ORIGINAL 500 MB:
$(if($mb -ge 500){"ATINGIDA"}else{"NAO ATINGIDA NESTA EXECUCAO"})
"@
$rel | Set-Content -Encoding UTF8 (Join-Path $Destino "RELATORIO_FINAL.txt")

Write-Host ""
Write-Host "============================================================"
Write-Host " BIBLIOTECA BIM V4 CONCLUIDA"
Write-Host "============================================================"
Write-Host "Tamanho: $mb MB ($gb GB)"
Write-Host "Arquivos: $($arquivos.Count)"
Write-Host "RFA $(Qtd '.rfa') | RVT $(Qtd '.rvt') | IFC $(Qtd '.ifc')"
Write-Host "Relatorio: $(Join-Path $Destino 'RELATORIO_FINAL.txt')"
Write-Host "============================================================"

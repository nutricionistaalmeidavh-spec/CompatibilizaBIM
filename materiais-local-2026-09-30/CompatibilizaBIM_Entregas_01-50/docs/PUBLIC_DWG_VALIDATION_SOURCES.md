# Public DWG sources for compatibility checks

ACadSharp's upstream repository includes binary DWG samples, including `samples/sample_AC1032.dwg`. These are appropriate for format/decoder smoke testing but are not substitutes for discipline-rich architecture/structure/MEP project files.

Upstream reference: `DomCR/ACadSharp` (MIT). GitHub blob observed during delivery 01–40: `samples/sample_AC1032.dwg`, blob SHA `4cfa790d6719acf3aad9818bacbd693ac3ab71b8`.

This delivery environment could inspect the upstream file metadata but could not download/execute binary DWGs in the container because outbound network access and .NET/NuGet were unavailable.

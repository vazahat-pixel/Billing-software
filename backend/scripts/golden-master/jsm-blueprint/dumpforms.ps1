param([string]$Filter = '', [string]$Out)
$sp = Split-Path -Parent $MyInvocation.MyCommand.Path
$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.ReferencedAssemblies.Add('System.dll') | Out-Null
$cp.ReferencedAssemblies.Add('System.Core.dll') | Out-Null
$cp.TreatWarningsAsErrors = $false
Add-Type -Path "$sp\JsmFormDump.cs" -CompilerParameters $cp
$json = [JsmFormDump]::Run('D:\JsmAccount_TextDemo', 'Jsm_Winsoft.exe', $Filter)
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))
"wrote $Out ($($json.Length) chars)"

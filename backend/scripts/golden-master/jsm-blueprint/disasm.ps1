param([string]$Type, [string]$Method)
$sp = Split-Path -Parent $MyInvocation.MyCommand.Path
$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.ReferencedAssemblies.Add('System.dll') | Out-Null
$cp.ReferencedAssemblies.Add('System.Core.dll') | Out-Null
Add-Type -Path (Join-Path $sp 'JsmFormDump.cs') -CompilerParameters $cp
[JsmFormDump]::Disasm('D:\JsmAccount_TextDemo', 'Jsm_Winsoft.exe', $Type, $Method)

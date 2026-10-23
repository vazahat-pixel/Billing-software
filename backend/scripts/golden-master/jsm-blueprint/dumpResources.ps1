param([Parameter(Mandatory = $true)][string]$Exe, [Parameter(Mandatory = $true)][string]$ResourceName)
# Reads a WinForms .resources stream from JSM's exe as raw entries (no deserialization):
# strings are decoded; Point/Size values are read from the trailing int32 pair of the serialized record.
$asm = [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($Exe)
$stream = $asm.GetManifestResourceStream($ResourceName)
if (-not $stream) { throw "resource not found: $ResourceName" }
$reader = New-Object System.Resources.ResourceReader($stream)
$e = $reader.GetEnumerator()
$out = New-Object System.Collections.Generic.List[string]
while ($e.MoveNext()) {
  $name = [string]$e.Key
  $type = $null; $data = $null
  $reader.GetResourceData($name, [ref]$type, [ref]$data)
  if ($type -eq 'ResourceTypeCode.String') {
    $ms = New-Object System.IO.MemoryStream(, $data)
    $br = New-Object System.IO.BinaryReader($ms)
    $val = $br.ReadString()
    $out.Add("$name`tstring`t$val")
  } elseif ($type -match 'System.Drawing.(Point|Size),') {
    $n = $data.Length
    $a = [BitConverter]::ToInt32($data, $n - 9)
    $b = [BitConverter]::ToInt32($data, $n - 5)
    $out.Add("$name`t$($Matches[1])`t$a,$b")
  } elseif ($type -match 'Int32|Boolean|Dock|Anchor') {
    $out.Add("$name`t$type`t" + (($data | ForEach-Object { '{0:x2}' -f $_ }) -join ''))
  }
}
$reader.Close()
$out

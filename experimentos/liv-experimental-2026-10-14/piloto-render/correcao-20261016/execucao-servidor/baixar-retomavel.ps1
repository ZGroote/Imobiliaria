param([ValidateSet('base','main','extras','preview','regional')][string]$Group)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$folder = Join-Path $PSScriptRoot 'resultados-baixados-20261016'
$deadline = [DateTime]::Parse('2026-10-17T07:43:00Z').ToUniversalTime()
$sshOptions = @('-i','C:/Users/respawn/.ssh/id_ed25519_gpu','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=4')
$stages = switch ($Group) {
 'base' { @('entrega-servidor') }
 'main' { @('denso16-preview','denso16-modelo') }
 'extras' { @('denso16-capturas','ensaios-comodos-modelos','composicao-modelo') }
 'preview' { @('composicao-preview') }
 'regional' { @('composicao-denso-regional-preview','composicao-denso-regional-modelo') }
}
function Invoke-RemoteJson([string]$Script,[string[]]$Arguments) {
 for ($attempt=1; $attempt -le 60 -and [DateTime]::UtcNow -lt $deadline; $attempt++) {
  $raw = & ssh @sshOptions -T -p 24112 root@js2.blockelite.cn python3.11 ('/root/liv-corrigido-20261016/' + $Script) @Arguments
  $code = $LASTEXITCODE
  if ($code -eq 0) { return (($raw -join "`n") | ConvertFrom-Json) }
  if ($code -in @(42,43,44,45,46)) { throw "Remote stage unavailable: $code" }
  Start-Sleep -Seconds 4
 }
 throw 'Remote metadata deadline reached'
}
function Save-Stage([string]$Name,$Metadata) {
 if ($Metadata.sha256 -notmatch '^[a-f0-9]{64}$' -or [long]$Metadata.bytes -le 0) { throw 'Invalid immutable manifest' }
 $target = Join-Path $folder ($Name+'.tgz')
 $partial = $target+'.partial'
 $batch = Join-Path $folder ('.'+$Name+'.sftp')
 $needsPrefixCheck = $true
 $prefixRecoveries = 0
 $verified = $false
 if (Test-Path -LiteralPath $target) {
  if ((Get-Item -LiteralPath $target).Length -eq [long]$Metadata.bytes -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Metadata.sha256) { $verified=$true }
  else { Move-Item -LiteralPath $target -Destination ($target+'.corrupt.'+[DateTime]::UtcNow.Ticks) }
 }
 for ($attempt=1; -not $verified -and $attempt -le 60 -and [DateTime]::UtcNow -lt $deadline; $attempt++) {
  $length = if (Test-Path -LiteralPath $partial) { (Get-Item -LiteralPath $partial).Length } else { 0L }
  if ($length -gt [long]$Metadata.bytes) {
   Move-Item -LiteralPath $partial -Destination ($partial+'.oversize.'+[DateTime]::UtcNow.Ticks)
   $length=0L
  }
  if ($length -eq [long]$Metadata.bytes) {
   if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Metadata.sha256) {
    Move-Item -LiteralPath $partial -Destination $target
    $verified=$true; break
   }
   Move-Item -LiteralPath $partial -Destination ($partial+'.corrupt.'+[DateTime]::UtcNow.Ticks)
   $length=0L
  }
  if ($needsPrefixCheck -and $length -gt 0) {
   $localPrefix = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
   $remotePrefix = Invoke-RemoteJson 'hash-prefixo-download.py' @($Name,[string]$length)
   if ([long]$remotePrefix.total_bytes -ne [long]$Metadata.bytes) { throw 'Remote archive changed after its manifest was published' }
   if ($remotePrefix.sha256 -ne $localPrefix -or [long]$remotePrefix.bytes -ne $length) {
    if ($prefixRecoveries -lt 2 -and $length -gt 33554432) {
     $stream=[IO.File]::Open($partial,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::None)
     try { $stream.SetLength($length-33554432) } finally { $stream.Dispose() }
     $prefixRecoveries++
     Write-Warning "Unconfirmed tail removed from interrupted download: $Name; checking prefix again"
    } else {
     Move-Item -LiteralPath $partial -Destination ($partial+'.corrupt.'+[DateTime]::UtcNow.Ticks)
     Write-Warning "Inconsistent partial preserved separately: $Name; starting a clean download"
    }
    $needsPrefixCheck=$true
    continue
   }
   Write-Output "PREFIX_VERIFIED $Name $length bytes"
  }
  if ((Get-PSDrive -Name C).Free -lt ([long]$Metadata.bytes-$length+2000000000)) { throw 'Disk reserve would be exceeded' }
  $remote = '/root/liv-corrigido-20261016/'+$Name+'.tgz'
  $local = $partial.Replace('\','/')
  [IO.File]::WriteAllText($batch,('get -a "'+$remote+'" "'+$local+'"'+"`nbye`n"),[Text.UTF8Encoding]::new($false))
  Write-Output "RESUME $Name from $length of $($Metadata.bytes) bytes; attempt $attempt"
  & sftp @sshOptions -B 262144 -R 128 -b $batch -P 24112 root@js2.blockelite.cn
  $code=$LASTEXITCODE
  $after = if (Test-Path -LiteralPath $partial) { (Get-Item -LiteralPath $partial).Length } else { 0L }
  $needsPrefixCheck=($after -gt $length)
  if ($after -eq [long]$Metadata.bytes -and (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Metadata.sha256) {
   Move-Item -LiteralPath $partial -Destination $target
   $verified=$true; break
  }
  Write-Output "TRANSFER_RETRY $Name code=$code available=$after"
  Start-Sleep -Seconds 4
 }
 if (-not $verified) { throw "Verified download incomplete: $Name" }
 $receipt=[ordered]@{archive=$target;bytes=[long]$Metadata.bytes;sha256=$Metadata.sha256;received_utc=[DateTime]::UtcNow.ToString('o');method='SFTP resume; partial prefix and final SHA256 verified'}
 $receiptPath=Join-Path $folder ($Name+'-recebido.json')
 [IO.File]::WriteAllText($receiptPath+'.partial',($receipt|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 Move-Item -LiteralPath ($receiptPath+'.partial') -Destination $receiptPath -Force
 if ($Name.EndsWith('-preview')) {
  $entries=@(& tar -tzf $target)
  if ($LASTEXITCODE -ne 0 -or @($entries|Where-Object { $_ -match '(^[/\\])|(^[A-Za-z]:)|((^|[/\\])\.\.([/\\]|$))' }).Count -gt 0) { throw 'Invalid preview archive paths' }
  & tar -xzf $target -C $folder
  if ($LASTEXITCODE -ne 0) { throw 'Preview extraction failed' }
 }
 Write-Output "RECEIVED_SHA256_VERIFIED $Name"
}
$failed=$false
[IO.File]::WriteAllText((Join-Path $folder ('download-'+$Group+'-process.json')),(@{pid=$PID;started_utc=[DateTime]::UtcNow.ToString('o');stages=@($stages)}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
foreach ($stage in $stages) {
 try {
  Write-Output "WAITING $stage"
  $metadata=if ($stage -eq 'entrega-servidor') { [pscustomobject]@{bytes=3119703685L;sha256='a579f05b2a9243f8223158cd0e8bd9f031eac9b23253b6325a0bed680ed3f962'} } else { Invoke-RemoteJson 'aguardar-download-denso16.py' @($stage) }
  Save-Stage $stage $metadata
 } catch {
  if ($stage -eq 'composicao-modelo' -and $_.Exception.Message -match 'unavailable: 44') { Write-Output 'No composition model was selected for experiment'; continue }
  $failed=$true
  $message=$_.Exception.Message
  [IO.File]::WriteAllText((Join-Path $folder ($stage+'-falha-download.json')),(@{stage=$stage;error=$message;utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
  Write-Warning "$stage : $message"
 }
}
if ($failed) { exit 1 }

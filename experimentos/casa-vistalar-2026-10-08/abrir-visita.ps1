$ErrorActionPreference = 'Stop'
$casaDirectory = $PSScriptRoot
$casaPort = 8774
$listener = Get-NetTCPConnection -LocalPort $casaPort -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    $casaPython = 'C:/Python314/python.exe'
    if (-not (Test-Path -LiteralPath $casaPython)) { $casaPython = (Get-Command python).Source }
    Start-Process -FilePath $casaPython -ArgumentList @('-m','http.server',"$casaPort",'--bind','127.0.0.1','--directory',('"' + $casaDirectory + '"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $casaDirectory 'server.log') -RedirectStandardError (Join-Path $casaDirectory 'server-error.log')
    Start-Sleep -Milliseconds 900
}
Start-Process "http://127.0.0.1:$casaPort/"

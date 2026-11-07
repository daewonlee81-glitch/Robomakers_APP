# RoboMakers WordBlock - local web server (Windows PowerShell, no install needed)
# Serves this folder at http://localhost:<port>/ and opens Chrome.
param([int]$Port = 8000)
$Root = Split-Path -Parent $PSScriptRoot
$Types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.py'='text/plain; charset=utf-8';
  '.md'='text/plain; charset=utf-8'; '.txt'='text/plain; charset=utf-8'; '.wasm'='application/wasm';
  '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.jpg'='image/jpeg'
}
$listener = New-Object System.Net.HttpListener
for ($i = 0; $i -lt 20; $i++) {
  try { $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add("http://localhost:$Port/"); $listener.Start(); break }
  catch { $Port++ }
}
if (-not $listener.IsListening) { Write-Host "Could not open a port. Close other servers and try again."; Read-Host; exit 1 }
$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  RoboMakers WordBlock is running:  $url"
Write-Host "  Keep this window open. Close it to stop the server."
Write-Host ""
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LocalAppData\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { Start-Process $chrome $url } else { Start-Process $url }
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $path.StartsWith([IO.Path]::GetFullPath($Root)) -or -not (Test-Path $path -PathType Leaf)) {
      $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = $(if ($Types.ContainsKey($ext)) { $Types[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Cache-Control', 'no-cache')
      $b = [IO.File]::ReadAllBytes($path)
    }
    $res.ContentLength64 = $b.Length
    $res.OutputStream.Write($b, 0, $b.Length)
  } catch { } finally { $res.Close() }
}

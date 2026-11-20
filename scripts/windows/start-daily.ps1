# Opens Daily (hosted on GitHub Pages, data in Supabase) in its own Chrome window.
# Run by the "Daily" Desktop shortcut through start-daily.vbs, so no console window flashes.
$Url = 'https://atheendre130505.github.io/daily/habits/'
foreach ($p in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                 "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
                 "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
                 "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                 "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")) {
  if (Test-Path $p) { Start-Process $p "--app=$Url"; exit 0 }
}
Start-Process $Url

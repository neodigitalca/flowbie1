$Csv = Join-Path $PSScriptRoot "SFTP Users_Clients List.csv"
$Header = "Website Link,SFTP Address,Port Number,Username,Password"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$DeployScript = Join-Path (Split-Path $PSScriptRoot -Parent) ".deploy\deploy-client-site.mjs"

function Csv([string]$v) {
    if ($v -match '[,"\r\n]') { return '"' + $v.Replace('"', '""') + '"' }
    return $v
}

function Secret([string]$p) {
    $s = Read-Host $p -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Get-Clients {
    if (-not (Test-Path $Csv)) { return @() }
    Import-Csv $Csv | Where-Object {
        $_.'Website Link' -and $_.'SFTP Address' -and $_.Username -and $_.Password
    } | Sort-Object { $_.'Website Link' }, { $_.Username }
}

function Show-ClientList {
    $clients = @(Get-Clients)
    Write-Host ""
    Write-Host "Deploy neo-pulse-wp"
    Write-Host "==================="
    if ($clients.Count -eq 0) {
        Write-Host "  (no deployable clients in CSV)"
        Write-Host ""
        return $clients
    }

    for ($i = 0; $i -lt $clients.Count; $i++) {
        $c = $clients[$i]
        $n = $i + 1
        $label = $c.'Website Link'
        if (@($clients | Where-Object { $_.'Website Link' -eq $c.'Website Link' }).Count -gt 1) {
            $label = "$label ($($c.Username))"
        }
        Write-Host ("{0,3}  {1}" -f $n, $label)
    }
    Write-Host ""
    return $clients
}

function Deploy-Client([pscustomobject]$Client) {
    if (-not (Test-Path $DeployScript)) {
        Write-Host "Deploy script not found: $DeployScript"
        return
    }

    $site = $Client.'Website Link'.Trim()
    $user = $Client.Username.Trim()
    Write-Host ""
    Write-Host "Uploading to $site ..."

    Push-Location $RepoRoot
    try {
        & node $DeployScript $site $user
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Deploy failed."
        } else {
            Write-Host "Done."
        }
    } finally {
        Pop-Location
    }
    Write-Host ""
}

function Add-Client {
    if (-not (Test-Path $Csv)) { Set-Content $Csv $Header -Encoding UTF8 }

    $site = (Read-Host "Website Link").Trim()
    $sftp = (Read-Host "SFTP Address").Trim()
    $port = (Read-Host "Port Number [2222]").Trim()
    if (-not $port) { $port = "2222" }
    $user = (Read-Host "Username").Trim()
    $pass = Secret "Password"

    if (-not $site -or -not $sftp -or -not $user -or -not $pass) {
        Write-Host "Missing required field. Nothing added."
        return
    }

    $line = "$(Csv $site),$(Csv $sftp),$(Csv $port),$(Csv $user),$(Csv $pass)"
    Add-Content $Csv $line -Encoding UTF8
    Write-Host "Added $site"
}

if (-not (Test-Path $Csv)) { Set-Content $Csv $Header -Encoding UTF8 }

while ($true) {
    $clients = Show-ClientList
    Write-Host "  A  Add new client"
    Write-Host "  Q  Quit"
    Write-Host ""
    $choice = (Read-Host "Choice").Trim()

    if ($choice -match '^[Qq]$') { break }
    if ($choice -match '^[Aa]$') {
        Add-Client
        continue
    }

    $n = 0
    if ([int]::TryParse($choice, [ref]$n) -and $n -ge 1 -and $n -le $clients.Count) {
        Deploy-Client $clients[$n - 1]
        continue
    }

    Write-Host "Invalid choice."
}

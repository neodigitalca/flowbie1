$Csv = Join-Path $PSScriptRoot "SFTP Users_Clients List.csv"
$Header = "Website Link,SFTP Address,Port Number,Username,Password"

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

if (-not (Test-Path $Csv)) { Set-Content $Csv $Header -Encoding UTF8 }

do {
    $sftp = (Read-Host "SFTP Address").Trim()
    $port = (Read-Host "Port Number [2222]").Trim()
    if (-not $port) { $port = "2222" }
    $user = (Read-Host "Username").Trim()
    $pass = Secret "Password"

    $slug = $sftp -replace '\.sftp\.wpengine\.com$', ''
    $site = "$slug.wpenginepowered.com"

    $line = "$(Csv $site),$(Csv $sftp),$(Csv $port),$(Csv $user),$(Csv $pass)"
    Add-Content $Csv $line -Encoding UTF8
    Write-Host "Added."
    $again = Read-Host "Another? (y/n)"
} while ($again -match '^[Yy]')

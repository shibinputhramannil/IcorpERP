# Automatically activates the virtual environment in PowerShell
$venvActivate = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
    Write-Host "ICORP ERP Backend virtual environment activated." -ForegroundColor Green
} else {
    Write-Host "Virtual environment not found at $venvActivate" -ForegroundColor Red
}

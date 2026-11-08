<#
.SYNOPSIS
  Chạy toàn bộ test ghi danh/hủy ghi danh đề tài (P03-S02) bằng một lệnh.

.DESCRIPTION
  1. Dựng một PostgreSQL tạm trong Docker (container riêng, không dùng database của Compose).
  2. Backend: test handler (SQLite), test hợp đồng HTTP và test đồng thời trên PostgreSQL thật
     (RegistrationConcurrencyTests tự tạo database qlkltn_test_* bằng migration rồi xóa).
  3. Frontend: test service và màn đề tài/ghi danh của sinh viên (Vitest).
  4. Luôn xóa container tạm, kể cả khi test lỗi. Mã thoát khác 0 nếu có bước lỗi.

  Thêm -All để chạy toàn bộ test backend và frontend thay vì chỉ phần đề tài/ghi danh.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File app/scripts/test-ghi-danh.ps1
#>
param(
    [switch]$All,
    [int]$Port = 55432
)

# Continue: ở Windows PowerShell 5.1, Stop biến stderr của lệnh native (docker, dotnet) thành lỗi.
# Mỗi bước tự kiểm tra $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$appDir = Split-Path -Parent $PSScriptRoot
$container = 'qlkltn-test-ghi-danh-pg'
# Mật khẩu chỉ dùng cho container tạm, chỉ mở cổng trên 127.0.0.1 và bị xóa khi xong.
$password = [guid]::NewGuid().ToString('N')
$failed = @()

function Invoke-Step([string]$name, [scriptblock]$body) {
    Write-Host ""
    Write-Host "==> $name" -ForegroundColor Cyan
    & $body
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $name" -ForegroundColor Red
        $script:failed += $name
    }
}

# Gọi thẳng docker.exe: một tệp tên "docker" không đuôi trong PATH (ví dụ system32) sẽ che mất lệnh thật.
$docker = (Get-Command docker.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $docker) { throw 'Không tìm thấy docker.exe. Cài/mở Docker Desktop rồi chạy lại.' }
& $docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker chưa chạy. Mở Docker Desktop rồi chạy lại.' }

& $docker rm -f $container *> $null
try {
    Write-Host "==> Dựng PostgreSQL tạm ($container, cổng 127.0.0.1:$Port)" -ForegroundColor Cyan
    & $docker run -d --rm --name $container -e "POSTGRES_PASSWORD=$password" -p "127.0.0.1:${Port}:5432" postgres:17-alpine | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Không dựng được container PostgreSQL (cổng $Port đang bận? dùng -Port)." }
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        & $docker exec $container pg_isready -U postgres -h 127.0.0.1 *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'PostgreSQL tạm không sẵn sàng sau 60 giây.' }

    $env:QLKLTN_TEST_POSTGRES = "Host=127.0.0.1;Port=$Port;Username=postgres;Password=$password"

    $filter = 'FullyQualifiedName~Backend.Tests.GroupRegistrationTests|FullyQualifiedName~Backend.Tests.RegistrationConcurrencyTests|FullyQualifiedName~Backend.Tests.TopicApiTests|FullyQualifiedName~Backend.Tests.TopicWorkflowTests'
    Push-Location (Join-Path $appDir 'backend')
    try {
        Invoke-Step 'Backend: restore' { dotnet restore Backend.sln --locked-mode --verbosity quiet }
        if ($All) {
            Invoke-Step 'Backend: toàn bộ test' { dotnet test Backend.sln --no-restore }
        } else {
            Invoke-Step 'Backend: đề tài, ghi danh và test đồng thời PostgreSQL' {
                dotnet test Backend.sln --no-restore --filter $filter --logger 'console;verbosity=normal'
            }
        }
    } finally { Pop-Location }

    Push-Location (Join-Path $appDir 'frontend')
    try {
        if (-not (Test-Path 'node_modules')) { Invoke-Step 'Frontend: npm ci' { npm ci } }
        if ($All) {
            Invoke-Step 'Frontend: toàn bộ test' { npx vitest run }
        } else {
            Invoke-Step 'Frontend: đề tài và ghi danh' { npx vitest run src/features/topics }
        }
    } finally { Pop-Location }
}
finally {
    Remove-Item Env:QLKLTN_TEST_POSTGRES -ErrorAction SilentlyContinue
    & $docker rm -f $container *> $null
    Write-Host ""
    Write-Host "==> Đã xóa PostgreSQL tạm" -ForegroundColor Cyan
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host ("KẾT QUẢ: LỖI ở " + ($failed -join '; ')) -ForegroundColor Red
    exit 1
}
Write-Host 'KẾT QUẢ: tất cả test ghi danh đều qua.' -ForegroundColor Green
exit 0

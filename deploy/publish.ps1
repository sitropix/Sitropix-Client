param(
  [string]$InstanceId = "",
  [string]$PublicIp = "",
  [string]$AvailabilityZone = "us-east-1c",
  [string]$SshKeyPath = "",
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$LaunchFile = Join-Path $PSScriptRoot "last-launch.json"

if (Test-Path $LaunchFile) {
  $launch = Get-Content $LaunchFile | ConvertFrom-Json
  if (-not $InstanceId) { $InstanceId = $launch.InstanceId }
  if (-not $PublicIp) { $PublicIp = $launch.PublicIp }
  if ($launch.AvailabilityZone) { $AvailabilityZone = $launch.AvailabilityZone }
}

if (-not $PublicIp) { throw "Set -PublicIp or run deploy\launch-ec2.ps1 first." }

if (-not $SshKeyPath) {
  foreach ($candidate in @(
    "$env:USERPROFILE\.ssh\Sitropix.pem",
    "$env:USERPROFILE\Downloads\Sitropix.pem",
    "C:\Users\raman\Downloads\Sitropix.pem"
  )) {
    if (Test-Path $candidate) { $SshKeyPath = $candidate; break }
  }
}

$TempKey = Join-Path $env:TEMP "sitropix-deploy-$([guid]::NewGuid().ToString('n').Substring(0,8))"
$UseInstanceConnect = $false

if (-not $SshKeyPath -or -not (Test-Path $SshKeyPath)) {
  $UseInstanceConnect = $true
  ssh-keygen -t ed25519 -f $TempKey -N '""' -q
  $pub = Get-Content ($TempKey + ".pub") -Raw
  aws ec2-instance-connect send-ssh-public-key `
    --instance-id $InstanceId `
    --availability-zone $AvailabilityZone `
    --instance-os-user ec2-user `
    --ssh-public-key $pub | Out-Null
  $SshKeyPath = $TempKey
  Write-Host "Using EC2 Instance Connect temporary key."
}

$sshOpts = @("-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=NUL", "-i", $SshKeyPath)
$HostTarget = "ec2-user@$PublicIp"

function Invoke-WithInstanceConnect {
  param([scriptblock]$Action)
  if ($UseInstanceConnect) {
    $pub = Get-Content ($TempKey + ".pub") -Raw
    aws ec2-instance-connect send-ssh-public-key `
      --instance-id $InstanceId `
      --availability-zone $AvailabilityZone `
      --instance-os-user ec2-user `
      --ssh-public-key $pub | Out-Null
  }
  & $Action
}

Write-Host "Building production bundle..."
Push-Location $Root
npm install
npm run build:prod
Pop-Location

$Stage = Join-Path $env:TEMP "sitropix-release"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage | Out-Null

$exclude = @("node_modules", ".git", "dist", ".env", "deploy\last-launch.json")
robocopy $Root $Stage /E /XD node_modules .git /XF .env | Out-Null
Copy-Item (Join-Path $Root "dist") (Join-Path $Stage "dist") -Recurse -Force
if (Test-Path (Join-Path $Root $EnvFile)) {
  Copy-Item (Join-Path $Root $EnvFile) (Join-Path $Stage ".env") -Force
} else {
  Write-Warning ('No ' + $EnvFile + ' at repo root; copy deploy/env.production.example to server .env manually.')
}

$Tar = Join-Path $env:TEMP "sitropix-portal-release.tar.gz"
if (Test-Path $Tar) { Remove-Item $Tar -Force }
tar -czf $Tar -C $Stage .

Write-Host "Uploading to $PublicIp ..."
Invoke-WithInstanceConnect { scp @sshOpts $Tar "${HostTarget}:/tmp/sitropix-portal-release.tar.gz" }
Invoke-WithInstanceConnect { scp @sshOpts (Join-Path $PSScriptRoot "remote-install.sh") "${HostTarget}:/tmp/remote-install.sh" }

$remoteCmd = "sudo mkdir -p /opt/sitropix-portal /var/log/sitropix-portal && " +
  "sudo tar -xzf /tmp/sitropix-portal-release.tar.gz -C /opt/sitropix-portal && " +
  "sudo cp /tmp/remote-install.sh /opt/sitropix-portal/deploy/remote-install.sh && " +
  "sudo sed -i 's/\r$//' /opt/sitropix-portal/deploy/remote-install.sh && " +
  "sudo chmod +x /opt/sitropix-portal/deploy/remote-install.sh && " +
  "sudo bash /opt/sitropix-portal/deploy/remote-install.sh"

Invoke-WithInstanceConnect { ssh @sshOpts $HostTarget $remoteCmd }

Write-Host ""
Write-Host 'Deployed. Verify: https://app.sitropix.com/api/health after DNS and certbot'
if ($UseInstanceConnect -and (Test-Path $TempKey)) {
  Remove-Item $TempKey -Force -ErrorAction SilentlyContinue
  Remove-Item ($TempKey + ".pub") -Force -ErrorAction SilentlyContinue
}

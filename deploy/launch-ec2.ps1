# Launch new EC2 "Sitropix" (t3.large) — does not touch Sitropix_Backend.
$ErrorActionPreference = "Stop"
$Region = "us-east-1"
$AmiId = "ami-02b2c1b57c5105166"
$InstanceType = "t3.large"
$KeyName = "Sitropix"
$SubnetId = "subnet-080f871f2a3646da7"
$SecurityGroups = @("sg-0eb196efcc53dadd0", "sg-01c028661e408755e")
$UserDataPath = Join-Path $PSScriptRoot "ec2-user-data.sh"

$userData = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw $UserDataPath)))

$run = aws ec2 run-instances `
  --region $Region `
  --image-id $AmiId `
  --instance-type $InstanceType `
  --key-name $KeyName `
  --subnet-id $SubnetId `
  --security-group-ids $SecurityGroups `
  --associate-public-ip-address `
  --user-data $userData `
  --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=40,VolumeType=gp3,DeleteOnTermination=true}" `
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=Sitropix},{Key=App,Value=sitropix-portal},{Key=Domain,Value=app.sitropix.com}]" `
  --output json | ConvertFrom-Json

$instanceId = $run.Instances[0].InstanceId
Write-Host "Launched instance: $instanceId (Name=Sitropix, type=$InstanceType)"
Write-Host "Waiting for instance to be running..."

aws ec2 wait instance-running --region $Region --instance-ids $instanceId

$eip = aws ec2 allocate-address --domain vpc --region $Region --output json | ConvertFrom-Json
aws ec2 associate-address --region $Region --instance-id $instanceId --allocation-id $eip.AllocationId | Out-Null

$desc = aws ec2 describe-instances --region $Region --instance-ids $instanceId --output json | ConvertFrom-Json
$publicIp = $desc.Reservations[0].Instances[0].PublicIpAddress
$az = $desc.Reservations[0].Instances[0].Placement.AvailabilityZone

Write-Host ""
Write-Host "=== Sitropix EC2 ready ==="
Write-Host "InstanceId:  $instanceId"
Write-Host "Public IP:   $publicIp (Elastic IP: $($eip.PublicIp))"
Write-Host "AZ:          $az"
Write-Host ""
Write-Host "DNS: Create A record  app.sitropix.com  ->  $($eip.PublicIp)"
Write-Host "SSH: ssh -i Sitropix.pem ec2-user@$publicIp"
Write-Host "Deploy: .\deploy\publish.ps1 -InstanceId $instanceId -PublicIp $publicIp -AvailabilityZone $az"

@{
  InstanceId = $instanceId
  PublicIp = $publicIp
  ElasticIp = $eip.PublicIp
  AvailabilityZone = $az
} | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot "last-launch.json")

$ErrorActionPreference = "Stop"

# localStorage だけではスマホや GitHub Actions から読めないため、Downloads に出た JSON を repo の generated JSON へ橋渡しする。
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DownloadDir = Join-Path $env:USERPROFILE "Downloads"
$ProcessedDir = Join-Path $DownloadDir "processed-boat-johnson"
$TargetDir = Join-Path $ProjectRoot "public\data\boatrace"
$TargetFile = Join-Path $TargetDir "johnson-predictions.generated.json"
$LogFile = Join-Path $ProjectRoot "scripts\boat-johnson-auto-push-log.txt"

function Write-Log {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  Write-Host $line

  $logDir = Split-Path -Parent $LogFile
  if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  }

  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Invoke-GitCommand {
  param([string]$Command)

  Set-Location $ProjectRoot
  Write-Log "RUN: git $Command"

  $output = cmd /c "git $Command 2>&1"
  $exitCode = $LASTEXITCODE

  if ($output) {
    $output | ForEach-Object { Write-Log "GIT: $_" }
  }

  Write-Log "EXIT: $exitCode"
  return $exitCode
}

function Wait-FileReady {
  param([string]$Path)

  for ($i = 0; $i -lt 20; $i++) {
    try {
      $stream = [System.IO.File]::Open($Path, "Open", "Read", "None")
      $stream.Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function New-EmptyPayload {
  return [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString("o")
    updatedAt = [DateTimeOffset]::Now.ToString("o")
    version = 1
    source = "kurari-boat-prediction-page"
    records = @()
    notifiedSlackResultKeys = @()
    notifiedSlackHitKeys = @()
  }
}

function Load-JsonObject {
  param(
    [string]$Path,
    [switch]$AllowMissing
  )

  if (!(Test-Path $Path)) {
    if ($AllowMissing) {
      return [pscustomobject]@{
        Success = $true
        Payload = (New-EmptyPayload)
      }
    }

    Write-Log "JSON file not found: $Path"
    return [pscustomobject]@{
      Success = $false
      Payload = $null
    }
  }

  try {
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return [pscustomobject]@{
        Success = $true
        Payload = (New-EmptyPayload)
      }
    }

    return [pscustomobject]@{
      Success = $true
      Payload = ($raw | ConvertFrom-Json -Depth 100)
    }
  } catch {
    Write-Log "JSON parse failed: $Path"
    return [pscustomobject]@{
      Success = $false
      Payload = $null
    }
  }
}

function Convert-ToRecordMap {
  param([object]$Payload)

  $map = @{}
  $records = $Payload.records

  if ($records -is [System.Collections.IEnumerable] -and !($records -is [string])) {
    foreach ($record in $records) {
      if ($null -ne $record -and $record.raceKey) {
        $map[$record.raceKey] = $record
      }
    }
    return $map
  }

  if ($records -and $records.PSObject.Properties) {
    foreach ($property in $records.PSObject.Properties) {
      if ($property.Value) {
        $map[$property.Name] = $property.Value
      }
    }
  }

  return $map
}

function Convert-ToSortedRecords {
  param([hashtable]$RecordMap)

  return @($RecordMap.Values | Sort-Object -Property @(
    @{ Expression = { $_.date }; Descending = $true },
    @{ Expression = { $_.updatedAt }; Descending = $true },
    @{ Expression = { $_.savedAt }; Descending = $true },
    @{ Expression = { [int]($_.raceNo) }; Descending = $false }
  ))
}

function Save-MergedPredictionJson {
  param([string]$SourceFile)

  $incomingLoadResult = Load-JsonObject -Path $SourceFile
  if (!$incomingLoadResult.Success) {
    Write-Log "Skip update because incoming JSON could not be parsed."
    return $null
  }

  $targetLoadResult = Load-JsonObject -Path $TargetFile -AllowMissing
  if (!$targetLoadResult.Success) {
    Write-Log "Skip update because target JSON could not be parsed."
    return $null
  }

  $incomingPayload = $incomingLoadResult.Payload
  $targetPayload = $targetLoadResult.Payload

  $incomingRecords = Convert-ToRecordMap -Payload $incomingPayload
  Write-Log "Parsed incoming records: $($incomingRecords.Count)"
  if ($incomingRecords.Count -le 0) {
    Write-Log "Incoming records are 0. Skip update."
    return $null
  }

  $targetRecords = Convert-ToRecordMap -Payload $targetPayload

  foreach ($key in $incomingRecords.Keys) {
    $targetRecords[$key] = $incomingRecords[$key]
  }

  $nextPayload = [ordered]@{
    generatedAt = [DateTimeOffset]::Now.ToString("o")
    updatedAt = [DateTimeOffset]::Now.ToString("o")
    version = 1
    source = "kurari-boat-prediction-page"
    records = (Convert-ToSortedRecords -RecordMap $targetRecords)
    notifiedSlackResultKeys = @($targetPayload.notifiedSlackResultKeys)
    notifiedSlackHitKeys = @($targetPayload.notifiedSlackHitKeys)
  }

  if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
  }

  $json = $nextPayload | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($TargetFile, "$json`n", [System.Text.UTF8Encoding]::new($false))
  Write-Log "Updated johnson-predictions.generated.json with $($incomingRecords.Count) incoming record(s)."

  return [pscustomobject]@{
    IncomingCount = $incomingRecords.Count
  }
}

function Archive-ProcessedJson {
  param([string]$SourceFile)

  if (!(Test-Path $SourceFile)) {
    return
  }

  if (!(Test-Path $ProcessedDir)) {
    New-Item -ItemType Directory -Path $ProcessedDir -Force | Out-Null
  }

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($SourceFile)
  $extension = [System.IO.Path]::GetExtension($SourceFile)
  $archiveName = "{0}-{1}{2}" -f $baseName, (Get-Date -Format "yyyyMMdd-HHmmssfff"), $extension
  $archivePath = Join-Path $ProcessedDir $archiveName
  Move-Item -Path $SourceFile -Destination $archivePath -Force
  Write-Log "Archived processed json: $archivePath"
}

function Publish-PredictionJson {
  param([string]$SourceFile)

  try {
    if (!(Test-Path $SourceFile)) {
      Write-Log "Source file not found: $SourceFile"
      return
    }

    if (!(Wait-FileReady -Path $SourceFile)) {
      Write-Log "File is not ready: $SourceFile"
      return
    }

    $mergeResult = Save-MergedPredictionJson -SourceFile $SourceFile
    if ($null -eq $mergeResult) {
      return
    }

    Archive-ProcessedJson -SourceFile $SourceFile

    $addExit = Invoke-GitCommand "add public/data/boatrace/johnson-predictions.generated.json"
    if ($addExit -ne 0) {
      Write-Log "git add failed."
      return
    }

    $diffExit = Invoke-GitCommand "diff --cached --quiet"
    if ($diffExit -eq 0) {
      Write-Log "No git changes. Skip commit and push."
      return
    }

    $commitExit = Invoke-GitCommand "commit -m \"Update boat Johnson predictions\""
    if ($commitExit -ne 0) {
      Write-Log "git commit failed."
      return
    }

    $pullExit = Invoke-GitCommand "pull --rebase --autostash origin main"
    if ($pullExit -ne 0) {
      Write-Log "git pull --rebase failed. Resolve the conflict in this repo and restart the watcher."
      return
    }

    $pushExit = Invoke-GitCommand "push"
    if ($pushExit -eq 0) {
      Write-Log "git push completed. MobilePage / Slack script can now read the generated JSON."
    } else {
      Write-Log "git push failed."
    }
  } catch {
    Write-Log "ERROR: $($_.Exception.Message)"
  }
}

Write-Log "Watcher started."
Write-Log "Download directory: $DownloadDir"
Write-Log "Target file: $TargetFile"
Write-Log "Watching boat-johnson-predictions.generated*.json"
Write-Log "Press Ctrl + C to stop."

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $DownloadDir
$watcher.Filter = "boat-johnson-predictions.generated*.json"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$script:lastHandledPath = ""
$script:lastHandledAt = Get-Date "2000-01-01"

$action = {
  $path = $Event.SourceEventArgs.FullPath
  $now = Get-Date

  if ($path -eq $script:lastHandledPath -and (($now - $script:lastHandledAt).TotalSeconds -lt 3)) {
    return
  }

  $script:lastHandledPath = $path
  $script:lastHandledAt = $now

  Start-Sleep -Milliseconds 800
  Write-Log "Detected json: $path"
  Publish-PredictionJson -SourceFile $path
}

Register-ObjectEvent $watcher Created -Action $action | Out-Null
Register-ObjectEvent $watcher Changed -Action $action | Out-Null
Register-ObjectEvent $watcher Renamed -Action $action | Out-Null

while ($true) {
  Start-Sleep -Seconds 2
}
param(
  [switch]$ImportLatest
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DownloadDir = Join-Path $env:USERPROFILE "Downloads"
$CheckerPath = Join-Path $ProjectRoot "scripts\checkBoatJohnsonPredictionsJson.mjs"
$LogFile = Join-Path $ProjectRoot "scripts\boat-johnson-auto-push-log.txt"
$StateFile = Join-Path $ProjectRoot ".git\boat-johnson-watch-state.txt"
$TargetRelativePath = "public/data/boatrace/johnson-predictions.generated.json"
$MaxPushAttempts = 4
$WatchStartedAt = Get-Date
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:LastHeartbeatAt = Get-Date "2000-01-01"
$script:RejectedSignature = ""
$script:FailedSignature = ""

function Write-Log {
  param([string]$Message)

  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  [System.IO.File]::AppendAllText($LogFile, "$line`r`n", $Utf8NoBom)
}

function Invoke-LoggedCommand {
  param(
    [string]$WorkingDirectory,
    [string]$File,
    [string[]]$Arguments
  )

  $display = "$File $($Arguments -join ' ')"
  Write-Log "RUN: $display"
  Push-Location $WorkingDirectory
  try {
    $output = @(& $File @Arguments 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
  } catch {
    $output = @($_.Exception.Message)
    $exitCode = 1
  } finally {
    Pop-Location
  }

  foreach ($line in $output) {
    if ($line) {
      Write-Log "OUTPUT: $line"
    }
  }

  Write-Log "EXIT: $exitCode"
  return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

function Invoke-Git {
  param([string]$WorkingDirectory, [string[]]$Arguments)
  return Invoke-LoggedCommand -WorkingDirectory $WorkingDirectory -File "git" -Arguments $Arguments
}

function Get-OperationDate {
  $jst = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([System.DateTimeOffset]::UtcNow, "Tokyo Standard Time")
  return $jst.ToString("yyyy-MM-dd")
}

function Get-DownloadSignature {
  param([System.IO.FileInfo]$File)
  return "{0}|{1}|{2}" -f $File.FullName, $File.LastWriteTimeUtc.Ticks, $File.Length
}

function Get-ProcessedSignature {
  if (!(Test-Path -LiteralPath $StateFile)) {
    return ""
  }

  return [System.IO.File]::ReadAllText($StateFile, [System.Text.Encoding]::UTF8).Trim()
}

function Save-ProcessedSignature {
  param([string]$Signature)
  [System.IO.File]::WriteAllText($StateFile, $Signature + "`n", $Utf8NoBom)
}

function Write-Heartbeat {
  param([string]$Message)

  $now = Get-Date
  if (($now - $script:LastHeartbeatAt).TotalSeconds -ge 30) {
    Write-Log $Message
    $script:LastHeartbeatAt = $now
  }
}

function Test-OriginalRepositoryState {
  $gitDir = Join-Path $ProjectRoot ".git"
  $blockedPaths = @(
    (Join-Path $gitDir "rebase-merge"),
    (Join-Path $gitDir "rebase-apply"),
    (Join-Path $gitDir "MERGE_HEAD"),
    (Join-Path $gitDir "CHERRY_PICK_HEAD")
  )

  foreach ($blockedPath in $blockedPaths) {
    if (Test-Path -LiteralPath $blockedPath) {
      Write-Log "Stop: original repository has an in-progress Git operation at $blockedPath"
      return $false
    }
  }

  return $true
}

function Test-DownloadName {
  param([string]$Name)
  return $Name -eq "boat-johnson-predictions.generated.json" `
    -or $Name -like "boat-johnson-predictions.generated (*.json)" `
    -or $Name -like "boat-johnson-from-browser-????-??-??.json" `
    -or $Name -like "boat-johnson-from-browser-????-??-?? (*.json)"
}

function Get-DownloadCandidates {
  if (!(Test-Path -LiteralPath $DownloadDir)) {
    Write-Log "Download directory does not exist: $DownloadDir"
    return @()
  }

  return Get-ChildItem -LiteralPath $DownloadDir -File -ErrorAction SilentlyContinue |
    Where-Object { Test-DownloadName -Name $_.Name } |
    Sort-Object -Property LastWriteTime -Descending
}

function Get-EligibleDownload {
  $candidates = @(Get-DownloadCandidates)
  if ($candidates.Count -eq 0) {
    Write-Heartbeat "Download candidates: 0 (patterns: boat-johnson-predictions.generated*.json, boat-johnson-from-browser-YYYY-MM-DD*.json)"
    return $null
  }

  foreach ($candidate in $candidates) {
    $signature = Get-DownloadSignature -File $candidate
    if ($signature -eq (Get-ProcessedSignature)) {
      Write-Heartbeat "Candidate excluded as processed: $($candidate.Name)"
      continue
    }

    if (!$ImportLatest -and $candidate.LastWriteTime -le $WatchStartedAt) {
      Write-Heartbeat "Candidate excluded by startup baseline: $($candidate.Name) lastWrite=$($candidate.LastWriteTime.ToString('o'))"
      continue
    }

    if ($signature -eq $script:RejectedSignature) {
      Write-Heartbeat "Candidate excluded after JSON validation failure: $($candidate.Name)"
      continue
    }

    if ($signature -eq $script:FailedSignature) {
      Write-Heartbeat "Candidate excluded after publish failure: $($candidate.Name)"
      continue
    }

    return [pscustomobject]@{ File = $candidate; Signature = $signature }
  }

  return $null
}

function Wait-FileReady {
  param([System.IO.FileInfo]$File)

  for ($attempt = 0; $attempt -lt 12; $attempt++) {
    try {
      $stream = [System.IO.File]::Open($File.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
      $stream.Close()
      $firstLength = (Get-Item -LiteralPath $File.FullName).Length
      Start-Sleep -Milliseconds 500
      $secondLength = (Get-Item -LiteralPath $File.FullName).Length
      if ($firstLength -gt 0 -and $firstLength -eq $secondLength) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function Invoke-JsonCheck {
  param([string]$Path, [string]$OperationDate)
  return Invoke-LoggedCommand -WorkingDirectory $ProjectRoot -File "node" -Arguments @($CheckerPath, $Path, "--expected-date", $OperationDate)
}

function Remove-TemporaryWorktree {
  param([string]$WorktreePath)
  if (Test-Path -LiteralPath $WorktreePath) {
    $result = Invoke-Git -WorkingDirectory $ProjectRoot -Arguments @("worktree", "remove", "--force", $WorktreePath)
    if ($result.ExitCode -ne 0) {
      Write-Log "Temporary worktree cleanup failed: $WorktreePath"
    }
  }
}

function Test-PushRetryable {
  param([string[]]$Output)
  $text = $Output -join "`n"
  return $text -match "non-fast-forward|rejected|cannot lock ref|fetch first"
}

function Publish-Download {
  param([System.IO.FileInfo]$SourceFile)

  if (!(Test-OriginalRepositoryState)) {
    return "failed"
  }

  if (!(Wait-FileReady -File $SourceFile)) {
    Write-Log "File is not ready: $($SourceFile.FullName)"
    return "retry-later"
  }

  $operationDate = Get-OperationDate
  Write-Log "Detected download: $($SourceFile.Name) size=$($SourceFile.Length) lastWrite=$($SourceFile.LastWriteTime.ToString('o'))"
  $sourceCheck = Invoke-JsonCheck -Path $SourceFile.FullName -OperationDate $operationDate
  if ($sourceCheck.ExitCode -ne 0) {
    Write-Log "Source JSON validation failed."
    return "rejected"
  }

  for ($attempt = 1; $attempt -le $MaxPushAttempts; $attempt++) {
    $worktreePath = Join-Path ([System.IO.Path]::GetTempPath()) ("boatrace-johnson-push-{0}-{1}" -f (Get-Date -Format "yyyyMMddHHmmssfff"), $attempt)
    $created = $false

    try {
      Write-Log "Push attempt $attempt/$MaxPushAttempts"
      $fetch = Invoke-Git -WorkingDirectory $ProjectRoot -Arguments @("fetch", "origin", "main")
      if ($fetch.ExitCode -ne 0) {
        return "failed"
      }

      $addWorktree = Invoke-Git -WorkingDirectory $ProjectRoot -Arguments @("worktree", "add", "--detach", $worktreePath, "origin/main")
      if ($addWorktree.ExitCode -ne 0) {
        return "failed"
      }
      $created = $true
      Write-Log "Temporary worktree: $worktreePath"

      $targetPath = Join-Path $worktreePath $TargetRelativePath
      [System.IO.Directory]::CreateDirectory((Split-Path -Parent $targetPath)) | Out-Null
      Copy-Item -LiteralPath $SourceFile.FullName -Destination $targetPath -Force
      Write-Log "Copied source JSON by bytes to temporary worktree target."

      $targetCheck = Invoke-JsonCheck -Path $targetPath -OperationDate $operationDate
      if ($targetCheck.ExitCode -ne 0) {
        Write-Log "Target JSON validation failed."
        return "rejected"
      }

      $stage = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("add", "--", $TargetRelativePath)
      if ($stage.ExitCode -ne 0) {
        return "failed"
      }

      $staged = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("diff", "--cached", "--name-only")
      $stagedFiles = @($staged.Output | Where-Object { $_ })
      Write-Log "Staged files: $($stagedFiles -join ', ')"
      if ($staged.ExitCode -ne 0 -or $stagedFiles.Count -ne 1 -or $stagedFiles[0] -ne $TargetRelativePath) {
        Write-Log "Stop: unexpected staged file set."
        return "failed"
      }

      $check = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("diff", "--check", "--cached")
      if ($check.ExitCode -ne 0) {
        return "failed"
      }

      $hasDiff = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("diff", "--cached", "--quiet")
      if ($hasDiff.ExitCode -eq 0) {
        Write-Log "No target JSON diff on latest origin/main. Marking download as processed."
        return "processed"
      }
      if ($hasDiff.ExitCode -ne 1) {
        return "failed"
      }

      $commitMessage = "Update boat Johnson predictions for $operationDate"
      $commit = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("commit", "-m", $commitMessage)
      if ($commit.ExitCode -ne 0) {
        return "failed"
      }

      $hash = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("rev-parse", "HEAD")
      if ($hash.ExitCode -ne 0) {
        return "failed"
      }
      Write-Log "Commit hash: $($hash.Output[0])"

      $push = Invoke-Git -WorkingDirectory $worktreePath -Arguments @("push", "origin", "HEAD:main")
      if ($push.ExitCode -eq 0) {
        Write-Log "Push succeeded on attempt $attempt."
        return "processed"
      }

      Write-Log "Push failed on attempt $attempt."
      if (!(Test-PushRetryable -Output $push.Output) -or $attempt -eq $MaxPushAttempts) {
        return "failed"
      }
    } finally {
      if ($created) {
        Remove-TemporaryWorktree -WorktreePath $worktreePath
      }
    }
  }

  return "failed"
}

if (!(Test-Path -LiteralPath $CheckerPath)) {
  throw "Missing JSON checker: $CheckerPath"
}

Write-Log "Johnson watcher started. Downloads created after $($WatchStartedAt.ToString('o')) are eligible unless -ImportLatest is used."
Write-Log "Download directory: $DownloadDir"
Write-Log "Target: $TargetRelativePath"
Write-Log "Patterns: boat-johnson-predictions.generated.json; boat-johnson-predictions.generated (N).json; boat-johnson-from-browser-YYYY-MM-DD.json; boat-johnson-from-browser-YYYY-MM-DD (N).json"
Write-Log "Startup baseline: $($WatchStartedAt.ToString('o')); ImportLatest=$ImportLatest"
Write-Log "Press Ctrl+C to stop."

while ($true) {
  try {
    $candidate = Get-EligibleDownload
    if ($null -ne $candidate) {
      $result = Publish-Download -SourceFile $candidate.File
        if ($result -eq "processed") {
          Save-ProcessedSignature -Signature $candidate.Signature
        } elseif ($result -eq "rejected") {
          $script:RejectedSignature = $candidate.Signature
          Write-Log "Watcher remains active after rejecting candidate JSON."
        } elseif ($result -eq "failed") {
          $script:FailedSignature = $candidate.Signature
          Write-Log "Watcher remains active after publish failure; save a newer download to retry."
        }
    }
  } catch {
    Write-Log "Watcher error: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 2
}

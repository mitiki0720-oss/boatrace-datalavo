param(
	[switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$LogPath = Join-Path $ScriptDir "boat-daily-rollover-log.txt"
$CommitMessage = "Run boat daily rollover"

function Get-Timestamp {
	return (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

function Write-Step {
	param([string]$Message)
	$line = "[{0}] {1}" -f (Get-Timestamp), $Message
	Write-Host $line
	if (-not $DryRun) {
		Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
	}
}

function Stop-Safely {
	param([string]$Message)
	Write-Step $Message
	exit 1
}

function Invoke-LoggedCommand {
	param(
		[string]$FilePath,
		[string[]]$Arguments,
		[switch]$AllowFailure
	)

	$output = & $FilePath @Arguments 2>&1
	$exitCode = $LASTEXITCODE
	foreach ($line in $output) {
		Write-Host $line
		if (-not $DryRun) {
			Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
		}
	}
	if ($exitCode -ne 0 -and -not $AllowFailure) {
		throw "$FilePath $($Arguments -join ' ') failed with exit code $exitCode"
	}
	return @{
		ExitCode = $exitCode
		Output = @($output)
	}
}

function Test-GitUnsafeState {
	$gitDir = (& git -C $RepoRoot rev-parse --git-dir 2>$null)
	if ($LASTEXITCODE -ne 0 -or -not $gitDir) {
		return "not a git repository"
	}

	if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
		$gitDir = Join-Path $RepoRoot $gitDir
	}

	foreach ($marker in @("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD")) {
		if (Test-Path (Join-Path $gitDir $marker)) {
			return "git operation in progress: $marker"
		}
	}

	foreach ($dir in @("rebase-merge", "rebase-apply")) {
		if (Test-Path (Join-Path $gitDir $dir)) {
			return "git rebase in progress"
		}
	}

	$branch = (& git -C $RepoRoot symbolic-ref --quiet --short HEAD 2>$null)
	if ($LASTEXITCODE -ne 0 -or -not $branch) {
		return "HEAD is not on a branch"
	}

	$status = & git -C $RepoRoot status --porcelain -uall
	foreach ($line in $status) {
		if ($line -match "^(UU|AA|DD|AU|UA|DU|UD) ") {
			return "git conflict state: $line"
		}
	}

	return $null
}

function Get-RolloverCandidates {
	param([string[]]$Output)

	$candidates = New-Object System.Collections.Generic.List[string]
	$collecting = $false
	foreach ($line in $Output) {
		if ($line -eq "[boat-rollover] changed candidates:") {
			$collecting = $true
			continue
		}
		if ($collecting) {
			if ($line -match "^\s{2}(.+)$") {
				$candidates.Add($Matches[1].Replace("\", "/"))
				continue
			}
			if ($line -match "^\[boat-rollover\]") {
				$collecting = $false
			}
		}
	}
	return @($candidates)
}

function Get-ArchiveTargetDate {
	param([string[]]$Output)

	foreach ($line in $Output) {
		if ($line -match "\sprevious=(\d{4}-\d{2}-\d{2})\s") {
			return $Matches[1]
		}
	}
	return "unknown"
}

function Get-PruneTargetDate {
	param([string[]]$Output)

	foreach ($line in $Output) {
		if ($line -match "\scurrent=(\d{4}-\d{2}-\d{2})\s") {
			return $Matches[1]
		}
	}
	return "unknown"
}

function Select-AllowedRolloverFiles {
	param(
		[string[]]$Candidates,
		[string]$ArchiveDate = ""
	)

	$allowed = New-Object System.Collections.Generic.List[string]
	foreach ($candidate in $Candidates) {
		$path = $candidate.Replace("\", "/")
		$archivePattern = if ($ArchiveDate) {
			"^public/data/reviews/$([regex]::Escape($ArchiveDate))/[^/]+-(predictions|results|summary)\.txt$"
		} else {
			"^public/data/reviews/\d{4}-\d{2}-\d{2}/[^/]+-(predictions|results|summary)\.txt$"
		}
		if ($path -eq "public/data/reviews/index.json" -or
			$path -match $archivePattern -or
			$path -eq "public/data/boatrace/today.generated.json" -or
			$path -eq "public/data/boatrace/today-race-details.generated.json" -or
			$path -eq "public/data/boatrace/venue-extras.generated.json" -or
			$path -eq "public/data/boatrace/johnson-predictions.generated.json" -or
			$path -eq "public/data/boatrace/upcoming-schedule.generated.json") {
			$allowed.Add($path)
		}
	}
	return @($allowed | Sort-Object -Unique)
}

function Get-StagedFiles {
	$files = & git -C $RepoRoot diff --cached --name-only
	return @($files | ForEach-Object { $_.Replace("\", "/") } | Where-Object { $_ })
}

function Assert-StagedFilesAreAllowed {
	param([string[]]$AllowedFiles)

	$allowedSet = @{}
	foreach ($file in $AllowedFiles) {
		$allowedSet[$file] = $true
	}

	$stagedFiles = Get-StagedFiles
	$unexpected = @($stagedFiles | Where-Object { -not $allowedSet.ContainsKey($_) })
	if ($unexpected.Count -gt 0) {
		Write-Step "unexpected staged files detected; skip commit/push"
		foreach ($file in $unexpected) {
			Write-Step "unexpected staged: $file"
		}
		exit 1
	}

	Write-Step "staged rollover files:"
	foreach ($file in $stagedFiles) {
		Write-Step $file
	}
}

Set-Location -LiteralPath $RepoRoot

Write-Step "Start boat daily rollover"

$unsafeReason = Test-GitUnsafeState
if ($unsafeReason) {
	Stop-Safely "Stop before rollover: $unsafeReason"
}

if ($DryRun) {
	Write-Step "DryRun: inspect rollover plan without file updates"
	$dry = Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("run", "rollover:boat-daily", "--", "--dry-run")
	if ($dry.ExitCode -ne 0) {
		Stop-Safely "DryRun: rollover dry-run failed"
	}
	$candidates = Get-RolloverCandidates -Output $dry.Output
	$archiveDate = Get-ArchiveTargetDate -Output $dry.Output
	$allowed = Select-AllowedRolloverFiles -Candidates $candidates -ArchiveDate $archiveDate
	Write-Step "DryRun archive target: $archiveDate"
	Write-Step "DryRun prune target: $(Get-PruneTargetDate -Output $dry.Output)"
	Write-Step "DryRun add planned files:"
	foreach ($file in $allowed) {
		Write-Host "  $file"
	}
	if ($allowed.Count -eq 0) {
		Write-Host "  (none)"
	}
	Write-Step "DryRun commit planned: $CommitMessage"
	Write-Step "DryRun push planned: git push origin main"
	exit 0
}

Write-Step "sync latest main before rollover"
& git -C $RepoRoot fetch origin main
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git fetch failed before rollover"
}

& git -C $RepoRoot rebase --autostash origin/main
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git rebase failed or conflicted before rollover; force push is disabled"
}
Write-Step "latest main synced"

$rollover = Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("run", "rollover:boat-daily")
if ($rollover.ExitCode -ne 0) {
	Stop-Safely "rollover failed; skip git add/commit/push"
}

$rolloverOutput = $rollover.Output
if ($rolloverOutput -match "prediction archive verified") {
	Write-Step "prediction archive verified"
}
if ($rolloverOutput -match "result archive verified") {
	Write-Step "result archive verified"
}
if ($rolloverOutput -match "summary not found: optional, continue") {
	Write-Step "summary not found: optional, continue"
}
if ($rolloverOutput -match "prune active data") {
	Write-Step "active prune completed"
}

$archiveDate = Get-ArchiveTargetDate -Output $rolloverOutput
$candidates = Get-RolloverCandidates -Output $rolloverOutput
$allowedFiles = Select-AllowedRolloverFiles -Candidates $candidates -ArchiveDate $archiveDate

if ($allowedFiles.Count -eq 0) {
	Write-Step "no allowed rollover files changed; exit without commit"
	exit 0
}

Write-Step "pre-existing allowed rollover changes detected: include in rollover commit"

Write-Step "git add selected rollover files"
& git -C $RepoRoot add -- @allowedFiles
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git add failed"
}

Assert-StagedFilesAreAllowed -AllowedFiles $allowedFiles

& git -C $RepoRoot diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
	Write-Step "no staged rollover diff; exit without commit"
	exit 0
}

& git -C $RepoRoot commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git commit failed"
}
Write-Step "git commit completed"

& git -C $RepoRoot fetch origin main
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git fetch failed"
}

& git -C $RepoRoot rebase --autostash origin/main
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git rebase failed or conflicted; force push is disabled"
}
Write-Step "git rebase completed"

& git -C $RepoRoot push origin main
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git push failed"
}
Write-Step "git push completed"

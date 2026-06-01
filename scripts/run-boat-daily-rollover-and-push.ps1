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
	param([string[]]$Candidates)

	$allowed = New-Object System.Collections.Generic.List[string]
	foreach ($candidate in $Candidates) {
		$path = $candidate.Replace("\", "/")
		if ($path -eq "public/data/reviews/index.json" -or
			$path -match "^public/data/reviews/\d{4}-\d{2}-\d{2}/[^/]+-(predictions|results|summary)\.txt$" -or
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

function Get-GitDirtyPathSet {
	$set = @{}
	$status = & git -C $RepoRoot status --porcelain -uall
	foreach ($line in $status) {
		if ($line.Length -lt 4) {
			continue
		}
		$pathText = $line.Substring(3).Trim()
		if ($pathText -match " -> ") {
			$pathText = ($pathText -split " -> ")[-1]
		}
		$pathText = $pathText.Trim('"').Replace("\", "/")
		if ($pathText) {
			$set[$pathText] = $true
		}
	}
	return $set
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
	$allowed = Select-AllowedRolloverFiles -Candidates $candidates
	Write-Step "DryRun archive target: $(Get-ArchiveTargetDate -Output $dry.Output)"
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

$preRolloverDirtyPaths = Get-GitDirtyPathSet

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

$candidates = Get-RolloverCandidates -Output $rolloverOutput
$allowedFiles = Select-AllowedRolloverFiles -Candidates $candidates

if ($allowedFiles.Count -eq 0) {
	Write-Step "no allowed rollover files changed; exit without commit"
	exit 0
}

$preExistingAllowedFiles = @($allowedFiles | Where-Object { $preRolloverDirtyPaths.ContainsKey($_) })
if ($preExistingAllowedFiles.Count -gt 0) {
	Write-Step "pre-existing dirty rollover files detected; skip commit/push to avoid mixing manual work"
	foreach ($file in $preExistingAllowedFiles) {
		Write-Step "pre-existing dirty: $file"
	}
	exit 1
}

Write-Step "git add selected rollover files"
& git -C $RepoRoot add -- @allowedFiles
if ($LASTEXITCODE -ne 0) {
	Stop-Safely "git add failed"
}

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

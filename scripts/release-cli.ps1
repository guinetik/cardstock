<#
.SYNOPSIS
Tag and push the CLI release for npm trusted publishing.
.EXAMPLE
./scripts/release-cli.ps1 -NoPush
.EXAMPLE
./scripts/release-cli.ps1 -Bump patch
#>
param(
    [ValidateSet('current', 'patch', 'minor', 'major')]
    [string]$Bump = 'current',
    [switch]$NoPush
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    $dirty = git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Could not read git status' }
    if ($dirty) { throw 'Commit or stash changes before releasing.' }
    $branch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or -not $branch) { throw 'Release from a branch, not detached HEAD.' }

    $manifest = Get-Content -Raw packages/cli/package.json | ConvertFrom-Json
    $version = $manifest.version
    if ($Bump -ne 'current') {
        $parts = $version.Split('.')
        if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Automatic bumps require a stable version.' }
        $major, $minor, $patch = [int]$parts[0], [int]$parts[1], [int]$parts[2]
        switch ($Bump) {
            'major' { $major++; $minor = 0; $patch = 0 }
            'minor' { $minor++; $patch = 0 }
            'patch' { $patch++ }
        }
        $version = "$major.$minor.$patch"
    }
    $tag = "cli-v$version"
    git show-ref --verify --quiet "refs/tags/$tag"
    if ($LASTEXITCODE -eq 0) { throw "Tag $tag already exists" }
    if ($LASTEXITCODE -ne 1) { throw 'Could not check existing tags' }

    bun run check:packages
    if ($LASTEXITCODE -ne 0) { throw 'Package checks failed' }

    if ($Bump -ne 'current') {
        $text = Get-Content -Raw packages/cli/package.json
        $text = $text -replace '"version": "[^"]+"', "`"version`": `"$version`""
        [System.IO.File]::WriteAllText((Join-Path $root 'packages/cli/package.json'), $text)
        bun install --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw 'Lockfile update failed; review the version edit before retrying.' }
    }
    bun run build:cli
    if ($LASTEXITCODE -ne 0) { throw 'CLI build failed' }
    $actual = bun packages/cli/dist/index.js --version
    if ($LASTEXITCODE -ne 0 -or $actual -ne $version) { throw 'Built CLI version does not match manifest' }

    if ($Bump -ne 'current') {
        git add -- packages/cli/package.json bun.lock
        if ($LASTEXITCODE -ne 0) { throw 'Could not stage version files' }
        git commit -m "chore(cli): release $version"
        if ($LASTEXITCODE -ne 0) { throw 'Could not commit release' }
    }
    git tag -a $tag -m "@guinetik/cardstock-cli $version"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create release tag' }
    if ($NoPush) {
        Write-Host "Tagged $tag locally. Publish later: git push --atomic origin $branch $tag"
    } else {
        git push --atomic origin $branch $tag
        if ($LASTEXITCODE -ne 0) { throw 'Push failed; the release tag remains local.' }
        Write-Host 'Release pushed. Follow https://github.com/guinetik/cardstock/actions'
    }
} finally {
    Pop-Location
}

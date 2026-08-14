# Boat EX JSON parse audit

## Result

`public/data/boatrace-ex/audit/name-identity-bridge-2026-08-02.generated.json` is valid JSON. Node.js `JSON.parse` succeeds, and Windows PowerShell also succeeds when the file is explicitly decoded as UTF-8.

The earlier broad PowerShell validation used `Get-Content -Raw` without an encoding. In Windows PowerShell 5.1, that default can use the active ANSI code page rather than UTF-8. Japanese UTF-8 payloads are then decoded incorrectly before `ConvertFrom-Json` receives them. The resulting parser error is a validation-environment false positive, not JSON corruption.

## Canonical validation

Use the Node-based checker for merge and release validation:

```powershell
node scripts/checkBoatExJsonParse.mjs
```

It walks every `public/data/boatrace-ex/**/*.json` file, parses UTF-8 with `JSON.parse`, reports the path, byte size, and parser message for each failure, and explicitly verifies the name identity bridge audit is included.

This matches the Node/browser JSON runtime used by the app and avoids PowerShell 5.1 code-page behavior. The checker is validation-only and does not rewrite any JSON.

## PowerShell diagnostic alternative

When a PowerShell diagnostic is needed, always specify UTF-8:

```powershell
Get-ChildItem -Path "public/data/boatrace-ex" -Recurse -Filter "*.json" | ForEach-Object {
  Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop | Out-Null
}
```

Do not use the encoding-implicit `Get-Content -Raw` form for this repository's UTF-8 JSON files.

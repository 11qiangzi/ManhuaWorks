$htmlDir = "D:\ManhuaWorks\docs\design\mockups\html"
Get-ChildItem -Path $htmlDir -Filter "*.html" | ForEach-Object {
    $filename = $_.Name
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return }
    
    $apis = @()
    # Match .get('...'), .post('...') etc
    $pattern1 = [regex]::Matches($content, "\.(get|post|put|delete|patch)\s*\(\s*['`"]([^'`"]+)['`"]")
    foreach ($m in $pattern1) { $apis += "$($m.Groups[1].Value.ToUpper()) $($m.Groups[2].Value)" }
    
    # Match fetch('...')
    $pattern2 = [regex]::Matches($content, "fetch\s*\(\s*['`"]([^'`"]+)['`"]")
    foreach ($m in $pattern2) { $apis += "FETCH $($m.Groups[1].Value)" }
    
    $apis = $apis | Sort-Object -Unique
    if ($apis.Count -gt 0) {
        Write-Output "=== $filename ==="
        $apis | ForEach-Object { Write-Output "  $_" }
    }
}

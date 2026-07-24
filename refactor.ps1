$ErrorActionPreference = 'Stop'
$files = Get-ChildItem -Path "apps/web/src" -Recurse -Include *.tsx, *.ts, *.jsx, *.js -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Replace hardcoded backgrounds
    $content = $content -replace 'bg-\[#0F1115\]', 'bg-bg-surface'
    $content = $content -replace 'bg-\[#0A0C0F\]', 'bg-bg-base'
    $content = $content -replace 'bg-\[#1B1712\]', 'bg-bg-base'
    $content = $content -replace 'bg-\[#14555C\]', 'bg-accent-primary'
    $content = $content -replace 'bg-\[#3F9AA3\]', 'bg-accent-primary-text'
    $content = $content -replace 'bg-\[#F5EFE3\]', 'bg-text-primary'

    # Replace hardcoded text colors
    $content = $content -replace 'text-\[#F5EFE3\]', 'text-text-primary'
    $content = $content -replace 'text-\[#3F9AA3\]', 'text-accent-primary-text'
    $content = $content -replace 'text-\[#6BBF82\]', 'text-accent-emerald'
    $content = $content -replace 'text-\[#F2C94C\]', 'text-accent-gold'
    $content = $content -replace 'text-\[#1B1712\]', 'text-bg-base'

    # Replace hardcoded border colors
    $content = $content -replace 'border-\[#3F9AA3\]', 'border-accent-primary-text'
    $content = $content -replace 'border-\[#F5EFE3\]', 'border-text-primary'

    # Replace gradients
    $content = $content -replace 'from-\[#3F9AA3\]', 'from-accent-primary-text'
    $content = $content -replace 'via-\[#6BBF82\]', 'via-accent-emerald'
    $content = $content -replace 'to-\[#14555C\]', 'to-accent-primary'
    $content = $content -replace 'to-\[#3F9AA3\]', 'to-accent-primary-text'

    # Replace shadows
    $content = $content -replace 'shadow-\[#3F9AA3\]', 'shadow-accent-primary-text'
    
    # Replace focus rings
    $content = $content -replace 'focus:ring-\[#8E7F65\]', 'focus:ring-accent-primary'
    
    # Replace some edge cases
    $content = $content -replace 'bg-\[#25201A\]', 'bg-surface-glass'
    $content = $content -replace 'bg-\[#B4A083\]', 'bg-accent-primary'

    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "Replacement complete."

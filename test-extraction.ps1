$testText = "HOSPITAL DISCHARGE SUMMARY`n`nMr. John Doe is a 72 year old gentleman admitted with CHF.`nHistory: Presented with gradually worsening lower extremity edema.`nPast Medical History:`n1. CHF (ICD-10: I50.9)`n2. Hypertension (ICD-10: I10)"

$boundary = "----WebKitFormBoundary7e38c7c56b8c"

$body = @()
$body += "--$boundary"
$body += 'Content-Disposition: form-data; name="manualText"'
$body += ""
$body += $testText
$body += "--$boundary--"

$bodyStr = $body -join "`r`n"

$response = Invoke-WebRequest -Uri "http://localhost:3002/api/intake/parse" -Method POST -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyStr -ErrorAction Stop

$result = $response.Content | ConvertFrom-Json

Write-Host "EXTRACTION TEST RESULTS" -ForegroundColor Green
Write-Host "======================" 
$demo = $result.demographics[0]
Write-Host ("Name: {0}" -f $demo.fullName)
Write-Host ("Age: {0}" -f $demo.age)
Write-Host ("Gender: {0}" -f $demo.gender)
Write-Host ("City: {0}" -f $demo.city)

if ($result.medicalHistory.Count -gt 0) {
    Write-Host "`nMedical History:"
    $result.medicalHistory | ForEach-Object {
        Write-Host ("  - {0}" -f $_.condition)
    }
}

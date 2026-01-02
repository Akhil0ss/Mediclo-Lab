# Add environment variables to Vercel
$envVars = @{
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" = "mediclo-lab.firebaseapp.com"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID" = "mediclo-lab"
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" = "mediclo-lab.firebasestorage.app"
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" = "1004098677748"
    "NEXT_PUBLIC_FIREBASE_APP_ID" = "1:1004098677748:web:8a7f4c7b9e6d5a4c3b2a1f"
    "NEXT_PUBLIC_GROQ_API_KEY" = "your_groq_api_key_here"
}

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "Adding $key..."
    echo $value | vercel env add $key production preview development
}

Write-Host "All environment variables added!"

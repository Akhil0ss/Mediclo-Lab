const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Read key from .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const keyMatch = envContent.match(/GROQ_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : null;

if (!apiKey) {
    console.error('❌ GROQ_API_KEY not found in .env.local');
    process.exit(1);
}

console.log(`🔍 Testing Groq API with key: ${apiKey.slice(0, 7)}... (Length: ${apiKey.length})`);

// 2. Prepare request
const data = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 10
});

const options = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

// 3. Execute request
const req = https.request(options, (res) => {
    console.log(`📡 Status Code: ${res.statusCode}`);
    
    let body = '';
    res.on('data', (d) => body += d);
    
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ API is WORKING!');
            console.log('Response:', JSON.parse(body).choices[0].message.content);
        } else if (res.statusCode === 401) {
            console.error('❌ API Error: 401 Unauthorized');
            console.error('REASON: Your API key is invalid or truncated.');
            console.error('Groq keys should be ~48 characters. Yours is ' + apiKey.length);
        } else {
            console.error(`❌ API Error: ${res.statusCode}`);
            console.error(body);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Network Error:', error.message);
});

req.write(data);
req.end();

const { spawnSync } = require('child_process');
const fs = require('fs');

const content = fs.readFileSync('.env.local', 'utf8');
const lines = content.split(/\r?\n/).filter(line => line.includes('=') && !line.trim().startsWith('#'));

for (const line of lines) {
    const i = line.indexOf('=');
    const key = line.substring(0, i).trim();
    const val = line.substring(i + 1).trim().replace(/[\r\n\t]/g, ''); // Crucial: strip all CRLF and tabs

    if (key.startsWith('NEXT_PUBLIC_')) {
        console.log(`Setting ${key}...`);

        // Use v.replace to be absolutely sure
        const cleanVal = val;

        ['production', 'preview', 'development'].forEach(env => {
            // Remove first
            spawnSync('vercel', ['env', 'rm', key, env, '-y'], { stdio: 'ignore', shell: true });

            // Add back using stdin piping to avoid shell-injected newlines
            const addProcess = require('child_process').spawn('vercel', ['env', 'add', key, env], {
                stdio: ['pipe', 'inherit', 'inherit'],
                shell: true
            });
            addProcess.stdin.write(cleanVal);
            addProcess.stdin.end();

            // Busy wait a second to avoid rate limits/concurrency issues
            const start = Date.now();
            while (Date.now() - start < 1500);
        });
    }
}
console.log('Environment variables have been cleaned and set.');

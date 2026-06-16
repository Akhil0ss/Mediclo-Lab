import admin from 'firebase-admin';

function getArgValue(name: string): string | undefined {
    const prefix = `${name}=`;
    const inline = process.argv.find(arg => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);

    const index = process.argv.indexOf(name);
    if (index >= 0) return process.argv[index + 1];
    return undefined;
}

function hasArg(name: string): boolean {
    return process.argv.includes(name);
}

function initAdmin() {
    if (admin.apps.length > 0) return;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
        });
        return;
    }

    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

function isAnonymousUser(user: admin.auth.UserRecord): boolean {
    return user.providerData.length === 0 && !user.email && !user.phoneNumber;
}

function lastSeenAt(user: admin.auth.UserRecord): number {
    const lastSignIn = user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : 0;
    return lastSignIn || Date.parse(user.metadata.creationTime);
}

async function main() {
    const days = Number(getArgValue('--days') || process.env.ANON_CLEANUP_DAYS || 30);
    const maxDelete = Number(getArgValue('--max-delete') || process.env.ANON_CLEANUP_MAX_DELETE || 500);
    const shouldDelete = hasArg('--delete') || process.env.ANON_CLEANUP_DELETE === 'true';

    if (!Number.isFinite(days) || days < 1) {
        throw new Error('Use --days with a value >= 1');
    }
    if (!Number.isFinite(maxDelete) || maxDelete < 1) {
        throw new Error('Use --max-delete with a value >= 1');
    }

    initAdmin();

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const candidates: string[] = [];
    let scanned = 0;
    let pageToken: string | undefined;

    do {
        const result = await admin.auth().listUsers(1000, pageToken);
        scanned += result.users.length;

        for (const user of result.users) {
            if (!isAnonymousUser(user)) continue;
            if (lastSeenAt(user) >= cutoff) continue;

            candidates.push(user.uid);
            if (candidates.length >= maxDelete) break;
        }

        pageToken = result.pageToken;
    } while (pageToken && candidates.length < maxDelete);

    console.log(JSON.stringify({
        mode: shouldDelete ? 'delete' : 'dry-run',
        scanned,
        candidates: candidates.length,
        olderThanDays: days,
        maxDelete,
    }, null, 2));

    if (!shouldDelete || candidates.length === 0) {
        if (!shouldDelete) {
            console.log('Dry run only. Add --delete to remove these anonymous users.');
        }
        return;
    }

    for (let i = 0; i < candidates.length; i += 1000) {
        const batch = candidates.slice(i, i + 1000);
        const result = await admin.auth().deleteUsers(batch);
        console.log(JSON.stringify({
            batch: i / 1000 + 1,
            successCount: result.successCount,
            failureCount: result.failureCount,
            errors: result.errors.map(error => ({ index: error.index, message: error.error.message })),
        }, null, 2));
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});

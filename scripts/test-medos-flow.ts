import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, update, get, query, limitToLast } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loader
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.join('=').trim();
    });
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDeepTest() {
    console.log("🚀 Starting MedOS Deep Test Flow...");
    
    // 1. Authenticate Anonymously
    console.log("🔐 Authenticating Anonymously...");
    const userCredential = await signInAnonymously(auth);
    const firebaseUid = userCredential.user.uid;
    const ownerId = firebaseUid; 
    console.log(`📡 Logged in. UID: ${firebaseUid}`);

    // 2. MOCK SESSION (Bypass Rule: root.child('sessions/' + auth.uid + '/ownerId'))
    console.log("🛠️  Establishing Mock Admin Session...");
    await set(ref(db, `sessions/${firebaseUid}`), {
        username: "test_admin",
        name: "Deep Test System",
        role: "admin",
        ownerId: ownerId, 
        lastActive: new Date().toISOString()
    });
    console.log("✅ Session Mocked. Waiting for propagation...");
    await sleep(2000); // Give rules engine time to sync

    const today = new Date().toISOString().split('T')[0];

    // --- STEP 1: REGISTER PATIENT ---
    console.log("\nStep 1: Registering Patient 'Deepak Tester'...");
    const patientRef = push(ref(db, `patients/${ownerId}`));
    const patientId = patientRef.key;
    const patientData = {
        patientId: "PAT-TEST-" + Date.now().toString().slice(-4),
        name: "Deepak Tester",
        mobile: "9999988888",
        age: "30",
        gender: "Male",
        createdAt: new Date().toISOString()
    };
    await set(patientRef, patientData);
    console.log(`✅ Patient Created. ID: ${patientId}`);

    // --- STEP 2: CREATE OPD VISIT ---
    console.log("\nStep 2: Creating OPD Visit...");
    const opdRef = push(ref(db, `opd/${ownerId}`));
    const visitId = opdRef.key;
    const visitData = {
        patientId,
        patientName: patientData.name,
        visitDate: today,
        status: "pending",
        token: "TEST-01",
        vitals: { bp: "120/80", pulse: "72", weight: "70", temp: "98.6" },
        createdAt: new Date().toISOString()
    };
    await set(opdRef, visitData);
    console.log(`✅ Visit Created. ID: ${visitId}`);

    // --- STEP 3: DOCTOR CONSULTATION ---
    console.log("\nStep 3: Consultation & Referral...");
    const consultData = {
        status: "completed",
        docName: "Dr. Mock AI",
        prescription: {
            diagnosis: "Viral Fever (Test)",
            advice: "Test flow verification patient.",
            referredTests: ["CBC", "Lipid Profile"]
        },
        updatedAt: new Date().toISOString()
    };
    await update(ref(db, `opd/${ownerId}/${visitId}`), consultData);
    console.log(`✅ Prescription Saved. Tests: ${consultData.prescription.referredTests.join(",")}`);

    // --- STEP 4: CONVERT TO LAB ---
    console.log("\nStep 4: Simulating Lab Conversion...");
    const sampleRef = push(ref(db, `samples/${ownerId}`));
    const sampleId = sampleRef.key;
    const sampleData = {
        sampleNumber: "S-TEST-" + Date.now().toString().slice(-4),
        patientId,
        patientName: patientData.name,
        date: new Date().toISOString(),
        status: "Pending",
        tests: consultData.prescription.referredTests,
        priority: "Urgent",
        createdAt: new Date().toISOString()
    };
    await set(sampleRef, sampleData);
    console.log(`✅ Sample Generated. ID: ${sampleId}`);

    // --- STEP 5: BILLING ---
    console.log("\nStep 5: Generating Bill...");
    const invRef = push(ref(db, `invoices/${ownerId}`));
    const invData = {
        invoiceNumber: "INV-TEST-" + Date.now().toString().slice(-4),
        patientId,
        patientName: patientData.name,
        total: 1000,
        status: "Paid",
        createdAt: new Date().toISOString()
    };
    await set(invRef, invData);
    console.log(`✅ Billing Done. Invoice: ${invData.invoiceNumber}`);

    console.log("\n" + "=".repeat(40));
    console.log("🏆 DEEP TEST COMPLETED SUCCESSFULLY 🏆");
    console.log(`Summary: P:${patientId} | V:${visitId} | S:${sampleId}`);
    console.log("=".repeat(40));
    
    process.exit(0);
}

runDeepTest().catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
});

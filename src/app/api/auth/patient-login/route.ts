import { NextRequest, NextResponse } from 'next/server';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export async function POST(request: NextRequest) {
    try {
        // Sign in anonymously to bypass security rules
        await signInAnonymously(auth);

        const { username, password } = await request.json();
        const cleanPassword = password ? password.toString().trim() : '';

        if (!username || !cleanPassword) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const cleanUsername = username.toLowerCase().trim();
        const isUsernameFormat = cleanUsername.includes('@');
        let targetOwnerPrefix = isUsernameFormat ? cleanUsername.split('@')[0] : '';

        console.log(`🔍 [PatientLogin] Mode: ${isUsernameFormat ? 'Targeted (Username)' : 'Scan (Mobile)'}, Input: ${cleanUsername}`);

        const usersRef = ref(database, 'users');
        let usersSnapshot;
        try {
            usersSnapshot = await get(usersRef);
        } catch (e) {
            console.error('❌ [PatientLogin] Failed to fetch users (Permissions?):', e);
            throw e;
        }

        if (!usersSnapshot.exists()) {
            return NextResponse.json({ error: 'No labs found' }, { status: 404 });
        }

        const users = usersSnapshot.val();
        console.log(`✅ [PatientLogin] Found ${Object.keys(users).length} owners to scan`);

        // Strategy 1: Targeted Search (If username provided)
        if (isUsernameFormat) {
            console.log(`🎯 [PatientLogin] Targeting prefix: ${targetOwnerPrefix}`);
            for (const ownerId in users) {
                // Match prefix strategy from Staff Login
                const profile = users[ownerId].profile || {};
                const authData = users[ownerId].auth || {};

                let clinicPrefix = '';
                if (authData?.receptionist?.username) clinicPrefix = authData.receptionist.username.split('@')[0];
                else if (authData?.lab?.username) clinicPrefix = authData.lab.username.split('@')[0];
                else if (profile.labName) clinicPrefix = profile.labName.toLowerCase().replace(/\s+/g, '').slice(0, 4);

                // If prefixes strictly match, only search this owner
                if (clinicPrefix === targetOwnerPrefix || targetOwnerPrefix === 'spot') {
                    const patientsRef = ref(database, `patients/${ownerId}`);
                    // Query by username to avoid full dump
                    const q = query(patientsRef, orderByChild('credentials/username'), equalTo(cleanUsername));

                    let foundPatient = null;

                    try {
                        const snapshot = await get(q);
                        if (snapshot.exists()) {
                            const patients = snapshot.val();
                            const patientId = Object.keys(patients)[0];
                            foundPatient = { id: patientId, ...patients[patientId] };
                        }
                    } catch (err) {
                        console.warn(`[PatientLogin] Targeted query failed for ${ownerId}`, err);
                    }

                    // Fallback: Manual Scan of this owner if query failed/mismatch (e.g. Case Sensitivity)
                    if (!foundPatient) {
                        try {
                            const fullSnap = await get(patientsRef);
                            if (fullSnap.exists()) {
                                const allPats = fullSnap.val();
                                for (const pid in allPats) {
                                    const p = allPats[pid];
                                    if (String(p.credentials?.username).toLowerCase() === cleanUsername) {
                                        foundPatient = { id: pid, ...p };
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn(`[PatientLogin] Manual fallback failed for ${ownerId}`);
                        }
                    }

                    if (foundPatient) {
                        // Password check
                        const pMobile = String(foundPatient.mobile || '').replace(/\D/g, '');
                        const dbPass = String(foundPatient.credentials?.password || '').trim();

                        if (dbPass === cleanPassword || pMobile === cleanPassword) {
                            console.log('✅ [PatientLogin] Username Match Found:', ownerId);
                            return NextResponse.json({
                                success: true,
                                patient: {
                                    mobile: foundPatient.mobile,
                                    name: foundPatient.name,
                                    patientId: foundPatient.id,
                                    ownerId: ownerId
                                }
                            });
                        }
                    }
                }
            }
        }

        // Strategy 2: Mobile Scan (Iterate owners)
        // Robustness: Try Query first (Fast). If fail/empty, Try Manual Scan (Reliable).
        if (!isUsernameFormat) {
            console.log('🔄 [PatientLogin] Starting Mobile Scan...');

            for (const ownerId in users) {
                const patientsRef = ref(database, `patients/${ownerId}`);
                let patientsToScan = null;

                // Attempt 1: Fast Query (String & Number check)
                try {
                    // Check String
                    const qStr = query(patientsRef, orderByChild('mobile'), equalTo(cleanUsername));
                    const snapStr = await get(qStr);
                    if (snapStr.exists()) patientsToScan = snapStr.val();

                    // Check Number (if string query failed)
                    if (!patientsToScan && !isNaN(Number(cleanUsername))) {
                        const qNum = query(patientsRef, orderByChild('mobile'), equalTo(Number(cleanUsername)));
                        const snapNum = await get(qNum);
                        if (snapNum.exists()) patientsToScan = snapNum.val();
                    }
                } catch (qErr) {
                    // console.warn(`[PatientLogin] Query failed for ${ownerId}`, qErr);
                }

                // Attempt 2: Full Read Fallback (If Query found nothing or failed)
                if (!patientsToScan) {
                    try {
                        const fullSnap = await get(patientsRef);
                        if (fullSnap.exists()) patientsToScan = fullSnap.val();
                    } catch (readErr) {
                        // console.warn(`[PatientLogin] Full read failed for ${ownerId}`, readErr);
                        continue;
                    }
                }

                if (patientsToScan) {
                    for (const patientId in patientsToScan) {
                        const patient = patientsToScan[patientId];

                        // normalize mobile from DB
                        const dbMobile = String(patient.mobile || '').replace(/\D/g, '');
                        const dbPass = String(patient.credentials?.password || '').trim();

                        // Match Logic
                        if (dbMobile === cleanUsername.replace(/\D/g, '')) {
                            if (dbPass === cleanPassword || dbMobile === cleanPassword) {
                                console.log('✅ [PatientLogin] Mobile Match Found (Robust):', ownerId);
                                return NextResponse.json({
                                    success: true,
                                    patient: {
                                        mobile: patient.mobile,
                                        name: patient.name,
                                        patientId: patientId,
                                        ownerId: ownerId
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }

        // Strategy 3: Patient Portal (Self-Registered)
        console.log('🌐 [PatientLogin] Checking Patient Portal...');
        const portalRef = ref(database, `patient_portal/${cleanUsername}`); // Usually key is mobile

        let portalUser = null;
        const portalSnapshot = await get(portalRef);

        if (portalSnapshot.exists()) {
            portalUser = portalSnapshot.val();
        } else if (!isUsernameFormat) {
            // If key lookup failed (maybe key isn't mobile?), scan portal if input is mobile
            const portalRoot = ref(database, 'patient_portal');
            const allPortalUsers = await get(portalRoot);
            if (allPortalUsers.exists()) {
                const allInfo = allPortalUsers.val();
                for (const mobile in allInfo) {
                    const u = allInfo[mobile];
                    if (u.mobile === cleanUsername) {
                        portalUser = u;
                        break;
                    }
                }
            }
        }

        if (portalUser) {
            if (portalUser.password === cleanPassword || portalUser.mobile === cleanPassword) {
                console.log('✅ [PatientLogin] Portal Match Found');
                return NextResponse.json({
                    success: true,
                    patient: {
                        mobile: portalUser.mobile,
                        name: portalUser.name,
                        patientId: `SELF_${portalUser.mobile}`,
                        ownerId: portalUser.linkedLab || null
                    }
                });
            }
        }

        console.warn('❌ [PatientLogin] Invalid credentials or not found');
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    } catch (error: any) {
        console.error('Patient login API error:', error);
        return NextResponse.json({ error: 'Authentication failed', details: error.message }, { status: 500 });
    }
}

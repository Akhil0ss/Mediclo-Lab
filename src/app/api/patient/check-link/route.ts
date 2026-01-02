import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';

export async function POST(request: NextRequest) {
    try {
        const { mobile } = await request.json();

        if (!mobile || mobile.length !== 10) {
            return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
        }

        // Search through all labs' patients
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);

        if (!usersSnapshot.exists()) {
            return NextResponse.json({ found: false });
        }

        const users = usersSnapshot.val();

        // Search through all owners
        for (const ownerId in users) {
            const patientsRef = ref(database, `patients/${ownerId}`);
            const patientsSnapshot = await get(patientsRef);

            if (!patientsSnapshot.exists()) continue;

            const patients = patientsSnapshot.val();

            for (const patientId in patients) {
                const patient = patients[patientId];

                // Check if mobile matches
                if (patient.mobile === mobile) {
                    // Patient found!
                    return NextResponse.json({
                        success: true,
                        found: true,
                        ownerId: ownerId,
                        patientId: patientId,
                        name: patient.name,
                        labName: users[ownerId].labName || "Partner Lab"
                    });
                }
            }
        }

        return NextResponse.json({ found: false });

    } catch (error) {
        console.error('Check link API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

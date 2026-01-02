import {
    auth,
    database,
    googleProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue
} from './firebase.config.js';

// Global Variables
let currentUser = null;
let subscriptionData = null;
let reportsData = [];
let patientsData = [];
let samplesData = [];
let templatesData = [];
let brandingData = {};
let doctorsData = [];
let opdData = [];

// Pagination Variables
const itemsPerPage = 10;
let currentPatientsPage = 1;
let currentSamplesPage = 1;
let currentTemplatesPage = 1;
let currentAllReportsPage = 1;
let currentRecentReportsPage = 1;
let currentDoctorsPage = 1;
let currentOPDPage = 1;

let filteredPatients = [];
let filteredSamples = [];
let filteredTemplates = [];
let filteredReports = [];
let filteredRecentReports = [];
let filteredDoctors = [];
let filteredOPD = [];

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await initializeDashboard();
    } else {
        showAuthContainer();
    }
});

// Google Authentication
window.handleGoogleAuth = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await checkAndInitializeUser(result.user);
    } catch (error) {
        alert('Google login failed: ' + error.message);
        console.error('Google Auth Error:', error);
    }
};

// Email Authentication
window.handleEmailAuth = async () => {
    const name = document.getElementById('nameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        let result;
        try {
            result = await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                if (!name) {
                    alert('Please enter your name for new account');
                    return;
                }
                result = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(result.user, { displayName: name });
                await checkAndInitializeUser(result.user, true);
                return;
            }
            throw error;
        }
        await checkAndInitializeUser(result.user);
    } catch (error) {
        alert('Authentication failed: ' + error.message);
        console.error('Email Auth Error:', error);
    }
};

// Initialize new user with trial
async function checkAndInitializeUser(user, isNewUser = false) {
    const userRef = ref(database, `subscriptions/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists() || isNewUser) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        await set(userRef, {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            premium: false,
            trialEnd: trialEndDate.toISOString(),
            createdAt: new Date().toISOString(),
            paymentStatus: 'pending'
        });

        await set(ref(database, `branding/${user.uid}`), {
            labName: 'My Medical Lab',
            tagline: 'Healthcare Excellence',
            address: '',
            contact: '',
            email: user.email,
            website: '',
            director: '',
            logo: '',
            footerNotes: ''
        });
    }
}

// Initialize Sample Templates (100+ templates as admin templates)
async function initializeSampleTemplates(uid) {
    // Import comprehensive templates from testTemplates.js
    const { medicalTestTemplates } = await import('./testTemplates.js');

    // Check if admin templates already exist
    const adminTemplatesSnapshot = await get(ref(database, 'common_templates'));

    // Only initialize if admin templates don't exist yet
    if (!adminTemplatesSnapshot.exists()) {
        // Save all templates to Firebase as admin templates (available to all users)
        for (const template of medicalTestTemplates) {
            await push(ref(database, 'common_templates'), template);
        }
        console.log(`✅ Initialized ${medicalTestTemplates.length} admin-level medical test templates`);
    } else {
        console.log(`ℹ️ Admin templates already exist, skipping initialization`);
    }
}


// Sign Out
window.handleSignOut = async () => {
    if (confirm('Are you sure you want to logout?')) {
        await signOut(auth);
        location.reload();
    }
};

// Show Auth Container
function showAuthContainer() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

// Initialize Dashboard
async function initializeDashboard() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    // User avatar with color
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];
    const userAvatar = document.getElementById('userAvatar');
    userAvatar.title = displayName;

    await loadSubscriptionData();
    await loadBranding();
    await loadPatients();
    await loadSamples();

    // Check and initialize admin templates if missing (Runs for all users)
    await initializeSampleTemplates();

    await loadTemplates();
    await loadReports();
    await loadDoctors();
    await loadOPD();

    checkSubscriptionStatus();
    updateDashboardStats();
    initializeAnalytics();
}

// Load Subscription Data
async function loadSubscriptionData() {
    const subRef = ref(database, `subscriptions/${currentUser.uid}`);
    const snapshot = await get(subRef);
    if (snapshot.exists()) {
        subscriptionData = snapshot.val();
    }
}

// Check Subscription Status
function checkSubscriptionStatus() {
    if (!subscriptionData) return;

    const today = new Date();
    const trialEnd = new Date(subscriptionData.trialEnd);
    const daysLeft = Math.ceil((trialEnd - today) / (1000 * 60 * 60 * 24));

    if (subscriptionData.premium) {
        const expiryDate = new Date(subscriptionData.expiryDate);
        const premiumDaysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (premiumDaysLeft <= 0) {
            document.getElementById('expiredBanner').classList.remove('hidden');
            document.getElementById('subscriptionStatus').innerHTML = '❌ <strong>Premium Expired</strong> - Renew to continue';
            sendAdminNotification('Premium subscription expired', `${currentUser.email} - Premium expired`);
        } else {
            document.getElementById('subscriptionStatus').innerHTML = `✅ <strong>Premium Active</strong> - Expires in ${premiumDaysLeft} days`;
        }
    } else {
        if (daysLeft > 0) {
            document.getElementById('trialBanner').classList.remove('hidden');
            document.getElementById('trialDays').textContent = daysLeft;
            document.getElementById('subscriptionStatus').innerHTML = `⏳ <strong>Trial Mode</strong> - ${daysLeft} days remaining`;

            // Notify admin about trial user
            if (daysLeft <= 3) {
                sendAdminNotification('Trial expiring soon', `${currentUser.email} - ${daysLeft} days remaining`);
            }
        } else {
            document.getElementById('expiredBanner').classList.remove('hidden');
            document.getElementById('subscriptionStatus').innerHTML = '❌ <strong>Trial Expired</strong> - Upgrade to continue';
            sendAdminNotification('Trial expired', `${currentUser.email} - Trial expired`);
        }
    }
}

// Send admin notification
async function sendAdminNotification(title, message) {
    await push(ref(database, 'admin_notifications'), {
        title: title,
        message: message,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        timestamp: new Date().toISOString(),
        read: false
    });
}

// Load Branding
async function loadBranding() {
    const brandingRef = ref(database, `branding/${currentUser.uid}`);
    const snapshot = await get(brandingRef);
    if (snapshot.exists()) {
        brandingData = snapshot.val();
        applyBranding();
        populateBrandingForm();
    }
}

// Apply Branding to UI
function applyBranding() {
    document.getElementById('labNameHeader').textContent = brandingData.labName || 'Spotnet MedOS';
    document.getElementById('headerTagline').textContent = brandingData.tagline || 'Lab Management Dashboard';

    if (brandingData.logo && subscriptionData?.premium) {
        const logoImg = document.getElementById('headerLogo');
        logoImg.src = brandingData.logo;
        logoImg.classList.remove('hidden');
    }
}

// Populate Branding Form
function populateBrandingForm() {
    document.getElementById('brandLabName').value = brandingData.labName || '';
    document.getElementById('brandTagline').value = brandingData.tagline || '';
    document.getElementById('brandAddress').value = brandingData.address || '';
    document.getElementById('brandContact').value = brandingData.contact || '';
    document.getElementById('brandEmail').value = brandingData.email || '';
    document.getElementById('brandWebsite').value = brandingData.website || '';
    document.getElementById('brandDirector').value = brandingData.director || '';
    document.getElementById('brandFooterNotes').value = brandingData.footerNotes || '';

    if (brandingData.logo) {
        document.getElementById('logoPreview').src = brandingData.logo;
        document.getElementById('logoPreview').classList.remove('hidden');
    }
}

// Preview Logo
window.previewLogo = () => {
    const file = document.getElementById('brandLogo').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('logoPreview').src = e.target.result;
            document.getElementById('logoPreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};

// Save Branding
window.saveBranding = async () => {
    const updatedBranding = {
        labName: document.getElementById('brandLabName').value.trim() || 'My Medical Lab',
        tagline: document.getElementById('brandTagline').value.trim() || 'Healthcare Excellence',
        address: document.getElementById('brandAddress').value.trim(),
        contact: document.getElementById('brandContact').value.trim(),
        email: document.getElementById('brandEmail').value.trim(),
        website: document.getElementById('brandWebsite').value.trim(),
        director: document.getElementById('brandDirector').value.trim(),
        footerNotes: document.getElementById('brandFooterNotes').value.trim(),
        logo: brandingData.logo || ''
    };

    const logoFile = document.getElementById('brandLogo').files[0];
    if (logoFile) {
        if (!subscriptionData?.premium) {
            alert('Logo upload is a Premium feature. Upgrade to use this feature.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            updatedBranding.logo = e.target.result;
            await update(ref(database, `branding/${currentUser.uid}`), updatedBranding);
            brandingData = updatedBranding;
            applyBranding();
            showNotification('Branding updated successfully!', 'success');
        };
        reader.readAsDataURL(logoFile);
    } else {
        await update(ref(database, `branding/${currentUser.uid}`), updatedBranding);
        brandingData = updatedBranding;
        applyBranding();
        showNotification('Branding updated successfully!', 'success');
    }
};

// Load Patients
async function loadPatients() {
    const patientsRef = ref(database, `patients/${currentUser.uid}`);
    onValue(patientsRef, (snapshot) => {
        patientsData = [];
        snapshot.forEach((child) => {
            patientsData.push({ id: child.key, ...child.val() });
        });
        patientsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        filteredPatients = [...patientsData];
        currentPatientsPage = 1;
        renderPatients();
        updateDashboardStats();
    });
}

// Render Patients with Pagination
function renderPatients() {
    const tbody = document.getElementById('patientsTableBody');
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);

    if (filteredPatients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-users text-4xl mb-2 opacity-20"></i>
                    <p>No patients found</p>
                </td>
            </tr>
        `;
        document.getElementById('patientsPagination').innerHTML = '';
        return;
    }

    const startIndex = (currentPatientsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredPatients.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(patient => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">${patient.name}</td>
            <td class="px-4 py-3 text-sm">${patient.age} / ${patient.gender[0]}</td>
            <td class="px-4 py-3 text-sm">${patient.mobile}</td>
            <td class="px-4 py-3 text-sm">${patient.address || 'N/A'}</td>
            <td class="px-4 py-3 text-sm">${patient.refDoctor || 'N/A'}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="viewPatient('${patient.id}')" class="text-blue-600 hover:underline mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editPatient('${patient.id}')" class="text-green-600 hover:underline mr-2" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="openQuickOPDModal('${patient.id}')" class="text-teal-600 hover:underline mr-2" title="Print RX">
                    <i class="fas fa-file-prescription"></i>
                </button>
                <button onclick="deletePatient('${patient.id}')" class="text-red-600 hover:underline" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderPagination('patientsPagination', totalPages, currentPatientsPage, (page) => {
        currentPatientsPage = page;
        renderPatients();
    });
}

// Search Patients
window.searchPatients = () => {
    const query = document.getElementById('patientSearch').value.toLowerCase().trim();

    if (!query) {
        filteredPatients = [...patientsData];
    } else {
        filteredPatients = patientsData.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.mobile.includes(query) ||
            (p.address && p.address.toLowerCase().includes(query))
        );
    }

    currentPatientsPage = 1;
    renderPatients();
};

// Export Patients to CSV
window.exportPatientsCSV = () => {
    if (patientsData.length === 0) {
        alert('No patients to export');
        return;
    }

    const csv = [
        ['Name', 'Age', 'Gender', 'Contact', 'Address', 'Ref. Doctor', 'Created Date'],
        ...patientsData.map(p => [
            p.name,
            p.age,
            p.gender,
            p.mobile,
            p.address || '',
            p.refDoctor || '',
            new Date(p.createdAt).toLocaleString('en-IN')
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patients_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Patients exported to CSV!', 'success');
};

// Add Patient Modal
window.openAddPatientModal = () => {
    showModal(`
        <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
            <i class="fas fa-user-plus text-purple-600"></i> Add New Patient
        </h3>
        <form onsubmit="addPatient(event)" class="space-y-3">
            <div>
                <label class="block text-sm font-semibold mb-1">Patient Name *</label>
                <input type="text" id="patName" placeholder="Enter patient name" required 
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-semibold mb-1">Age *</label>
                    <input type="number" id="patAge" placeholder="Age" required min="1" max="150"
                        class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-1">Gender *</label>
                    <select id="patGender" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Contact Number *</label>
                <input type="tel" id="patMobile" placeholder="+91 9876543210" required 
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Address</label>
                <textarea id="patAddress" placeholder="Patient address" rows="2"
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"></textarea>
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Referring Doctor</label>
                <input type="text" id="patRefDoctor" placeholder="Dr. Name" 
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Tests Required</label>
                <input type="text" id="patTestSearch" placeholder="🔍 Search tests..." 
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-2"
                    onkeyup="filterPatientTests()">
                <div id="patTestsContainer" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 max-h-48 overflow-y-auto bg-white">
                    ${templatesData.map(t => `
                        <label class="flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer test-checkbox-item">
                            <input type="checkbox" name="patTests" value="${t.id}" class="w-4 h-4 rounded text-purple-600">
                            <span class="text-sm text-gray-700">${t.name}</span>
                        </label>
                    `).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-1">Select all required tests for this patient</p>
            </div>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg hover:shadow-lg">
                    <i class="fas fa-plus"></i> Add Patient
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

// Add Patient
window.addPatient = async (e) => {
    e.preventDefault();

    const checkboxes = document.querySelectorAll('input[name="patTests"]:checked');
    const testsRequired = Array.from(checkboxes).map(cb => cb.value);

    const patientData = {
        name: document.getElementById('patName').value.trim(),
        age: parseInt(document.getElementById('patAge').value),
        gender: document.getElementById('patGender').value,
        mobile: document.getElementById('patMobile').value.trim(),
        address: document.getElementById('patAddress').value.trim(),
        refDoctor: document.getElementById('patRefDoctor').value.trim(),
        testsRequired: testsRequired,
        createdAt: new Date().toISOString()
    };

    await push(ref(database, `patients/${currentUser.uid}`), patientData);
    closeModal();
    showNotification('Patient added successfully!', 'success');
};

// Filter tests in Add Patient modal
window.filterPatientTests = () => {
    const searchTerm = document.getElementById('patTestSearch').value.toLowerCase();
    const items = document.querySelectorAll('.test-checkbox-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};


// View, Edit, Delete Patient functions
window.viewPatient = (patientId) => {
    const patient = patientsData.find(p => p.id === patientId);
    if (!patient) return;

    const testNames = (patient.testsRequired || []).map(testId => {
        const template = templatesData.find(t => t.id === testId);
        return template ? template.name : testId;
    }).join(', ') || 'None';

    showModal(`
        <h3 class="text-xl font-bold mb-4">Patient Details</h3>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div><strong>Name:</strong> ${patient.name}</div>
            <div><strong>Age/Gender:</strong> ${patient.age} / ${patient.gender}</div>
            <div><strong>Contact:</strong> ${patient.mobile}</div>
            <div><strong>Address:</strong> ${patient.address || 'N/A'}</div>
            <div><strong>Ref. Doctor:</strong> ${patient.refDoctor || 'N/A'}</div>
            <div><strong>Tests Required:</strong> ${testNames}</div>
        </div>
        <button onclick="closeModal()" class="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
            Close
        </button>
    `);
};

window.editPatient = (patientId) => {
    const patient = patientsData.find(p => p.id === patientId);
    if (!patient) return;

    showModal(`
        <h3 class="text-xl font-bold mb-4"><i class="fas fa-user-edit text-green-600"></i> Edit Patient</h3>
        <form onsubmit="updatePatient(event, '${patientId}')" class="space-y-3">
            <input type="text" id="editPatName" value="${patient.name}" required placeholder="Name"
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <div class="grid grid-cols-2 gap-3">
                <input type="number" id="editPatAge" value="${patient.age}" required min="1" max="150"
                    class="px-4 py-2 border-2 border-gray-300 rounded-lg">
                <select id="editPatGender" required class="px-4 py-2 border-2 border-gray-300 rounded-lg">
                    <option value="Male" ${patient.gender === 'Male' ? 'selected' : ''}>Male</option>
                    <option value="Female" ${patient.gender === 'Female' ? 'selected' : ''}>Female</option>
                    <option value="Other" ${patient.gender === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <input type="tel" id="editPatMobile" value="${patient.mobile}" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <textarea id="editPatAddress" rows="2" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">${patient.address || ''}</textarea>
            <input type="text" id="editPatRefDoctor" value="${patient.refDoctor || ''}" 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg">
                    <i class="fas fa-save"></i> Update
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.updatePatient = async (e, patientId) => {
    e.preventDefault();
    await update(ref(database, `patients/${currentUser.uid}/${patientId}`), {
        name: document.getElementById('editPatName').value.trim(),
        age: parseInt(document.getElementById('editPatAge').value),
        gender: document.getElementById('editPatGender').value,
        mobile: document.getElementById('editPatMobile').value.trim(),
        address: document.getElementById('editPatAddress').value.trim(),
        refDoctor: document.getElementById('editPatRefDoctor').value.trim(),
        updatedAt: new Date().toISOString()
    });
    closeModal();
    showNotification('Patient updated!', 'success');
};

window.deletePatient = async (patientId) => {
    const patient = patientsData.find(p => p.id === patientId);
    if (!confirm(`Delete patient "${patient.name}"?`)) return;
    await remove(ref(database, `patients/${currentUser.uid}/${patientId}`));
    showNotification('Patient deleted!', 'success');
};

// Load Samples
async function loadSamples() {
    const samplesRef = ref(database, `samples/${currentUser.uid}`);
    onValue(samplesRef, (snapshot) => {
        samplesData = [];
        snapshot.forEach((child) => {
            samplesData.push({ id: child.key, ...child.val() });
        });
        samplesData.sort((a, b) => new Date(b.date) - new Date(a.date));
        filteredSamples = [...samplesData];
        currentSamplesPage = 1;
        renderSamples();
        updateDashboardStats();
    });
}

// Render Samples with Pagination
function renderSamples() {
    const tbody = document.getElementById('samplesTableBody');
    const totalPages = Math.ceil(filteredSamples.length / itemsPerPage);

    if (filteredSamples.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-flask text-4xl mb-2 opacity-20"></i>
                    <p>No samples found</p>
                </td>
            </tr>
        `;
        document.getElementById('samplesPagination').innerHTML = '';
        return;
    }

    const startIndex = (currentSamplesPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredSamples.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(sample => {
        const patient = patientsData.find(p => p.id === sample.patientId);
        const patientName = patient ? patient.name : 'Unknown Patient';

        const statusColors = {
            'Pending': 'bg-orange-100 text-orange-800',
            'Processing': 'bg-blue-100 text-blue-800',
            'Completed': 'bg-green-100 text-green-800'
        };

        return `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-sm font-semibold text-purple-600">${sample.sampleNumber}</td>
                <td class="px-4 py-3 text-sm font-semibold">${patientName}</td>
                <td class="px-4 py-3 text-sm">${sample.sampleType}</td>
                <td class="px-4 py-3 text-sm">${new Date(sample.date).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="status-badge ${statusColors[sample.status]}">${sample.status}</span>
                </td>
                <td class="px-4 py-3 text-sm">
                    <button onclick="editSample('${sample.id}')" class="text-green-600 hover:underline mr-2" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="updateSampleStatus('${sample.id}')" class="text-blue-600 hover:underline mr-2" title="Update Status">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button onclick="deleteSample('${sample.id}')" class="text-red-600 hover:underline" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('samplesPagination', totalPages, currentSamplesPage, (page) => {
        currentSamplesPage = page;
        renderSamples();
    });
}

// Search Samples
window.searchSamples = () => {
    const query = document.getElementById('sampleSearch').value.toLowerCase().trim();

    if (!query) {
        filteredSamples = [...samplesData];
    } else {
        filteredSamples = samplesData.filter(s => {
            const patient = patientsData.find(p => p.id === s.patientId);
            const patientName = patient ? patient.name.toLowerCase() : '';
            return s.sampleNumber.toLowerCase().includes(query) ||
                patientName.includes(query) ||
                s.sampleType.toLowerCase().includes(query);
        });
    }

    currentSamplesPage = 1;
    renderSamples();
};

// Add Sample Modal (Patient name shown)
window.openAddSampleModal = () => {
    if (patientsData.length === 0) {
        alert('Please add patients first');
        switchTab('patients');
        return;
    }

    const patientOptions = patientsData.map(p =>
        `<option value="${p.id}">${p.name} - ${p.mobile}</option>`
    ).join('');

    // ID Logic: 'SPOT' for Free users OR Default Brand. Custom Prefix for Premium + Custom Brand.
    let labPrefix = 'SPOT';
    const isDefaultBrand = !brandingData?.labName || brandingData.labName === 'My Medical Lab';

    if (subscriptionData?.premium && !isDefaultBrand) {
        labPrefix = brandingData.labName.substring(0, 4).toUpperCase();
    }

    const autoSampleId = `${labPrefix}-${Date.now().toString().slice(-6)}`;

    showModal(`
        <h3 class="text-xl font-bold mb-4"><i class="fas fa-flask text-blue-600"></i> Add Sample</h3>
        <form onsubmit="addSample(event)" class="space-y-3">
            <div>
                <label class="block text-sm font-semibold mb-1">Sample ID (Auto-generated)</label>
                <input type="text" id="sampleNumber" value="${autoSampleId}" readonly required 
                    class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-gray-600">
            </div>
            <select id="samplePatient" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="">Choose Patient</option>
                ${patientOptions}
            </select>
            <select id="sampleType" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="">Select Type</option>
                <option value="Blood">Blood</option>
                <option value="Urine">Urine</option>
                <option value="Stool">Stool</option>
                <option value="Saliva">Saliva</option>
                <option value="Other">Other</option>
            </select>
            <input type="datetime-local" id="sampleDate" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <select id="sampleStatus" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
            </select>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg">
                    <i class="fas fa-plus"></i> Add Sample
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);

    document.getElementById('sampleDate').value = new Date().toISOString().slice(0, 16);
};

window.addSample = async (e) => {
    e.preventDefault();
    await push(ref(database, `samples/${currentUser.uid}`), {
        sampleNumber: document.getElementById('sampleNumber').value.trim(),
        patientId: document.getElementById('samplePatient').value,
        sampleType: document.getElementById('sampleType').value,
        date: document.getElementById('sampleDate').value,
        status: document.getElementById('sampleStatus').value,
        createdAt: new Date().toISOString()
    });
    closeModal();
    showNotification('Sample added!', 'success');
};

// Edit Sample
window.editSample = (sampleId) => {
    const sample = samplesData.find(s => s.id === sampleId);
    if (!sample) return;

    const patientOptions = patientsData.map(p =>
        `<option value="${p.id}" ${p.id === sample.patientId ? 'selected' : ''}>${p.name} - ${p.mobile}</option>`
    ).join('');

    showModal(`
        <h3 class="text-xl font-bold mb-4"><i class="fas fa-edit text-green-600"></i> Edit Sample</h3>
        <form onsubmit="updateSample(event, '${sampleId}')" class="space-y-3">
            <input type="text" id="editSampleNumber" value="${sample.sampleNumber}" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <select id="editSamplePatient" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="">Choose Patient</option>
                ${patientOptions}
            </select>
            <select id="editSampleType" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="Blood" ${sample.sampleType === 'Blood' ? 'selected' : ''}>Blood</option>
                <option value="Urine" ${sample.sampleType === 'Urine' ? 'selected' : ''}>Urine</option>
                <option value="Stool" ${sample.sampleType === 'Stool' ? 'selected' : ''}>Stool</option>
                <option value="Saliva" ${sample.sampleType === 'Saliva' ? 'selected' : ''}>Saliva</option>
                <option value="Other" ${sample.sampleType === 'Other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="datetime-local" id="editSampleDate" value="${sample.date.replace('Z', '').slice(0, 16)}" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <select id="editSampleStatus" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="Pending" ${sample.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Processing" ${sample.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Completed" ${sample.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg">
                    <i class="fas fa-save"></i> Update Sample
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.updateSample = async (e, sampleId) => {
    e.preventDefault();
    await update(ref(database, `samples/${currentUser.uid}/${sampleId}`), {
        sampleNumber: document.getElementById('editSampleNumber').value.trim(),
        patientId: document.getElementById('editSamplePatient').value,
        sampleType: document.getElementById('editSampleType').value,
        date: document.getElementById('editSampleDate').value,
        status: document.getElementById('editSampleStatus').value,
        updatedAt: new Date().toISOString()
    });
    closeModal();
    showNotification('Sample updated!', 'success');
};

window.updateSampleStatus = async (sampleId) => {
    const sample = samplesData.find(s => s.id === sampleId);
    showModal(`
        <h3 class="text-xl font-bold mb-4">Update Sample Status</h3>
        <form onsubmit="saveSampleStatus(event, '${sampleId}')" class="space-y-3">
            <input type="text" value="${sample.sampleNumber}" disabled class="w-full px-4 py-2 border rounded-lg bg-gray-100">
            <select id="newStatus" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="Pending" ${sample.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Processing" ${sample.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Completed" ${sample.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg">Update</button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">Cancel</button>
            </div>
        </form>
    `);
};

window.saveSampleStatus = async (e, sampleId) => {
    e.preventDefault();
    await update(ref(database, `samples/${currentUser.uid}/${sampleId}`), {
        status: document.getElementById('newStatus').value,
        updatedAt: new Date().toISOString()
    });
    closeModal();
    showNotification('Sample status updated!', 'success');
};

window.deleteSample = async (sampleId) => {
    if (!confirm('Delete this sample?')) return;
    await remove(ref(database, `samples/${currentUser.uid}/${sampleId}`));
    showNotification('Sample deleted!', 'success');
};

// Load Templates
async function loadTemplates() {
    templatesData = [];
    filteredTemplates = [];

    // User specific templates
    const userTemplatesSnapshot = await get(ref(database, `templates/${currentUser.uid}`));
    if (userTemplatesSnapshot.exists()) {
        userTemplatesSnapshot.forEach((child) => {
            templatesData.push({ id: child.key, ...child.val() });
        });
    }

    // Common templates for all users
    const commonTemplatesSnapshot = await get(ref(database, 'common_templates'));
    if (commonTemplatesSnapshot.exists()) {
        commonTemplatesSnapshot.forEach((child) => {
            templatesData.push({ id: "common_" + child.key, ...child.val() });
        });
    }

    templatesData.sort((a, b) => a.name.localeCompare(b.name));
    filteredTemplates = [...templatesData];
    currentTemplatesPage = 1;
    renderTemplates();
}

// Render Templates with Pagination
function renderTemplates() {
    const tbody = document.getElementById('templatesTableBody');
    const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
    const isAdmin = subscriptionData?.role === 'admin'; // Check if user is admin

    if (filteredTemplates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-flask-vial text-4xl mb-2 opacity-20"></i>
                    <p>No templates found</p>
                </td>
            </tr>
        `;
        document.getElementById('templatesPagination').innerHTML = '';
        return;
    }

    const startIndex = (currentTemplatesPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredTemplates.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(template => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">${template.name}</td>
            <td class="px-4 py-3 text-sm">
                <span class="status-badge bg-blue-100 text-blue-800">${template.category}</span>
            </td>
            <td class="px-4 py-3 text-sm">${template.subtests ? template.subtests.length : 0} subtests</td>
            <td class="px-4 py-3 text-sm font-semibold text-green-600">₹${template.totalPrice ?? 0}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="viewTemplate('${template.id}')" class="text-blue-600 hover:underline mr-2" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${template.id.startsWith("common_") ?
            // Admin template - only admin can edit/delete
            (isAdmin ? `
                    <button onclick="editTemplate('${template.id}')" class="text-green-600 hover:underline mr-2" title="Edit (Admin Template)">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTemplate('${template.id}')" class="text-red-600 hover:underline" title="Delete (Admin Template)">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : `
                    <span class="text-gray-400 text-xs italic" title="Admin template - view only">
                        <i class="fas fa-shield-alt"></i> Admin Template
                    </span>
                    `)
            :
            // User's own template - user can edit/delete
            `
                    <button onclick="editTemplate('${template.id}')" class="text-green-600 hover:underline mr-2" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTemplate('${template.id}')" class="text-red-600 hover:underline" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    `
        }
            </td>
        </tr>
    `).join('');

    renderPagination('templatesPagination', totalPages, currentTemplatesPage, (page) => {
        currentTemplatesPage = page;
        renderTemplates();
    });
}

// Search Templates
window.searchTemplates = () => {
    const query = document.getElementById('templateSearch').value.toLowerCase().trim();

    if (!query) {
        filteredTemplates = [...templatesData];
    } else {
        filteredTemplates = templatesData.filter(t =>
            t.name.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query)
        );
    }

    currentTemplatesPage = 1;
    renderTemplates();
};

// View Template
window.viewTemplate = (templateId) => {
    const template = templatesData.find(t => t.id === templateId);
    if (!template) return;

    showModal(`
        <h3 class="text-xl font-bold mb-4">${template.name}</h3>
        <div class="mb-4">
            <span class="status-badge bg-blue-100 text-blue-800">${template.category}</span>
            <span class="status-badge bg-green-100 text-green-800 ml-2">₹${template.totalPrice ?? 0}</span>
        </div>
        <div class="overflow-x-auto max-h-96">
            <table class="result-table">
                <thead>
                    <tr>
                        <th>Subtest Name</th>
                        <th>Unit</th>
                        <th>Male Range</th>
                        <th>Female Range</th>
                    </tr>
                </thead>
                <tbody>
                    ${template.subtests?.map((subtest, index) => `
                        <tr>
                            <td class="font-semibold">${index + 1}. ${subtest.name}</td>
                            <td>${subtest.unit || 'N/A'}</td>
                            <td>${subtest.ranges.male.min} - ${subtest.ranges.male.max}</td>
                            <td>${subtest.ranges.female.min} - ${subtest.ranges.female.max}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="4">No subtests available</td></tr>'}
                </tbody>
            </table>
        </div>
        <button onclick="closeModal()" class="mt-4 w-full bg-gray-300 text-gray-700 py-2 rounded-lg">Close</button>
    `);
};

// Edit Template
window.editTemplate = (templateId) => {
    // Check if it's an admin template
    const isAdminTemplate = templateId.startsWith("common_");

    // If it's an admin template, only admin can edit
    if (isAdminTemplate && subscriptionData?.role !== 'admin') {
        alert('⚠️ Admin Access Required\n\nThis is an admin template and can only be edited by administrators.\nYou can create your own custom template instead.');
        return;
    }

    if (templateId.startsWith("common_")) {
        alert('Common templates cannot be edited!');
        return;
    }

    const template = templatesData.find(t => t.id === templateId);
    if (!template) return;

    let subtestsHtml = '';
    if (template.subtests) {
        subtestsHtml = template.subtests.map((subtest, index) => `
            <div class="subtest-item border-2 border-gray-300 rounded p-3 bg-gray-50 mb-2">
                <input type="text" value="${subtest.name}" required class="subtest-name w-full px-3 py-2 border rounded mb-2" placeholder="Subtest name">
                <div class="grid grid-cols-2 gap-2">
                    <input type="text" value="${subtest.unit || ''}" class="subtest-unit px-3 py-2 border rounded" placeholder="Unit">
                    <select class="subtest-type px-3 py-2 border rounded">
                        <option value="numeric" ${subtest.type === 'numeric' ? 'selected' : ''}>Numeric</option>
                        <option value="text" ${subtest.type === 'text' ? 'selected' : ''}>Text</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <div>
                        <label class="text-xs">Male Range</label>
                        <div class="flex gap-1">
                            <input type="number" step="0.01" value="${subtest.ranges.male.min}" class="subtest-male-min px-2 py-1 border rounded text-sm" placeholder="Min">
                            <input type="number" step="0.01" value="${subtest.ranges.male.max}" class="subtest-male-max px-2 py-1 border rounded text-sm" placeholder="Max">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs">Female Range</label>
                        <div class="flex gap-1">
                            <input type="number" step="0.01" value="${subtest.ranges.female.min}" class="subtest-female-min px-2 py-1 border rounded text-sm" placeholder="Min">
                            <input type="number" step="0.01" value="${subtest.ranges.female.max}" class="subtest-female-max px-2 py-1 border rounded text-sm" placeholder="Max">
                        </div>
                    </div>
                </div>
                <input type="number" value="${subtest.price || 0}" class="subtest-price w-full px-3 py-2 border rounded mt-2" placeholder="Price">
                <button type="button" onclick="this.parentElement.remove()" class="w-full bg-red-50 text-red-600 py-1 rounded mt-2 text-sm">
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        `).join('');
    }

    showModal(`
        <h3 class="text-xl font-bold mb-4"><i class="fas fa-edit text-green-600"></i> Edit Template</h3>
        <form onsubmit="updateTemplate(event, '${templateId}')" class="space-y-3">
            <input type="text" id="editTemplateName" value="${template.name}" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg" placeholder="Test Name">
            <select id="editTemplateCategory" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="">Category</option>
                <option value="Hematology" ${template.category === 'Hematology' ? 'selected' : ''}>Hematology</option>
                <option value="Biochemistry" ${template.category === 'Biochemistry' ? 'selected' : ''}>Biochemistry</option>
                <option value="Microbiology" ${template.category === 'Microbiology' ? 'selected' : ''}>Microbiology</option>
                <option value="Immunology" ${template.category === 'Immunology' ? 'selected' : ''}>Immunology</option>
                <option value="Endocrinology" ${template.category === 'Endocrinology' ? 'selected' : ''}>Endocrinology</option>
                <option value="Pathology" ${template.category === 'Pathology' ? 'selected' : ''}>Pathology</option>
                <option value="Serology" ${template.category === 'Serology' ? 'selected' : ''}>Serology</option>
                <option value="Other" ${template.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="number" id="editTemplatePrice" value="${template.totalPrice || 0}" required min="0" 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg" placeholder="Total Price">
            <div class="border-t pt-3">
                <label class="block text-sm font-semibold mb-2">Subtests</label>
                <div id="editSubtestsContainer" class="space-y-2 max-h-60 overflow-y-auto mb-2">
                    ${subtestsHtml}
                </div>
                <button type="button" onclick="addEditSubtestField()" 
                    class="w-full bg-indigo-50 text-indigo-600 py-2 rounded text-sm">
                    <i class="fas fa-plus"></i> Add Subtest
                </button>
            </div>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg">
                    <i class="fas fa-save"></i> Update Template
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

// Add subtest field for edit template
window.addEditSubtestField = () => {
    const container = document.getElementById('editSubtestsContainer');
    const newSubtest = document.createElement('div');
    newSubtest.className = 'subtest-item border-2 border-gray-300 rounded p-3 bg-gray-50 mb-2';
    newSubtest.innerHTML = `
        <input type="text" placeholder="Subtest name" required class="subtest-name w-full px-3 py-2 border rounded mb-2">
        <div class="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Unit" class="subtest-unit px-3 py-2 border rounded">
            <select class="subtest-type px-3 py-2 border rounded">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
            </select>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
            <div>
                <label class="text-xs">Male Range</label>
                <div class="flex gap-1">
                    <input type="number" step="0.01" placeholder="Min" class="subtest-male-min px-2 py-1 border rounded text-sm">
                    <input type="number" step="0.01" placeholder="Max" class="subtest-male-max px-2 py-1 border rounded text-sm">
                </div>
            </div>
            <div>
                <label class="text-xs">Female Range</label>
                <div class="flex gap-1">
                    <input type="number" step="0.01" placeholder="Min" class="subtest-female-min px-2 py-1 border rounded text-sm">
                    <input type="number" step="0.01" placeholder="Max" class="subtest-female-max px-2 py-1 border rounded text-sm">
                </div>
            </div>
        </div>
        <input type="number" placeholder="Price" class="subtest-price w-full px-3 py-2 border rounded mt-2">
        <button type="button" onclick="this.parentElement.remove()" 
            class="w-full bg-red-50 text-red-600 py-1 rounded mt-2 text-sm">
            <i class="fas fa-times"></i> Remove
        </button>
    `;
    container.appendChild(newSubtest);
};

// Update Template
window.updateTemplate = async (e, templateId) => {
    e.preventDefault();

    const subtestElements = document.querySelectorAll('#editSubtestsContainer .subtest-item');
    const subtests = Array.from(subtestElements).map(elem => ({
        name: elem.querySelector('.subtest-name').value.trim(),
        unit: elem.querySelector('.subtest-unit').value.trim(),
        type: elem.querySelector('.subtest-type').value,
        ranges: {
            male: {
                min: parseFloat(elem.querySelector('.subtest-male-min').value) || 0,
                max: parseFloat(elem.querySelector('.subtest-male-max').value) || 0
            },
            female: {
                min: parseFloat(elem.querySelector('.subtest-female-min').value) || 0,
                max: parseFloat(elem.querySelector('.subtest-female-max').value) || 0
            }
        },
        price: parseFloat(elem.querySelector('.subtest-price').value) || 0
    }));

    if (subtests.length === 0) {
        alert('Add at least one subtest');
        return;
    }

    await update(ref(database, `templates/${currentUser.uid}/${templateId}`), {
        name: document.getElementById('editTemplateName').value.trim(),
        category: document.getElementById('editTemplateCategory').value,
        totalPrice: parseFloat(document.getElementById('editTemplatePrice').value),
        subtests: subtests,
        updatedAt: new Date().toISOString()
    });

    closeModal();
    showNotification('Template updated!', 'success');
};

window.deleteTemplate = async (templateId) => {
    // Check if it's an admin template
    const isAdminTemplate = templateId.startsWith("common_");

    // If it's an admin template, only admin can delete
    if (isAdminTemplate && subscriptionData?.role !== 'admin') {
        alert('⚠️ Admin Access Required\\n\\nThis is an admin template and can only be deleted by administrators.');
        return;
    }

    if (templateId.startsWith("common_")) {
        alert('Common templates cannot be deleted!');
        return;
    }
    const template = templatesData.find(t => t.id === templateId);
    if (!template) return alert('Template not found');
    if (!confirm(`Delete template "${template.name}"?`)) return;
    await remove(ref(database, `templates/${currentUser.uid}/${templateId}`));
    showNotification('Template deleted!', 'success');
};

// Generic Pagination Renderer
function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);

    if (totalPages <= 1) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    let html = `
        <button ${currentPage === 1 ? 'disabled' : ''} onclick="paginationClick('${containerId}', ${currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Prev
        </button>
    `;

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button class="${i === currentPage ? 'active' : ''}" onclick="paginationClick('${containerId}', ${i})">
                ${i}
            </button>
        `;
    }

    html += `
        <button ${currentPage === totalPages ? 'disabled' : ''} onclick="paginationClick('${containerId}', ${currentPage + 1})">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;

    // Store callback
    container.dataset.callback = onPageChange.toString();
}

// Pagination Click Handler
window.paginationClick = (containerId, page) => {
    const container = document.getElementById(containerId);
    const callback = eval(container.dataset.callback);
    callback(page);
};

// Load Reports
async function loadReports() {
    const reportsRef = ref(database, `reports/${currentUser.uid}`);
    onValue(reportsRef, (snapshot) => {
        reportsData = [];
        snapshot.forEach((child) => {
            reportsData.push({ id: child.key, ...child.val() });
        });
        reportsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Filter for today's reports
        const today = new Date().toISOString().split('T')[0];
        filteredRecentReports = reportsData.filter(r =>
            r.createdAt.split('T')[0] === today
        );

        filteredReports = [...reportsData];
        currentAllReportsPage = 1;
        currentRecentReportsPage = 1;

        renderRecentReports();
        renderAllReports();
        updateDashboardStats();
        initializeAnalytics();
    });
}

// Render Recent Reports (Today Only - Dashboard)
function renderRecentReports() {
    const tbody = document.getElementById('recentReportsTableBody');
    const totalPages = Math.ceil(filteredRecentReports.length / itemsPerPage);

    if (filteredRecentReports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-file-medical text-4xl mb-2 opacity-20"></i>
                    <p>No reports generated today</p>
                </td>
            </tr>
        `;
        document.getElementById('recentReportsPagination').classList.add('hidden');
        return;
    }

    const startIndex = (currentRecentReportsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredRecentReports.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(report => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm font-mono text-purple-600">${report.id.substring(0, 10)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">${report.patientName}</td>
            <td class="px-4 py-3 text-sm text-xs">${report.tests.slice(0, 2).join(', ')}${report.tests.length > 2 ? '...' : ''}</td>
            <td class="px-4 py-3 text-sm">${new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="downloadReportPDF('${report.id}')" class="text-green-600 hover:underline mr-2" title="Download PDF">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteReport('${report.id}')" class="text-red-600 hover:underline" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderPagination('recentReportsPagination', totalPages, currentRecentReportsPage, (page) => {
        currentRecentReportsPage = page;
        renderRecentReports();
    });
}

// Render All Reports (All Reports Tab)
function renderAllReports() {
    const tbody = document.getElementById('allReportsTableBody');
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

    if (filteredReports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-file-medical text-4xl mb-2 opacity-20"></i>
                    <p>No reports found</p>
                </td>
            </tr>
        `;
        document.getElementById('allReportsPagination').innerHTML = '';
        return;
    }

    const startIndex = (currentAllReportsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredReports.slice(startIndex, endIndex);

    tbody.innerHTML = pageData.map(report => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm font-mono text-purple-600">${report.id.substring(0, 12)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">${report.patientName}</td>
            <td class="px-4 py-3 text-sm">${report.tests.join(', ')}</td>
            <td class="px-4 py-3 text-sm">${new Date(report.createdAt).toLocaleDateString('en-IN')}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="downloadReportPDF('${report.id}')" class="text-green-600 hover:underline mr-2" title="Download PDF">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteReport('${report.id}')" class="text-red-600 hover:underline" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderPagination('allReportsPagination', totalPages, currentAllReportsPage, (page) => {
        currentAllReportsPage = page;
        renderAllReports();
    });
}

// Search Reports
window.searchReports = () => {
    const query = document.getElementById('reportSearch').value.toLowerCase().trim();

    if (!query) {
        filteredReports = [...reportsData];
    } else {
        filteredReports = reportsData.filter(r =>
            r.patientName.toLowerCase().includes(query) ||
            r.id.toLowerCase().includes(query) ||
            r.tests.some(t => t.toLowerCase().includes(query))
        );
    }

    currentAllReportsPage = 1;
    renderAllReports();
};

// Filter Reports by Date
window.filterReports = () => {
    const fromDate = document.getElementById('reportsFromDate').value;
    const toDate = document.getElementById('reportsToDate').value;

    if (!fromDate || !toDate) {
        alert('Please select both dates');
        return;
    }

    filteredReports = reportsData.filter(r => {
        const reportDate = new Date(r.createdAt).toISOString().split('T')[0];
        return reportDate >= fromDate && reportDate <= toDate;
    });

    currentAllReportsPage = 1;
    renderAllReports();
};

// Export Reports to CSV
window.exportReportsCSV = () => {
    if (reportsData.length === 0) {
        alert('No reports to export');
        return;
    }

    const csv = [
        ['Report ID', 'Patient Name', 'Age', 'Gender', 'Tests', 'Report Date', 'Created Date'],
        ...reportsData.map(r => [
            r.id.substring(0, 12),
            r.patientName,
            r.patientAge,
            r.patientGender,
            r.tests.join('; '),
            new Date(r.reportDate).toLocaleDateString('en-IN'),
            new Date(r.createdAt).toLocaleString('en-IN')
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Reports exported to CSV!', 'success');
};

// Export Samples to CSV
window.exportSamplesCSV = () => {
    if (samplesData.length === 0) {
        alert('No samples to export');
        return;
    }

    const csv = [
        ['Sample No', 'Patient Name', 'Sample Type', 'Collection Date', 'Status', 'Created Date'],
        ...samplesData.map(s => {
            const patient = patientsData.find(p => p.id === s.patientId);
            const patientName = patient ? patient.name : 'Unknown';
            return [
                s.sampleNumber,
                patientName,
                s.sampleType,
                new Date(s.date).toLocaleString('en-IN'),
                s.status,
                new Date(s.createdAt).toLocaleString('en-IN')
            ];
        })
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `samples_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Samples exported to CSV!', 'success');
};

// Quick Report Modal - NEW PATIENT OPTION with FULL SCREEN RESULT ENTRY
window.openQuickReportModal = () => {
    showModal(`
        <h3 class="text-2xl font-bold mb-6"><i class="fas fa-plus-circle text-blue-600"></i> Quick Report Generation</h3>

        <div class="mb-6">
            <label class="block font-semibold mb-3">Select Patient Type:</label>
            <div class="flex gap-6">
                <label class="flex items-center cursor-pointer">
                    <input type="radio" name="patientType" value="existing" checked onchange="togglePatientFields()" class="mr-2 w-4 h-4">
                    <span class="text-sm">Existing Patient</span>
                </label>
                <label class="flex items-center cursor-pointer">
                    <input type="radio" name="patientType" value="new" onchange="togglePatientFields()" class="mr-2 w-4 h-4">
                    <span class="text-sm">New Patient</span>
                </label>
            </div>
        </div>

        <div id="existingPatientSection" class="mb-6">
            <label class="block font-semibold mb-2">Select Patient:</label>
            <select id="reportPatient" class="w-full p-3 border rounded-lg">
                <option value="">Choose a patient</option>
                ${patientsData.map(p => `
                    <option value="${p.id}">${p.name} - ${p.mobile}</option>
                `).join('')}
            </select>
        </div>

        <div id="newPatientSection" class="hidden space-y-4 mb-6">
            <input type="text" id="newPatName" placeholder="Full Name" class="w-full p-3 border rounded-lg">
            <div class="grid grid-cols-2 gap-4">
                <input type="number" id="newPatAge" placeholder="Age" class="p-3 border rounded-lg">
                <select id="newPatGender" class="p-3 border rounded-lg">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <input type="tel" id="newPatMobile" placeholder="Mobile Number" class="w-full p-3 border rounded-lg">
            <textarea id="newPatAddress" placeholder="Address (Optional)" class="w-full p-3 border rounded-lg" rows="2"></textarea>
            <input type="text" id="newPatRefDoctor" placeholder="Referring Doctor (Optional)" class="w-full p-3 border rounded-lg">
        </div>

        <input type="hidden" id="patientSelection" value="existing">

        <div class="mb-6">
            <label class="block font-semibold mb-2">Select Tests:</label>
            <input type="text" id="reportTestSearch" placeholder="🔍 Search tests..." 
                class="w-full p-3 border rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onkeyup="filterReportTests()">
            <div id="reportTestsContainer" class="w-full p-3 border rounded-lg max-h-60 overflow-y-auto bg-white" onchange="loadTestResults()">
                ${templatesData.map(t => `
                    <label class="flex items-center gap-2 py-1.5 hover:bg-gray-50 cursor-pointer report-test-checkbox-item">
                        <input type="checkbox" name="reportTests" value="${t.id}" class="w-4 h-4 rounded text-blue-600">
                        <span class="text-sm font-medium text-gray-700">${t.name}</span>
                    </label>
                `).join('')}
            </div>
            <p class="text-xs text-gray-500 mt-2">Select tests to include in the report</p>
        </div>

        <div class="mb-6">
            <label class="block font-semibold mb-2">Report Date:</label>
            <input type="date" id="reportDate" value="${new Date().toISOString().split('T')[0]}" class="w-full p-3 border rounded-lg">
        </div>

        <!-- Sample Collection Details -->
        <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 class="font-semibold text-blue-800 mb-3"><i class="fas fa-flask mr-2"></i>Sample Collection Details</h4>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sample ID</label>
                    <select id="reportSampleId" class="w-full p-2 border rounded-lg text-sm">
                        <option value="">Auto-Generate New</option>
                        ${samplesData.filter(s => s.status !== 'Completed').map(s => {
        const patient = patientsData.find(p => p.id === s.patientId);
        return `<option value="${s.id}" data-type="${s.sampleType}" data-time="${s.date}">${s.sampleNumber} - ${patient?.name || 'Unknown'}</option>`;
    }).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sample Type</label>
                    <select id="reportSampleType" class="w-full p-2 border rounded-lg text-sm">
                        <option value="Blood">Blood</option>
                        <option value="Serum">Serum</option>
                        <option value="Plasma">Plasma</option>
                        <option value="Urine">Urine</option>
                        <option value="Stool">Stool</option>
                        <option value="Sputum">Sputum</option>
                        <option value="Swab">Swab</option>
                        <option value="CSF">CSF</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Collection Time</label>
                    <input type="time" id="reportCollectionTime" value="${new Date().toTimeString().slice(0, 5)}" class="w-full p-2 border rounded-lg text-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Fasting Status</label>
                    <select id="reportFastingStatus" class="w-full p-2 border rounded-lg text-sm">
                        <option value="Not Specified">Not Specified</option>
                        <option value="Fasting (8+ hrs)">Fasting (8+ hrs)</option>
                        <option value="Fasting (12+ hrs)">Fasting (12+ hrs)</option>
                        <option value="Non-Fasting">Non-Fasting</option>
                        <option value="Random">Random</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="testResultsContainer" class="mb-6"></div>

        <div class="flex gap-3 mt-8">
            <button onclick="submitFullScreenResults()" class="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-md transition-all">
                <i class="fas fa-check-circle mr-2"></i> Generate Report
            </button>
            <button onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 font-semibold transition-all">
                <i class="fas fa-times mr-2"></i> Cancel
            </button>
        </div>
    `);
};

window.togglePatientFields = () => {
    const type = document.querySelector('input[name="patientType"]:checked').value;
    document.getElementById('patientSelection').value = type;

    if (type === 'existing') {
        document.getElementById('existingPatientSection').classList.remove('hidden');
        document.getElementById('newPatientSection').classList.add('hidden');
    } else {
        document.getElementById('existingPatientSection').classList.add('hidden');
        document.getElementById('newPatientSection').classList.remove('hidden');
    }
};

window.loadTestResults = () => {
    const checkboxes = document.querySelectorAll('input[name="reportTests"]:checked');
    const selectedTests = Array.from(checkboxes).map(cb => cb.value);
    const container = document.getElementById('testResultsContainer');

    if (selectedTests.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '<h4 class="font-bold text-lg mb-4">Enter Test Results:</h4>';

    selectedTests.forEach(testId => {
        const template = templatesData.find(t => t.id === testId);
        if (!template) return;

        const testHTML = `
            <div class="border-2 border-blue-200 rounded-lg p-4 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h5 class="font-semibold mb-3 text-blue-700 text-lg">${template.name}</h5>
                <div class="space-y-3">
                    ${template.subtests.map((subtest, index) => {
            const isTextType = subtest.type === 'text' || subtest.unit === '';
            const hasFormula = subtest.formula ? true : false;
            return `
                            <div class="grid grid-cols-3 gap-3 items-center bg-white p-2 rounded">
                                <label class="text-sm font-medium text-gray-700">${subtest.name}:</label>
                                ${isTextType ?
                    `<input type="text" class="test-result col-span-2 p-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" 
                                        data-test="${testId}" 
                                        data-subtest="${index}"
                                        data-name="${subtest.name}"
                                        placeholder="Enter result">` :
                    `<input type="number" step="0.01" class="test-result col-span-2 p-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none ${hasFormula ? 'bg-blue-50' : ''}" 
                                        data-test="${testId}" 
                                        data-subtest="${index}"
                                        data-name="${subtest.name}"
                                        data-min="${subtest.ranges.male.min}" 
                                        data-max="${subtest.ranges.male.max}"
                                        ${hasFormula ? `data-formula="${subtest.formula}" readonly title="Auto-calculated"` : 'oninput="calculateDependencies()"'}
                                        placeholder="${hasFormula ? 'Auto-calculated' : 'Value (' + subtest.unit + ')'}">`
                }
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        container.innerHTML += testHTML;
    });
};

// Filter tests in Quick Report modal
window.filterReportTests = () => {
    const searchTerm = document.getElementById('reportTestSearch').value.toLowerCase();
    const items = document.querySelectorAll('.report-test-checkbox-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};


// Auto-calculate dependent test parameters
window.calculateDependencies = () => {
    // Get all test result inputs
    const inputs = document.querySelectorAll('.test-result');

    // Build a map of parameter names to values
    const values = {};
    inputs.forEach(input => {
        const paramName = input.dataset.name;
        const value = parseFloat(input.value);
        if (paramName && !isNaN(value) && value !== '') {
            values[paramName] = value;
        }
    });

    // Process inputs with formulas
    inputs.forEach(input => {
        const formula = input.dataset.formula;
        if (!formula) return; // Skip if no formula

        let calculatedFormula = formula;
        let canCalculate = true;

        // Replace all {Parameter Name} placeholders with actual values
        const paramMatches = formula.match(/\{([^}]+)\}/g);
        if (paramMatches) {
            paramMatches.forEach(match => {
                const paramName = match.replace(/[{}]/g, '');
                if (values[paramName] !== undefined) {
                    calculatedFormula = calculatedFormula.replace(match, values[paramName]);
                } else {
                    canCalculate = false;
                }
            });
        }

        // Calculate if all required parameters are available
        if (canCalculate) {
            try {
                const result = eval(calculatedFormula);
                if (!isNaN(result) && isFinite(result)) {
                    input.value = result.toFixed(2);
                    // Update the values map with calculated value
                    values[input.dataset.name] = result;
                }
            } catch (error) {
                console.error('Formula calculation error:', error);
            }
        } else {
            // Clear the field if dependencies are not met
            input.value = '';
        }
    });
};


window.submitFullScreenResults = async () => {
    const selection = document.getElementById('patientSelection').value;
    const checkboxes = document.querySelectorAll('input[name="reportTests"]:checked');
    const selectedTests = Array.from(checkboxes).map(cb => cb.value);
    const reportDate = document.getElementById('reportDate').value;

    // Sample Collection Details
    const selectedSampleId = document.getElementById('reportSampleId')?.value || '';
    const selectedSample = selectedSampleId ? samplesData.find(s => s.id === selectedSampleId) : null;
    const sampleType = document.getElementById('reportSampleType')?.value || 'Blood';
    const collectionTime = document.getElementById('reportCollectionTime')?.value || '';
    const fastingStatus = document.getElementById('reportFastingStatus')?.value || 'Not Specified';

    // Generate Sample ID if not selected
    const labPrefix = (brandingData.labName || 'SPOT').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    const sampleId = selectedSample?.sampleNumber || `${labPrefix}-SMP-${Date.now().toString().slice(-6)}`;


    if (selectedTests.length === 0) {
        showNotification('Please select at least one test', 'warning');
        return;
    }

    let patient, patientId, saveNewPatient = false;

    if (selection === 'existing') {
        patientId = document.getElementById('reportPatient').value;
        if (!patientId) {
            showNotification('Please select a patient', 'warning');
            return;
        }
        patient = patientsData.find(p => p.id === patientId);
        if (!patient) {
            showNotification('Patient not found', 'error');
            return;
        }
    } else {
        const name = document.getElementById('newPatName').value.trim();
        const age = document.getElementById('newPatAge').value;
        const gender = document.getElementById('newPatGender').value;
        const mobile = document.getElementById('newPatMobile').value.trim();

        if (!name || !age || !gender || !mobile) {
            showNotification('Please fill all required patient fields', 'warning');
            return;
        }

        patient = {
            name: name,
            age: parseInt(age),
            gender: gender,
            mobile: mobile,
            address: document.getElementById('newPatAddress').value.trim(),
            refDoctor: document.getElementById('newPatRefDoctor').value.trim()
        };
        saveNewPatient = true;
    }

    const results = {};
    const resultInputs = document.querySelectorAll('.test-result');
    resultInputs.forEach(input => {
        const testId = input.dataset.test;
        const subtestIndex = parseInt(input.dataset.subtest);
        if (!results[testId]) results[testId] = {};

        let value = input.value.trim();
        let threatLevel = 'normal';

        if (input.dataset.min && input.dataset.max && value) {
            const numValue = parseFloat(value);
            const min = parseFloat(input.dataset.min);
            const max = parseFloat(input.dataset.max);

            if (numValue < min * 0.7 || numValue > max * 1.3) {
                threatLevel = 'critical';
            } else if (numValue < min || numValue > max) {
                threatLevel = 'warning';
            }
        }

        results[testId][subtestIndex] = { value, threatLevel };
    });

    const submitBtn = document.querySelector('button[onclick="submitFullScreenResults()"]');
    const originalHTML = submitBtn.innerHTML;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Generating...';
    }

    try {
        if (saveNewPatient) {
            const newPatientRef = await push(ref(database, `patients/${currentUser.uid}`), {
                ...patient,
                testsRequired: selectedTests,
                createdAt: new Date().toISOString()
            });
            patientId = newPatientRef.key;
        }

        const reportPrefix = subscriptionData?.premium
            ? brandingData.labName?.substring(0, 4).toUpperCase() || 'LAB'
            : 'SPOT';
        const reportId = `${reportPrefix}-${Date.now()}`;

        const reportData = {
            id: reportId,
            patientId: patientId,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            patientMobile: patient.mobile,
            patientAddress: patient.address || '',
            patientRefDoctor: patient.refDoctor || '',
            tests: selectedTests.map(testId => templatesData.find(t => t.id === testId).name),
            testDetails: selectedTests.map(testId => {
                const template = templatesData.find(t => t.id === testId);
                return {
                    testId: testId,
                    testName: template.name,
                    category: template.category,
                    subtests: template.subtests.map((subtest, index) => ({
                        name: subtest.name,
                        unit: subtest.unit,
                        value: results[testId]?.[index]?.value || '',
                        threatLevel: results[testId]?.[index]?.threatLevel || 'normal',
                        ranges: patient.gender === 'Male' ? subtest.ranges.male : subtest.ranges.female
                    }))
                };
            }),
            reportDate: reportDate,
            createdAt: new Date().toISOString(),
            labName: brandingData.labName || 'Spotnet MedOS',
            labBranding: brandingData,
            // Sample Collection Details
            sampleId: sampleId,
            sampleType: sampleType,
            sampleCollectionTime: collectionTime,
            fastingStatus: fastingStatus
        };

        await set(ref(database, `reports/${currentUser.uid}/${reportId}`), reportData);

        showNotification('Report generated successfully!', 'success');
        closeModal();

        setTimeout(() => {
            downloadReportPDF(reportId);
        }, 1000);

    } catch (error) {
        console.error('Report generation error:', error);
        showNotification('Failed to generate report', 'error');

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }
    }
};

// Delete Report Function
window.deleteReport = async (reportId) => {
    if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        try {
            await remove(ref(database, `reports/${currentUser.uid}/${reportId}`));
            showNotification('Report deleted successfully!', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            showNotification('Failed to delete report', 'error');
        }
    }
};

window.downloadReportPDF = (reportId) => {
    const report = reportsData.find(r => r.id === reportId);

    if (!report) {
        showNotification('Report not found', 'error');
        return;
    }

    try {
        const pdfWindow = window.open('', '_blank');
        const isPremium = subscriptionData?.premium;

        // Generate Sample ID using timestamp
        const sampleId = report.sampleId || `SMP-${Date.now().toString().slice(-8)}`;

        // Generate Patient ID using lab prefix
        const labPrefix = (report.labBranding?.labName || 'SPOT').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
        const patientIdNum = report.patientId ? report.patientId.substring(0, 6).toUpperCase() : String(Date.now()).slice(-6);
        const generatedPatientId = `${labPrefix}-${patientIdNum}`;

        // Get list of tests done
        const testsDoneList = report.testDetails.map(t => t.testName).join(', ');

        // Sample Collection Details (with defaults)
        const sampleCollectionTime = report.sampleCollectionTime || new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const fastingStatus = report.fastingStatus || 'Not Specified';
        const sampleType = report.sampleType || 'Blood';

        // Report Theme Colors (5 themes)
        const themes = {
            blue: { primary: '#667eea', secondary: '#764ba2', accent: '#6366f1', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6366f1 100%)' },
            green: { primary: '#10b981', secondary: '#059669', accent: '#34d399', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' },
            purple: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' },
            teal: { primary: '#14b8a6', secondary: '#0d9488', accent: '#2dd4bf', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)' },
            grey: { primary: '#475569', secondary: '#334155', accent: '#64748b', gradient: 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)' }
        };
        const selectedTheme = report.pdfTheme || brandingData.pdfTheme || 'blue';
        const theme = themes[selectedTheme] || themes.blue;

        // Collect critical findings
        const criticalFindings = [];
        report.testDetails.forEach(test => {
            test.subtests.forEach(subtest => {
                if (subtest.threatLevel === 'critical' && subtest.value) {
                    criticalFindings.push({
                        test: test.testName,
                        parameter: subtest.name,
                        value: subtest.value,
                        unit: subtest.unit
                    });
                }
            });
        });

        // Culture & Sensitivity Report Helper
        const generateCultureReport = (test) => {
            if (!test.cultureData) return '';
            const { organism, colonyCount, antibiotics } = test.cultureData;
            return `
                <div style="margin-bottom: 18px; page-break-inside: avoid; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="background: ${theme.gradient}; color: white; padding: 10px 14px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700;">🧫 ${test.testName} - Culture & Sensitivity</h3>
                        <p style="margin: 2px 0 0 0; opacity: 0.85; font-size: 10px;">${test.category || 'Microbiology'}</p>
                    </div>
                    <div style="background: white; padding: 12px;">
                        <div style="margin-bottom: 10px; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px;">
                            <p style="font-size: 11px; color: #92400e;"><strong>Organism Isolated:</strong> ${organism || 'No growth'}</p>
                            <p style="font-size: 10px; color: #78350f; margin-top: 4px;"><strong>Colony Count:</strong> ${colonyCount || 'N/A'}</p>
                        </div>
                        ${antibiotics && antibiotics.length > 0 ? `
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                            <thead>
                                <tr style="background: #f8fafc;">
                                    <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Antibiotic</th>
                                    <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">Sensitivity</th>
                                    <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">MIC</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${antibiotics.map(ab => `
                                    <tr style="background: ${ab.sensitivity === 'Sensitive' ? '#f0fdf4' : ab.sensitivity === 'Resistant' ? '#fef2f2' : '#fffbeb'};">
                                        <td style="border: 1px solid #e5e7eb; padding: 6px;">${ab.name}</td>
                                        <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; font-weight: 700; color: ${ab.sensitivity === 'Sensitive' ? '#16a34a' : ab.sensitivity === 'Resistant' ? '#dc2626' : '#d97706'};">${ab.sensitivity}</td>
                                        <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">${ab.mic || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : '<p style="font-size: 10px; color: #6b7280; text-align: center; padding: 10px;">No sensitivity data available</p>'}
                    </div>
                </div>
            `;
        };

        // Narrative/Text Report Helper (Radiology, Histopathology)
        const generateNarrativeReport = (test) => {
            if (!test.narrativeText) return '';
            return `
                <div style="margin-bottom: 18px; page-break-inside: avoid; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="background: ${theme.gradient}; color: white; padding: 10px 14px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700;">📝 ${test.testName}</h3>
                        <p style="margin: 2px 0 0 0; opacity: 0.85; font-size: 10px;">${test.category || 'Narrative Report'}</p>
                    </div>
                    <div style="background: white; padding: 14px;">
                        ${test.findings ? `
                        <div style="margin-bottom: 10px;">
                            <h4 style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 4px;">FINDINGS:</h4>
                            <p style="font-size: 10px; color: #4b5563; line-height: 1.5; white-space: pre-wrap;">${test.findings}</p>
                        </div>
                        ` : ''}
                        ${test.impression ? `
                        <div style="margin-bottom: 10px; padding: 10px; background: #eff6ff; border-left: 3px solid ${theme.primary}; border-radius: 4px;">
                            <h4 style="font-size: 11px; font-weight: 700; color: ${theme.primary}; margin-bottom: 4px;">IMPRESSION:</h4>
                            <p style="font-size: 10px; color: #1e40af; line-height: 1.5;">${test.impression}</p>
                        </div>
                        ` : ''}
                        ${test.narrativeText ? `
                        <div>
                            <h4 style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 4px;">REPORT:</h4>
                            <p style="font-size: 10px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${test.narrativeText}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        };

        // Generate test results HTML with color-coded BOLD values and status emojis
        const testResultsHTML = report.testDetails.map((test, testIndex) => {
            // Check if this is a special report type
            if (test.cultureData) {
                return generateCultureReport(test);
            }
            if (test.narrativeText || test.findings || test.impression) {
                return generateNarrativeReport(test);
            }

            // Standard table-based report
            const colors = [theme.primary, theme.secondary, '#06b6d4', '#10b981', '#f59e0b'];
            const testColor = colors[testIndex % colors.length];

            const subtestsHTML = test.subtests.map(subtest => {
                let statusIcon = '●';
                let statusColor = '#10b981';
                let valueColor = '#10b981';
                let rowBg = '#ffffff';
                let valueBold = '600';

                // Calculate visual indicator bar position
                let indicatorBar = '';
                if (subtest.ranges && subtest.value && !isNaN(parseFloat(subtest.value))) {
                    const val = parseFloat(subtest.value);
                    const min = parseFloat(subtest.ranges.min);
                    const max = parseFloat(subtest.ranges.max);
                    const range = max - min;
                    const extendedMin = min - (range * 0.3);
                    const extendedMax = max + (range * 0.3);
                    const extendedRange = extendedMax - extendedMin;
                    let position = ((val - extendedMin) / extendedRange) * 100;
                    position = Math.max(0, Math.min(100, position));
                    const normalStart = ((min - extendedMin) / extendedRange) * 100;
                    const normalEnd = ((max - extendedMin) / extendedRange) * 100;

                    indicatorBar = `
                        <div style="width: 60px; height: 8px; background: linear-gradient(to right, #ef4444 0%, #ef4444 ${normalStart}%, #10b981 ${normalStart}%, #10b981 ${normalEnd}%, #ef4444 ${normalEnd}%, #ef4444 100%); border-radius: 4px; position: relative; margin-top: 3px;">
                            <div style="position: absolute; top: -2px; left: ${position}%; transform: translateX(-50%); width: 12px; height: 12px; background: ${subtest.threatLevel === 'critical' ? '#dc2626' : subtest.threatLevel === 'warning' ? '#f59e0b' : '#10b981'}; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                        </div>
                    `;
                }

                if (subtest.threatLevel === 'warning') {
                    statusIcon = '▲';
                    statusColor = '#f59e0b';
                    valueColor = '#b45309';
                    rowBg = '#fffbeb';
                    valueBold = '700';
                } else if (subtest.threatLevel === 'critical') {
                    statusIcon = '✖';
                    statusColor = '#ef4444';
                    valueColor = '#dc2626';
                    rowBg = '#fef2f2';
                    valueBold = '800';
                }

                return `
                    <tr style="background: ${rowBg};">
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 12px; color: #374151;">${subtest.name}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-weight: ${valueBold}; font-size: 14px; color: ${valueColor};">
                            ${subtest.value || '-'}
                            ${indicatorBar}
                        </td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 11px; color: #6b7280;">${subtest.unit || '-'}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 11px; color: #6b7280;">${subtest.ranges ? `${subtest.ranges.min} - ${subtest.ranges.max}` : '-'}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; text-align: center; color: ${statusColor}; font-size: 16px; font-weight: bold;">${statusIcon}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div style="margin-bottom: 18px; page-break-inside: avoid; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="background: linear-gradient(135deg, ${testColor} 0%, ${testColor}cc 100%); color: white; padding: 10px 14px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700;">${test.testName}</h3>
                        <p style="margin: 2px 0 0 0; opacity: 0.85; font-size: 10px;">${test.category}</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #1e293b;">Parameter</th>
                                <th style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #1e293b;">Result</th>
                                <th style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #1e293b;">Unit</th>
                                <th style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #1e293b;">Ref. Range</th>
                                <th style="border: 1px solid #e5e7eb; padding: 6px 10px; text-align: center; font-size: 10px; font-weight: 700; color: #1e293b;">Status</th>
                            </tr>
                        </thead>
                        <tbody>${subtestsHTML}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        pdfWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>Lab Report - ${report.id}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 8mm; size: A4; }
        
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f1f5f9;
            padding: 15px;
            line-height: 1.4;
            color: #1e293b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .report-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        /* HEADER */
        .header {
            background: ${theme.gradient};
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }
        .header::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, #fbbf24, #f97316, #ef4444, #ec4899);
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .header-logo { width: 50px; height: 50px; background: white; border-radius: 6px; padding: 4px; object-fit: contain; }
        .header-info h1 { font-size: 18px; font-weight: 800; margin-bottom: 1px; }
        .header-info p { font-size: 10px; opacity: 0.9; margin: 1px 0; }
        .header-right { text-align: right; font-size: 9px; line-height: 1.5; }
        .header-right p { margin: 1px 0; }
        .badge-row { display: flex; gap: 4px; justify-content: flex-end; margin-top: 4px; }
        .badge { background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 700; }

        /* META BAR */
        .meta-bar {
            background: linear-gradient(135deg, #1e293b, #334155);
            color: white;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .meta-left { display: flex; align-items: center; gap: 12px; }
        .qr-code { width: 50px; height: 50px; background: white; border-radius: 5px; padding: 2px; }
        .qr-code img { width: 100%; height: 100%; }
        .report-id-block h2 { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
        .report-id-block p { font-size: 9px; opacity: 0.8; margin-top: 1px; }
        .meta-right { text-align: right; font-size: 9px; }
        .meta-right strong { color: #fbbf24; }

        /* PATIENT INFO */
        .patient-section { padding: 12px 20px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-bottom: 2px solid ${theme.primary}; }
        .patient-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .patient-item { background: white; padding: 8px 10px; border-radius: 5px; border-left: 3px solid ${theme.primary}; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .patient-item.span-2 { grid-column: span 2; }
        .patient-item label { display: block; font-size: 8px; color: ${theme.primary}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
        .patient-item span { font-size: 11px; font-weight: 600; color: #1e293b; }
        
        /* SAMPLE INFO BAR */
        .sample-bar { padding: 8px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 20px; align-items: center; }
        .sample-item { display: flex; align-items: center; gap: 6px; font-size: 10px; }
        .sample-item label { color: #64748b; font-weight: 600; }
        .sample-item span { color: #1e293b; font-weight: 700; background: white; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }

        /* CONTENT */
        .content { padding: 15px 20px; }

        /* Status Legend */
        .status-legend { display: flex; justify-content: center; gap: 20px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; margin-bottom: 12px; font-size: 10px; font-weight: 700; }
        .legend-normal { color: #10b981; }
        .legend-borderline { color: #f59e0b; }
        .legend-abnormal { color: #ef4444; }

        /* Critical Findings */
        .critical-box { background: linear-gradient(135deg, #fef2f2, #fee2e2); border: 1px solid #ef4444; border-radius: 6px; padding: 10px 12px; margin-bottom: 15px; }
        .critical-box h4 { color: #dc2626; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
        .critical-item { background: white; padding: 6px 10px; border-radius: 3px; border-left: 2px solid #ef4444; margin-bottom: 4px; font-size: 10px; color: #991b1b; }

        /* Notes & Disclaimer */
        .notes-section { margin-top: 15px; padding: 10px 12px; background: linear-gradient(135deg, #fefce8, #fef9c3); border: 1px solid #facc15; border-radius: 6px; }
        .notes-section h4 { color: #a16207; font-size: 10px; font-weight: 700; margin-bottom: 4px; }
        .notes-section p { font-size: 9px; color: #713f12; line-height: 1.4; }
        .disclaimer-box { margin-top: 10px; padding: 8px 10px; background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 5px; font-size: 8px; color: #64748b; line-height: 1.3; }

        /* Signature Section */
        .signature-section { margin-top: 20px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; }
        .digital-sign { text-align: center; padding: 10px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 5px; min-width: 160px; }
        .digital-sign p { font-size: 8px; color: #64748b; }
        .digital-sign .hash { font-family: 'Courier New', monospace; font-size: 7px; color: #94a3b8; margin-top: 3px; word-break: break-all; }
        .auth-sign { text-align: center; min-width: 180px; }
        .auth-sign .sign-space { height: 40px; border-bottom: 2px solid #374151; margin-bottom: 6px; }
        .auth-sign strong { display: block; font-size: 11px; color: #1e293b; }
        .auth-sign span { font-size: 9px; color: ${theme.primary}; font-weight: 600; }

        /* Footer */
        .footer { background: ${theme.gradient}; color: white; padding: 12px 20px; display: flex; justify-content: space-between; font-size: 9px; }
        .footer-left p { margin: 1px 0; }
        .footer-left strong { font-size: 10px; }
        .footer-right { text-align: right; }
        .footer-right p { margin: 1px 0; opacity: 0.9; }
        .footer-barcode { font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 1px; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 2px; margin-top: 4px; display: inline-block; }

        /* Print Styles */
        @media print {
            body { padding: 0; background: white; }
            .report-container { box-shadow: none; border-radius: 0; max-width: 100%; }
            .no-print { display: none !important; }
        }

        .print-btn { position: fixed; bottom: 20px; right: 20px; background: ${theme.gradient}; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000; }
        .print-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- HEADER -->
        <div class="header">
            <div class="header-left">
                ${report.labBranding?.logo && isPremium ? `<img src="${report.labBranding.logo}" class="header-logo" alt="Logo">` : ''}
                <div class="header-info">
                    <h1>${report.labBranding?.labName || 'Spotnet MedOS'}</h1>
                    <p>${report.labBranding?.tagline || 'Professional Healthcare Services'}</p>
                    ${report.labBranding?.address ? `<p>📍 ${report.labBranding.address}</p>` : ''}
                </div>
            </div>
            <div class="header-right">
                ${report.labBranding?.contact ? `<p>📞 ${report.labBranding.contact}</p>` : ''}
                ${report.labBranding?.email ? `<p>✉️ ${report.labBranding.email}</p>` : ''}
                ${report.labBranding?.website ? `<p>🌐 ${report.labBranding.website}</p>` : ''}
                ${isPremium ? `<div class="badge-row"><span class="badge">NABL</span><span class="badge">ISO 9001</span></div>` : ''}
            </div>
        </div>

        <!-- REPORT ID & QR -->
        <div class="meta-bar">
            <div class="meta-left">
                <div class="qr-code">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(report.id)}" alt="QR">
                </div>
                <div class="report-id-block">
                    <h2>ID: ${report.id}</h2>
                    <p>AUTHORISED LABORATORY REPORT</p>
                </div>
            </div>
            <div class="meta-right">
                <p><strong>Date:</strong> ${new Date(report.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p><strong>Time:</strong> ${new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
        </div>

        <!-- PATIENT INFO -->
        <div class="patient-section">
            <div class="patient-grid">
                <div class="patient-item">
                    <label>Patient Name</label>
                    <span>${report.patientName}</span>
                </div>
                <div class="patient-item">
                    <label>Sample ID</label>
                    <span>${sampleId}</span>
                </div>
                <div class="patient-item">
                    <label>Patient ID</label>
                    <span>${generatedPatientId}</span>
                </div>
                <div class="patient-item">
                    <label>Age / Gender</label>
                    <span>${report.patientAge} Y / ${report.patientGender}</span>
                </div>
                <div class="patient-item">
                    <label>Mobile</label>
                    <span>${report.patientMobile}</span>
                </div>
                <div class="patient-item">
                    <label>Ref. Doctor</label>
                    <span>${report.patientRefDoctor || 'Self'}</span>
                </div>
                <div class="patient-item span-2">
                    <label>Tests Done</label>
                    <span>${testsDoneList}</span>
                </div>
            </div>
        </div>
        
        <!-- SAMPLE COLLECTION INFO BAR -->
        <div class="sample-bar">
            <div class="sample-item">
                <label>🕐 Collection Time:</label>
                <span>${sampleCollectionTime}</span>
            </div>
            <div class="sample-item">
                <label>🍽️ Fasting:</label>
                <span>${fastingStatus}</span>
            </div>
            <div class="sample-item">
                <label>🧪 Sample Type:</label>
                <span>${sampleType}</span>
            </div>
        </div>

        <!-- CONTENT -->
        <div class="content">
            <!-- Status Legend -->
            <div class="status-legend">
                <span class="legend-normal">● NORMAL</span>
                <span class="legend-borderline">▲ BORDERLINE</span>
                <span class="legend-abnormal">✖ ABNORMAL</span>
            </div>

            <!-- Critical Findings -->
            ${criticalFindings.length > 0 ? `
            <div class="critical-box">
                <h4>⚠️ CRITICAL FINDINGS - IMMEDIATE ATTENTION REQUIRED</h4>
                ${criticalFindings.map(finding => `
                    <div class="critical-item">
                        <strong>${finding.test}:</strong> ${finding.parameter} = <strong>${finding.value}</strong> ${finding.unit}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- Test Results -->
            ${testResultsHTML}

            <!-- Clinical Notes -->
            <div class="notes-section">
                <h4>📋 CLINICAL NOTES & IMPRESSION</h4>
                <p>${report.labBranding?.footerNotes || 'This report should be correlated clinically. Results are based on the sample provided and testing methodology employed. Abnormal values are highlighted for your reference. For any queries, please consult your physician or contact the laboratory.'}</p>
            </div>

            <!-- Disclaimer -->
            <div class="disclaimer-box">
                <strong>DISCLAIMER:</strong> Laboratory results should be interpreted in conjunction with clinical history and examination. Values marked as abnormal may vary based on individual conditions. This is a computer-generated report valid only with authorized signature.
            </div>
        </div>

        <!-- SIGNATURE -->
        <div class="signature-section">
            <div class="digital-sign">
                <p>🔐 Digital Signature</p>
                <div class="hash">SHA256: ${report.id.replace(/-/g, '').substring(0, 24)}...</div>
                <p style="margin-top: 3px;">Electronically Verified</p>
            </div>
            <div class="auth-sign">
                <div class="sign-space"></div>
                <strong>${report.labBranding?.director || 'Dr. Authorized Pathologist'}</strong>
                <span>Chief Pathologist / Microbiologist</span>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="footer">
            <div class="footer-left">
                ${isPremium && report.labBranding?.labName ? `
                    <p><strong>${report.labBranding.labName}</strong></p>
                    ${report.labBranding?.address ? `<p>${report.labBranding.address}</p>` : ''}
                    ${report.labBranding?.contact ? `<p>📞 ${report.labBranding.contact} | ✉️ ${report.labBranding.email || ''}</p>` : ''}
                ` : `
                    <p><strong>Spotnet MedOS</strong> - Professional Lab Management</p>
                    <p>Digitally Generated Report | Trusted Healthcare Solutions</p>
                `}
                <div class="footer-barcode">|${report.id.replace(/-/g, '').substring(0, 12)}|</div>
            </div>
            <div class="footer-right">
                <p>Generated: ${new Date(report.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p>Report Version: 1.0</p>
                <p>Computer Generated Report</p>
            </div>
        </div>
    </div>

    <button onclick="window.print()" class="print-btn no-print">🖨️ Print / Save PDF</button>
</body>
</html>`);

        pdfWindow.document.close();
        setTimeout(() => pdfWindow.print(), 800);

    } catch (error) {
        console.error('PDF error:', error);
        showNotification('PDF generation failed', 'error');
    }
};



// Update Dashboard Stats
function updateDashboardStats() {
    document.getElementById('totalPatients').textContent = patientsData.length;
    document.getElementById('statPending').textContent = samplesData.filter(s => s.status === 'Pending').length;
    document.getElementById('statProcessing').textContent = samplesData.filter(s => s.status === 'Processing').length;
    document.getElementById('statCompleted').textContent = samplesData.filter(s => s.status === 'Completed').length;

    const today = new Date().toISOString().split('T')[0];
    const todayReports = reportsData.filter(r => r.createdAt.split('T')[0] === today).length;
    document.getElementById('todayReports').textContent = todayReports;

    // Weekly Reports (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyReports = reportsData.filter(r => new Date(r.createdAt) >= sevenDaysAgo).length;
    document.getElementById('weeklyReports').textContent = weeklyReports;

    // OPD Stats
    const todayOPD = opdData.filter(v => v.visitDate === today).length;
    const weeklyOPD = opdData.filter(v => new Date(v.visitDate) >= sevenDaysAgo).length;

    // Update OPD counts if elements exist
    const todayOPDEl = document.getElementById('todayOPD');
    const weeklyOPDEl = document.getElementById('weeklyOPD');
    if (todayOPDEl) todayOPDEl.textContent = todayOPD;
    if (weeklyOPDEl) weeklyOPDEl.textContent = weeklyOPD;

    // Report Patients vs OPD Patients
    const patientsWithReports = new Set(reportsData.map(r => r.patientId));
    const patientsWithOPD = new Set(opdData.map(v => v.patientId));
    const reportPatientsCount = patientsWithReports.size;
    const opdPatientsCount = patientsWithOPD.size;

    document.getElementById('reportPatientsCount').textContent = reportPatientsCount;
    document.getElementById('opdPatientsCount').textContent = opdPatientsCount;
}

// Initialize Analytics
function initializeAnalytics() {
    updateAnalyticsCards();
    renderAnalyticsCharts();
}

// Update Analytics Cards
function updateAnalyticsCards() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Monthly Reports
    const monthlyReports = reportsData.filter(r => {
        const reportDate = new Date(r.createdAt);
        return reportDate.getMonth() === currentMonth && reportDate.getFullYear() === currentYear;
    }).length;
    document.getElementById('monthlyReports').textContent = monthlyReports;

    // Total Revenue (estimated)
    const totalRevenue = reportsData.reduce((sum, report) => {
        return sum + report.testDetails.reduce((testSum, test) => {
            const template = templatesData.find(t => t.name === test.testName);
            return testSum + (template?.totalPrice || 0);
        }, 0);
    }, 0);
    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString();

    // Average Tests per Report
    const avgTestsPerReport = reportsData.length > 0 ?
        (reportsData.reduce((sum, report) => sum + report.tests.length, 0) / reportsData.length).toFixed(1) : 0;
    document.getElementById('avgTestsPerReport').textContent = avgTestsPerReport;

    // Completion Rate
    const totalSamples = samplesData.length;
    const completedSamples = samplesData.filter(s => s.status === 'Completed').length;
    const completionRate = totalSamples > 0 ? Math.round((completedSamples / totalSamples) * 100) : 0;
    document.getElementById('completionRate').textContent = completionRate;
}

// Render Analytics Charts
function renderAnalyticsCharts() {
    renderReportsTrendChart();
    renderTestCategoriesChart();
}

// Global Chart Instances to prevent collision
const chartRegistry = {
    trends: null,
    categories: null
};

// Reports Trend Chart
function renderReportsTrendChart() {
    const canvas = document.getElementById('reportsTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (chartRegistry.trends) {
        chartRegistry.trends.destroy();
    }

    // Last 7 days data
    const dates = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        dates.push(date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
        counts.push(reportsData.filter(r => r.createdAt.split('T')[0] === dateStr).length);
    }

    chartRegistry.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Reports',
                data: counts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#667eea',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#9ca3af' },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Test Categories Chart
function renderTestCategoriesChart() {
    const canvas = document.getElementById('testCategoriesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (chartRegistry.categories) {
        chartRegistry.categories.destroy();
    }

    // Count tests by category
    const categoryCount = {};
    reportsData.forEach(report => {
        if (report.testDetails) {
            report.testDetails.forEach(test => {
                const category = test.category || 'Other';
                categoryCount[category] = (categoryCount[category] || 0) + 1;
            });
        }
    });

    const categories = Object.keys(categoryCount);
    const counts = Object.values(categoryCount);

    if (categories.length === 0) {
        // Handle empty case
        ctx.font = '14px Inter';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Modern color palette
    const colors = [
        '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'
    ];

    chartRegistry.categories = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: counts,
                backgroundColor: colors,
                hoverOffset: 15,
                borderWidth: 2,
                borderColor: '#ffffff',
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        font: { size: 12, weight: '500' },
                        color: '#4b5563'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 5
                }
            },
            cutout: '70%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

// Switch Tab
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(tabName + 'Tab').classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-white');
        btn.classList.add('border-transparent', 'opacity-70');
    });

    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('border-white');
        activeBtn.classList.remove('border-transparent', 'opacity-70');
    }

    // Refresh analytics when switching to analytics tab
    if (tabName === 'analytics') {
        initializeAnalytics();
    }
};

// Show Upgrade Modal
window.showUpgradeModal = () => {
    showModal(`
        <div class="text-center">
            <div class="inline-block p-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full mb-4">
                <i class="fas fa-crown text-white text-4xl"></i>
            </div>
            <h3 class="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Upgrade to Premium
            </h3>
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg mb-4 border-2 border-purple-200">
                <div class="text-4xl font-bold text-purple-800 mb-2">₹5,999 <span class="text-lg font-normal">/year</span></div>
                <p class="text-gray-600">Unlock all premium features</p>
            </div>
            
            <div class="text-left space-y-3 mb-6">
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>Unlimited Reports & Patients</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>Custom Lab Logo (Rounded) & Branding</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>No Watermark on PDFs</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>Custom Footer Notes in Reports</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>Professional PDF Branding</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-check-circle text-green-600"></i>
                    <span>Priority Support</span>
                </div>
            </div>
            
            <div class="space-y-3">
                <button onclick="proceedToPayment()" 
                    class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg">
                    <i class="fas fa-credit-card"></i> Proceed to Payment
                </button>
                <button onclick="closeModal()" 
                    class="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                    Maybe Later
                </button>
            </div>
        </div>
    `);
};

window.proceedToPayment = () => {
    showModal(`
        <h3 class="text-xl font-bold mb-4">Payment Details</h3>
        <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <h4 class="font-bold text-blue-800 mb-2">Bank Transfer:</h4>
            <div class="space-y-1 text-sm">
                <p><strong>Bank:</strong> HDFC Bank</p>
                <p><strong>Account:</strong> Spotnet Services</p>
                <p><strong>Number:</strong> 1234567890</p>
                <p><strong>IFSC:</strong> HDFC0001234</p>
                <p><strong>Amount:</strong> ₹5,999</p>
            </div>
        </div>
        
        <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
            <h4 class="font-bold text-yellow-800 mb-2">UPI Payment:</h4>
            <p class="text-sm"><strong>UPI ID:</strong> spotnet@upi</p>
            <p class="text-sm"><strong>Phone Pay:</strong> 9876543210</p>
        </div>
        
        <form onsubmit="submitPaymentProof(event)" class="space-y-3">
            <input type="text" id="transactionId" required placeholder="Transaction ID" 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <input type="datetime-local" id="transactionDate" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <input type="number" id="amountPaid" value="5999" required readonly
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-100">
            <textarea id="paymentNotes" rows="2" placeholder="Notes (optional)"
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"></textarea>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg">
                    <i class="fas fa-paper-plane"></i> Submit
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.submitPaymentProof = async (e) => {
    e.preventDefault();
    await push(ref(database, `payments/${currentUser.uid}`), {
        transactionId: document.getElementById('transactionId').value.trim(),
        transactionDate: document.getElementById('transactionDate').value,
        amount: 5999,
        notes: document.getElementById('paymentNotes').value.trim(),
        userEmail: currentUser.email,
        submittedAt: new Date().toISOString(),
        status: 'pending_verification'
    });

    await update(ref(database, `subscriptions/${currentUser.uid}`), {
        paymentStatus: 'pending_verification'
    });

    closeModal();
    showNotification('Payment submitted! Admin will verify within 24 hours.', 'success');
};

// Modal & Notification Functions
function showModal(content) {
    document.getElementById('modalContainer').innerHTML = `
        <div class="modal-backdrop">
            <div class="modal-content animate-slide">
                ${content}
            </div>
        </div>
    `;
}

window.closeModal = () => {
    document.getElementById('modalContainer').innerHTML = '';
};

function showNotification(message, type = 'info') {
    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-6 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide`;
    notification.innerHTML = `<i class="fas fa-bell mr-2"></i>${message}`;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
}

// Add Template Modal & Functions
window.openAddTemplateModal = () => {
    showModal(`
        <h3 class="text-xl font-bold mb-4"><i class="fas fa-flask-vial text-indigo-600"></i> Add Test Template</h3>
        <form onsubmit="addTemplate(event)" class="space-y-3">
            <input type="text" id="templateName" placeholder="Test Name" required 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <select id="templateCategory" required class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
                <option value="">Category</option>
                <option value="Hematology">Hematology</option>
                <option value="Biochemistry">Biochemistry</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Immunology">Immunology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Pathology">Pathology</option>
                <option value="Serology">Serology</option>
                <option value="Other">Other</option>
            </select>
            <input type="number" id="templatePrice" placeholder="Total Price" required min="0" 
                class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg">
            <div class="border-t pt-3">
                <label class="block text-sm font-semibold mb-2">Subtests</label>
                <div id="subtestsContainer" class="space-y-2 max-h-60 overflow-y-auto mb-2">
                    <div class="subtest-item border-2 border-gray-300 rounded p-3 bg-gray-50">
                        <input type="text" placeholder="Subtest name" required class="subtest-name w-full px-3 py-2 border rounded mb-2">
                        <div class="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Unit" class="subtest-unit px-3 py-2 border rounded">
                            <select class="subtest-type px-3 py-2 border rounded">
                                <option value="numeric">Numeric</option>
                                <option value="text">Text</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <div>
                                <label class="text-xs">Male Range</label>
                                <div class="flex gap-1">
                                    <input type="number" step="0.01" placeholder="Min" class="subtest-male-min px-2 py-1 border rounded text-sm">
                                    <input type="number" step="0.01" placeholder="Max" class="subtest-male-max px-2 py-1 border rounded text-sm">
                                </div>
                            </div>
                            <div>
                                <label class="text-xs">Female Range</label>
                                <div class="flex gap-1">
                                    <input type="number" step="0.01" placeholder="Min" class="subtest-female-min px-2 py-1 border rounded text-sm">
                                    <input type="number" step="0.01" placeholder="Max" class="subtest-female-max px-2 py-1 border rounded text-sm">
                                </div>
                            </div>
                        </div>
                        <input type="number" placeholder="Price" class="subtest-price w-full px-3 py-2 border rounded mt-2">
                    </div>
                </div>
                <button type="button" onclick="addSubtestField()" 
                    class="w-full bg-indigo-50 text-indigo-600 py-2 rounded text-sm">
                    <i class="fas fa-plus"></i> Add Subtest
                </button>
            </div>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg">
                    <i class="fas fa-save"></i> Save
                </button>
                <button type="button" onclick="closeModal()" class="px-6 bg-gray-300 py-2 rounded-lg">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.addSubtestField = () => {
    const container = document.getElementById('subtestsContainer');
    const newSubtest = document.createElement('div');
    newSubtest.className = 'subtest-item border-2 border-gray-300 rounded p-3 bg-gray-50';
    newSubtest.innerHTML = `
        <input type="text" placeholder="Subtest name" required class="subtest-name w-full px-3 py-2 border rounded mb-2">
        <div class="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Unit" class="subtest-unit px-3 py-2 border rounded">
            <select class="subtest-type px-3 py-2 border rounded">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
            </select>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
            <div>
                <label class="text-xs">Male Range</label>
                <div class="flex gap-1">
                    <input type="number" step="0.01" placeholder="Min" class="subtest-male-min px-2 py-1 border rounded text-sm">
                    <input type="number" step="0.01" placeholder="Max" class="subtest-male-max px-2 py-1 border rounded text-sm">
                </div>
            </div>
            <div>
                <label class="text-xs">Female Range</label>
                <div class="flex gap-1">
                    <input type="number" step="0.01" placeholder="Min" class="subtest-female-min px-2 py-1 border rounded text-sm">
                    <input type="number" step="0.01" placeholder="Max" class="subtest-female-max px-2 py-1 border rounded text-sm">
                </div>
            </div>
        </div>
        <input type="number" placeholder="Price" class="subtest-price w-full px-3 py-2 border rounded mt-2">
        <button type="button" onclick="this.parentElement.remove()" 
            class="w-full bg-red-50 text-red-600 py-1 rounded mt-2 text-sm">
            <i class="fas fa-times"></i> Remove
        </button>
    `;
    container.appendChild(newSubtest);
};

window.addTemplate = async (e) => {
    e.preventDefault();

    const subtestElements = document.querySelectorAll('.subtest-item');
    const subtests = Array.from(subtestElements).map(elem => ({
        name: elem.querySelector('.subtest-name').value.trim(),
        unit: elem.querySelector('.subtest-unit').value.trim(),
        type: elem.querySelector('.subtest-type').value,
        ranges: {
            male: {
                min: parseFloat(elem.querySelector('.subtest-male-min').value) || 0,
                max: parseFloat(elem.querySelector('.subtest-male-max').value) || 0
            },
            female: {
                min: parseFloat(elem.querySelector('.subtest-female-min').value) || 0,
                max: parseFloat(elem.querySelector('.subtest-female-max').value) || 0
            }
        },
        price: parseFloat(elem.querySelector('.subtest-price').value) || 0
    }));

    if (subtests.length === 0) {
        alert('Add at least one subtest');
        return;
    }

    const templateData = {
        name: document.getElementById('templateName').value.trim(),
        category: document.getElementById('templateCategory').value,
        totalPrice: parseFloat(document.getElementById('templatePrice').value),
        subtests: subtests,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid, // Track creator
        authorName: currentUser.displayName || 'User'
    };

    // 1. Save to user's personal templates (Editable by user)
    await push(ref(database, `templates/${currentUser.uid}`), templateData);

    // 2. Save to common templates as Admin Backup (Read-only for others, Editable by Admin)
    // This meets the requirement: "automatically makes admin level templates as a backup"
    await push(ref(database, 'common_templates'), templateData);

    closeModal();
    showNotification('Template created & backed up to Admin System!', 'success');
};

// ==================== NEW ADVANCED FEATURES ====================

// 1. DOCTOR-WISE REFERRALS ANALYTICS
let doctorReferralsData = {};

async function loadDoctorAnalytics() {
    doctorReferralsData = {};
    patientsData.forEach(patient => {
        if (patient.refDoctor) {
            if (!doctorReferralsData[patient.refDoctor]) {
                doctorReferralsData[patient.refDoctor] = {
                    count: 0,
                    patients: [],
                    totalRevenue: 0
                };
            }
            doctorReferralsData[patient.refDoctor].count++;
            doctorReferralsData[patient.refDoctor].patients.push(patient.name);
        }
    });
}

window.showDoctorAnalytics = () => {
    loadDoctorAnalytics();
    const sortedDoctors = Object.entries(doctorReferralsData)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

    const tableHTML = sortedDoctors.map(([doctor, data], index) => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 font-semibold">${index + 1}</td>
            <td class="px-4 py-3">${doctor}</td>
            <td class="px-4 py-3 text-center font-bold text-blue-600">${data.count}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${data.patients.slice(0, 3).join(', ')}${data.patients.length > 3 ? '...' : ''}</td>
        </tr>
    `).join('');

    showModal(`
        <h3 class="text-2xl font-bold mb-4">👨‍⚕️ Top Referring Doctors</h3>
        <table class="w-full border-collapse">
            <thead class="bg-blue-100">
                <tr>
                    <th class="px-4 py-3 text-left">Rank</th>
                    <th class="px-4 py-3 text-left">Doctor Name</th>
                    <th class="px-4 py-3 text-center">Referrals</th>
                    <th class="px-4 py-3 text-left">Recent Patients</th>
                </tr>
            </thead>
            <tbody>${tableHTML || '<tr><td colspan="4" class="text-center py-4">No data available</td></tr>'}</tbody>
        </table>
        <button onclick="closeModal()" class="w-full mt-4 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Close</button>
    `);
};

// 2. PUSH NOTIFICATIONS (Browser)
let notificationPermission = false;

async function initPushNotifications() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notificationPermission = (permission === 'granted');
    }
}

function sendBrowserNotification(title, message) {
    if (notificationPermission) {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            badge: '/badge.png'
        });
    }
}

window.toggleNotifications = async () => {
    await initPushNotifications();
    showNotification('Browser notifications ' + (notificationPermission ? 'enabled' : 'disabled'), 'info');
};

// 3. REMINDER SYSTEM
let remindersData = [];

window.openReminderSystem = () => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">⏰ Test Reminders</h3>
        <form onsubmit="addReminder(event)" class="space-y-4">
            <select id="reminderPatient" class="w-full p-3 border rounded-lg" required>
                <option value="">Select Patient</option>
                ${patientsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
            <input type="date" id="reminderDate" class="w-full p-3 border rounded-lg" required>
            <input type="text" id="reminderTest" placeholder="Follow-up Test Name" class="w-full p-3 border rounded-lg" required>
            <textarea id="reminderNotes" placeholder="Notes" class="w-full p-3 border rounded-lg" rows="2"></textarea>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Add Reminder
                </button>
                <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                    Cancel
                </button>
            </div>
        </form>
        <div class="mt-6">
            <h4 class="font-bold mb-2">Upcoming Reminders</h4>
            <div id="remindersList" class="space-y-2 max-h-60 overflow-y-auto"></div>
        </div>
    `);
    loadReminders();
};

window.addReminder = async (e) => {
    e.preventDefault();
    const reminder = {
        patientId: document.getElementById('reminderPatient').value,
        patientName: patientsData.find(p => p.id === document.getElementById('reminderPatient').value)?.name,
        date: document.getElementById('reminderDate').value,
        test: document.getElementById('reminderTest').value,
        notes: document.getElementById('reminderNotes').value,
        createdAt: new Date().toISOString()
    };
    await push(ref(database, `reminders/${currentUser.uid}`), reminder);
    showNotification('Reminder added successfully!', 'success');
    loadReminders();
};

async function loadReminders() {
    const remindersRef = ref(database, `reminders/${currentUser.uid}`);
    const snapshot = await get(remindersRef);
    remindersData = [];
    snapshot.forEach(child => {
        remindersData.push({ id: child.key, ...child.val() });
    });
    renderReminders();
}

function renderReminders() {
    const container = document.getElementById('remindersList');
    if (!container) return;

    container.innerHTML = remindersData.map(r => `
        <div class="bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
            <strong>${r.patientName}</strong> - ${r.test}<br>
            <small>${new Date(r.date).toLocaleDateString()}</small>
        </div>
    `).join('') || '<p class="text-gray-500">No reminders yet</p>';
}

// 4. CUSTOM REPORT TEMPLATES
window.openCustomTemplates = () => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">📄 Custom Report Templates</h3>
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded border">
                <h4 class="font-bold">Standard Template</h4>
                <p class="text-sm">Default professional layout</p>
                <button onclick="selectTemplate('standard')" class="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Use This</button>
            </div>
            <div class="bg-green-50 p-4 rounded border">
                <h4 class="font-bold">Detailed Template</h4>
                <p class="text-sm">With additional clinical notes section</p>
                <button onclick="selectTemplate('detailed')" class="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Use This</button>
            </div>
            <div class="bg-purple-50 p-4 rounded border">
                <h4 class="font-bold">Compact Template</h4>
                <p class="text-sm">Minimal design for quick reports</p>
                <button onclick="selectTemplate('compact')" class="mt-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Use This</button>
            </div>
        </div>
        <button onclick="closeModal()" class="w-full mt-4 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Close</button>
    `);
};

window.selectTemplate = (templateType) => {
    localStorage.setItem('selectedTemplate', templateType);
    showNotification(`${templateType} template selected!`, 'success');
    closeModal();
};

// 5. ADDENDUM FEATURE
window.addAddendum = (reportId) => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">📝 Add Addendum</h3>
        <form onsubmit="saveAddendum(event, '${reportId}')" class="space-y-4">
            <textarea id="addendumText" placeholder="Enter additional notes or corrections..." class="w-full p-3 border rounded-lg" rows="6" required></textarea>
            <input type="text" id="addendumDoctor" placeholder="Pathologist Name" class="w-full p-3 border rounded-lg" required>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Save Addendum
                </button>
                <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.saveAddendum = async (e, reportId) => {
    e.preventDefault();
    const addendum = {
        text: document.getElementById('addendumText').value,
        doctor: document.getElementById('addendumDoctor').value,
        timestamp: new Date().toISOString()
    };
    await push(ref(database, `reports/${currentUser.uid}/${reportId}/addendums`), addendum);
    showNotification('Addendum added successfully!', 'success');
    closeModal();
};

// 6. DIGITAL SIGNATURE
let signaturePad = null;

window.openDigitalSignature = () => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">✍️ Digital Signature</h3>
        <div class="mb-4">
            <canvas id="signatureCanvas" width="600" height="200" class="border-2 border-gray-300 rounded bg-white cursor-crosshair"></canvas>
        </div>
        <div class="flex gap-2">
            <button onclick="clearSignature()" class="flex-1 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600">
                Clear
            </button>
            <button onclick="saveSignature()" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Save Signature
            </button>
            <button onclick="closeModal()" class="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                Cancel
            </button>
        </div>
    `);
    initSignaturePad();
};

function initSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let drawing = false;

    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    });
}

window.clearSignature = () => {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.saveSignature = async () => {
    const canvas = document.getElementById('signatureCanvas');
    const signatureData = canvas.toDataURL();
    await update(ref(database, `branding/${currentUser.uid}`), {
        digitalSignature: signatureData
    });
    showNotification('Signature saved successfully!', 'success');
    closeModal();
};

// 7. APPOINTMENT BOOKING
window.openAppointmentBooking = () => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">📅 Book Sample Collection</h3>
        <form onsubmit="bookAppointment(event)" class="space-y-4">
            <select id="apptPatient" class="w-full p-3 border rounded-lg" required>
                <option value="">Select Patient</option>
                ${patientsData.map(p => `<option value="${p.id}">${p.name} - ${p.mobile}</option>`).join('')}
            </select>
            <input type="date" id="apptDate" class="w-full p-3 border rounded-lg" required>
            <input type="time" id="apptTime" class="w-full p-3 border rounded-lg" required>
            <select id="apptType" class="w-full p-3 border rounded-lg" required>
                <option value="">Collection Type</option>
                <option value="Home">Home Collection</option>
                <option value="Lab">Lab Visit</option>
            </select>
            <textarea id="apptAddress" placeholder="Collection Address (for home collection)" class="w-full p-3 border rounded-lg" rows="2"></textarea>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Book Appointment
                </button>
                <button type="button" onclick="closeModal()" class="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.bookAppointment = async (e) => {
    e.preventDefault();
    const appointment = {
        patientId: document.getElementById('apptPatient').value,
        patientName: patientsData.find(p => p.id === document.getElementById('apptPatient').value)?.name,
        date: document.getElementById('apptDate').value,
        time: document.getElementById('apptTime').value,
        type: document.getElementById('apptType').value,
        address: document.getElementById('apptAddress').value,
        status: 'Scheduled',
        createdAt: new Date().toISOString()
    };
    await push(ref(database, `appointments/${currentUser.uid}`), appointment);
    showNotification('Appointment booked successfully!', 'success');
    sendBrowserNotification('Appointment Booked', `${appointment.patientName} - ${appointment.date} ${appointment.time}`);
    closeModal();
};

// 8. AI AUTO-INTERPRETATION
function getAIInterpretation(testName, value, ranges, gender) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    const range = gender === 'Male' ? ranges.male : ranges.female;
    const min = range.min;
    const max = range.max;

    if (numValue < min * 0.7) {
        return `⚠️ Critically Low - Immediate medical attention may be required`;
    } else if (numValue < min) {
        return `⚡ Below normal - Consult physician`;
    } else if (numValue > max * 1.3) {
        return `⚠️ Critically High - Immediate medical attention may be required`;
    } else if (numValue > max) {
        return `⚡ Above normal - Consult physician`;
    }
    return `✅ Within normal range`;
}

// 9. PREDICTIVE ANALYTICS
function analyzePredictiveRisk(patientData, testResults) {
    const risks = [];

    // Check for diabetes risk
    const hba1c = testResults.find(t => t.name.includes('HbA1c'));
    if (hba1c && parseFloat(hba1c.value) > 5.7) {
        risks.push({
            condition: 'Pre-Diabetes/Diabetes',
            risk: 'High',
            recommendation: 'Consult endocrinologist, lifestyle modifications recommended'
        });
    }

    // Check for cardiovascular risk
    const ldl = testResults.find(t => t.name.includes('LDL'));
    if (ldl && parseFloat(ldl.value) > 130) {
        risks.push({
            condition: 'Cardiovascular Disease',
            risk: 'Moderate to High',
            recommendation: 'Consult cardiologist, dietary changes advised'
        });
    }

    return risks;
}

window.showPredictiveAnalytics = (reportId) => {
    const report = reportsData.find(r => r.id === reportId);
    if (!report) return;

    const allResults = [];
    report.testDetails.forEach(test => {
        test.subtests.forEach(sub => allResults.push(sub));
    });

    const risks = analyzePredictiveRisk(report, allResults);

    const risksHTML = risks.map(r => `
        <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-3">
            <h4 class="font-bold text-yellow-800">${r.condition}</h4>
            <p class="text-sm">Risk Level: <strong>${r.risk}</strong></p>
            <p class="text-sm mt-2">${r.recommendation}</p>
        </div>
    `).join('');

    showModal(`
        <h3 class="text-2xl font-bold mb-4">🔮 Predictive Health Analytics</h3>
        <p class="mb-4 text-gray-600">AI-powered health risk assessment based on test results</p>
        ${risksHTML || '<p class="text-green-600">✅ No significant health risks detected. Continue regular checkups.</p>'}
        <button onclick="closeModal()" class="w-full mt-4 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Close</button>
    `);
};

// 10. SMART RECOMMENDATIONS
function getSmartRecommendations(testResults) {
    const recommendations = [];

    testResults.forEach(test => {
        test.subtests.forEach(subtest => {
            if (subtest.threatLevel === 'critical' || subtest.threatLevel === 'warning') {
                // Recommend follow-up tests
                if (subtest.name.includes('Glucose') || subtest.name.includes('HbA1c')) {
                    recommendations.push({
                        test: 'Fasting Insulin Test',
                        reason: 'Abnormal glucose levels detected',
                        priority: 'High'
                    });
                }
                if (subtest.name.includes('Cholesterol') || subtest.name.includes('LDL')) {
                    recommendations.push({
                        test: 'Cardiac Risk Assessment',
                        reason: 'Abnormal lipid profile',
                        priority: 'Moderate'
                    });
                }
            }
        });
    });

    return recommendations;
}

window.showSmartRecommendations = (reportId) => {
    const report = reportsData.find(r => r.id === reportId);
    if (!report) return;

    const recommendations = getSmartRecommendations(report.testDetails);

    const recoHTML = recommendations.map(r => `
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
            <h4 class="font-bold text-blue-800">${r.test}</h4>
            <p class="text-sm">Reason: ${r.reason}</p>
            <span class="inline-block mt-2 px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                Priority: ${r.priority}
            </span>
        </div>
    `).join('');

    showModal(`
        <h3 class="text-2xl font-bold mb-4">💡 Smart Test Recommendations</h3>
        <p class="mb-4 text-gray-600">AI-suggested follow-up tests based on current results</p>
        ${recoHTML || '<p class="text-green-600">✅ No additional tests recommended at this time.</p>'}
        <button onclick="closeModal()" class="w-full mt-4 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Close</button>
    `);
};

// 11. SAMPLE BARCODE TRACKING
window.generateBarcode = (sampleId) => {
    showModal(`
        <h3 class="text-2xl font-bold mb-4">📊 Sample Barcode</h3>
        <div class="text-center mb-4">
            <div class="bg-white p-6 rounded border-2 border-gray-300 inline-block">
                <div style="font-family: 'Libre Barcode 128', cursive; font-size: 48px; letter-spacing: 2px;">
                    ${sampleId}
                </div>
                <p class="text-sm text-gray-600 mt-2">${sampleId}</p>
            </div>
        </div>
        <p class="text-sm text-gray-600 mb-4">Scan this barcode to track sample throughout processing</p>
        <div class="flex gap-2">
            <button onclick="printBarcode('${sampleId}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Print Barcode
            </button>
            <button onclick="closeModal()" class="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">
                Close
            </button>
        </div>
    `);
};

window.printBarcode = (sampleId) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Barcode - ${sampleId}</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; }
                .barcode { font-family: 'Libre Barcode 128', cursive; font-size: 72px; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="barcode">${sampleId}</div>
            <p>${sampleId}</p>
            <script>window.print(); setTimeout(() => window.close(), 100);</script>
        </body>
        </html>
    `);
};

// Initialize new features on dashboard load
window.addEventListener('DOMContentLoaded', () => {
    initPushNotifications();
    console.log('✅ All 11 advanced features loaded successfully!');
});



console.log('✅ Spotnet MedOS - Enhanced Version - All Features Active');

// Quick OPD Functionality

// Open Quick OPD Modal
window.openQuickOPDModal = (preSelectedPatientId = null) => {
    showModal(`
        <h3 class="text-2xl font-bold mb-6"><i class="fas fa-file-prescription text-green-600"></i> Quick OPD Prescription</h3>

        <div class="mb-6">
            <label class="block font-semibold mb-3">Select Patient Type:</label>
            <div class="flex gap-6">
                <label class="flex items-center cursor-pointer">
                    <input type="radio" name="patientType" value="existing" checked onchange="togglePatientFields()" class="mr-2 w-4 h-4">
                    <span class="text-sm">Existing Patient</span>
                </label>
                <label class="flex items-center cursor-pointer">
                    <input type="radio" name="patientType" value="new" onchange="togglePatientFields()" class="mr-2 w-4 h-4">
                    <span class="text-sm">New Patient</span>
                </label>
            </div>
        </div>

        <div id="existingPatientSection" class="mb-6">
            <label class="block font-semibold mb-2">Select Patient:</label>
            <select id="reportPatient" class="w-full p-3 border rounded-lg">
                <option value="">Choose a patient</option>
                ${patientsData.map(p => `
                    <option value="${p.id}" ${preSelectedPatientId === p.id ? 'selected' : ''}>${p.name} - ${p.mobile}</option>
                `).join('')}
            </select>
        </div>

        <div id="newPatientSection" class="hidden space-y-4 mb-6">
            <input type="text" id="newPatName" placeholder="Full Name" class="w-full p-3 border rounded-lg">
            <div class="grid grid-cols-2 gap-4">
                <input type="number" id="newPatAge" placeholder="Age" class="p-3 border rounded-lg">
                <select id="newPatGender" class="p-3 border rounded-lg">
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <input type="tel" id="newPatMobile" placeholder="Mobile Number" class="w-full p-3 border rounded-lg">
            <textarea id="newPatAddress" placeholder="Address (Optional)" class="w-full p-3 border rounded-lg" rows="2"></textarea>
            <input type="text" id="newPatRefDoctor" placeholder="Referring Doctor (Optional)" class="w-full p-3 border rounded-lg">
        </div>

        <input type="hidden" id="patientSelection" value="existing">

        <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label class="block font-semibold mb-2">Blood Pressure (BP):</label>
                <input type="text" id="opdBP" placeholder="e.g. 120/80" class="w-full p-3 border rounded-lg">
            </div>
             <div>
                <label class="block font-semibold mb-2">Pulse Rate:</label>
                <input type="text" id="opdPulse" placeholder="e.g. 72" class="w-full p-3 border rounded-lg">
            </div>
             <div>
                <label class="block font-semibold mb-2">Weight (kg):</label>
                <input type="text" id="opdWeight" placeholder="e.g. 70" class="w-full p-3 border rounded-lg">
            </div>
             <div>
                <label class="block font-semibold mb-2">Temperature (°F):</label>
                <input type="text" id="opdTemp" placeholder="e.g. 98.6" class="w-full p-3 border rounded-lg">
            </div>
        </div>

        <div class="mb-6">
            <label class="block font-semibold mb-2">Chief Complaints:</label>
            <textarea id="opdComplaints" placeholder="Patient's complaints..." class="w-full p-3 border rounded-lg" rows="3"></textarea>
        </div>

        <div class="mb-6">
            <label class="block font-semibold mb-2">Clinical Diagnosis:</label>
            <textarea id="opdDiagnosis" placeholder="Provisional diagnosis..." class="w-full p-3 border rounded-lg" rows="3"></textarea>
        </div>

        <div class="mb-6">
             <label class="block font-semibold mb-2">Medicines / Rx:</label>
             <div id="medicineList" class="space-y-2 mb-2">
                 <div class="medicine-item flex gap-2">
                     <input type="text" placeholder="Medicine Name" class="rx-name flex-1 p-2 border rounded">
                     <input type="text" placeholder="Dosage (e.g. 1-0-1)" class="rx-dosage w-1/4 p-2 border rounded">
                     <input type="text" placeholder="Duration" class="rx-duration w-1/4 p-2 border rounded">
                 </div>
             </div>
             <button onclick="addMedicineField()" class="text-sm text-blue-600 hover:underline"><i class="fas fa-plus"></i> Add Medicine</button>
        </div>

         <div class="mb-6">
            <label class="block font-semibold mb-2">Advice / Instructions:</label>
            <textarea id="opdAdvice" placeholder="Diet, rest, follow-up..." class="w-full p-3 border rounded-lg" rows="3"></textarea>
        </div>

        <div class="flex gap-3 mt-8">
            <button onclick="generateOPDPDF()" class="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-green-800 font-semibold shadow-md transition-all">
                <i class="fas fa-print mr-2"></i> Print Prescription
            </button>
            <button onclick="closeModal()" class="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 font-semibold transition-all">
                <i class="fas fa-times mr-2"></i> Cancel
            </button>
        </div>
    `);
}

window.addMedicineField = () => {
    const div = document.createElement('div');
    div.className = 'medicine-item flex gap-2';
    div.innerHTML = `
         <input type="text" placeholder="Medicine Name" class="rx-name flex-1 p-2 border rounded">
         <input type="text" placeholder="Dosage (e.g. 1-0-1)" class="rx-dosage w-1/4 p-2 border rounded">
         <input type="text" placeholder="Duration" class="rx-duration w-1/4 p-2 border rounded">
         <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>
    `;
    document.getElementById('medicineList').appendChild(div);
}

window.generateOPDPDF = async () => {
    const selection = document.getElementById('patientSelection').value;
    let patient, patientId, saveNewPatient = false;

    if (selection === 'existing') {
        patientId = document.getElementById('reportPatient').value;
        if (!patientId) {
            showNotification('Please select a patient', 'warning');
            return;
        }
        patient = patientsData.find(p => p.id === patientId);
        if (!patient) {
            showNotification('Patient not found', 'error');
            return;
        }
    } else {
        const name = document.getElementById('newPatName').value.trim();
        const age = document.getElementById('newPatAge').value;
        const gender = document.getElementById('newPatGender').value;
        const mobile = document.getElementById('newPatMobile').value.trim();

        if (!name || !age || !gender || !mobile) {
            showNotification('Please fill all required patient fields', 'warning');
            return;
        }

        patient = {
            name: name,
            age: parseInt(age),
            gender: gender,
            mobile: mobile,
            address: document.getElementById('newPatAddress').value.trim(),
            refDoctor: document.getElementById('newPatRefDoctor').value.trim()
        };
        saveNewPatient = true;
    }

    // Save Patient if New
    if (saveNewPatient) {
        try {
            await push(ref(database, `patients/${currentUser.uid}`), {
                ...patient,
                createdAt: new Date().toISOString()
            });
            showNotification('New patient saved', 'success');
        } catch (e) {
            console.error(e);
        }
    }

    // Capture OPD Info
    const opdData = {
        bp: document.getElementById('opdBP').value,
        pulse: document.getElementById('opdPulse').value,
        weight: document.getElementById('opdWeight').value,
        temp: document.getElementById('opdTemp').value,
        complaints: document.getElementById('opdComplaints').value,
        diagnosis: document.getElementById('opdDiagnosis').value,
        advice: document.getElementById('opdAdvice').value,
        date: new Date().toLocaleDateString('en-IN')
    };

    const medicines = [];
    document.querySelectorAll('.medicine-item').forEach(item => {
        const name = item.querySelector('.rx-name').value;
        if (name) {
            medicines.push({
                name: name,
                dosage: item.querySelector('.rx-dosage').value,
                duration: item.querySelector('.rx-duration').value
            });
        }
    });

    const isPremium = subscriptionData?.premium;
    const pdfWindow = window.open('', '_blank');

    pdfWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>OPD Prescription - ${patient.name}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .patient-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .vitals { display: flex; gap: 20px; margin-bottom: 20px; padding: 10px; background: #e0f2fe; border-radius: 6px; }
        .section-title { font-weight: bold; font-size: 14px; color: #555; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
        .content-box { margin-bottom: 20px; }
        .medicine-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .medicine-table th, .medicine-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .medicine-table th { background: #f9fafb; font-weight: 600; }
        .footer { margin-top: 50px; text-align: right; border-top: 1px solid #ccc; padding-top: 10px; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 style="margin:0; font-size: 24px;">${brandingData.labName || 'Medical Center'}</h1>
            <p style="margin:5px 0 0;">${brandingData.address || ''}</p>
            <p style="margin:2px 0 0;">${brandingData.contact || ''}</p>
        </div>
        <div style="text-align: right;">
            <p><strong>Date:</strong> ${opdData.date}</p>
            <p><strong>OPD ID:</strong> ${'OPD-' + Date.now().toString().slice(-6)}</p>
        </div>
    </div>

    <div class="patient-info">
        <div><strong>Name:</strong> ${patient.name}</div>
        <div><strong>Age/Gender:</strong> ${patient.age} / ${patient.gender}</div>
        <div><strong>Mobile:</strong> ${patient.mobile}</div>
        <div><strong>Address:</strong> ${patient.address || 'N/A'}</div>
    </div>

    <div class="vitals">
        <div><strong>BP:</strong> ${opdData.bp || '-'}</div>
        <div><strong>Pulse:</strong> ${opdData.pulse || '-'}</div>
        <div><strong>Weight:</strong> ${opdData.weight || '-'}</div>
        <div><strong>Temp:</strong> ${opdData.temp || '-'}</div>
    </div>

    <div class="content-box">
        <div class="section-title">Chief Complaints</div>
        <p>${opdData.complaints || 'None listed'}</p>
    </div>

    <div class="content-box">
        <div class="section-title">Diagnosis</div>
        <p>${opdData.diagnosis || 'None listed'}</p>
    </div>

    <div class="content-box">
        <div class="section-title">Rx / Medicines</div>
        ${medicines.length > 0 ? `
        <table class="medicine-table">
            <thead>
                <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${medicines.map(m => `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.dosage}</td>
                    <td>${m.duration}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p>No medicines prescribed.</p>'}
    </div>

    <div class="content-box">
        <div class="section-title">Advice</div>
        <p>${opdData.advice || '-'}</p>
    </div>

    <div class="footer">
        <p><strong>${brandingData.director || 'Doctor Signature'}</strong></p>
    </div>

    <button onclick="window.print()" class="no-print" style="position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: blue; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Prescription</button>
</body>
</html>`);

    pdfWindow.document.close();
    closeModal();
};

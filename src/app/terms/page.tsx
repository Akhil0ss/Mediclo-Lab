export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-slate-50 py-16 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-file-contract text-white"></i>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Terms of Service</h1>
                </div>

                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Last Updated: April 2026</p>

                <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">1. Service Description</h2>
                        <p className="text-slate-600">Mediclo (Spotnet MedOS) is a cloud-based clinical laboratory information and management system (LIMS) that provides patient registration, sample tracking, lab report generation, OPD management, pharmacy dispensing, and AI-assisted clinical tools.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">2. User Responsibilities</h2>
                        <ul className="list-disc pl-6 text-slate-600 space-y-1">
                            <li>Maintain the confidentiality of staff login credentials</li>
                            <li>Ensure accurate patient data entry</li>
                            <li>Verify all AI-generated clinical suggestions before acting on them</li>
                            <li>Comply with applicable medical regulations and patient privacy laws</li>
                            <li>Maintain appropriate professional licenses for clinical activities</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">3. AI-Assisted Features</h2>
                        <p className="text-slate-600 bg-red-50 border border-red-200 rounded-xl p-4">
                            <strong>⚠️ Medical Disclaimer:</strong> AI-generated suggestions, including diagnosis aids, drug interaction warnings, and lifestyle recommendations, are provided as <strong>assistive tools only</strong>. They do <strong>not</strong> constitute medical advice, diagnosis, or treatment. The healthcare provider retains full responsibility for all clinical decisions. AI outputs may contain errors and must be independently verified.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">4. Data Ownership</h2>
                        <p className="text-slate-600">All patient data entered into the system remains the property of the healthcare facility (clinic/lab owner). The service provider does not claim ownership of clinical data and processes data solely as a data processor on behalf of the healthcare facility.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">5. Service Availability</h2>
                        <p className="text-slate-600">We strive for 99.9% uptime but do not guarantee uninterrupted service. The service depends on third-party infrastructure (Firebase, Vercel, Groq AI) which may experience independent outages.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">6. Limitation of Liability</h2>
                        <p className="text-slate-600">The service is provided &quot;as-is&quot; without warranties of any kind. The service provider is not liable for clinical decisions made based on AI suggestions or for any data loss, service interruption, or indirect damages arising from the use of the platform.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">7. Termination</h2>
                        <p className="text-slate-600">Either party may terminate the subscription with 30 days notice. Upon termination, a data export will be provided in standard format. Data will be retained for the regulatory minimum period before secure deletion.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}

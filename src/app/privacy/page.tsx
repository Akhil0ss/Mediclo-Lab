export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-50 py-16 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-shield-alt text-white"></i>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Privacy Policy</h1>
                </div>
                
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Last Updated: April 2026</p>

                <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">1. Information We Collect</h2>
                        <p className="text-slate-600">We collect the following information to provide clinical laboratory and healthcare management services:</p>
                        <ul className="list-disc pl-6 text-slate-600 space-y-1">
                            <li>Patient demographics (name, age, gender, contact information)</li>
                            <li>Clinical data (lab results, prescriptions, vitals, diagnoses)</li>
                            <li>Staff authentication credentials (encrypted)</li>
                            <li>Usage analytics for service improvement</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">2. How We Use Your Data</h2>
                        <ul className="list-disc pl-6 text-slate-600 space-y-1">
                            <li>To provide clinical laboratory management services</li>
                            <li>To generate diagnostic reports and prescriptions</li>
                            <li>To facilitate patient-provider communication</li>
                            <li>To provide AI-assisted clinical insights (with clear disclaimers)</li>
                            <li>To maintain audit trails for regulatory compliance</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">3. Data Protection</h2>
                        <p className="text-slate-600">All patient data is stored in encrypted databases with role-based access controls. Staff authentication uses bcrypt-hashed passwords. Firebase security rules enforce that each clinic can only access their own data.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">4. AI Usage Disclaimer</h2>
                        <p className="text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <strong>⚠️ Important:</strong> This platform uses AI-powered analysis (via third-party LLM APIs) to provide assistive clinical suggestions including diagnosis aids, drug interaction checks, and lifestyle advice. These AI suggestions are <strong>not a substitute for professional medical judgment</strong>. All AI-generated content should be reviewed and validated by a qualified healthcare professional before any clinical decision is made.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">5. Data Retention</h2>
                        <p className="text-slate-600">Medical records are retained in accordance with applicable Indian medical regulations (minimum 7 years). Automated cleanup processes archive stale operational data but never delete permanent medical records.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">6. Your Rights (DPDP Act 2023)</h2>
                        <p className="text-slate-600">Under the Digital Personal Data Protection Act, 2023 (India), you have the right to:</p>
                        <ul className="list-disc pl-6 text-slate-600 space-y-1">
                            <li>Access your personal data held by the clinic</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request erasure of your data (subject to medical retention requirements)</li>
                            <li>Withdraw consent for AI analysis of your data</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">7. Contact</h2>
                        <p className="text-slate-600">For privacy-related inquiries, contact your healthcare provider or reach us at the contact information provided in the application.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}

/**
 * Groq AI Service - Token-Optimized Medical AI
 * 
 * Uses Groq's ultra-fast LLM with minimal token usage
 * Model: llama-3.3-70b-versatile (best balance of speed/quality)
 */

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // Fastest, cheapest, huge free limit

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GroqResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Core Groq API call - Redirected through Secure Server-Side Proxy
 */
async function callGroq(
    messages: GroqMessage[],
    maxTokens: number = 500,
    temperature: number = 0.3
): Promise<{ response: string; tokens: number }> {
    try {
        const response = await fetch('/api/ai/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                max_tokens: maxTokens,
                temperature,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('AI Proxy Error:', errorBody);
            throw new Error(`AI service error: ${response.status}`);
        }

        const data = await response.json();
        return {
            response: data.response,
            tokens: data.tokens || 0,
        };
    } catch (error) {
        console.error('Groq AI error:', error);
        throw error;
    }
}

/**
 * 1. AI Report Analysis - Flag abnormals, generate insights
 */
export async function analyzeLabReport(
    testResults: Array<{ test: string; value: string; unit: string; normalRange?: string }>,
    patientAge: number,
    patientGender: string
): Promise<{
    abnormals: string[];
    insights: string;
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
    confidenceScore: number;
}> {
    // Token-optimized prompt (concise, structured)
    const prompt = `Analyze lab results for ${patientAge}Y ${patientGender}:
${testResults.map(t => `${t.test}: ${t.value}${t.unit}${t.normalRange ? ` (Normal: ${t.normalRange})` : ''}`).join('\n')}

Output JSON only:
{
  "abnormals": ["test names with abnormal values"],
  "insights": "brief medical interpretation (max 2 sentences)",
  "recommendations": ["max 3 actionable suggestions"],
  "riskLevel": "low|medium|high",
  "confidenceScore": 0-100
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'You are a medical lab AI. Output raw JSON only. Do NOT use markdown code blocks or formatting.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 300, 0.2);

    try {
        // Clean potential markdown formatting which breaks JSON.parse
        const cleanResponse = result.response
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        return JSON.parse(cleanResponse);
    } catch (e) {
        console.warn('Groq JSON Parse Error:', e);
        // Fallback if JSON parsing fails
        return {
            abnormals: [],
            insights: "Unable to analyze automatically. Please review manually.",
            recommendations: [],
            riskLevel: 'low',
            confidenceScore: 0
        };
    }
}

/**
 * 2. Smart Prescription Assistant - Drug interactions, suggestions
 */
export async function checkDrugInteractions(
    medicines: Array<{ name: string; dosage: string }>
): Promise<{
    hasInteractions: boolean;
    warnings: string[];
    suggestions: string[];
}> {
    const prompt = `Check drug interactions:
${medicines.map((m, i) => `${i + 1}. ${m.name} ${m.dosage}`).join('\n')}

JSON output:
{
  "hasInteractions": boolean,
  "warnings": ["critical warnings only"],
  "suggestions": ["safer alternatives if needed"]
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical pharmacology AI. Output JSON only. Focus on critical interactions.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 250, 0.1);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            hasInteractions: false,
            warnings: [],
            suggestions: []
        };
    }
}

/**
 * 3. Prescription Template Suggestions
 */
export async function suggestPrescription(
    diagnosis: string,
    symptoms: string,
    patientAge: number
): Promise<{
    medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>;
    advice: string;
}> {
    const prompt = `Diagnosis: ${diagnosis}
Symptoms: ${symptoms}
Age: ${patientAge}Y

Suggest prescription (JSON):
{
  "medicines": [{"name":"","dosage":"","frequency":"","duration":""}],
  "advice": "brief patient advice"
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical prescription AI. Output JSON. Use generic names. Be conservative.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 300, 0.3);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            medicines: [],
            advice: ''
        };
    }
}

export async function suggestLifestyleAdvice(
    diagnosis: string,
    symptoms: string,
    history?: string
): Promise<string> {
    const prompt = `Diagnosis: ${diagnosis}, Symptoms: ${symptoms}. ${history ? `Patient History: ${history}` : ''}
    Provide EXACTLY 3 short, professional clinical advice bullet points.
    Rules:
    - Use "-" for bullets
    - NO markdown stars (** or *)
    - NO bold or headers
    - Max 10 words per point
    - Clinical tone only
    
    Format example:
    - Advice point one
    - Advice point two
    - Advice point three`;
    
    const result = await callGroq([
        { role: 'system', content: 'Professional Medical Advisor. Clean text output only, no formatting.' },
        { role: 'user', content: prompt }
    ], 150, 0.2);
    
    return result.response.trim();
}

/**
 * 3.2 AI Medicine Intelligence - Dosage, Frequency, and Side Effects
 */
export async function getMedicineIntelligence(
    medicineName: string,
    patientAge: number
): Promise<{ 
    dosage: string; 
    frequency: string; 
    duration: string;
    instructions: string;
    complications: string;
    doctorTips: string;
}> {
    const prompt = `Medicine: ${medicineName}, Patient Age: ${patientAge}Y.
    Provide standard clinical guidance (JSON):
    {
      "dosage": "e.g. 500mg",
      "frequency": "OD/BD/TDS",
      "duration": "5 Days",
      "instructions": "After Food/Empty Stomach",
      "complications": "Max 5 words (e.g. Nausea, Gastric irritation)",
      "doctorTips": "Max 10 words (e.g. Check renal function if long term)"
    }`;
    const result = await callGroq([
        { role: 'system', content: 'Pharmacology AI. Provide concise medical guidance. Output raw JSON only.' }, 
        { role: 'user', content: prompt }
    ], 200, 0.1);
    try {
        const cleanResponse = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch {
        return { 
            dosage: '', 
            frequency: 'BD', 
            duration: '5 Days', 
            instructions: 'After Food',
            complications: 'No common complications noted.',
            doctorTips: 'Follow standard adult dosage guidelines.'
        };
    }
}

/**
 * 4. Intelligent Patient Triage - Priority scoring
 */
export async function triagePatient(
    complaints: string,
    vitals: { bp?: string; pulse?: string; temp?: string; spo2?: string },
    age: number
): Promise<{
    priority: 'low' | 'medium' | 'high' | 'emergency';
    reason: string;
    suggestedDoctor: 'general' | 'cardiologist' | 'pulmonologist' | 'pediatrician' | 'emergency';
}> {
    const prompt = `Triage patient:
Age: ${age}Y
Complaints: ${complaints}
Vitals: BP=${vitals.bp || 'N/A'} Pulse=${vitals.pulse || 'N/A'} Temp=${vitals.temp || 'N/A'} SpO2=${vitals.spo2 || 'N/A'}

JSON:
{
  "priority": "low|medium|high|emergency",
  "reason": "brief justification",
  "suggestedDoctor": "specialty"
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical triage AI. Output JSON. Prioritize patient safety.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 200, 0.1);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            priority: 'medium',
            reason: 'Unable to assess',
            suggestedDoctor: 'general'
        };
    }
}

/**
 * 5. Smart Search - Natural language to query
 */
export async function parseNaturalQuery(query: string): Promise<{
    filters: {
        dateRange?: { start: string; end: string };
        condition?: string;
        testType?: string;
        ageRange?: { min: number; max: number };
        gender?: string;
    };
    intent: string;
}> {
    const prompt = `Parse search query: "${query}"

JSON:
{
  "filters": {
    "dateRange": {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
    "condition": "disease/symptom",
    "testType": "test name",
    "ageRange": {"min":0,"max":100},
    "gender": "M/F"
  },
  "intent": "what user wants"
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Query parser AI. Output JSON. Extract filters from natural language.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 200, 0.2);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            filters: {},
            intent: query
        };
    }
}

/**
 * 6. Auto-generate Patient Summary
 */
export async function generatePatientSummary(
    visits: Array<{ date: string; diagnosis: string; medicines: string[] }>,
    reports: Array<{ date: string; type: string; findings: string }>
): Promise<string> {
    const prompt = `Summarize patient history (max 3 sentences):

Visits:
${visits.slice(0, 5).map(v => `${v.date}: ${v.diagnosis}`).join('\n')}

Reports:
${reports.slice(0, 3).map(r => `${r.date}: ${r.type} - ${r.findings}`).join('\n')}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical summarization AI. Be concise and clear.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 150, 0.3);

    return result.response;
}

/**
 * 6. Longitudinal Clinical History Insight - Processes all past visits + reports
 */
export async function generateClinicalHistoryInsight(
    visits: Array<{ date: string; diagnosis: string; medicines: string[]; vitals: any }>,
    reports: Array<{ date: string; test: string; threatLevel: string; findings?: string }>
): Promise<{
    narrative: string;
    trends: string[];
    riskFactors: string[];
    recommendations: string[];
}> {
    const prompt = `Analyze patient longitudinal data:

Visit History (Diagnoses & Medication):
${visits.slice(0, 10).map(v => `${v.date}: ${v.diagnosis} (Medicines: ${v.medicines.join(', ')})`).join('\n')}

Lab History (Critical Patterns):
${reports.slice(0, 10).map(r => `${r.date}: ${r.test} - Status: ${r.threatLevel}`).join('\n')}

Output JSON ONLY:
{
  "narrative": "3-sentence medical history summary",
  "trends": ["up to 3 clinical trends spotted (e.g., BP rising, repeat infections)"],
  "riskFactors": ["up to 2 lifestyle/clinical risks identified"],
  "recommendations": ["up to 2 next-step clinical recommendations"]
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'You are a senior Clinical Informatics AI. Synthesize long-term patient data. Be precise, medical, and evidence-based. Output raw JSON only.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 450, 0.2);

    try {
        const cleanResponse = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (e) {
        console.warn('Clinical Insight Parse Error:', e);
        return {
            narrative: "Unable to synthesize clinical history automatically. Please review visits and reports manually.",
            trends: [],
            riskFactors: [],
            recommendations: []
        };
    }
}

/**
 * 7. Explain Medical Terms (Patient-Friendly)
 */
export async function explainMedicalTerm(term: string): Promise<string> {
    const prompt = `Explain "${term}" in simple language (1 sentence).`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical educator AI. Use simple words. No jargon.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 100, 0.4);

    return result.response;
}

/**
 * Token usage tracker (for monitoring)
 */
let totalTokensUsed = 0;

export function getTokenUsage(): number {
    return totalTokensUsed;
}

export function resetTokenUsage(): void {
    totalTokensUsed = 0;
}

/**
 * 8. AI Analytics Insights
 */
export async function generateAIAnalytics(
    metrics: any
): Promise<{
    summary: string;
    highlights: string[];
    recommendations: string[];
}> {
    const prompt = `Analyze Lab metrics:
Patients: ${metrics.totalPatients} (+${metrics.newPatientsToday} today)
Reports: ${metrics.totalReports} (+${metrics.reportsToday} today)
Pending Samples: ${metrics.pendingSamples}
Revenue: ₹${metrics.totalRevenue} (Month: ₹${metrics.revenueThisMonth})

JSON:
{
  "summary": "1 sentence overview",
  "highlights": ["3 key positive/negative trends"],
  "recommendations": ["2 business/operational suggestions"]
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Business analyst AI. Output JSON. Be professional.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 350, 0.4);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            summary: "Unable to generate analytics insights.",
            highlights: [],
            recommendations: []
        };
    }
}

/**
 * 9. AI Diagnosis Assistant - Suggest possible diagnoses based on complaints
 */
export async function suggestDiagnosis(
    complaints: string,
    vitals: { bp?: string; pulse?: string; temp?: string; spo2?: string; weight?: string },
    age: number,
    gender: string,
    history?: string
): Promise<{
    possibleDiagnoses: Array<{ name: string; probability: string; reasoning: string }>;
    recommendedTests: string[];
    urgencyLevel: 'low' | 'medium' | 'high' | 'emergency';
    differentialNote: string;
}> {
    const prompt = `Patient Assessment:
Age: ${age}Y, Gender: ${gender}
Complaints: ${complaints}
Vitals: BP=${vitals.bp || 'N/A'}, Pulse=${vitals.pulse || 'N/A'}, Temp=${vitals.temp || 'N/A'}, SpO2=${vitals.spo2 || 'N/A'}
${history ? `Clinical History Context: ${history}` : ''}

Provide differential diagnosis (JSON):
{
  "possibleDiagnoses": [
    {"name": "Most likely diagnosis", "probability": "high/medium/low", "reasoning": "brief clinical reasoning"},
    {"name": "Second possibility", "probability": "medium/low", "reasoning": "why considered"}
  ],
  "recommendedTests": ["specific lab/imaging tests to confirm"],
  "urgencyLevel": "low|medium|high|emergency",
  "differentialNote": "brief clinical note on differential diagnosis approach"
}`;

    const result = await callGroq([
        {
            role: 'system',
            content: 'Medical diagnostic AI. Output JSON only. Provide differential diagnosis. Be conservative and evidence-based.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 800, 0.2);

    try {
        const cleanResponse = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch {
        return {
            possibleDiagnoses: [],
            recommendedTests: [],
            urgencyLevel: 'medium',
            differentialNote: 'Unable to generate diagnosis suggestions.'
        };
    }
}

/**
 * 10. Lab Operations AI Assistant (Sidebar Tips)
 */
export async function generateLabSuggestions(
    recentReports: Array<{ testName: string; status: string }>
): Promise<{
    suggestions: Array<{ icon: string; text: string }>;
}> {
    const prompt = `Analyze these recent lab tests/reports and give 3 precise, actionable tips for the lab technician (e.g. equipment calibration, sample handling workflow, reporting speed, error prevention).
Recent Tests: ${recentReports.length > 0 ? recentReports.map(r => `${r.testName} (${r.status})`).join(', ') : 'No recent tests found. Provide general top-tier lab best practices.'}

Output JSON ONLY format:
{
  "suggestions": [
     {"icon": "fas fa-microscope", "text": "Short actionable tip (max 10 words)"}
  ]
}`;

    const result = await callGroq([
        { role: 'system', content: 'You are a Clinical Lab Manager AI. Give actionable, hyper-concise technical workflow tips. Output raw JSON only.' },
        { role: 'user', content: prompt }
    ], 250, 0.4);

    try {
        const cleanResponse = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch {
        return {
            suggestions: [
                { icon: "fas fa-vial", text: "Ensure proper sample centrifugation times." },
                { icon: "fas fa-thermometer-half", text: "Monitor reagent fridge temperature logs." },
                { icon: "fas fa-clipboard-check", text: "Double-check patient IDs before testing." }
            ]
        };
    }
}



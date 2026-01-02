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
 * Core Groq API call with token optimization
 */
async function callGroq(
    messages: GroqMessage[],
    maxTokens: number = 500,
    temperature: number = 0.3
): Promise<{ response: string; tokens: number }> {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                max_tokens: maxTokens,
                temperature, // Lower = more focused, less creative
                top_p: 0.9,
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.statusText}`);
        }

        const data: GroqResponse = await response.json();

        return {
            response: data.choices[0].message.content,
            tokens: data.usage.total_tokens,
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
            content: 'You are a medical lab AI. Output only valid JSON. Be concise.'
        },
        {
            role: 'user',
            content: prompt
        }
    ], 300, 0.2);

    try {
        return JSON.parse(result.response);
    } catch {
        // Fallback if JSON parsing fails
        return {
            abnormals: [],
            insights: result.response,
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
    const prompt = `Analyze hospital metrics:
Patients: ${metrics.totalPatients} (+${metrics.newPatientsToday} today)
OPD: ${metrics.totalOPDVisits} (+${metrics.opdToday} today)
Reports: ${metrics.totalReports}
Revenue: ₹${metrics.totalRevenue} (Month: ₹${metrics.revenueThisMonth})
Doctors: ${metrics.totalDoctors}

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
    gender: string
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
    ], 400, 0.2);

    try {
        return JSON.parse(result.response);
    } catch {
        return {
            possibleDiagnoses: [],
            recommendedTests: [],
            urgencyLevel: 'medium',
            differentialNote: 'Unable to generate diagnosis suggestions.'
        };
    }
}


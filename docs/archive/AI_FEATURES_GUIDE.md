# AI Features Setup Guide

## 🚀 Quick Start

### 1. Get Groq API Key (FREE)

1. Go to https://console.groq.com
2. Sign up with Google/Email
3. Navigate to API Keys
4. Create new API key
5. Copy the key

### 2. Add to Environment Variables

Create/update `.env.local`:

```env
NEXT_PUBLIC_GROQ_API_KEY=gsk_your_api_key_here
```

### 3. Restart Development Server

```bash
npm run dev
```

---

## 🤖 AI Features Implemented

### 1. **AI Report Analysis** ✅
- **Location**: QuickReportModal, Reports page
- **Function**: Analyzes lab results, flags abnormals, provides insights
- **Token Usage**: ~200-300 tokens per analysis
- **Staff Only**: Yes

### 2. **Smart Prescription Assistant** ✅
- **Location**: RxModal, OPD consultation
- **Function**: Checks drug interactions, suggests prescriptions
- **Token Usage**: ~150-250 tokens per check
- **Staff Only**: Yes

### 3. **Intelligent Patient Triage** ✅
- **Location**: OPD Queue creation
- **Function**: Auto-assigns priority based on symptoms/vitals
- **Token Usage**: ~150-200 tokens per triage
- **Staff Only**: Yes

### 4. **Smart Search** ✅
- **Location**: Patients, Reports, Samples pages
- **Function**: Natural language search ("Show diabetic patients")
- **Token Usage**: ~100-150 tokens per query
- **Staff Only**: Yes

### 5. **Patient Summary Generator** ✅
- **Location**: Patient profile view
- **Function**: Auto-generates medical history summary
- **Token Usage**: ~150-200 tokens per summary
- **Staff Only**: Yes

### 6. **Medical Term Explainer** ✅
- **Location**: Inline tooltips on medical terms
- **Function**: Simple explanations for complex terms
- **Token Usage**: ~50-100 tokens per term
- **Staff Only**: Yes

### 7. **Quality Control Checker** ✅
- **Location**: Report/Prescription finalization
- **Function**: Detects data entry errors, missing info
- **Token Usage**: ~100-150 tokens per check
- **Staff Only**: Yes

---

## 💰 Cost Estimation

### Groq Pricing (as of Dec 2024)
- **FREE Tier**: 14,400 requests/day
- **Paid**: $0.10 per 1M tokens (extremely cheap)

### Expected Usage
- **Small Lab** (50 patients/day): ~50,000 tokens/day = **$0.005/day** = **$1.50/month**
- **Medium Lab** (200 patients/day): ~200,000 tokens/day = **$0.02/day** = **$6/month**
- **Large Lab** (500 patients/day): ~500,000 tokens/day = **$0.05/day** = **$15/month**

**Conclusion**: Essentially FREE for most labs!

---

## 🎯 Token Optimization Strategies

### 1. **Concise Prompts**
- Use structured JSON output
- Avoid unnecessary context
- Direct, specific instructions

### 2. **Smart Caching**
- Cache drug interaction database locally
- Reuse analysis for similar reports
- Store common medical explanations

### 3. **Batch Processing**
- Analyze multiple reports together
- Bulk triage for queue
- Combined searches

### 4. **Fallback Logic**
- Local validation before AI
- Rule-based checks for simple cases
- AI only for complex scenarios

---

## 🔒 Privacy & Security

### Data Handling
- ✅ No patient data stored by Groq
- ✅ API calls are encrypted (HTTPS)
- ✅ No training on your data
- ✅ HIPAA-compliant infrastructure

### Best Practices
1. **Anonymize when possible**: Use age/gender instead of names
2. **Minimal data**: Send only necessary fields
3. **Local processing first**: Validate locally before AI
4. **Audit logs**: Track all AI usage

---

## 📊 Monitoring Token Usage

```typescript
import { getTokenUsage, resetTokenUsage } from '@/lib/groqAI';

// Check total tokens used
const tokens = getTokenUsage();
console.log(`Tokens used today: ${tokens}`);

// Reset counter (do this daily)
resetTokenUsage();
```

---

## 🚫 Patient-Facing Restrictions

**IMPORTANT**: AI outputs are NEVER shown to patients:
- ❌ Not in PDF reports
- ❌ Not in patient dashboard
- ❌ Not in patient portal
- ✅ Only visible to doctors/staff

---

## 🛠️ Troubleshooting

### "API Key Invalid"
- Check `.env.local` file exists
- Verify key starts with `gsk_`
- Restart dev server after adding key

### "Rate Limit Exceeded"
- Free tier: 14,400 requests/day
- Upgrade to paid tier if needed
- Implement request throttling

### "Slow Response"
- Groq is typically <1 second
- Check internet connection
- Verify API endpoint is correct

---

## 🎨 UI Integration Examples

### In Report Modal
```tsx
import AIReportAnalysis from '@/components/AIReportAnalysis';

<AIReportAnalysis
  testResults={results}
  patientAge={25}
  patientGender="M"
  onAnalysisComplete={(analysis) => {
    // Use analysis data
  }}
/>
```

### In Prescription Modal
```tsx
import AIPrescriptionAssistant from '@/components/AIPrescriptionAssistant';

<AIPrescriptionAssistant
  medicines={medicines}
  diagnosis={diagnosis}
  symptoms={symptoms}
  patientAge={age}
  onSuggestionAccept={(meds) => {
    // Add suggested medicines
  }}
/>
```

### In OPD Queue
```tsx
import AITriage from '@/components/AITriage';

<AITriage
  complaints={complaints}
  vitals={vitals}
  age={age}
  autoTriage={true}
  onTriageComplete={(result) => {
    // Set priority automatically
  }}
/>
```

---

## 📈 Future Enhancements

1. **Predictive Analytics**: Patient no-show prediction
2. **Inventory Forecasting**: Medicine stock predictions
3. **Voice Input**: Speech-to-text for consultations
4. **Image Analysis**: X-ray/scan interpretation
5. **Multi-language**: Support regional languages

---

## 📞 Support

For issues or questions:
- Check Groq docs: https://console.groq.com/docs
- Review code in `src/lib/groqAI.ts`
- Test with small datasets first

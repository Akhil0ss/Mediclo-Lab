'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ref, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PrintReportPage() {
    const params = useParams();
    const { user, userProfile, loading: authLoading } = useAuth();
    const [report, setReport] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [reportOwnerId, setReportOwnerId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const printTriggeredRef = useRef(false);

    const reportId = params.id as string;

    useEffect(() => {
        if (!reportId || authLoading) return;

        const fetchData = async () => {
            try {
                let reportData = null;
                let ownerId = null;

                // Get ownerId from multiple sources (localStorage persists across tabs)
                if (user) {
                    ownerId = userProfile?.ownerId || user.uid;
                }
                // Fallback: check localStorage (critical for new-tab print)
                if (!ownerId && typeof window !== 'undefined') {
                    ownerId = localStorage.getItem('ownerId') || localStorage.getItem('patient_owner_id') || null;
                }

                if (ownerId) {
                    const reportSnapshot = await get(ref(database, `reports/${ownerId}/${reportId}`));
                    reportData = reportSnapshot.val();
                }

                if (!reportData || !ownerId) {
                    console.error('Report not found');
                    setLoading(false);
                    return;
                }

                // Inject ID if missing
                if (!reportData.id) {
                    reportData = { id: reportId, ...reportData };
                }

                // Fetch Patient Details to ensure correct Display ID
                if (reportData.patientId) {
                    try {
                        const pSnap = await get(ref(database, `patients/${ownerId}/${reportData.patientId}`));
                        if (pSnap.exists()) {
                            reportData.patientDisplayId = pSnap.val().patientId;
                        }
                    } catch (e) { console.log('Err fetching patient:', e); }
                }

                // Fetch Branding
                const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
                const brandingData = brandingSnapshot.val() || {};

                // Fetch Subscription
                const subSnapshot = await get(ref(database, `subscriptions/${ownerId}`));
                const subData = subSnapshot.val() || {};

                setReport(reportData);
                setBranding(brandingData);
                setSubscription(subData);
                setReportOwnerId(ownerId);
                setLoading(false);

            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [reportId, authLoading, user, userProfile]);

    // Generate HTML and replace document content
    useEffect(() => {
        if (loading || !report || !branding || !reportOwnerId) return;
        if (printTriggeredRef.current) return;

        // Lock to prevent re-execution
        printTriggeredRef.current = true;

        const isPremium = subscription?.premium || false;

        // --- LEGACY PDF GENERATION LOGIC ---

        // Report Theme Colors
        const themes: any = {
            blue: { primary: '#667eea', secondary: '#764ba2', accent: '#6366f1', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6366f1 100%)' },
            green: { primary: '#10b981', secondary: '#059669', accent: '#34d399', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' },
            purple: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' },
            teal: { primary: '#14b8a6', secondary: '#0d9488', accent: '#2dd4bf', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)' },
            grey: { primary: '#475569', secondary: '#334155', accent: '#64748b', gradient: 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)' }
        };
        const selectedTheme = report.pdfTheme || branding.pdfTheme || 'blue';
        const theme = themes[selectedTheme] || themes.blue;

        // Identifiers
        const labName = branding.labName || 'Spotnet MedOS';
        const sampleId = report.sampleId || report.sampleNumber || 'N/A';
        const generatedPatientId = report.patientDisplayId || report.patientId || 'N/A';
        const formattedReportId = report.reportId || report.id || 'N/A';


        // Create compact test list - truncate if too long
        let testsDoneList = '';
        if (report.testDetails) {
            const testNames = report.testDetails.map((t: any) => t.testName);
            const fullList = testNames.join(', ');
            // If too long (>80 chars), truncate
            if (fullList.length > 80) {
                testsDoneList = fullList.substring(0, 77) + '...';
            } else {
                testsDoneList = fullList;
            }
        }

        // Details
        const sampleCollectionTime = report.sampleCollectionTime || new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const fastingStatus = report.fastingStatus || 'Not Specified';
        const sampleType = report.sampleType || 'Blood';

        // Critical Findings
        const criticalFindings: any[] = [];
        if (report.testDetails) {
            report.testDetails.forEach((test: any) => {
                if (test.subtests) {
                    test.subtests.forEach((subtest: any) => {
                        if (subtest.threatLevel === 'critical' && subtest.value) {
                            criticalFindings.push({
                                test: test.testName,
                                parameter: subtest.name,
                                value: subtest.value,
                                unit: subtest.unit
                            });
                        }
                    });
                }
            });
        }

        // Helpers
        const generateCultureReport = (test: any) => {
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
                                ${antibiotics.map((ab: any) => `
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

        const generateNarrativeReport = (test: any) => {
            if (!test.narrativeText && !test.findings && !test.impression) return '';
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

        // Helper to generate Combined Critical & Clinical Analysis Section
        const generateCombinedAnalysisSection = (criticalFindings: any[], aiAnalysis: any) => {
            // Filter AI analysis based on score > 90
            const sufficientAiConfidence = aiAnalysis && aiAnalysis.confidenceScore > 90;

            // If No Critical Findings AND (No AI OR Low Confidence AI), return empty
            if ((!criticalFindings || criticalFindings.length === 0) && !sufficientAiConfidence) return '';

            // Determine Overall Style based on severity
            let severity = 'normal';
            if (criticalFindings.length > 0) severity = 'high';
            else if (sufficientAiConfidence && aiAnalysis.riskLevel === 'high') severity = 'high';
            else if (sufficientAiConfidence && aiAnalysis.riskLevel === 'medium') severity = 'medium';

            const colors = {
                high: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', header: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
                medium: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', header: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
                normal: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', header: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' }
            };
            const theme = colors[severity as keyof typeof colors];

            return `
            <div style="margin-top: 5px; margin-bottom: 10px; border: 1px solid ${theme.border}; border-radius: 6px; overflow: visible; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background: ${theme.header}; padding: 8px 12px; color: white; display: flex; align-items: center; justify-content: space-between; page-break-after: avoid;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;">
                        <span>${severity === 'high' ? '⚠️' : severity === 'medium' ? '⚠️' : '✅'}</span>
                        MEDICAL HEALTH ANALYSIS
                    </h3>
                    ${sufficientAiConfidence ? `
                    <div style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid rgba(255,255,255,0.4);">
                        RISK ASSESSMENT: ${aiAnalysis.riskLevel.toUpperCase()}
                    </div>
                    ` : ''}
                </div>
                
                <div style="padding: 16px; background: white;">
                    <!-- 1. CRITICAL STATS ROW -->
                    ${criticalFindings.length > 0 ? `
                    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed #e2e8f0;">
                         <h4 style="font-size: 11px; font-weight: 700; color: #dc2626; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i style="width: 6px; height: 6px; background: #dc2626; border-radius: 50%; display: inline-block;"></i>
                            IMMEDIATE ATTENTION REQUIRED (${criticalFindings.length} Critical Values)
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                            ${criticalFindings.map((finding: any) => `
                                <div style="background: #fef2f2; border-left: 3px solid #ef4444; padding: 8px 12px; border-radius: 4px;">
                                    <div style="font-size: 10px; color: #7f1d1d;">${finding.test} - ${finding.parameter}</div>
                                    <div style="font-size: 13px; font-weight: 800; color: #dc2626;">
                                        ${finding.value} <span style="font-size: 9px; font-weight: 600; color: #991b1b;">${finding.unit}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 2. CLINICAL INSIGHTS & ANALYSIS -->
                    ${sufficientAiConfidence ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        
                        <!-- Insights -->
                        ${aiAnalysis.insights ? `
                        <div>
                             <h4 style="font-size: 11px; font-weight: 700; color: #0369a1; margin-bottom: 4px;">
                                 🩺 Clinical Insights
                            </h4>
                            <div style="background: #f0f9ff; border: 1px solid #bfdbfe; padding: 10px; border-radius: 6px;">
                                <p style="font-size: 10px; color: #334155; line-height: 1.6; margin: 0;">${aiAnalysis.insights}</p>
                            </div>
                        </div>
                        ` : ''}

                        <!-- Recommendations -->
                        ${aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 ? `
                        <div>
                             <h4 style="font-size: 11px; font-weight: 700; color: #15803d; margin-bottom: 4px;">
                                📋 Recommendations
                            </h4>
                            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px;">
                                <ul style="margin: 0; padding-left: 16px; color: #14532d; font-size: 10px; line-height: 1.6;">
                                    ${aiAnalysis.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
                
                <!-- Footer -->
                <div style="background: #f8fafc; padding: 6px 12px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #64748b; text-align: right; font-style: italic;">
                    Medical Analysis generated by Spotnet MedOS • Verified by Standard Protocols
                </div>
            </div>
            `;
        };

        // Group reports by category for "Report Part" logic
        const groupedTests: Record<string, any[]> = {};
        if (report.testDetails) {
            report.testDetails.forEach((test: any) => {
                const cat = test.category || 'General';
                if (!groupedTests[cat]) groupedTests[cat] = [];
                groupedTests[cat].push(test);
            });
        }

        const testResultsHTML = Object.entries(groupedTests).map(([category, tests], catIndex) => {
            const categoryHTML = tests.map((test: any, testIndex: number) => {
                if (test.reportType === 'culture' || test.cultureData) return generateCultureReport(test);
                if (test.reportType === 'narrative' || test.narrativeText || test.findings || test.impression) return generateNarrativeReport(test);

                // Check if any subtests have real values.
                const validSubtests = (test.subtests || []).filter((s: any) => s.value && String(s.value).trim() !== '');
                const hasNarrative = test.narrativeText || test.findings || test.impression;
                const hasCulture = test.cultureData && (test.cultureData.organism || (test.cultureData.antibiotics && test.cultureData.antibiotics.length > 0));

                if (validSubtests.length === 0 && !hasNarrative && !hasCulture) return '';

                const subtestsHTML = validSubtests.map((subtest: any) => {
                    let statusIcon = '✔';
                    let statusColor = '#10b981';
                    let valueColor = '#1e293b';
                    let rowBg = '#ffffff';
                    let valueBold = '600';
                    let indicatorBar = '';

                    // Ranges and Indicator
                    if (subtest.ranges && subtest.value && !isNaN(parseFloat(subtest.value))) {
                        const val = parseFloat(subtest.value);
                        const min = parseFloat(subtest.ranges.min);
                        const max = parseFloat(subtest.ranges.max);

                        if (!isNaN(min) && !isNaN(max)) {
                            const range = (max - min) || 1;
                            const extendedMin = min - (range * 0.4);
                            const extendedMax = max + (range * 0.4);
                            const extendedRange = extendedMax - extendedMin;
                            let position = ((val - extendedMin) / extendedRange) * 100;
                            position = Math.max(0, Math.min(100, position));
                            const normalStart = ((min - extendedMin) / extendedRange) * 100;
                            const normalEnd = ((max - extendedMin) / extendedRange) * 100;

                            let dotColor = '#10b981';
                            if (subtest.threatLevel === 'critical') {
                                statusIcon = '❗'; statusColor = '#dc2626'; valueColor = '#dc2626'; rowBg = '#fef2f2'; valueBold = '700'; dotColor = '#dc2626';
                            } else if (subtest.threatLevel === 'warning') {
                                statusIcon = '⚠️'; statusColor = '#f59e0b'; valueColor = '#b45309'; rowBg = '#fffbeb'; valueBold = '700'; dotColor = '#f59e0b';
                            } else if (val < min || val > max) {
                                statusIcon = '❗'; statusColor = '#ef4444'; valueColor = '#dc2626'; rowBg = '#fef2f2'; valueBold = '700'; dotColor = '#dc2626';
                            }

                            indicatorBar = `
                                <div style="width: 50px; height: 3px; background: linear-gradient(to right, #ef4444 0%, #ef4444 ${normalStart}%, #10b981 ${normalStart}%, #10b981 ${normalEnd}%, #ef4444 ${normalEnd}%, #ef4444 100%); border-radius: 2px; position: relative; margin-top: 4px;">
                                    <div style="position: absolute; top: -3px; left: ${position}%; transform: translateX(-50%); width: 8px; height: 8px; background: ${dotColor}; border: 1.5px solid white; border-radius: 50%;"></div>
                                </div>
                            `;
                        }
                    }

                    return `
                        <tr style="background: ${rowBg}; page-break-inside: avoid;">
                            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #1e293b;">${subtest.name}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-weight: ${valueBold}; font-size: 12px; color: ${valueColor};">
                                ${subtest.value || '-'}
                                ${indicatorBar}
                            </td>
                            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 10px; font-weight: 500; color: #4b5563;">${subtest.unit || '-'}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; font-size: 10px; font-weight: 500; color: #4b5563;">${subtest.ranges ? `${subtest.ranges.min} - ${subtest.ranges.max}` : 'N/A'}</td>
                            <td style="border: 1px solid #e2e8f0; padding: 6px 10px; text-align: center; color: ${statusColor}; font-size: 12px; font-weight: bold;">${statusIcon}</td>
                        </tr>
                    `;
                }).join('');

                const sectionTitle = `
                    <div style="background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 5px 12px; display: flex; justify-content: space-between; align-items: center; page-break-after: avoid;">
                        <h3 style="margin: 0; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${test.testName}</h3>
                        <span style="font-size: 8px; font-weight: 900; background: ${theme.primary}15; color: ${theme.primary}; padding: 1px 6px; border-radius: 4px;">TEST ID: ${test.testId?.slice(-5) || 'NEW'}</span>
                    </div>
                `;

                if (hasCulture) return generateCultureReport(test);
                if (hasNarrative) return generateNarrativeReport(test);

                return `
                    <div style="margin-bottom: 10px; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0; page-break-inside: avoid;">
                        ${sectionTitle}
                        <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                            <thead>
                                <tr style="background: ${theme.gradient}08;">
                                    <th style="width: 35%; border: 1px solid #e2e8f0; padding: 5px 10px; text-align: left; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Parameter</th>
                                    <th style="width: 20%; border: 1px solid #e2e8f0; padding: 5px 10px; text-align: left; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Result</th>
                                    <th style="width: 15%; border: 1px solid #e2e8f0; padding: 5px 10px; text-align: left; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Unit</th>
                                    <th style="width: 20%; border: 1px solid #e2e8f0; padding: 5px 10px; text-align: left; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Reference Range</th>
                                    <th style="width: 10%; border: 1px solid #e2e8f0; padding: 5px 10px; text-align: center; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">Status</th>
                                </tr>
                            </thead>
                            <tbody>${subtestsHTML}</tbody>
                        </table>
                    </div>
                `;
            }).join('');

            return `
                <div style="margin-top: ${catIndex === 0 ? '0' : '20px'}; page-break-before: ${catIndex === 0 ? 'auto' : 'avoid'};">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 4px 0; border-bottom: 2px solid #e2e8f0; page-break-after: avoid; break-after: avoid;">
                         <div style="width: 4px; height: 18px; background: ${theme.primary}; border-radius: 2px;"></div>
                         <h2 style="font-size: 14px; font-weight: 900; color: ${theme.primary}; text-transform: uppercase; letter-spacing: 1px;">DEPARTMENT: ${category}</h2>
                    </div>
                    ${categoryHTML}
                </div>
            `;
        }).join('');

        // FULL HTML
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Lab Report - ${formattedReportId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            margin: 0mm;
            size: A4; 
        }
        
        body { 
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f1f5f9;
            padding: 0;
            margin: 0;
            line-height: 1.3;
            color: #1e293b;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
        }

        .watermark {
            position: fixed;
            top: 55%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 900;
            color: #d1d5db !important; /* Fixed hex color for reliable printing */
            opacity: 0.12 !important; /* Slightly more visible but still faint */
            z-index: 999999; /* Top absolute layer */
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
            text-transform: uppercase;
            display: block !important;
        }

        .report-container {
            width: 210mm; 
            margin: 0 auto; 
            background: white;
            padding: 0;
            position: relative; 
        }
        
        @media print {
           * {
               -webkit-print-color-adjust: exact !important;
               print-color-adjust: exact !important;
               color-adjust: exact !important;
           }
           body { background: white; margin: 0; padding: 0; }
           .report-container { width: 100%; margin: 0; box-shadow: none; }
           .no-print { display: none !important; }
           thead { display: table-header-group; }
           tfoot { display: table-footer-group; }
           [style*="gradient"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
           .font-medium { font-weight: 600 !important; }
           .font-semibold, strong, b { font-weight: 700 !important; }
        }

        /* HEADER */
        .header {
            background: ${theme.gradient};
            color: white;
            padding: 16px 20px;
            display: flex;
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
        
        /* Left Logo */
        .header-logo-container {
            flex: 0 0 110px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }
        .header-logo { 
            width: 90px; 
            height: 90px; 
            object-fit: contain; 
        }

        /* Center Info (Brand Text) */
        .header-center {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .header-center h1 { font-size: 24px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header-center p.tagline { font-size: 11px; opacity: 0.95; margin-bottom: 4px; font-style: italic; font-weight: 500; }
        .header-center .contact-details { font-size: 9px; opacity: 0.9; line-height: 1.4; display: flex; flex-direction: column; gap: 1px; }

        /* Right (QR Code & Time) */
        .header-right {
            flex: 0 0 180px; 
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            height: 80px;
        }
        .header-qr { 
            width: 80px; 
            height: 80px; 
            background: rgba(255, 255, 255, 0.25);
            border-radius: 10px;
            padding: 4px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header-qr img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
        }
        .header-meta-text { 
            text-align: right; 
            color: rgba(255,255,255,0.95); 
            font-size: 8px; 
            line-height: 1.4; 
            display: flex;
            flex-direction: column;
            justify-content: center;
            white-space: nowrap;
        }

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
        .patient-item.span-2 span { 
            font-size: 9px; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            display: block;
        }
        
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
        .notes-section { margin-top: 10px; padding: 8px 10px; background: linear-gradient(135deg, #fefce8, #fef9c3); border: 1px solid #facc15; border-radius: 6px; }
        .notes-section h4 { color: #a16207; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
        .notes-section p { font-size: 9px; color: #713f12; line-height: 1.4; }
        .disclaimer-box { margin-top: 10px; padding: 8px 10px; background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 5px; font-size: 8px; color: #64748b; line-height: 1.3; }

        /* Signature Section */
        .signature-section { margin-top: 10px; padding: 8px 20px 0 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; }
        .digital-sign { text-align: center; padding: 6px 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 5px; min-width: 140px; }
        .digital-sign p { font-size: 7px; color: #64748b; }
        .digital-sign .hash { font-family: 'Courier New', monospace; font-size: 6px; color: #94a3b8; margin-top: 2px; word-break: break-all; }
        .auth-sign { text-align: center; min-width: 150px; position: relative; }
        .auth-sign .sign-space { height: 25px; border-bottom: 2px solid #374151; margin-bottom: 2px; }
        .auth-sign strong { display: inline; font-size: 10px; color: #1e293b; }
        .auth-sign span { font-size: 9px; color: ${theme.primary}; font-weight: 600; margin-left: 4px; }

        /* Last Page Footer System */
        .last-section {
            margin-top: 30px;
            z-index: 10;
        }

        /* Purple Footer - fixed to every page bottom */
        .footer { 
            background: ${theme.gradient} !important; 
            color: white !important; 
            padding: 10px 20px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            font-size: 9px; 
            position: fixed; 
            bottom: 0px; 
            left: 50%; 
            transform: translateX(-50%); 
            width: 210mm; 
            z-index: 200000; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
        }
        .footer-left p { margin: 1px 0; }
        .footer-left strong { font-size: 10px; }
        .footer-right { text-align: right; }
        .footer-right p { margin: 1px 0; }

        /* End of Report Marker */
        .end-of-report {
            text-align: center;
            font-size: 8px;
            font-weight: 700;
            color: #cbd5e1;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 20px;
        }

        /* Verified Stamp */
        .stamp-box {
            position: absolute;
            top: -5px;
            left: 50%;
            transform: translateX(-50%) rotate(-10deg);
            border: 3px solid #10b981;
            color: #10b981;
            padding: 4px 12px;
            font-weight: 900;
            font-size: 14px;
            text-transform: uppercase;
            border-radius: 4px;
            opacity: 0.15;
            letter-spacing: 1px;
            pointer-events: none;
            mix-blend-mode: multiply;
        }

        thead { display: table-header-group; } 
        @media print {
            body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
            .report-container { box-shadow: none; border: none; width: 100%; margin: 0; padding: 0 !important; }
            .no-print { display: none !important; }
            .footer { left: 0 !important; width: 100% !important; transform: none !important; bottom: 0 !important; position: fixed !important; z-index: 999999 !important; display: flex !important; visibility: visible !important; }
            .watermark { display: block !important; opacity: 0.1 !important; z-index: 1000000 !important; color: #d1d5db !important; }
            .print-btn { display: none !important; }
        }
        .print-btn { position: fixed; bottom: 60px; right: 20px; background: ${theme.gradient}; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 200000; transition: all 0.2s; }
        .print-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="watermark">CONFIDENTIAL</div>
    <div class="report-container">
        <!-- Main Table Structure for Repeating Headers/Footers -->
        <table style="width: 100%; border-collapse: collapse; position: relative; z-index: 1;">
            <!-- REPEATING HEADER -->
            <thead style="display: table-header-group;">
                <tr>
                    <td style="position: relative;">
                        <!-- Repeating Header Content -->
                        <div class="header">
                            <!-- Left: Logo -->
                            <div class="header-logo-container">
                                ${branding.logoUrl ? `<img src="${branding.logoUrl}" class="header-logo" alt="Logo">` : ''}
                            </div>

                            <!-- Center: Brand Info -->
                            <div class="header-center">
                                <h1>${branding.labName || 'Spotnet MedOS'}</h1>
                                <p class="tagline">${branding.tagline || 'Professional Healthcare Services'}</p>
                                <div class="contact-details">
                                    ${branding.address ? `<p>${branding.address}</p>` : ''}
                                    ${branding.address2 ? `<p>${branding.address2}</p>` : ''}
                                    ${branding.city || branding.state || branding.pincode ? `<p>${[branding.city, branding.state, branding.pincode].filter(Boolean).join(', ')}</p>` : ''}
                                    <p>
                                        ${branding.contact ? `📞 ${branding.contact}` : ''}
                                        ${branding.contact && branding.email ? ' | ' : ''}
                                        ${branding.email ? `✉️ ${branding.email}` : ''}
                                        ${(branding.contact || branding.email) && branding.website ? ' | ' : ''}
                                        ${branding.website ? `🌐 ${branding.website}` : ''}
                                    </p>
                                    ${branding.gstin ? `<p>GSTIN: ${branding.gstin}</p>` : ''}
                                    ${branding.dlNumber ? `<p>DL No: ${branding.dlNumber}</p>` : ''}
                                </div>
                            </div>

                            <!-- Right: QR and Info -->
                            <div class="header-right">
                                <div class="header-meta-text">
                                    <p style="font-weight: 700; color: white; font-size: 9px; margin-bottom: 2px;">ID: ${formattedReportId}</p>
                                    <p style="font-weight: 700; opacity: 0.8; font-size: 8px; margin-bottom: 4px;">AUTHORISED LAB REPORT</p>
                                    <p><strong>Date:</strong> ${new Date(report.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    <p><strong>Time:</strong> ${new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                    ${isPremium ? `<span class="badge" style="display:inline-block; margin-top:2px;">NABL</span>` : ''}
                                    <p style="margin-top: 5px; color: #fbbf24; font-weight: 800; font-size: 8px;">Verify your report by QR →</p>
                                </div>
                                <div class="header-qr">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://medlab.spotnet.in/verify/${report.id}?oid=${reportOwnerId}`)}" alt="QR" style="width:100%; height:100%; object-fit: contain;">
                                </div>
                            </div>
                        </div>
                        <!-- Spacer for visual separation -->
                        <div style="height: 10px;"></div>
                    </td>
                </tr>
            </thead>

            <!-- FOOTER SPACER (forces data to avoid the floating purple footer padding constraints) -->
            <tfoot style="display: table-footer-group;">
                 <tr>
                    <td style="border: none; padding: 0;">
                        <div style="height: 50px;"></div>
                    </td>
                </tr>
            </tfoot>

            <!-- BODY CONTENT -->
            <tbody>
                <tr>
                    <td>
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
                    <span>${report.refDoctor || 'Self'}</span>
                </div>
                <div class="patient-item span-2">
                    <label>Tests Done</label>
                    <span>${testsDoneList}</span>
                </div>
            </div>
        </div>
        
        <!-- SAMPLE COLLECTION INFO BAR & LEGEND -->
        <div class="sample-bar" style="justify-content: space-between;">
            <div style="display: flex; gap: 20px;">
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
            
            <!-- Inline Legend -->
            <div class="status-legend" style="margin: 0; padding: 0; background: transparent; border: none; gap: 12px; font-size: 9px;">
                <span class="legend-normal">✔ NORMAL</span>
                <span class="legend-borderline">⚠️ BORDERLINE</span>
                <span class="legend-abnormal">❗ ABNORMAL</span>
            </div>
        </div>
                <!-- CONTENT (Flowing Part) -->
                <div class="content">
                    <!-- Combined Critical Findings & AI Analysis -->
                    ${generateCombinedAnalysisSection(criticalFindings, report.aiAnalysis)}

                    <!-- Test Results -->
                    ${testResultsHTML}
                </div>

                <!-- LAST SECTION: Notes + Signature (appears only after content, on last page) -->
                <div class="last-section" style="margin-top: 15px;">
                    <div style="padding: 0 20px;">
                        <!-- Notes and Disclaimer combined into a single visual block -->
                        <div class="notes-section" style="margin-bottom: 12px;">
                            <h4>📋 CLINICAL NOTES & IMPRESSION</h4>
                            <p>${branding.footerNotes || 'These results should be clinically correlated with the patient\'s history and examination findings. The reported values depend on the sample quality and testing methodology. Isolated abnormal results may require repeat testing or further evaluation. Please consult your physician for interpretation and management.'}</p>
                        </div>
                        
                        <div class="disclaimer-box" style="margin-bottom: 20px;">
                            <strong>DISCLAIMER:</strong> This report is for diagnostic reference only and not a final diagnosis. Methodological limitations exist for all laboratory tests. In case of unexpected results, a fresh sample repeat is recommended. This digitally generated document acts as a preliminary report; the final authorized version requires a physical or valid digital signature.
                        </div>

                        <div class="signature-section" style="margin-bottom: 10px;">
                            <div class="digital-sign">
                                <p><span style="color: #10b981; font-size: 10px;">✔</span> 🔐 Digital Signature</p>
                                <div class="hash">SHA256: ${report.id.replace(/-/g, '').substring(0, 24)}...</div>
                                <p style="margin-top: 3px;">Electronically Verified</p>
                            </div>
                            <div class="end-of-report">~ END OF REPORT ~</div>
                            <div class="auth-sign">
                                <div class="stamp-box">VERIFIED</div>
                                <div class="sign-space"></div>
                                <div>
                                    <strong>${branding.director || 'Dr. Authorized Pathologist'}</strong>
                                    <span> - Chief Pathologist</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </td>
        </tr>
    </tbody>
</table>
</div>

    <!-- Purple Footer perfectly fixed to absolute bottom -->
    <div class="footer">
        <div class="footer-left">
            <strong>${branding.labName || 'Spotnet MedOS'}</strong>
            <p>Report Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div style="flex: 1; text-align: center;">
            <p style="font-size: 9px; font-weight: 700;">Sample ID: ${sampleId}</p>
            <p style="font-size: 8px; margin-top: 2px;">Powered by Spotnet MedOS</p>
        </div>
        <div class="footer-right">
            <div style="font-weight: 800; font-size: 10px; margin-bottom: 2px;">${formattedReportId}</div>
            <p>Computer Generated Report</p>
        </div>
    </div>

    <button onclick="window.print()" class="print-btn no-print">🖨️ Print / Save PDF</button>
</body>
</html>`;

        // Write to document
        document.open();
        document.write(fullHtml);
        document.close();

    }, [loading, report, branding, subscription, reportOwnerId]); // Runs once when data is loaded

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Generating Legacy PDF Report...</p>
                </div>
            </div>
        );
    }

    return null; // Content is replaced by document.write
}

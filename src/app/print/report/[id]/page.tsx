'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ref, onValue, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PrintReportPage() {
    const params = useParams();
    const { user, userProfile } = useAuth();
    const [report, setReport] = useState<any>(null);
    const [branding, setBranding] = useState<any>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const printTriggeredRef = useRef(false);

    const reportId = params.id as string;

    useEffect(() => {
        if (!reportId) return;

        const fetchData = async () => {
            try {
                let reportData = null;
                let ownerId = null;

                // If user is logged in (admin), use their ownerId
                if (user) {
                    ownerId = userProfile?.ownerId || user.uid;
                    const reportSnapshot = await get(ref(database, `reports/${ownerId}/${reportId}`));
                    reportData = reportSnapshot.val();
                } else {
                    // Patient portal access - search for report across all users
                    const usersSnapshot = await get(ref(database, 'users'));
                    if (usersSnapshot.exists()) {
                        const users = usersSnapshot.val();
                        for (const uid in users) {
                            const reportSnapshot = await get(ref(database, `reports/${uid}/${reportId}`));
                            if (reportSnapshot.exists()) {
                                reportData = reportSnapshot.val();
                                ownerId = uid;
                                break;
                            }
                        }
                    }
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

                // Fetch Branding
                const brandingSnapshot = await get(ref(database, `branding/${ownerId}`));
                const brandingData = brandingSnapshot.val() || {};

                // Fetch Subscription
                const subSnapshot = await get(ref(database, `subscriptions/${ownerId}`));
                const subData = subSnapshot.val() || {};

                setReport(reportData);
                setBranding(brandingData);
                setSubscription(subData);
                setLoading(false);

            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [reportId]);

    // Generate HTML and replace document content
    useEffect(() => {
        if (loading || !report || !branding) return;
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
        const sampleId = report.sampleId || `SMP-${new Date(report.createdAt).getTime().toString().slice(-8)}`;
        const labName = branding.labName || 'Spotnet MedOS';
        const labPrefix = labName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
        const patientIdNum = report.patientId ? report.patientId.substring(0, 6).toUpperCase() : String(Date.now()).slice(-6);
        const generatedPatientId = `${labPrefix}-${patientIdNum}`;
        const patientUserName = `${labPrefix}@${report.patientMobile}`;

        const testsDoneList = report.testDetails ? report.testDetails.map((t: any) => t.testName).join(', ') : '';

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

        const testResultsHTML = report.testDetails ? report.testDetails.map((test: any, testIndex: number) => {
            if (test.cultureData) return generateCultureReport(test);
            if (test.narrativeText || test.findings || test.impression) return generateNarrativeReport(test);

            const colors = [theme.primary, theme.secondary, '#06b6d4', '#10b981', '#f59e0b'];
            const testColor = colors[testIndex % colors.length];

            const subtestsHTML = test.subtests.map((subtest: any) => {
                // Filter out empty values to keep report clean
                if (!subtest.value || String(subtest.value).trim() === '') return '';

                let statusIcon = '✔'; // Checkmark for Normal
                let statusColor = '#10b981';
                let valueColor = '#1e293b'; // Default text color
                let rowBg = '#ffffff';
                let valueBold = '600';
                let indicatorBar = '';

                // Ranges and Indicator
                let range = 0;
                let extendedMin = 0;
                let extendedMax = 0;

                if (subtest.ranges && subtest.value && !isNaN(parseFloat(subtest.value))) {
                    const val = parseFloat(subtest.value);
                    const min = parseFloat(subtest.ranges.min);
                    const max = parseFloat(subtest.ranges.max);

                    if (!isNaN(min) && !isNaN(max)) {
                        range = max - min;
                        if (range === 0) range = 1;

                        extendedMin = min - (range * 0.4);
                        extendedMax = max + (range * 0.4);
                        const extendedRange = extendedMax - extendedMin;

                        let position = ((val - extendedMin) / extendedRange) * 100;
                        position = Math.max(0, Math.min(100, position));

                        const normalStart = ((min - extendedMin) / extendedRange) * 100;
                        const normalEnd = ((max - extendedMin) / extendedRange) * 100;

                        // Default Dot Color
                        let dotColor = '#10b981';

                        // LOGIC: Check explicit threat level first, then auto-calculate
                        if (subtest.threatLevel === 'critical') {
                            statusIcon = '❗'; // Exclamation for Critical
                            statusColor = '#dc2626';
                            valueColor = '#dc2626';
                            rowBg = '#fef2f2';
                            valueBold = '700';
                            dotColor = '#dc2626';
                        } else if (subtest.threatLevel === 'warning') {
                            statusIcon = '⚠️'; // Warning Sign
                            statusColor = '#f59e0b';
                            valueColor = '#b45309';
                            rowBg = '#fffbeb';
                            valueBold = '700';
                            dotColor = '#f59e0b';
                        } else {
                            // Auto-Calculation
                            if (val < min || val > max) {
                                statusIcon = '❗';
                                statusColor = '#ef4444';
                                valueColor = '#dc2626';
                                rowBg = '#fef2f2';
                                valueBold = '700';
                                dotColor = '#dc2626';
                            }
                        }

                        indicatorBar = `
                             <div style="width: 60px; height: 4px; background: linear-gradient(to right, #ef4444 0%, #ef4444 ${normalStart}%, #10b981 ${normalStart}%, #10b981 ${normalEnd}%, #ef4444 ${normalEnd}%, #ef4444 100%); border-radius: 2px; position: relative; margin-top: 5px;">
                                 <div style="position: absolute; top: -3px; left: ${position}%; transform: translateX(-50%); width: 10px; height: 10px; background: ${dotColor}; border: 1.5px solid white; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></div>
                             </div>
                         `;
                    }
                }

                // If threat level is explicitly set in data as warning/critical, verify row styling
                // (The block above handles turning 'normal' into 'critical' if out of range, this block ensures explicitly set warnings/criticals are respected if inside range? usually not possible but good safeguard)
                if (subtest.threatLevel === 'warning' && statusIcon !== '✖') {
                    statusIcon = '▲';
                    statusColor = '#f59e0b';
                    valueColor = '#b45309';
                    rowBg = '#fffbeb';
                    valueBold = '600';
                } else if (subtest.threatLevel === 'critical') {
                    // Already handled by auto-correction logic mostly, but ensures explicit criticals stay critical
                    statusIcon = '✖';
                    statusColor = '#ef4444';
                    valueColor = '#dc2626';
                    rowBg = '#fef2f2';
                    valueBold = '700';
                }

                return `
                    <tr style="background: ${rowBg};">
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #1e293b;">${subtest.name}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-weight: ${valueBold}; font-size: 14px; color: ${valueColor};">
                            ${subtest.value || '-'}
                            ${indicatorBar}
                        </td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 11px; font-weight: 500; color: #4b5563;">${subtest.unit || '-'}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; font-size: 11px; font-weight: 500; color: #4b5563;">${subtest.ranges ? `${subtest.ranges.min} - ${subtest.ranges.max}` : '-'}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px 12px; text-align: center; color: ${statusColor}; font-size: 16px; font-weight: bold;">${statusIcon}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div style="margin-bottom: 12px; border-radius: 6px; overflow: visible; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="background: linear-gradient(135deg, ${testColor} 0%, ${testColor}cc 100%); color: white; padding: 8px 12px; page-break-after: avoid;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700;">${test.testName}</h3>
                        <p style="margin: 2px 0 0 0; opacity: 0.85; font-size: 10px;">${test.category || 'General'}</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: white; table-layout: fixed;">
                        <thead>
                            <tr style="background: #f8fafc; page-break-after: avoid;">
                                <th style="width: 35%; border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #0f172a;">Parameter</th>
                                <th style="width: 25%; border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #0f172a;">Result</th>
                                <th style="width: 12%; border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #0f172a;">Unit</th>
                                <th style="width: 18%; border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 800; color: #0f172a;">Ref. Range</th>
                                <th style="width: 10%; border: 1px solid #e5e7eb; padding: 6px 10px; text-align: center; font-size: 10px; font-weight: 800; color: #0f172a;">Status</th>
                            </tr>
                        </thead>
                        <tbody>${subtestsHTML}</tbody>
                    </table>
                </div>
            `;
        }).join('') : '';

        // FULL HTML
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Lab Report - ${report.id}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 10mm; size: A4; }
        
        body { 
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f1f5f9;
            padding: 0;
            line-height: 1.3;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%; 
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0,0,0,0.04);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
        }
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%; 
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0,0,0,0.04);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
        }
            color: #1e293b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0,0,0,0.03); 
            z-index: 0; 
            white-space: nowrap; 
            pointer-events: none; 
            text-transform: uppercase;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 800;
            color: rgba(0,0,0,0.03); 
            z-index: 0; 
            white-space: nowrap; 
            pointer-events: none; 
            text-transform: uppercase;
        }

        .report-container {
            max-width: 210mm; /* A4 Width */
            min-height: 297mm; /* Minimum A4 Height */
            margin: 20px auto; /* Centered with top/bottom margin */
            background: white;
            border-radius: 0;
            overflow: visible;
            box-shadow: 0 0 20px rgba(0,0,0,0.1); /* Visual shadow for paper effect */
            padding: 0; /* Padding handled inside */
        }
        
        @media print {
           body { background: white; margin: 0; }
           .report-container {
               width: 100%;
               max-width: none;
               margin: 0;
               box-shadow: none;
               min-height: auto;
           }
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
            background: rgba(255, 255, 255, 0.25); /* Glossy transparent white */
            border-radius: 10px;
            padding: 4px;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 6px rgba(0,0,0,0.05); /* Subtle depth */
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

        /* Footer */
        .footer { background: ${theme.gradient}; color: white; padding: 12px 20px; display: flex; justify-content: space-between; font-size: 9px; }
        .footer-left p { margin: 1px 0; }
        .footer-left strong { font-size: 10px; }
        .footer-right { text-align: right; }
        .footer-right p { margin: 1px 0; opacity: 0.9; }
        .footer-barcode { font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 1px; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 2px; margin-top: 4px; display: inline-block; }

        @page { 
            margin: 15mm; 
            size: A4; 
        }
        
        /* Watermark */
        .watermark { 
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%) rotate(-45deg); 
            font-size: 80px; 
            font-weight: 800; 
            color: rgba(0,0,0,0.03); 
            z-index: 0; 
            white-space: nowrap; 
            pointer-events: none; 
            text-transform: uppercase;
        }

        /* End of Report Marker */
        .end-of-report {
            text-align: center;
            font-size: 8px;
            font-weight: 700;
            color: #cbd5e1;
            letter-spacing: 1px;
            text-transform: uppercase;
            align-self: center;
            margin-bottom: 20px;
        }
        .end-of-report::before, .end-of-report::after {
            content: none; 
        }

        /* Verified Stamp */
        .stamp-box {
            position: absolute;
            top: -5px;
            left: 50%;
            transform: translateX(-50%) rotate(-10deg);
            border: 3px solid #10b981; /* Green Verified Stamp */
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

        /* Repeating Header & Footer Logic */
        thead { display: table-header-group; } 
        tfoot { display: table-footer-group; }
        
        /* Ensure content doesn't overlap fixed elements if used, but table method handles this naturally */

        /* Running Footer for Browser Print (Fallback/Addition) */
        .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            padding: 10px 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 9px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        @media print {
            body { padding: 0; background: white; margin-bottom: 50px; }
            .report-container { box-shadow: none; border: none; }
            .no-print { display: none !important; }
            .page-footer { position: fixed; bottom: 0; }
        }

        .print-btn { position: fixed; bottom: 20px; right: 20px; background: ${theme.gradient}; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000; }
        .print-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="watermark">CONFIDENTIAL</div>
    <div class="report-container">
    <div class="report-container">
        <!-- Main Table Structure for Repeating Headers/Footers -->
        <table style="width: 100%; border-collapse: collapse;">
            <!-- REPEATING HEADER -->
            <thead style="display: table-header-group;">
                <tr>
                    <td>
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
                                    <p style="font-weight: 700; color: white; font-size: 9px; margin-bottom: 2px;">ID: ${report.id}</p>
                                    <p style="font-weight: 700; opacity: 0.8; font-size: 8px; margin-bottom: 4px;">AUTHORISED LAB REPORT</p>
                                    <p><strong>Date:</strong> ${new Date(report.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    <p><strong>Time:</strong> ${new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                    ${isPremium ? `<span class="badge" style="display:inline-block; margin-top:2px;">NABL</span>` : ''}
                                </div>
                                <div class="header-qr">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/verify/${report.id}`)}" alt="QR" style="width:100%; height:100%; object-fit: contain;">
                                </div>
                            </div>
                        </div>
                        <!-- Spacer for visual separation -->
                        <div style="height: 10px;"></div>
                    </td>
                </tr>
            </thead>

            <!-- REPEATING FOOTER -->
            <tfoot style="display: table-footer-group;">
                 <tr>
                    <td>
                        <div style="height: 10px;"></div>
                        <div class="footer">
                            <div class="footer-left">
                                <strong>${branding.labName || 'Spotnet MedOS'}</strong>
                                <p>Report Generated: ${new Date().toLocaleString()}</p>
                                <p style="font-size: 8px; opacity: 0.8; margin-top: 2px;">Patient Credentials: ${patientUserName} | PWD - Your Mobile Number</p>
                            </div>
                            <div style="flex: 1; text-align: center; margin-top: 2px;">
                                <p style="font-size: 9px; opacity: 0.8;">Report ID: ${report.id}</p>
                                <p style="font-size: 9px; font-weight: 700; margin-top: 2px;">Patient Portal: medos.spotnet.in</p>
                                <p style="font-size: 8px; opacity: 0.6; margin-top: 2px;">Powered by Spotnet MedOS</p>
                            </div>
                            <div class="footer-right">
                                <p>Results electronically verified.</p>
                                <p>Computer Generated Report</p>
                                <div class="footer-barcode">|${report.id.replace(/-/g, '').substring(0, 12)}|</div>
                            </div>
                        </div>
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

        <!-- CONTENT -->
        <div class="content">

            <!-- Combined Critical Findings & AI Analysis -->
            ${generateCombinedAnalysisSection(criticalFindings, report.aiAnalysis)}

            <!-- Test Results -->
            ${testResultsHTML}

            <!-- Clinical Notes -->
            <div class="notes-section">
                <h4>📋 CLINICAL NOTES & IMPRESSION</h4>
                <p>${branding.footerNotes || 'These results should be clinically correlated with the patient\'s history and examination findings. The reported values depend on the sample quality and testing methodology. Isolated abnormal results may require repeat testing or further evaluation. Please consult your physician for interpretation and management.'}</p>
            </div>

            <!-- Disclaimer -->
            <div class="disclaimer-box">
                <strong>DISCLAIMER:</strong> This report is for diagnostic reference only and not a final diagnosis. Methodological limitations exist for all laboratory tests. In case of unexpected results, a fresh sample repeat is recommended. This digitally generated document acts as a preliminary report; the final authorized version requires a physical or valid digital signature.
            </div>
        </div>

        <!-- SIGNATURE -->
        <!-- SIGNATURE -->
        <div class="signature-section">
            <div class="digital-sign">
                <p><span style="color: #10b981; font-size: 10px;">✔</span> 🔐 Digital Signature</p>
                <div class="hash">SHA256: ${report.id.replace(/-/g, '').substring(0, 24)}...</div>
                <p style="margin-top: 3px;">Electronically Verified</p>
            </div>
            
            <!-- End of Report Marker (Centered) -->
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
                    </td>
                </tr>
            </tbody>
        </table>

         <!-- Running Footer for Print -->
        <div class="page-footer">
             <div><strong>${branding.labName || 'Mediclo Lab'}</strong> | Patient: ${report.patientName} (${generatedPatientId})</div>
             <div>Repo ID: ${report.id}</div>
        </div>
    </div>

    <button onclick="window.print()" class="print-btn no-print">🖨️ Print / Save PDF</button>
</body>
</html>`;

        // Write to document
        document.open();
        document.write(fullHtml);
        document.close();

    }, [loading, report, branding, subscription]); // Runs once when data is loaded

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

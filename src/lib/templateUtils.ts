import { defaultTemplates } from './defaultTemplates';

export interface Template {
    id: string;
    name: string;
    category: string;
    totalPrice: number;
    subtests: any[];
    createdAt?: string;
    createdBy?: string;
    authorName?: string;
    isSystem?: boolean;
    isVirtual?: boolean;
    isCommunity?: boolean;
    reportType?: 'numeric' | 'culture' | 'narrative';
}

/**
 * Merges templates from three sources with the following priority for pricing:
 * 1. User Overrides (templates/${userId})
 * 2. Community Templates (common_templates)
 * 3. Hardcoded Defaults (lib/defaultTemplates)
 * 
 * The structure (subtests) is preserved from Default/Community unless it's a completely 
 * new private template.
 */
export function mergeTemplates(userTemplates: any[], commonTemplates: any[] = []): Template[] {
    const userTemplatesMap = new Map();
    userTemplates.forEach((t) => {
        if (t && t.name) {
            userTemplatesMap.set(t.name, t);
        }
    });

    const processedTemplates: Template[] = [];
    const processedNames = new Set();

    // A. Process Hardcoded Defaults (Base System)
    defaultTemplates.forEach((defTemp: any, index: number) => {
        const userOverride = userTemplatesMap.get(defTemp.name);
        if (userOverride) {
            processedTemplates.push({
                ...userOverride,
                // Keep default structure but use user's custom prices if they overridden specific subtests
                subtests: defTemp.subtests.map((defSub: any) => {
                    const userSub = userOverride.subtests?.find((s: any) => s.name === defSub.name);
                    return {
                        ...defSub,
                        price: userSub && userSub.price !== undefined ? userSub.price : defSub.price
                    };
                }),
                category: defTemp.category,
                isSystem: true,
                isVirtual: false
            });
        } else {
            processedTemplates.push({
                ...defTemp,
                id: `SYS-${index}-${defTemp.name.replace(/\s+/g, '-')}`,
                isSystem: true,
                isVirtual: true
            } as any);
        }
        processedNames.add(defTemp.name);
    });

    // B. Process Community Templates (Crowd-sourced)
    commonTemplates.forEach((comTemp: any) => {
        if (comTemp && comTemp.name && !processedNames.has(comTemp.name)) {
            const userOverride = userTemplatesMap.get(comTemp.name);
            if (userOverride) {
                processedTemplates.push({
                    ...userOverride,
                    isSystem: false,
                    isCommunity: true,
                    isVirtual: false
                });
            } else {
                processedTemplates.push({
                    ...comTemp,
                    isSystem: false,
                    isCommunity: true,
                    isVirtual: false
                });
            }
            processedNames.add(comTemp.name);
        }
    });

    // C. Process Private User Templates (Not in System or Community)
    userTemplatesMap.forEach((ut, name) => {
        if (!processedNames.has(name)) {
            processedTemplates.push({
                ...ut,
                isSystem: false,
                isCommunity: false,
                isVirtual: false
            });
        }
    });

    // Ensure uniqueness by ID to prevent React render errors
    const uniqueMap = new Map<string, Template>();
    processedTemplates.forEach(t => {
        if (!uniqueMap.has(t.id)) {
            uniqueMap.set(t.id, t);
        }
    });

    return Array.from(uniqueMap.values());
}

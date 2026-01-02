export const defaultTemplates = [
    // ========== HEMATOLOGY ==========
    {
        name: "Complete Blood Count (CBC)",
        category: "Hematology",
        subtests: [
            { name: "Hemoglobin", unit: "g/dL", type: "numeric", ranges: { male: { min: 13, max: 17 }, female: { min: 12, max: 15.5 } }, price: 100 },
            { name: "Total Leukocyte Count (TLC)", unit: "/cumm", type: "numeric", ranges: { male: { min: 4000, max: 11000 }, female: { min: 4000, max: 11000 } }, price: 100 },
            { name: "Neutrophils", unit: "%", type: "numeric", ranges: { male: { min: 40, max: 75 }, female: { min: 40, max: 75 } }, price: 50 },
            { name: "Lymphocytes", unit: "%", type: "numeric", ranges: { male: { min: 20, max: 45 }, female: { min: 20, max: 45 } }, price: 50 },
            { name: "Eosinophils", unit: "%", type: "numeric", ranges: { male: { min: 1, max: 6 }, female: { min: 1, max: 6 } }, price: 50 },
            { name: "Monocytes", unit: "%", type: "numeric", ranges: { male: { min: 2, max: 10 }, female: { min: 2, max: 10 } }, price: 50 },
            { name: "Basophils", unit: "%", type: "numeric", ranges: { male: { min: 0, max: 2 }, female: { min: 0, max: 2 } }, price: 50 },
            { name: "Platelet Count", unit: "lakhs/cumm", type: "numeric", ranges: { male: { min: 1.5, max: 4.5 }, female: { min: 1.5, max: 4.5 } }, price: 100 },
            { name: "RBC Count", unit: "million/cumm", type: "numeric", ranges: { male: { min: 4.5, max: 5.5 }, female: { min: 4.0, max: 5.0 } }, price: 100 },
            { name: "PCV (Hematocrit)", unit: "%", type: "numeric", ranges: { male: { min: 40, max: 50 }, female: { min: 36, max: 44 } }, price: 50 },
            { name: "MCV", unit: "fL", type: "numeric", ranges: { male: { min: 83, max: 101 }, female: { min: 83, max: 101 } }, price: 50 },
            { name: "MCH", unit: "pg", type: "numeric", ranges: { male: { min: 27, max: 32 }, female: { min: 27, max: 32 } }, price: 50 },
            { name: "MCHC", unit: "%", type: "numeric", ranges: { male: { min: 31.5, max: 34.5 }, female: { min: 31.5, max: 34.5 } }, price: 50 },
            { name: "RDW", unit: "%", type: "numeric", ranges: { male: { min: 11.5, max: 14.5 }, female: { min: 11.5, max: 14.5 } }, price: 50 }
        ],
        totalPrice: 400
    },

    {
        name: "ESR (Erythrocyte Sedimentation Rate)",
        category: "Hematology",
        subtests: [
            { name: "ESR", unit: "mm/hr", type: "numeric", ranges: { male: { min: 0, max: 15 }, female: { min: 0, max: 20 } }, price: 100 }
        ],
        totalPrice: 100
    },

    {
        name: "Peripheral Blood Smear",
        category: "Hematology",
        subtests: [
            { name: "RBC Morphology", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "WBC Morphology", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Platelet Morphology", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Parasites", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 200 }
        ],
        totalPrice: 300
    },

    {
        name: "Reticulocyte Count",
        category: "Hematology",
        subtests: [
            { name: "Reticulocyte Count", unit: "%", type: "numeric", ranges: { male: { min: 0.5, max: 2.5 }, female: { min: 0.5, max: 2.5 } }, price: 300 }
        ],
        totalPrice: 300
    },

    {
        name: "Iron Studies Complete",
        category: "Hematology",
        subtests: [
            { name: "Serum Iron", unit: "µg/dL", type: "numeric", ranges: { male: { min: 65, max: 175 }, female: { min: 50, max: 170 } }, price: 200 },
            { name: "TIBC", unit: "µg/dL", type: "numeric", ranges: { male: { min: 250, max: 450 }, female: { min: 250, max: 450 } }, price: 200 },
            { name: "Transferrin Saturation", unit: "%", type: "numeric", ranges: { male: { min: 20, max: 50 }, female: { min: 15, max: 50 } }, price: 200, formula: "({Serum Iron} / {TIBC}) * 100" },
            { name: "Ferritin", unit: "ng/mL", type: "numeric", ranges: { male: { min: 20, max: 250 }, female: { min: 10, max: 120 } }, price: 300 }
        ],
        totalPrice: 800
    },

    // ========== BIOCHEMISTRY ==========
    {
        name: "Lipid Profile Complete",
        category: "Biochemistry",
        subtests: [
            { name: "Total Cholesterol", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0, max: 200 }, female: { min: 0, max: 200 } }, price: 150 },
            { name: "Triglycerides", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0, max: 150 }, female: { min: 0, max: 150 } }, price: 150 },
            { name: "HDL Cholesterol", unit: "mg/dL", type: "numeric", ranges: { male: { min: 40, max: 60 }, female: { min: 50, max: 60 } }, price: 150 },
            { name: "LDL Cholesterol", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0, max: 100 }, female: { min: 0, max: 100 } }, price: 150, formula: "{Total Cholesterol} - {HDL Cholesterol} - ({Triglycerides} / 5)" },
            { name: "VLDL Cholesterol", unit: "mg/dL", type: "numeric", ranges: { male: { min: 5, max: 40 }, female: { min: 5, max: 40 } }, price: 100, formula: "{Triglycerides} / 5" },
            { name: "Total Cholesterol/HDL Ratio", unit: "ratio", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 4.5 } }, price: 50, formula: "{Total Cholesterol} / {HDL Cholesterol}" },
            { name: "LDL/HDL Ratio", unit: "ratio", type: "numeric", ranges: { male: { min: 0, max: 3 }, female: { min: 0, max: 3 } }, price: 50, formula: "{LDL Cholesterol} / {HDL Cholesterol}" }
        ],
        totalPrice: 600
    },

    {
        name: "Liver Function Test (LFT)",
        category: "Biochemistry",
        subtests: [
            { name: "Total Bilirubin", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0.3, max: 1.2 }, female: { min: 0.3, max: 1.2 } }, price: 120 },
            { name: "Direct Bilirubin", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0.1, max: 0.3 }, female: { min: 0.1, max: 0.3 } }, price: 120 },
            { name: "Indirect Bilirubin", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0.2, max: 0.9 }, female: { min: 0.2, max: 0.9 } }, price: 100, formula: "{Total Bilirubin} - {Direct Bilirubin}" },
            { name: "SGOT (AST)", unit: "U/L", type: "numeric", ranges: { male: { min: 0, max: 40 }, female: { min: 0, max: 35 } }, price: 150 },
            { name: "SGPT (ALT)", unit: "U/L", type: "numeric", ranges: { male: { min: 0, max: 41 }, female: { min: 0, max: 33 } }, price: 150 },
            { name: "Alkaline Phosphatase", unit: "U/L", type: "numeric", ranges: { male: { min: 40, max: 130 }, female: { min: 35, max: 104 } }, price: 150 },
            { name: "Total Protein", unit: "g/dL", type: "numeric", ranges: { male: { min: 6.0, max: 8.3 }, female: { min: 6.0, max: 8.3 } }, price: 120 },
            { name: "Albumin", unit: "g/dL", type: "numeric", ranges: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 } }, price: 120 },
            { name: "Globulin", unit: "g/dL", type: "numeric", ranges: { male: { min: 2.0, max: 3.5 }, female: { min: 2.0, max: 3.5 } }, price: 100, formula: "{Total Protein} - {Albumin}" },
            { name: "A/G Ratio", unit: "ratio", type: "numeric", ranges: { male: { min: 1.0, max: 2.1 }, female: { min: 1.0, max: 2.1 } }, price: 50, formula: "{Albumin} / {Globulin}" },
            { name: "GGT", unit: "U/L", type: "numeric", ranges: { male: { min: 0, max: 51 }, female: { min: 0, max: 35 } }, price: 200 }
        ],
        totalPrice: 700
    },

    {
        name: "Kidney Function Test (KFT/RFT)",
        category: "Biochemistry",
        subtests: [
            { name: "Blood Urea", unit: "mg/dL", type: "numeric", ranges: { male: { min: 15, max: 40 }, female: { min: 15, max: 40 } }, price: 120 },
            { name: "Serum Creatinine", unit: "mg/dL", type: "numeric", ranges: { male: { min: 0.7, max: 1.3 }, female: { min: 0.6, max: 1.1 } }, price: 120 },
            { name: "BUN/Creatinine Ratio", unit: "ratio", type: "numeric", ranges: { male: { min: 10, max: 20 }, female: { min: 10, max: 20 } }, price: 50, formula: "{Blood Urea} / {Serum Creatinine}" },
            { name: "Uric Acid", unit: "mg/dL", type: "numeric", ranges: { male: { min: 3.4, max: 7.0 }, female: { min: 2.4, max: 6.0 } }, price: 150 },
            { name: "Sodium", unit: "mEq/L", type: "numeric", ranges: { male: { min: 136, max: 145 }, female: { min: 136, max: 145 } }, price: 150 },
            { name: "Potassium", unit: "mEq/L", type: "numeric", ranges: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 } }, price: 150 },
            { name: "Chloride", unit: "mEq/L", type: "numeric", ranges: { male: { min: 98, max: 107 }, female: { min: 98, max: 107 } }, price: 150 },
            { name: "Bicarbonate", unit: "mEq/L", type: "numeric", ranges: { male: { min: 22, max: 29 }, female: { min: 22, max: 29 } }, price: 150 }
        ],
        totalPrice: 600
    },

    {
        name: "Blood Sugar Tests",
        category: "Biochemistry",
        subtests: [
            { name: "Fasting Blood Sugar (FBS)", unit: "mg/dL", type: "numeric", ranges: { male: { min: 70, max: 100 }, female: { min: 70, max: 100 } }, price: 100 },
            { name: "Post Prandial Blood Sugar (PPBS)", unit: "mg/dL", type: "numeric", ranges: { male: { min: 70, max: 140 }, female: { min: 70, max: 140 } }, price: 100 },
            { name: "Random Blood Sugar (RBS)", unit: "mg/dL", type: "numeric", ranges: { male: { min: 70, max: 140 }, female: { min: 70, max: 140 } }, price: 100 }
        ],
        totalPrice: 200
    },

    {
        name: "HbA1c (Glycated Hemoglobin)",
        category: "Biochemistry",
        subtests: [
            { name: "HbA1c", unit: "%", type: "numeric", ranges: { male: { min: 4.0, max: 5.6 }, female: { min: 4.0, max: 5.6 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "Serum Electrolytes",
        category: "Biochemistry",
        subtests: [
            { name: "Sodium (Na+)", unit: "mEq/L", type: "numeric", ranges: { male: { min: 136, max: 145 }, female: { min: 136, max: 145 } }, price: 150 },
            { name: "Potassium (K+)", unit: "mEq/L", type: "numeric", ranges: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 } }, price: 150 },
            { name: "Chloride (Cl-)", unit: "mEq/L", type: "numeric", ranges: { male: { min: 98, max: 107 }, female: { min: 98, max: 107 } }, price: 150 },
            { name: "Bicarbonate (HCO3-)", unit: "mEq/L", type: "numeric", ranges: { male: { min: 22, max: 29 }, female: { min: 22, max: 29 } }, price: 150 },
            { name: "Calcium", unit: "mg/dL", type: "numeric", ranges: { male: { min: 8.5, max: 10.5 }, female: { min: 8.5, max: 10.5 } }, price: 150 },
            { name: "Magnesium", unit: "mg/dL", type: "numeric", ranges: { male: { min: 1.7, max: 2.2 }, female: { min: 1.7, max: 2.2 } }, price: 150 },
            { name: "Phosphorus", unit: "mg/dL", type: "numeric", ranges: { male: { min: 2.5, max: 4.5 }, female: { min: 2.5, max: 4.5 } }, price: 150 }
        ],
        totalPrice: 700
    },

    {
        name: "Cardiac Enzymes",
        category: "Biochemistry",
        subtests: [
            { name: "Troponin I", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 0.04 }, female: { min: 0, max: 0.04 } }, price: 800 },
            { name: "Troponin T", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 0.01 }, female: { min: 0, max: 0.01 } }, price: 800 },
            { name: "CK-MB", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 500 },
            { name: "CPK (Total)", unit: "U/L", type: "numeric", ranges: { male: { min: 38, max: 174 }, female: { min: 26, max: 140 } }, price: 400 }
        ],
        totalPrice: 1500
    },

    {
        name: "Serum Calcium & Phosphorus",
        category: "Biochemistry",
        subtests: [
            { name: "Serum Calcium", unit: "mg/dL", type: "numeric", ranges: { male: { min: 8.5, max: 10.5 }, female: { min: 8.5, max: 10.5 } }, price: 150 },
            { name: "Serum Phosphorus", unit: "mg/dL", type: "numeric", ranges: { male: { min: 2.5, max: 4.5 }, female: { min: 2.5, max: 4.5 } }, price: 150 },
            { name: "Calcium/Phosphorus Ratio", unit: "ratio", type: "numeric", ranges: { male: { min: 2.0, max: 4.0 }, female: { min: 2.0, max: 4.0 } }, price: 50, formula: "{Serum Calcium} / {Serum Phosphorus}" }
        ],
        totalPrice: 300
    },

    {
        name: "Serum Protein Electrophoresis",
        category: "Biochemistry",
        subtests: [
            { name: "Total Protein", unit: "g/dL", type: "numeric", ranges: { male: { min: 6.0, max: 8.3 }, female: { min: 6.0, max: 8.3 } }, price: 150 },
            { name: "Albumin", unit: "g/dL", type: "numeric", ranges: { male: { min: 3.5, max: 5.0 }, female: { min: 3.5, max: 5.0 } }, price: 150 },
            { name: "Alpha-1 Globulin", unit: "g/dL", type: "numeric", ranges: { male: { min: 0.1, max: 0.3 }, female: { min: 0.1, max: 0.3 } }, price: 150 },
            { name: "Alpha-2 Globulin", unit: "g/dL", type: "numeric", ranges: { male: { min: 0.6, max: 1.0 }, female: { min: 0.6, max: 1.0 } }, price: 150 },
            { name: "Beta Globulin", unit: "g/dL", type: "numeric", ranges: { male: { min: 0.7, max: 1.2 }, female: { min: 0.7, max: 1.2 } }, price: 150 },
            { name: "Gamma Globulin", unit: "g/dL", type: "numeric", ranges: { male: { min: 0.7, max: 1.6 }, female: { min: 0.7, max: 1.6 } }, price: 150 }
        ],
        totalPrice: 800
    },

    // ========== ENDOCRINOLOGY ==========
    {
        name: "Thyroid Function Test (TFT) Complete",
        category: "Endocrinology",
        subtests: [
            { name: "T3 (Triiodothyronine)", unit: "ng/dL", type: "numeric", ranges: { male: { min: 80, max: 200 }, female: { min: 80, max: 200 } }, price: 250 },
            { name: "T4 (Thyroxine)", unit: "µg/dL", type: "numeric", ranges: { male: { min: 5.0, max: 12.0 }, female: { min: 5.0, max: 12.0 } }, price: 250 },
            { name: "TSH", unit: "µIU/mL", type: "numeric", ranges: { male: { min: 0.4, max: 4.0 }, female: { min: 0.4, max: 4.0 } }, price: 300 },
            { name: "Free T3", unit: "pg/mL", type: "numeric", ranges: { male: { min: 2.0, max: 4.4 }, female: { min: 2.0, max: 4.4 } }, price: 300 },
            { name: "Free T4", unit: "ng/dL", type: "numeric", ranges: { male: { min: 0.8, max: 1.8 }, female: { min: 0.8, max: 1.8 } }, price: 300 }
        ],
        totalPrice: 900
    },

    {
        name: "Thyroid Antibodies",
        category: "Endocrinology",
        subtests: [
            { name: "Anti-TPO (Thyroid Peroxidase)", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 34 }, female: { min: 0, max: 34 } }, price: 600 },
            { name: "Anti-Thyroglobulin", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 115 }, female: { min: 0, max: 115 } }, price: 600 }
        ],
        totalPrice: 1000
    },

    {
        name: "Vitamin D (25-OH)",
        category: "Endocrinology",
        subtests: [
            { name: "Vitamin D Total", unit: "ng/mL", type: "numeric", ranges: { male: { min: 30, max: 100 }, female: { min: 30, max: 100 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Vitamin B12",
        category: "Endocrinology",
        subtests: [
            { name: "Vitamin B12", unit: "pg/mL", type: "numeric", ranges: { male: { min: 200, max: 900 }, female: { min: 200, max: 900 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "Folate (Folic Acid)",
        category: "Endocrinology",
        subtests: [
            { name: "Serum Folate", unit: "ng/mL", type: "numeric", ranges: { male: { min: 2.7, max: 17.0 }, female: { min: 2.7, max: 17.0 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "Cortisol",
        category: "Endocrinology",
        subtests: [
            { name: "Morning Cortisol", unit: "µg/dL", type: "numeric", ranges: { male: { min: 6, max: 23 }, female: { min: 6, max: 23 } }, price: 700 },
            { name: "Evening Cortisol", unit: "µg/dL", type: "numeric", ranges: { male: { min: 3, max: 16 }, female: { min: 3, max: 16 } }, price: 700 }
        ],
        totalPrice: 1200
    },

    {
        name: "Testosterone",
        category: "Endocrinology",
        subtests: [
            { name: "Total Testosterone", unit: "ng/dL", type: "numeric", ranges: { male: { min: 300, max: 1000 }, female: { min: 15, max: 70 } }, price: 800 },
            { name: "Free Testosterone", unit: "pg/mL", type: "numeric", ranges: { male: { min: 50, max: 210 }, female: { min: 1.0, max: 8.5 } }, price: 900 }
        ],
        totalPrice: 1500
    },

    {
        name: "Prolactin",
        category: "Endocrinology",
        subtests: [
            { name: "Prolactin", unit: "ng/mL", type: "numeric", ranges: { male: { min: 2, max: 18 }, female: { min: 2, max: 29 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "Growth Hormone (GH)",
        category: "Endocrinology",
        subtests: [
            { name: "Growth Hormone", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 10 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Insulin",
        category: "Endocrinology",
        subtests: [
            { name: "Fasting Insulin", unit: "µIU/mL", type: "numeric", ranges: { male: { min: 2.6, max: 24.9 }, female: { min: 2.6, max: 24.9 } }, price: 700 },
            { name: "Post Prandial Insulin", unit: "µIU/mL", type: "numeric", ranges: { male: { min: 18, max: 276 }, female: { min: 18, max: 276 } }, price: 700 }
        ],
        totalPrice: 1200
    },

    {
        name: "C-Peptide",
        category: "Endocrinology",
        subtests: [
            { name: "C-Peptide", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0.9, max: 7.1 }, female: { min: 0.9, max: 7.1 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Parathyroid Hormone (PTH)",
        category: "Endocrinology",
        subtests: [
            { name: "PTH (Intact)", unit: "pg/mL", type: "numeric", ranges: { male: { min: 15, max: 65 }, female: { min: 15, max: 65 } }, price: 1000 }
        ],
        totalPrice: 1000
    },

    // ========== SEROLOGY & IMMUNOLOGY ==========
    {
        name: "HIV Test",
        category: "Serology",
        subtests: [
            { name: "HIV 1 & 2 Antibodies", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 }
        ],
        totalPrice: 500
    },

    {
        name: "Hepatitis B Profile",
        category: "Serology",
        subtests: [
            { name: "HBsAg", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 400 },
            { name: "Anti-HBs", unit: "mIU/mL", type: "numeric", ranges: { male: { min: 0, max: 10 }, female: { min: 0, max: 10 } }, price: 500 },
            { name: "Anti-HBc Total", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 },
            { name: "HBeAg", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 600 },
            { name: "Anti-HBe", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 600 }
        ],
        totalPrice: 1500
    },

    {
        name: "Hepatitis C Test",
        category: "Serology",
        subtests: [
            { name: "Anti-HCV", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "Dengue Test Complete",
        category: "Serology",
        subtests: [
            { name: "Dengue NS1 Antigen", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 },
            { name: "Dengue IgM", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 },
            { name: "Dengue IgG", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 }
        ],
        totalPrice: 1000
    },

    {
        name: "Malaria Test",
        category: "Serology",
        subtests: [
            { name: "Malaria Antigen (Pf/Pv)", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 300 },
            { name: "Peripheral Smear for MP", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 200 }
        ],
        totalPrice: 400
    },

    {
        name: "Typhoid Test (Widal)",
        category: "Serology",
        subtests: [
            { name: "Salmonella Typhi O", unit: "titre", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 150 },
            { name: "Salmonella Typhi H", unit: "titre", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 150 },
            { name: "Salmonella Paratyphi AH", unit: "titre", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 150 },
            { name: "Salmonella Paratyphi BH", unit: "titre", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 150 }
        ],
        totalPrice: 300
    },

    {
        name: "Rheumatoid Factor (RF)",
        category: "Serology",
        subtests: [
            { name: "Rheumatoid Factor", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 20 }, female: { min: 0, max: 20 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "ASO Titre",
        category: "Serology",
        subtests: [
            { name: "ASO Titre", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 200 }, female: { min: 0, max: 200 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "CRP (C-Reactive Protein)",
        category: "Serology",
        subtests: [
            { name: "CRP Quantitative", unit: "mg/L", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "hs-CRP (High Sensitivity CRP)",
        category: "Serology",
        subtests: [
            { name: "hs-CRP", unit: "mg/L", type: "numeric", ranges: { male: { min: 0, max: 3 }, female: { min: 0, max: 3 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "ANA (Antinuclear Antibody)",
        category: "Serology",
        subtests: [
            { name: "ANA", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Anti-dsDNA",
        category: "Serology",
        subtests: [
            { name: "Anti-dsDNA", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 25 }, female: { min: 0, max: 25 } }, price: 1000 }
        ],
        totalPrice: 1000
    },

    // ========== TUMOR MARKERS ==========
    {
        name: "PSA (Prostate Specific Antigen)",
        category: "Tumor Markers",
        subtests: [
            { name: "Total PSA", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 4 }, female: { min: 0, max: 0 } }, price: 800 },
            { name: "Free PSA", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 0.8 }, female: { min: 0, max: 0 } }, price: 800 },
            { name: "Free/Total PSA Ratio", unit: "%", type: "numeric", ranges: { male: { min: 15, max: 100 }, female: { min: 0, max: 0 } }, price: 200, formula: "({Free PSA} / {Total PSA}) * 100" }
        ],
        totalPrice: 1500
    },

    {
        name: "CEA (Carcinoembryonic Antigen)",
        category: "Tumor Markers",
        subtests: [
            { name: "CEA", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 3 }, female: { min: 0, max: 3 } }, price: 1000 }
        ],
        totalPrice: 1000
    },

    {
        name: "CA 19-9",
        category: "Tumor Markers",
        subtests: [
            { name: "CA 19-9", unit: "U/mL", type: "numeric", ranges: { male: { min: 0, max: 37 }, female: { min: 0, max: 37 } }, price: 1200 }
        ],
        totalPrice: 1200
    },

    {
        name: "CA 125",
        category: "Tumor Markers",
        subtests: [
            { name: "CA 125", unit: "U/mL", type: "numeric", ranges: { male: { min: 0, max: 35 }, female: { min: 0, max: 35 } }, price: 1200 }
        ],
        totalPrice: 1200
    },

    {
        name: "AFP (Alpha Fetoprotein)",
        category: "Tumor Markers",
        subtests: [
            { name: "AFP", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 9 }, female: { min: 0, max: 9 } }, price: 1000 }
        ],
        totalPrice: 1000
    },

    {
        name: "CA 15-3",
        category: "Tumor Markers",
        subtests: [
            { name: "CA 15-3", unit: "U/mL", type: "numeric", ranges: { male: { min: 0, max: 30 }, female: { min: 0, max: 30 } }, price: 1200 }
        ],
        totalPrice: 1200
    },

    {
        name: "Beta HCG",
        category: "Tumor Markers",
        subtests: [
            { name: "Beta HCG", unit: "mIU/mL", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 600 }
        ],
        totalPrice: 600
    },

    // ========== URINE TESTS ==========
    {
        name: "Urine Routine & Microscopy",
        category: "Pathology",
        subtests: [
            { name: "Color", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Appearance", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Specific Gravity", unit: "", type: "numeric", ranges: { male: { min: 1.005, max: 1.030 }, female: { min: 1.005, max: 1.030 } }, price: 50 },
            { name: "pH", unit: "", type: "numeric", ranges: { male: { min: 4.5, max: 8.0 }, female: { min: 4.5, max: 8.0 } }, price: 50 },
            { name: "Protein", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Glucose", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Ketones", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Blood", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Bilirubin", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Urobilinogen", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Nitrite", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Pus Cells", unit: "/HPF", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 50 },
            { name: "RBC", unit: "/HPF", type: "numeric", ranges: { male: { min: 0, max: 2 }, female: { min: 0, max: 2 } }, price: 50 },
            { name: "Epithelial Cells", unit: "/HPF", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Casts", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Crystals", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Bacteria", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 }
        ],
        totalPrice: 200
    },

    {
        name: "24-Hour Urine Protein",
        category: "Pathology",
        subtests: [
            { name: "24-Hour Urine Volume", unit: "mL", type: "numeric", ranges: { male: { min: 800, max: 2000 }, female: { min: 800, max: 2000 } }, price: 200 },
            { name: "Total Protein", unit: "mg/24hr", type: "numeric", ranges: { male: { min: 0, max: 150 }, female: { min: 0, max: 150 } }, price: 300 }
        ],
        totalPrice: 400
    },

    {
        name: "Urine Microalbumin",
        category: "Pathology",
        subtests: [
            { name: "Microalbumin", unit: "mg/L", type: "numeric", ranges: { male: { min: 0, max: 30 }, female: { min: 0, max: 30 } }, price: 500 }
        ],
        totalPrice: 500
    },

    {
        name: "Urine Culture & Sensitivity",
        category: "Microbiology",
        subtests: [
            { name: "Culture", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 500 },
            { name: "Organism Identified", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 300 },
            { name: "Antibiotic Sensitivity", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 300 }
        ],
        totalPrice: 800
    },

    // ========== STOOL TESTS ==========
    {
        name: "Stool Routine Examination",
        category: "Pathology",
        subtests: [
            { name: "Color", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Consistency", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Occult Blood", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 100 },
            { name: "Mucus", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Pus Cells", unit: "/HPF", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "RBC", unit: "/HPF", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 },
            { name: "Ova/Cyst", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 100 },
            { name: "Fat Globules", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 50 }
        ],
        totalPrice: 200
    },

    // ========== COAGULATION TESTS ==========
    {
        name: "Coagulation Profile",
        category: "Hematology",
        subtests: [
            { name: "PT (Prothrombin Time)", unit: "seconds", type: "numeric", ranges: { male: { min: 11, max: 13.5 }, female: { min: 11, max: 13.5 } }, price: 200 },
            { name: "INR", unit: "ratio", type: "numeric", ranges: { male: { min: 0.8, max: 1.2 }, female: { min: 0.8, max: 1.2 } }, price: 200 },
            { name: "aPTT", unit: "seconds", type: "numeric", ranges: { male: { min: 25, max: 35 }, female: { min: 25, max: 35 } }, price: 200 },
            { name: "Bleeding Time", unit: "minutes", type: "numeric", ranges: { male: { min: 2, max: 7 }, female: { min: 2, max: 7 } }, price: 100 },
            { name: "Clotting Time", unit: "minutes", type: "numeric", ranges: { male: { min: 5, max: 11 }, female: { min: 5, max: 11 } }, price: 100 }
        ],
        totalPrice: 600
    },

    {
        name: "D-Dimer",
        category: "Hematology",
        subtests: [
            { name: "D-Dimer", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 500 }, female: { min: 0, max: 500 } }, price: 800 }
        ],
        totalPrice: 800
    },

    // ========== SPECIAL TESTS ==========
    {
        name: "Semen Analysis",
        category: "Andrology",
        subtests: [
            { name: "Volume", unit: "mL", type: "numeric", ranges: { male: { min: 1.5, max: 6.0 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "pH", unit: "", type: "numeric", ranges: { male: { min: 7.2, max: 8.0 }, female: { min: 0, max: 0 } }, price: 100 },
            { name: "Sperm Count", unit: "million/mL", type: "numeric", ranges: { male: { min: 15, max: 200 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Total Sperm Count", unit: "million", type: "numeric", ranges: { male: { min: 39, max: 1000 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Motility (Progressive)", unit: "%", type: "numeric", ranges: { male: { min: 32, max: 100 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Morphology (Normal)", unit: "%", type: "numeric", ranges: { male: { min: 4, max: 100 }, female: { min: 0, max: 0 } }, price: 200 },
            { name: "Liquefaction Time", unit: "minutes", type: "numeric", ranges: { male: { min: 20, max: 60 }, female: { min: 0, max: 0 } }, price: 100 }
        ],
        totalPrice: 800
    },

    {
        name: "Pregnancy Test (Beta HCG)",
        category: "Endocrinology",
        subtests: [
            { name: "Beta HCG (Quantitative)", unit: "mIU/mL", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 500 }
        ],
        totalPrice: 500
    },

    {
        name: "Ammonia",
        category: "Biochemistry",
        subtests: [
            { name: "Ammonia", unit: "µg/dL", type: "numeric", ranges: { male: { min: 15, max: 45 }, female: { min: 15, max: 45 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Lactate",
        category: "Biochemistry",
        subtests: [
            { name: "Lactate", unit: "mg/dL", type: "numeric", ranges: { male: { min: 4.5, max: 19.8 }, female: { min: 4.5, max: 19.8 } }, price: 600 }
        ],
        totalPrice: 600
    },

    {
        name: "LDH (Lactate Dehydrogenase)",
        category: "Biochemistry",
        subtests: [
            { name: "LDH", unit: "U/L", type: "numeric", ranges: { male: { min: 140, max: 280 }, female: { min: 140, max: 280 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "Amylase",
        category: "Biochemistry",
        subtests: [
            { name: "Serum Amylase", unit: "U/L", type: "numeric", ranges: { male: { min: 30, max: 110 }, female: { min: 30, max: 110 } }, price: 400 }
        ],
        totalPrice: 400
    },

    {
        name: "Lipase",
        category: "Biochemistry",
        subtests: [
            { name: "Serum Lipase", unit: "U/L", type: "numeric", ranges: { male: { min: 0, max: 160 }, female: { min: 0, max: 160 } }, price: 500 }
        ],
        totalPrice: 500
    },

    {
        name: "G6PD (Glucose-6-Phosphate Dehydrogenase)",
        category: "Hematology",
        subtests: [
            { name: "G6PD", unit: "U/g Hb", type: "numeric", ranges: { male: { min: 4.6, max: 13.5 }, female: { min: 4.6, max: 13.5 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Homocysteine",
        category: "Biochemistry",
        subtests: [
            { name: "Homocysteine", unit: "µmol/L", type: "numeric", ranges: { male: { min: 5, max: 15 }, female: { min: 5, max: 15 } }, price: 1200 }
        ],
        totalPrice: 1200
    },

    {
        name: "Procalcitonin",
        category: "Serology",
        subtests: [
            { name: "Procalcitonin", unit: "ng/mL", type: "numeric", ranges: { male: { min: 0, max: 0.5 }, female: { min: 0, max: 0.5 } }, price: 1500 }
        ],
        totalPrice: 1500
    },

    {
        name: "NT-proBNP",
        category: "Biochemistry",
        subtests: [
            { name: "NT-proBNP", unit: "pg/mL", type: "numeric", ranges: { male: { min: 0, max: 125 }, female: { min: 0, max: 125 } }, price: 2000 }
        ],
        totalPrice: 2000
    },

    {
        name: "Troponin I (High Sensitivity)",
        category: "Biochemistry",
        subtests: [
            { name: "hs-Troponin I", unit: "ng/L", type: "numeric", ranges: { male: { min: 0, max: 34 }, female: { min: 0, max: 16 } }, price: 1500 }
        ],
        totalPrice: 1500
    },

    // ========== MOLECULAR DIAGNOSTICS ==========
    {
        name: "COVID-19 RT-PCR",
        category: "Molecular Diagnostics",
        subtests: [
            { name: "SARS-CoV-2 RNA", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "COVID-19 Antibody Test",
        category: "Serology",
        subtests: [
            { name: "COVID IgG", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 600 },
            { name: "COVID IgM", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 600 }
        ],
        totalPrice: 1000
    },

    {
        name: "Tuberculosis (TB) Tests",
        category: "Microbiology",
        subtests: [
            { name: "Mantoux Test (TST)", unit: "mm", type: "numeric", ranges: { male: { min: 0, max: 5 }, female: { min: 0, max: 5 } }, price: 300 },
            { name: "TB Gold (IGRA)", unit: "", type: "text", ranges: { male: { min: 0, max: 0 }, female: { min: 0, max: 0 } }, price: 3000 }
        ],
        totalPrice: 3000
    },

    // ========== ALLERGY TESTS ==========
    {
        name: "Total IgE",
        category: "Immunology",
        subtests: [
            { name: "Total IgE", unit: "IU/mL", type: "numeric", ranges: { male: { min: 0, max: 100 }, female: { min: 0, max: 100 } }, price: 800 }
        ],
        totalPrice: 800
    },

    {
        name: "Absolute Eosinophil Count",
        category: "Hematology",
        subtests: [
            { name: "AEC", unit: "/cumm", type: "numeric", ranges: { male: { min: 40, max: 440 }, female: { min: 40, max: 440 } }, price: 200 }
        ],
        totalPrice: 200
    }
];

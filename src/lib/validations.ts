import { z } from 'zod';

export const PatientSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters").regex(/^[A-Za-z\s]+$/, "Only alphabets are allowed"),
    age: z.string().min(1, "Age is required").max(3, "Invalid age"),
    gender: z.enum(['Male', 'Female', 'Other']),
    mobile: z.string().length(10, "Mobile must be exactly 10 digits").regex(/^\d+$/, "Invalid mobile number")
});

export const OPDVisitSchema = z.object({
    symptoms: z.string().max(300, "Symptoms must be under 300 characters").optional(),
    diagnosis: z.string().max(200, "Diagnosis must be under 200 characters").optional(),
    notes: z.string().max(500, "Notes must be under 500 characters").optional()
});

export const RxDosageSchema = z.object({
    medicineName: z.string().min(2).max(100),
    dosage: z.string().max(50),
    duration: z.string().max(50)
});

export const RxSchema = z.object({
    medications: z.array(RxDosageSchema).max(20, "Cannot prescribe more than 20 medications at once"),
    notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
    followUpDays: z.number().min(0).max(365).optional()
});

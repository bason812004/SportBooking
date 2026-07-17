import { z } from "zod";
// IDs in this app are custom prefixed varchar (e.g. "c0001"), not real UUIDs.
const id = z.string().trim().min(1).max(40);
export const tournamentIdParamsSchema = z.object({
    params: z.object({ id })
});
export const tournamentRegistrationSchema = z.object({
    params: z.object({ id }),
    body: z.object({
        teamName: z.string().max(160).optional(),
        contactPhone: z.string().min(6).max(30),
        note: z.string().optional()
    })
});
const tournamentBodySchema = z.object({
    courtId: id,
    title: z.string().min(2).max(220),
    description: z.string().optional(),
    sportType: z.string().min(2).max(80),
    coverImageUrl: z.string().url().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    registrationDeadline: z.string().datetime(),
    maxParticipants: z.number().int().positive(),
    entryFee: z.number().nonnegative().default(0),
    prizeDescription: z.string().optional(),
    status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "OPEN", "CLOSED", "COMPLETED", "CANCELLED"]).default("PENDING")
});
export const tournamentWriteSchema = z.object({
    body: tournamentBodySchema
});
export const tournamentUpdateSchema = z.object({
    body: tournamentBodySchema.partial()
});

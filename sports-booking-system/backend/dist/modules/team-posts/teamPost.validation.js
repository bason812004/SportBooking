import { z } from "zod";
const ALLOWED_MESSAGE_TYPES = ["TEXT", "IMAGE", "VIDEO", "SYSTEM"];
const ALLOWED_REACTIONS = ["like", "love", "laugh", "wow", "sad", "clap", "fire"];
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gio phai co dinh dang HH:mm");
export const teamPostSchema = z
    .object({
    body: z
        .object({
        courtId: z.string().min(1).nullable().optional(),
        title: z.string().trim().min(1, "Tieu de khong duoc rong").max(220),
        sportType: z.string().trim().min(1).max(80),
        courtName: z.string().trim().min(1, "Ten san khong duoc rong").max(180),
        address: z.string().trim().min(1, "Dia chi khong duoc rong"),
        currentPlayers: z.coerce.number().int().min(0),
        maxPlayers: z.coerce.number().int().min(1),
        playingDate: z.string().date().nullable().optional(),
        startTime: timeSchema,
        endTime: timeSchema,
        pricePerPerson: z.coerce.number().min(0),
        extraServices: z.string().trim().nullable().optional(),
        note: z.string().trim().nullable().optional(),
        zaloGroupLink: z.string().trim().url().nullable().optional().or(z.literal("")),
        zaloQrImage: z.string().trim().nullable().optional()
    })
        .refine((data) => data.maxPlayers > data.currentPlayers, {
        message: "So nguoi toi da phai lon hon so nguoi hien co",
        path: ["maxPlayers"]
    })
        .refine((data) => data.endTime > data.startTime, {
        message: "Gio ket thuc phai sau gio bat dau",
        path: ["endTime"]
    })
});
export const teamPostIdSchema = z.object({
    params: z.object({ id: z.string().min(1) })
});
export const teamPostMessageSchema = teamPostIdSchema.extend({
    body: z.object({
        content: z.string().trim().min(1).max(1000).optional(),
        messageType: z.enum(ALLOWED_MESSAGE_TYPES).default("TEXT"),
        attachmentUrl: z.string().url().optional(),
        attachmentName: z.string().trim().max(255).optional(),
        attachmentSize: z.coerce.number().int().min(0).max(50 * 1024 * 1024).optional(),
        thumbnailUrl: z.string().url().optional(),
        mimeType: z.string().trim().max(80).optional()
    }).refine((data) => data.messageType !== "TEXT" || (data.content && data.content.length > 0), {
        message: "Tin nhan van ban can co noi dung",
        path: ["content"]
    }).refine((data) => data.messageType === "TEXT" || Boolean(data.attachmentUrl), {
        message: "Tin nhan media can co attachmentUrl",
        path: ["attachmentUrl"]
    })
});
export const reactionSchema = teamPostIdSchema.extend({
    body: z.object({
        messageId: z.string().min(1),
        reaction: z.enum(ALLOWED_REACTIONS)
    })
});
export const transferAdminSchema = teamPostIdSchema.extend({
    body: z.object({ newAdminUserId: z.string().min(1) })
});
export const messageIdParamsSchema = z.object({
    params: z.object({
        id: z.string().min(1),
        messageId: z.string().min(1)
    })
});

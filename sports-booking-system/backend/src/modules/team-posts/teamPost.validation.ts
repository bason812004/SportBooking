import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gio phai co dinh dang HH:mm");

export const teamPostSchema = z
  .object({
    body: z
      .object({
        courtId: z.string().uuid().nullable().optional(),
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
  params: z.object({ id: z.string().uuid() })
});

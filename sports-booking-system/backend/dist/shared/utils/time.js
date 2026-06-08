import { DayType } from "@prisma/client";
export function parsePage(query) {
    const value = Number(query);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}
export function parseLimit(query) {
    const value = Number(query);
    return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 100) : 10;
}
export function toDbDate(date) {
    return new Date(`${date}T00:00:00.000Z`);
}
export function timeToDate(time) {
    return new Date(`1970-01-01T${time}:00.000Z`);
}
export function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
export function durationHours(startTime, endTime) {
    return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}
export function dayTypeFor(date) {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return day === 0 || day === 6 ? DayType.WEEKEND : DayType.WEEKDAY;
}
export function bookingStartsAt(date, time) {
    const datePart = date.toISOString().slice(0, 10);
    const timePart = time.toISOString().slice(11, 16);
    return new Date(`${datePart}T${timePart}:00`);
}

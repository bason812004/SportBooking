export function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}
export function omitPassword(record) {
    const { passwordHash, ...rest } = record;
    void passwordHash;
    return rest;
}
export function paginationMeta(page, limit, total) {
    return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

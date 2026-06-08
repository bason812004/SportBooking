export function slugify(input) {
    return input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
export function uniqueSlug(name) {
    return `${slugify(name)}-${Date.now().toString(36)}`;
}

// DEPRECATED — does nothing.
//
// This script inserted a sample catalog for every partner id it could find (plus made-up ones such as "p0001")
// without a court, and linked every service to every court. Every service now belongs to one court (the partner
// picks the courts when creating it), so rows like these would show up nowhere. Sample products for a demo come
// from `npx tsx src/scripts/seed_all_services.ts --court=<id,...>`, which fills only courts that sell nothing yet.
console.log(
  "seed_inventory_data.ts is deprecated and does nothing. Use: npx tsx src/scripts/seed_all_services.ts --court=<id,id,...>"
);

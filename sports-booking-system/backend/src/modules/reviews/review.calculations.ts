/** Average and spread of a set of reviews; hidden ones are counted apart and never weigh on the average. */
export function summarizeRatings(groups: Array<{ rating: number; displayStatus: string; _count: { _all: number } }>) {
  const visible = groups.filter((group) => group.displayStatus === "VISIBLE");
  const count = (list: typeof groups) => list.reduce((sum, group) => sum + group._count._all, 0);
  const total = count(visible);
  const points = visible.reduce((sum, group) => sum + group.rating * group._count._all, 0);
  return {
    total,
    averageRating: total ? Math.round((points / total) * 10) / 10 : 0,
    hiddenCount: count(groups.filter((group) => group.displayStatus === "HIDDEN")),
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: count(visible.filter((group) => group.rating === rating)) }))
  };
}

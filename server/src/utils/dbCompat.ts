// ============================================================
// DB compatibility helpers
// Works with both real MongoDB (stores BSON Dates) and
// Mongo-compatible engines that store dates as ISO strings
// (e.g. the local EasyDB/SQLite dev database).
// ============================================================

/**
 * Build a "field >= date" filter that matches whether the stored
 * value is a BSON Date or an ISO-8601 string.
 * Spread into a query object: { status: 'X', ...dateGte('created_at', d) }
 */
export function dateGte(field: string, date: Date): Record<string, unknown> {
  return {
    $or: [
      { [field]: { $gte: date } },
      { [field]: { $gte: date.toISOString() } },
    ],
  };
}

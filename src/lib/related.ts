/**
 * PostgREST returns a to-one embed as an object and a to-many embed as an
 * array. Use this when a foreign key is unique so either shape is possible
 * depending on how the client typed the query.
 */
export function oneRelated<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

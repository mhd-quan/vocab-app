export function first<T>(rows: T[]): T {
  const value = rows[0];
  if (value === undefined) {
    throw new Error("Expected at least one row, got none");
  }
  return value;
}

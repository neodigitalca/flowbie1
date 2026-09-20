const EDMONTON_TZ = "America/Edmonton";

export function formatDriveYearSegment(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EDMONTON_TZ, year: "numeric" }).format(date);
}

export function formatDriveMonthSegment(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EDMONTON_TZ, month: "long" }).format(date);
}

export function driveDateSegments(date = new Date()) {
  return [formatDriveYearSegment(date), formatDriveMonthSegment(date)];
}

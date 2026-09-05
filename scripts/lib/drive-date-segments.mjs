export function formatDriveYearSegment(date = new Date()) {
  return String(date.getFullYear());
}

export function formatDriveMonthSegment(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long" });
}

export function driveDateSegments(date = new Date()) {
  return [formatDriveYearSegment(date), formatDriveMonthSegment(date)];
}

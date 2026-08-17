export type ForgeAutomationDemoRow = {
  id: string;
  title: string;
  siteName: string;
  scheduleLabel: string;
  compareLabel: string;
  executionTimeLabel: string;
  tdeLabel: string;
  statusLabel: "Running" | "Idle";
  active: boolean;
  runCount: string;
};

export type ForgeAutomationsDemoStats = {
  total: number;
  running: number;
  idle: number;
};

export const FORGE_AUTOMATIONS_DEMO_ROWS: ForgeAutomationDemoRow[] = [
  {
    id: "demo-1",
    title: "Content Optimizer Bulk",
    siteName: "Advance Blinds",
    scheduleLabel: "Weekly",
    compareLabel: "—",
    executionTimeLabel: "9:00 AM",
    tdeLabel: "9:00 AM",
    statusLabel: "Running",
    active: true,
    runCount: "142 runs",
  },
  {
    id: "demo-2",
    title: "GSC Monthly YoY Report",
    siteName: "Heritage Dental",
    scheduleLabel: "Monthly",
    compareLabel: "YoY",
    executionTimeLabel: "8:00 AM",
    tdeLabel: "8:00 AM",
    statusLabel: "Running",
    active: true,
    runCount: "28 runs",
  },
  {
    id: "demo-3",
    title: "Post Creator Weekly",
    siteName: "Neo Digital",
    scheduleLabel: "Weekly",
    compareLabel: "—",
    executionTimeLabel: "10:30 AM",
    tdeLabel: "10:30 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "96 runs",
  },
  {
    id: "demo-4",
    title: "Meta Batch Optimizer",
    siteName: "Blind Magic",
    scheduleLabel: "Daily",
    compareLabel: "—",
    executionTimeLabel: "7:00 AM",
    tdeLabel: "7:00 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "310 runs",
  },
  {
    id: "demo-5",
    title: "Local SEO Pages",
    siteName: "Interiors by Laura",
    scheduleLabel: "Daily",
    compareLabel: "—",
    executionTimeLabel: "7:00 AM",
    tdeLabel: "7:00 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "54 runs",
  },
  {
    id: "demo-6",
    title: "Blog Freshness Radar",
    siteName: "Advance Blinds",
    scheduleLabel: "Weekly",
    compareLabel: "—",
    executionTimeLabel: "9:00 AM",
    tdeLabel: "9:00 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "67 runs",
  },
  {
    id: "demo-7",
    title: "SAP Entity Sync",
    siteName: "Heritage Dental",
    scheduleLabel: "Daily",
    compareLabel: "—",
    executionTimeLabel: "7:00 AM",
    tdeLabel: "7:00 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "41 runs",
  },
  {
    id: "demo-8",
    title: "Competitor Gap Scan",
    siteName: "Neo Digital",
    scheduleLabel: "Monthly",
    compareLabel: "—",
    executionTimeLabel: "11:00 AM",
    tdeLabel: "11:00 AM",
    statusLabel: "Idle",
    active: false,
    runCount: "19 runs",
  },
];

export const FORGE_AUTOMATIONS_DEMO_STATS: ForgeAutomationsDemoStats = {
  total: 8,
  running: 2,
  idle: 6,
};

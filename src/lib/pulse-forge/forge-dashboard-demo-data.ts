export type ForgeDashboardLegendItem = {
  id: string;
  label: string;
  value: string;
};

export type ForgeDashboardHeroCard = {
  key: string;
  label: string;
  value: string;
  deltaPercent: number | null;
  deltaPositive: boolean;
  miniSeries: ForgeDashboardChartPoint[];
  miniKeys: string[];
  legend: ForgeDashboardLegendItem[];
  footnote?: string;
};

export type ForgeDashboardRankedRow = {
  id: string;
  title: string;
  meta?: string;
  value: string;
  active?: boolean;
  projectId?: number;
};

export type ForgeDashboardChartPoint = Record<string, string | number> & {
  date: string;
};

export type ForgeDashboardSnapshot = {
  heroCards: ForgeDashboardHeroCard[];
  topModels: ForgeDashboardRankedRow[];
  agentRankings: ForgeDashboardRankedRow[];
  chartSeries: ForgeDashboardChartPoint[];
  chartKeys: string[];
  agentChartSeries: ForgeDashboardChartPoint[];
  agentChartKeys: string[];
};

const MODEL_KEYS = ["claude", "gpt", "gemini"] as const;

function miniChartDays(count: number, keys: readonly string[]): ForgeDashboardChartPoint[] {
  const out: ForgeDashboardChartPoint[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const row: ForgeDashboardChartPoint = { date: label };
    for (const key of keys) {
      const seed = (count - i) * (key.length + 2);
      row[key] = Math.round(1 + (Math.sin(seed * 0.4) + 1) * 4);
    }
    out.push(row);
  }
  return out;
}

function chartDays(count: number, keys: readonly string[]): ForgeDashboardChartPoint[] {
  const out: ForgeDashboardChartPoint[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const row: ForgeDashboardChartPoint = { date: label };
    for (const key of keys) {
      const seed = (count - i) * (key.length + 3);
      row[key] = Math.round(2 + (Math.sin(seed * 0.3) + 1) * 6 + i * 0.15);
    }
    out.push(row);
  }
  return out;
}

const AGENT_KEYS = ["a1", "a2", "a3", "a4", "a5"] as const;

export const FORGE_DASHBOARD_DEMO_SNAPSHOT: ForgeDashboardSnapshot = {
  heroCards: [
    {
      key: "spend",
      label: "Spend",
      value: "$91.25",
      deltaPercent: 46.3,
      deltaPositive: true,
      miniSeries: miniChartDays(7, MODEL_KEYS),
      miniKeys: [...MODEL_KEYS],
      legend: [
        { id: "claude", label: "Claude Sonnet 4", value: "$52.10" },
        { id: "gpt", label: "GPT-4.1", value: "$28.40" },
        { id: "gemini", label: "Gemini 2.5 Pro", value: "$10.75" },
      ],
      footnote: "Blended $/1M: $0.38",
    },
    {
      key: "runs",
      label: "Requests",
      value: "72.5K",
      deltaPercent: 33.6,
      deltaPositive: true,
      miniSeries: miniChartDays(7, MODEL_KEYS),
      miniKeys: [...MODEL_KEYS],
      legend: [
        { id: "claude", label: "Claude Sonnet 4", value: "41.2K" },
        { id: "gpt", label: "GPT-4.1", value: "19.8K" },
        { id: "gemini", label: "Gemini 2.5 Pro", value: "11.5K" },
      ],
      footnote: "Success rate: 94.2%",
    },
    {
      key: "tokens",
      label: "Tokens",
      value: "267.0M",
      deltaPercent: 6.1,
      deltaPositive: false,
      miniSeries: miniChartDays(7, MODEL_KEYS),
      miniKeys: [...MODEL_KEYS],
      legend: [
        { id: "claude", label: "Claude Sonnet 4", value: "152M" },
        { id: "gpt", label: "GPT-4.1", value: "78M" },
        { id: "gemini", label: "Gemini 2.5 Pro", value: "37M" },
      ],
    },
  ],
  topModels: [
    { id: "claude", title: "Claude Sonnet 4", value: "375M tok", active: true },
    { id: "gpt", title: "GPT-4.1", value: "112M tok" },
    { id: "gemini", title: "Gemini 2.5 Pro", value: "68M tok" },
    { id: "deepseek", title: "DeepSeek V3", value: "33M tok" },
    { id: "llama", title: "Llama 3.3 70B", value: "12M tok" },
  ],
  agentRankings: [
    { id: "a1", title: "Content Optimizer Bulk", meta: "Weekly", value: "$89.40", active: true },
    { id: "a2", title: "GSC Monthly YoY Report", meta: "Monthly", value: "$54.20" },
    { id: "a3", title: "Post Creator Weekly", meta: "Weekly", value: "$41.15" },
    { id: "a4", title: "Meta Batch Optimizer", meta: "Daily", value: "$28.90" },
    { id: "a5", title: "Local SEO Pages", meta: "Daily", value: "$11.32" },
  ],
  chartKeys: ["claude", "gpt", "gemini", "deepseek"],
  chartSeries: chartDays(30, ["claude", "gpt", "gemini", "deepseek"]),
  agentChartKeys: [...AGENT_KEYS],
  agentChartSeries: chartDays(30, AGENT_KEYS),
};

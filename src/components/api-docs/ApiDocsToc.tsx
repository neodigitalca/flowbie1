import { ArrowDown } from "lucide-react";
import type { TocEntry } from "@/lib/api-docs/types";
import { cn } from "@/lib/utils";

export function ApiDocsToc({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-24">
        <p className="mb-3 text-base font-normal uppercase tracking-wide text-white">In this article</p>
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className={entry.level === 3 ? "pl-4" : undefined}>
              <a
                href={`#${entry.id}`}
                className={cn(
                  "flex items-start gap-2 text-base text-white",
                  "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                )}
              >
                <ArrowDown className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{entry.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

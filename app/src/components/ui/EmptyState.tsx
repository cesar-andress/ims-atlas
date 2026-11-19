import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type Props = {
  title: string;
  body: string;
  action?: ReactNode;
  testId?: string;
};

/** Designed empty / pending panel (never a blank white box). */
export function EmptyState({ title, body, action, testId = "empty-state" }: Props) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center"
      data-testid={testId}
      role="status"
    >
      <Inbox className="h-10 w-10 text-ink-3" aria-hidden />
      <h2 className="m-0 text-lg font-semibold text-ink">{title}</h2>
      <p className="m-0 max-w-md text-sm text-ink-2">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

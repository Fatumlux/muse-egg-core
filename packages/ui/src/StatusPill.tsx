export interface StatusPillProps {
  tone?: "cyan" | "violet" | "rose" | "amber" | "green";
  children: string;
}

export function StatusPill({ tone = "cyan", children }: StatusPillProps) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

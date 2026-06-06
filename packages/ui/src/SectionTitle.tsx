export interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  compact?: boolean;
}

export function SectionTitle({ eyebrow, title, compact = false }: SectionTitleProps) {
  return (
    <header className={`section-title ${compact ? "compact" : ""}`}>
      {eyebrow && <span>{eyebrow}</span>}
      <h1>{title}</h1>
    </header>
  );
}

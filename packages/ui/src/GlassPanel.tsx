import type { HTMLAttributes, ReactNode } from "react";

export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "aside" | "div";
  title?: string;
  action?: ReactNode;
}

export function GlassPanel({
  as: Tag = "section",
  title,
  action,
  className = "",
  children,
  ...props
}: GlassPanelProps) {
  return (
    <Tag className={`glass-panel ${className}`} {...props}>
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

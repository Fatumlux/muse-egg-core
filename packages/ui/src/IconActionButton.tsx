import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  showLabel?: boolean;
}

export function IconActionButton({
  icon,
  label,
  showLabel = false,
  className = "",
  ...props
}: IconActionButtonProps) {
  return (
    <button className={`icon-action ${showLabel ? "with-label" : ""} ${className}`} aria-label={label} title={label} {...props}>
      {icon}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}

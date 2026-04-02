"use client";

import { StatusLabels } from "@/types";

interface StatusBadgeProps {
  status: number;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = StatusLabels[status] || `Unknown (${status})`;
  const className = status === 1 ? "badge badge-active" : "badge badge-deleted";

  return <span className={className}>{label}</span>;
}

export function shortKey(pub: string, n = 4): string {
  if (!pub) return "";
  return `${pub.slice(0, n)}…${pub.slice(-n)}`;
}

export function xlm(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(n);
  return `${formatted} XLM`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

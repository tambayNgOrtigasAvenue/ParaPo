import { RideStatus } from "@/lib/stellar/escrow";

export function RideStatusPill({ status }: { status: RideStatus }) {
  const map: Record<RideStatus, string> = {
    Active: "bg-accent/15 text-accent",
    Completed: "bg-brand/10 text-brand-dark",
    Cancelled: "bg-danger/10 text-danger",
  };
  return <span className={`pill ${map[status]}`}>{status}</span>;
}

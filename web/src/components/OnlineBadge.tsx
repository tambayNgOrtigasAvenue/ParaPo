"use client";
import { useEffect, useState } from "react";

export function OnlineBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <span
      className={`pill ${online ? "bg-brand/10 text-brand-dark" : "bg-accent/15 text-accent"}`}
      title={online ? "Online" : "Offline — actions will be queued"}
    >
      <span className={`h-2 w-2 rounded-full ${online ? "bg-brand" : "bg-accent"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

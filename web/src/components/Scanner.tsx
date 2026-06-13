"use client";
import { useEffect, useRef, useState } from "react";

// html5-qrcode is a browser-only library; import lazily to avoid SSR issues.
export function Scanner({
  onResult,
  onCancel,
}: {
  onResult: (text: string) => void;
  onCancel?: () => void;
}) {
  const regionId = useRef(`qr-region-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const handled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId.current, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            if (handled.current) return;
            handled.current = true;
            onResult(decoded);
          },
          () => {}
        );
      } catch (e: any) {
        setError(e?.message ?? "Unable to access the camera.");
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div className="space-y-3">
      <div
        id={regionId.current}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-black shadow-card"
      />
      {error && (
        <p className="rounded-2xl bg-danger/10 p-3 text-sm font-medium text-danger">
          {error} You can also paste the driver&apos;s code manually.
        </p>
      )}
      {onCancel && (
        <button className="btn-ghost w-full" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

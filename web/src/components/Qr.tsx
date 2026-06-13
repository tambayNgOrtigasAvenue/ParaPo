"use client";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function Qr({ value, size = 240 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#072A1E", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [value, size]);

  return (
    <div className="inline-block rounded-3xl border border-slate-100 bg-white p-3 shadow-glow">
      <canvas ref={ref} width={size} height={size} />
    </div>
  );
}

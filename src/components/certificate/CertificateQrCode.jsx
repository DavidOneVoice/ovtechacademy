import { useMemo } from "react";
import { createQrMatrix } from "../../utils/qrCode";

export default function CertificateQrCode({ value, label }) {
  const matrix = useMemo(() => createQrMatrix(value), [value]);
  const path = matrix.flatMap((row, y) => row.map((dark, x) => dark ? `M${x + 4} ${y + 4}h1v1h-1z` : "")).join("");

  return (
    <svg viewBox="0 0 45 45" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width="45" height="45" fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

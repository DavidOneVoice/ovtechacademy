import { useEffect, useRef, useState } from "react";
import { CERTIFICATE_HEIGHT, CERTIFICATE_WIDTH } from "../../data/certificateConfig";

export default function CertificateViewer({ children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const resize = ([entry]) => setScale(Math.min(entry.contentRect.width / CERTIFICATE_WIDTH, 1));
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    setScale(Math.min(container.clientWidth / CERTIFICATE_WIDTH, 1));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="certificate-display" ref={containerRef} style={{ height: `${CERTIFICATE_HEIGHT * scale}px` }}>
      <div className="certificate-scale-layer" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

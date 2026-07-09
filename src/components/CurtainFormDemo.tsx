import { useEffect, useRef, useState } from "react";
import { CurtainApp } from "../CurtainApp";

export function CurtainFormDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    const app = new CurtainApp();

    app.init(containerRef.current).then((supported) => {
      if (destroyed) {
        // React StrictMode: first mount cleanup already ran
        app.destroy();
        return;
      }
      if (!supported) {
        setUnsupported(true);
      }
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          app.resize(width, height);
        }
      }
    });

    observer.observe(containerRef.current);

    return () => {
      destroyed = true;
      observer.disconnect();
      app.destroy();
    };
  }, []);

  if (unsupported) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100vw",
        height: "100vh",
        background: "#e0d8cc",
        fontFamily: "Georgia, serif",
      }}>
        <div style={{
          maxWidth: 480,
          padding: 40,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          whiteSpace: "pre-line",
          lineHeight: 1.7,
          color: "#4a3f35",
          fontSize: 15,
        }}>
          <h2 style={{ marginTop: 0, fontWeight: 300, letterSpacing: 2 }}>Browser Not Supported</h2>
          <p>{CurtainApp.getUnsupportedMessage()}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100vw",
      height: "100vh",
      background: "#e0d8cc",
      overflow: "hidden",
    }}>
      <div
        ref={containerRef}
        style={{
          width: 640,
          height: 480,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 48px rgba(0,0,0,0.2)",
          borderRadius: 4,
        }}
      />
    </div>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import createGlobe from "cobe";
import { cn } from "@/lib/utils";

interface GlobeProps {
  className?: string;
  markers?: Array<{
    location: [number, number];
    size?: number;
  }>;
}

export function Globe({ className, markers = [] }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const locationToAngles = (lat: number, long: number) => {
    return [Math.PI - ((long * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];
  };

  const focusRef = useRef([0, 0]);

  useEffect(() => {
    let width = 0;
    const onResize = () => canvasRef.current && (width = canvasRef.current.offsetWidth);

    window.addEventListener('resize', onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 0,
      diffuse: 3,
      mapSamples: 16000,
      mapBrightness: 1.2,
      baseColor: [1, 1, 1],
      markerColor: [251 / 255, 100 / 255, 21 / 255],
      glowColor: [59 / 255, 130 / 255, 246 / 255],
      markers: markers.map(marker => ({
        location: marker.location,
        size: marker.size || 0.1
      })),
      onRender: (state) => {
        // Auto-rotate the globe
        state.phi = performance.now() * 0.0005;
        // Add some slow vertical movement
        state.theta = 0.3 + Math.sin(performance.now() * 0.001) * 0.1;
        
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    setTimeout(() => canvasRef.current!.style.opacity = '1');
    
    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, [markers]);

  return (
    <motion.div
      className={cn("relative", className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          display: "block",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
        className="rounded-lg"
      />
    </motion.div>
  );
}
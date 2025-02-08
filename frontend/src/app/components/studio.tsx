"use client";
import "../globals.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AudioVisualizerUtil } from "../utils/audioVisualizer";

interface StudioProps {
  show: boolean;
}

// Separate component for audio visualization
function AudioVisualizerComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<AudioVisualizerUtil | null>(null);
  const [error, setError] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Only create visualizer if canvas ref exists
    if (canvasRef.current) {
      visualizerRef.current = new AudioVisualizerUtil({
        current: canvasRef.current,
      });
    }

    return () => {
      if (visualizerRef.current) {
        visualizerRef.current.cleanup();
      }
    };
  }, []);

  const startVisualization = async () => {
    try {
      // Only create visualizer if canvas ref exists
      if (canvasRef.current && !visualizerRef.current) {
        visualizerRef.current = new AudioVisualizerUtil({
          current: canvasRef.current,
        });
      }

      if (visualizerRef.current) {
        await visualizerRef.current.startVisualization();
        setIsInitialized(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initialize audio"
      );
    }
  };

  return (
    <>
      <h2 className="text-white text-2xl mb-8">Live Waveform</h2>
      <div className="w-full max-w-4xl h-64 px-6">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg bg-black/50 border border-jungle-green/20"
        />
      </div>
      <button
        onClick={startVisualization}
        className="mt-6 px-6 py-3 bg-jungle-green hover:bg-opacity-90 text-white rounded-lg transition-colors"
      >
        {isInitialized ? "Restart Visualization" : "Start Visualization"}
      </button>
      {error && (
        <div className="mt-4 text-white text-xl bg-burgundy/20 p-6 rounded-lg">
          <p>{error}</p>
          <button
            onClick={() => setError("")}
            className="mt-4 px-4 py-2 bg-jungle-green/20 hover:bg-jungle-green/30 rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

// Dynamically import AudioVisualizer with SSR disabled
const AudioVisualizer = dynamic(
  () => Promise.resolve(AudioVisualizerComponent),
  {
    ssr: false,
  }
);

// Main Studio component
export default function Studio({ show }: StudioProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!show || !mounted) return null;

  return (
    <div className="fade-in relative h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      <AudioVisualizer />
    </div>
  );
}

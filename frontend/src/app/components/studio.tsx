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
  const audioRef = useRef<HTMLAudioElement>(null);
  const visualizerRef = useRef<AudioVisualizerUtil | null>(null);
  const [error, setError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

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
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startVisualization = async () => {
    try {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      // Only create visualizer if canvas ref exists
      if (canvasRef.current && !visualizerRef.current) {
        visualizerRef.current = new AudioVisualizerUtil({
          current: canvasRef.current,
        });
      }

      if (visualizerRef.current) {
        await visualizerRef.current.startVisualization();
        setIsRecording(true);
        setError("");
      }
    } catch (err) {
      console.error("Visualization error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize audio"
      );
    }
  };

  const stopRecording = async () => {
    try {
      if (visualizerRef.current) {
        const audioBlob = await visualizerRef.current.stopRecording();
        console.log("Recording stopped, blob size:", audioBlob.size);

        if (audioBlob.size > 0) {
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);

          // Ensure audio element loads the new source
          if (audioRef.current) {
            audioRef.current.load();
          }
        } else {
          throw new Error("No audio data recorded");
        }

        setIsRecording(false);
        setError("");
      }
    } catch (err) {
      console.error("Recording error:", err);
      setError(err instanceof Error ? err.message : "Failed to stop recording");
      setIsRecording(false);
    }
  };

  return (
    <>
      <h2 className="text-white text-2xl mb-2">
        Go ahead and get shredding, rockstar
      </h2>
      <p className="text-white text-xl mb-6">
        You worry about the guitar, we'll bring the drums and bass
      </p>
      <div className="w-full max-w-4xl h-64 px-6">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg bg-black/50 border border-jungle-green/20"
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={isRecording ? stopRecording : startVisualization}
          className="mt-6 px-6 py-3 bg-jungle-green hover:bg-opacity-90 text-white rounded-lg transition-colors"
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        {audioUrl && (
          <div className="mt-2 w-full max-w-screen-md p-4 rounded-lg bg-white/5 backdrop-blur-sm fade-in">
            <p className="text-white text-lg mb-2">
              Sounding divine -- make sure you're liking this track. Want to redo?
              We're here all day.
            </p>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
              onError={(e) => {
                console.error("Audio playback error:", e);
                setError("Failed to play audio recording");
              }}
            />
          </div>
        )}
      </div>
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

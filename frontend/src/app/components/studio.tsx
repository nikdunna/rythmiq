"use client";
import "../globals.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AudioVisualizerUtil } from "../utils/audioVisualizer";

interface StudioProps {
  show: boolean;
  onAudioComplete?: (audioUrl: string) => void;
  onBack?: () => void;
  onNext?: () => void;
}

// Separate component for audio visualization
function AudioVisualizerComponent({
  onAudioComplete,
}: {
  onAudioComplete?: (audioUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const visualizerRef = useRef<AudioVisualizerUtil | null>(null);
  const [error, setError] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUnmounting, setIsUnmounting] = useState(false);

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

  const handleLoveIt = () => {
    if (audioUrl && onAudioComplete) {
      setIsUnmounting(true);
      // Add a small delay to allow the fade-out animation to play
      setTimeout(() => {
        onAudioComplete(audioUrl);
      }, 500);
    }
  };

  return (
    <>
      <div
        className={`w-full flex flex-col items-center ${
          isUnmounting ? "fade-out" : "fade-in"
        }`}
      >
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
                Sounding divine -- make sure you're liking this track. Want to
                redo? We're here all day.
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
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleLoveIt}
                  className="px-6 py-3 bg-orange-web hover:bg-opacity-90 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>Love it</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
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
      </div>
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
export default function Studio({
  show,
  onAudioComplete,
  onBack,
  onNext,
}: StudioProps) {
  const [mounted, setMounted] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBack = () => {
    setIsFading(true);
    setTimeout(() => {
      onBack?.();
    }, 500); // Match this with your fade-out animation duration
  };

  const handleNext = () => {
    setIsFading(true);
    setTimeout(() => {
      onNext?.();
    }, 500);
  };

  if (!show || !mounted) return null;

  return (
    <div
      className={`relative h-screen flex flex-col items-center justify-center overflow-hidden bg-black ${
        isFading ? "fade-out" : "fade-in"
      }`}
    >
      {/* Navigation Arrows */}
      <div className="absolute top-1/2 left-6 transform -translate-y-1/2 z-20">
        <button
          onClick={handleBack}
          className="p-4 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="absolute top-1/2 right-6 transform -translate-y-1/2 z-20">
        <button
          onClick={handleNext}
          className="p-4 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <AudioVisualizer onAudioComplete={onAudioComplete} />
    </div>
  );
}

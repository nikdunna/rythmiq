"use client";
import "../globals.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AudioVisualizerUtil } from "../utils/audioVisualizer";
import { MidiCaptureUtil } from "../utils/midiCapture";

interface StudioProps {
  show: boolean;
  onAudioComplete: (audioUrl: string) => void;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [midiCapture, setMidiCapture] = useState<MidiCaptureUtil | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [error, setError] = useState<string>("");
  const [tempo, setTempo] = useState(120);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      setMidiCapture(new MidiCaptureUtil({ current: canvas }));
    }
    return () => {
      if (midiCapture) {
        midiCapture.cleanup();
      }
    };
  }, [canvasRef]);

  const handleTempoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTempo = parseInt(event.target.value);
    setTempo(newTempo);
    if (midiCapture) {
      midiCapture.setTempo(newTempo);
    }
  };

  const handleBack = () => {
    setIsFading(true);
    setTimeout(() => {
      onBack?.();
    }, 500);
  };

  const handleNext = () => {
    setIsFading(true);
    setTimeout(() => {
      onNext?.();
    }, 500);
  };

  const startRecording = async () => {
    try {
      if (!midiCapture) {
        throw new Error("MIDI capture not initialized");
      }

      setError("");
      setIsRecording(true);
      await midiCapture.startCapture();
    } catch (err: any) {
      setError(err.message || "Failed to start MIDI recording");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!midiCapture) return;

    const noteSequence = midiCapture.stopCapture();
    setIsRecording(false);

    // Convert NoteSequence to a data URL for compatibility with existing flow
    const sequenceStr = JSON.stringify(noteSequence);
    console.log("Generated NoteSequence:", noteSequence); // Debug log
    const dataUrl = `data:application/json;base64,${btoa(sequenceStr)}`;
    onAudioComplete(dataUrl);
  };

  if (!show) return null;

  return (
    <div
      className={`h-screen animated-gradient ${
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

      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <div className="w-[80%] max-w-3xl bg-black/20 backdrop-blur-sm p-8 rounded-lg">
          <h2 className="text-white text-4xl mb-6 text-center">
            Record Your Melody
          </h2>

          <div className="flex flex-col items-center gap-6">
            {!isRecording && (
              <div className="w-full flex flex-col items-center gap-2">
                <label className="text-white text-lg">Tempo: {tempo} BPM</label>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={tempo}
                  onChange={handleTempoChange}
                  className="w-full max-w-md h-2 bg-jungle-green/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="w-full h-48 bg-black/40 rounded-lg"
              width={800}
              height={200}
            />

            <div className="flex gap-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-6 py-3 rounded-lg transition-colors ${
                  isRecording
                    ? "bg-burgundy hover:bg-burgundy/90"
                    : "bg-jungle-green hover:bg-jungle-green/90"
                } text-white text-xl flex items-center gap-2`}
              >
                {isRecording ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.5 12c0-4.142-3.358-7.5-7.5-7.5S4.5 7.858 4.5 12s3.358 7.5 7.5 7.5v-1.5M12 12l9 6-9-6z"
                      />
                    </svg>
                    Start Recording
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="text-burgundy bg-burgundy/10 p-4 rounded-lg">
                {error}
              </div>
            )}

            <div className="text-white text-center">
              <p className="text-lg">
                Connect your MIDI keyboard and play up to 32 steps.
              </p>
              <p className="text-sm opacity-70">
                The metronome will count in for 2 bars before recording starts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

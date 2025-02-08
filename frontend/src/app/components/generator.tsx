"use client";
import "../globals.css";

interface GeneratorProps {
  audioURL: string | null;
  show: boolean;
}

export default function Generator({ audioURL, show }: GeneratorProps) {
  if (!show) return null;

  if (!audioURL) {
    return (
      <div className="h-screen fade-in">
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-white text-2xl font-bold">
            No audio recorded, problem!
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-red-500 fade-in">
      <audio
        controls
        src={audioURL}
        className="w-[80%] max-w-3xl"
        onError={(e) => {
          console.error("Audio playback error:", e);
        }}
      />
    </div>
  );
}

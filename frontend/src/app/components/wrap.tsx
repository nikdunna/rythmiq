"use client"; // Ensure this runs only on the client side
import "../globals.css";
import { useEffect, useState } from "react";
import { Monoton } from "next/font/google";

const monoton = Monoton({
  weight: "400",
  subsets: ["latin"],
});

let mm: any;
let Tone: any;

if (typeof window !== "undefined") {
  mm = require("@magenta/music");
  Tone = require("tone");
}

interface NoteSequence {
  notes: Array<{
    pitch: number;
    startTime?: number;
    endTime?: number;
    velocity: number;
    program: number;
    isDrum?: boolean;
    quantizedStartStep?: number;
    quantizedEndStep?: number;
  }>;
  totalTime?: number;
  tempos: Array<{ time: number; qpm: number }>;
  quantizationInfo: { stepsPerQuarter: number };
  totalQuantizedSteps?: number;
}

interface WrapProps {
  drumSequence: NoteSequence | null;
  inputSequence: NoteSequence | null;
  show: boolean;
  onBack?: () => void;
}

export default function Wrap({
  drumSequence,
  inputSequence,
  show,
  onBack,
}: WrapProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isFading, setIsFading] = useState(false);

  const handleBack = () => {
    setIsFading(true);
    setTimeout(() => {
      onBack?.();
    }, 500); // Match this with your fade-out animation duration
  };

  // ✅ **Dynamic Combination of Input & Drum Sequences**
  const getCombinedSequences = (): NoteSequence | null => {
    const sequences = [drumSequence, inputSequence].filter(Boolean); // Remove null values

    if (sequences.length === 0) {
      console.warn("⚠️ No sequences available to combine.");
      return null;
    }

    console.log("🎼 Drum Sequence:", drumSequence);
    console.log("🎵 Input Sequence:", inputSequence);

    const combinedSequence: NoteSequence = {
      notes: [],
      tempos: sequences[0]?.tempos || [{ time: 0, qpm: 120 }],
      quantizationInfo: sequences[0]?.quantizationInfo || {
        stepsPerQuarter: 4,
      },
      totalQuantizedSteps: 0,
      totalTime: 0,
    };

    sequences.forEach((seq) => {
      if (!seq || !seq.notes) return;

      seq.notes.forEach((note) => {
        combinedSequence.notes.push({
          ...note,
          program: note.program || 0, // Ensure default program if missing
        });
      });

      // ✅ **Update sequence duration**
      combinedSequence.totalQuantizedSteps = Math.max(
        combinedSequence.totalQuantizedSteps || 0,
        seq.totalQuantizedSteps || 0
      );
      combinedSequence.totalTime = Math.max(
        combinedSequence.totalTime || 0,
        seq.totalTime || 0
      );
    });

    // ✅ **Sort notes by start time**
    combinedSequence.notes.sort((a, b) => {
      const aStart = a.quantizedStartStep || a.startTime || 0;
      const bStart = b.quantizedStartStep || b.startTime || 0;
      return aStart - bStart;
    });

    console.log("🎶 Combined Sequence:", combinedSequence);
    return combinedSequence;
  };

  const playCombined = async () => {
    if (!mm || !Tone) {
      setError("Playback modules not loaded");
      return;
    }

    try {
      // ✅ **Stop playback if already playing**
      if (isPlaying && currentPlayer) {
        currentPlayer.stop();
        setCurrentPlayer(null);
        setIsPlaying(false);
        setStatus("Playback stopped");
        return;
      }

      const combinedSequence = getCombinedSequences();
      if (!combinedSequence) {
        setError("No sequences available to play");
        return;
      }

      // ✅ **Ensure Tone.js is active**
      if (!Tone.context || Tone.context.state !== "running") {
        await Tone.start();
      }

      // ✅ **Create Player**
      const player = new mm.SoundFontPlayer(
        "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
        undefined,
        Tone.context,
        undefined,
        {
          run: (note: any) => {
            console.log("🎵 Playing note:", {
              pitch: note.pitch,
              velocity: note.velocity,
              isDrum: note.isDrum,
              program: note.program,
              startTime: note.startTime,
              endTime: note.endTime,
            });
          },
          stop: () => {
            setStatus("Playback complete");
            setCurrentPlayer(null);
            setIsPlaying(false);
          },
        }
      );

      // ✅ **Load & Play**
      setStatus("Loading samples...");
      await player.loadSamples(combinedSequence);

      setIsPlaying(true);
      setCurrentPlayer(player);
      setStatus("Playing combined track...");
      await player.start(combinedSequence);
    } catch (err) {
      console.error("❌ Playback error:", err);
      setError("Failed to play combined sequence");
      setIsPlaying(false);
      setCurrentPlayer(null);
    }
  };

  if (!show) return null;

  return (
    <div
      className={`h-screen animated-gradient-wrap ${
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

      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <div className="w-[80%] max-w-3xl bg-black/20 backdrop-blur-sm p-8 rounded-lg text-center">
          <h2 className={`${monoton.className} text-white text-4xl mb-6`}>
            Let's wrap this up
          </h2>

          <div className="flex flex-col items-center gap-6">
            <p className="text-white text-xl">
              {status || "Ready to play your masterpiece"}
            </p>

            <button
              onClick={playCombined}
              className="w-full px-6 py-3 bg-jungle-green hover:bg-opacity-90 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isPlaying ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Stop Playing
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Play Combined Track
                </>
              )}
            </button>

            {error && (
              <div className="text-burgundy bg-burgundy/10 p-4 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

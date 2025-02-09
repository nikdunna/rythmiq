"use client"; // Ensure this runs only on the client side
import "../globals.css";
import { useState } from "react";
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
  const [isLooping, setIsLooping] = useState(false);

  const handleBack = () => {
    setIsFading(true);
    setTimeout(() => {
      onBack?.();
    }, 500); // Match this with your fade-out animation duration
  };

  const getCombinedSequences = (): NoteSequence | null => {
    console.log("Input sequences:", {
      drumSequence,
      inputSequence,
      drumNotes: drumSequence?.notes?.length,
      inputNotes: inputSequence?.notes?.length,
    });

    const sequences = [drumSequence, inputSequence].filter(Boolean);
    console.log("Filtered sequences:", sequences.length);

    if (sequences.length === 0) {
      console.warn("⚠️ No sequences available to combine.");
      return null;
    }

    const combinedSequence: NoteSequence = {
      notes: [],
      tempos: sequences[0]?.tempos || [{ time: 0, qpm: 120 }],
      quantizationInfo: sequences[0]?.quantizationInfo || {
        stepsPerQuarter: 4,
      },
      totalQuantizedSteps: 0,
      totalTime: 0, // Will be recalculated
    };

    let maxEndTime = 0;
    let minStartTime = Infinity;

    sequences.forEach((seq) => {
      if (!seq || !seq.notes) return;

      seq.notes.forEach((note) => {
        combinedSequence.notes.push({
          pitch: note.pitch,
          startTime: note.startTime || 0,
          endTime: note.endTime || (note.startTime || 0) + 0.25,
          velocity: note.velocity,
          program: note.isDrum ? 0 : note.program || 24,
          isDrum: note.isDrum || false,
        });

        // Track the latest endTime and earliest startTime
        maxEndTime = Math.max(maxEndTime, note.endTime || 0);
        minStartTime = Math.min(minStartTime, note.startTime || 0);
      });
    });

    // ✅ Ensure the sequence starts exactly at 0
    combinedSequence.notes = combinedSequence.notes.map((note) => ({
      ...note,
      startTime: (note.startTime ?? 0) - minStartTime,
      endTime: (note.endTime ?? 0) - minStartTime,
    }));

    // ✅ Trim any extra space by setting totalTime to the last note's endTime
    combinedSequence.totalTime = maxEndTime - minStartTime;

    console.log("✅ Trimmed sequence totalTime:", combinedSequence.totalTime);
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

      // ✅ Fix the timing of the notes
      const quant = mm.sequences.quantizeNoteSequence(combinedSequence, 4);
      const unquant = mm.sequences.unquantizeSequence(quant);

      for (let i = 0; i < unquant.notes.length; i++) {
        delete unquant.notes[i].quantizedStartStep;
        delete unquant.notes[i].quantizedEndStep;
      }
      delete unquant.totalQuantizedSteps;
      delete unquant.quantizationInfo;

      const processedSequence = unquant;

      // ✅ **Create Player**
      const player = new mm.SoundFontPlayer(
        "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
        Tone.Master
      );

      // Set up callback for note events
      player.callbackObject = {
        run: (note: {
          pitch: number;
          velocity: number;
          startTime: number;
          endTime: number;
          program: number;
        }) => {
          console.log("🎵 Playing note:", {
            pitch: note.pitch,
            velocity: note.velocity,
            startTime: note.startTime,
            endTime: note.endTime,
            program: note.program,
          });
        },
        stop: () => {
          console.log("⏹ Playback stopped");
          if (isLooping) {
            console.log("🔁 Restarting playback...");
            (async () => {
              await player.loadSamples(processedSequence); // ✅ Properly await inside an async IIFE
              player.start({ ...processedSequence }); // ✅ Restart the sequence with a fresh copy
            })();
          } else {
            setIsPlaying(false);
            setCurrentPlayer(null);
            setStatus("Playback complete");
          }
        },
      };

      // ✅ **Load & Play**
      setStatus("Loading samples...");
      await player.loadSamples(processedSequence);

      setIsPlaying(true);
      setCurrentPlayer(player);
      setStatus(isLooping ? "Playing in loop..." : "Playing combined track...");
      await player.start(processedSequence);
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
          <h2 className={` text-white text-4xl mb-6`}>
            Let's wrap this up
          </h2>

          <div className="flex flex-col items-center gap-6">
            {/* <p className="text-white text-xl">
              {status || "Ready to play your masterpiece"}
            </p> */}

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
                  {isLooping ? "Play in Loop" : "Play Combined Track"}
                </>
              )}
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`mt-2 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isLooping
                  ? "bg-jungle-green text-white"
                  : "bg-jungle-green/20 text-white hover:bg-jungle-green/30"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              {isLooping ? "Loop On" : "Loop Off"}
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

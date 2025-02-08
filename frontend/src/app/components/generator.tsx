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

const initializeModules = async () => {
  if (typeof window !== "undefined") {
    try {
      const magentaModule = await import("@magenta/music");
      const ToneModule = await import("tone");
      const mmcore = await import("@magenta/music").then((m) => m.sequences);
      // Initialize Tone.js properly
      Tone = ToneModule;
      await Tone.start();
      console.log("Tone.js started, context state:", Tone.context.state);

      // ✅ Override Magenta.js's internal Tone.js reference
      (window as any).Tone = Tone;

      // Try to set Magenta's Tone reference, but don't error if it fails
      try {
        Object.defineProperty(magentaModule, "Tone", {
          configurable: true,
          get: () => Tone,
          set: () => {},
        });
      } catch (e) {
        console.log("Tone property already set on Magenta module");
      }

      mm = magentaModule;
      console.log("✅ Magenta.js initialized");

      // ✅ 🔥 PATCH SoundFontPlayer to prevent `programOutputs.has` error
      if (mm.SoundFontPlayer) {
        const originalGetAudioNodeOutput =
          mm.SoundFontPlayer.prototype.getAudioNodeOutput;

        mm.SoundFontPlayer.prototype.getAudioNodeOutput = function (
          program: number
        ) {
          // ✅ Ensure `programOutputs` is initialized as a Map
          if (!this.programOutputs || !(this.programOutputs instanceof Map)) {
            console.warn(
              "⚠ Patching SoundFontPlayer: Creating programOutputs."
            );
            this.programOutputs = new Map<number, any>(); // ✅ Explicitly typed Map
          }

          // ✅ Ensure the program exists before accessing `.has()`
          if (!this.programOutputs.has(program)) {
            console.warn(`⚠ Patching: Creating missing program ${program}`);
            this.programOutputs.set(program, this.output || new Tone.Gain());
          }

          return originalGetAudioNodeOutput.call(this, program);
        };
      }

      console.log(
        "✅ SoundFontPlayer patched to prevent `programOutputs` error."
      );
    } catch (error) {
      console.error("❌ Error initializing modules:", error);
    }
  }
};

// ✅ Call `initializeModules()` when running on the client-side
if (typeof window !== "undefined") {
  initializeModules().catch(console.error);
}

interface GeneratorProps {
  audioURL: string | null;
  show: boolean;
  onClose?: (params: {
    drumSequence: NoteSequence | null;
    inputSequence: NoteSequence | null;
  }) => void;
  onBack?: () => void;
  onNext?: () => void;
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

export default function Generator({
  audioURL,
  show,
  onClose,
  onBack,
  onNext,
}: GeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState<any | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [inputSequence, setInputSequence] = useState<NoteSequence | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [generatedTracks, setGeneratedTracks] = useState<{
    drums: NoteSequence | null;
    bass: NoteSequence | null;
  }>({ drums: null, bass: null });

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

  const handleClose = () => {
    setIsFading(true);
    setTimeout(() => {
      onClose?.({
        drumSequence: generatedTracks.drums,
        inputSequence: inputSequence,
      });
    }, 500);
  };

  // Initialize the Magenta model
  useEffect(() => {
    const initModel = async () => {
      try {
        if (!mm) {
          setError("Browser environment required");
          return;
        }

        setModelStatus("Loading Magenta model...");
        const musicVAE = new mm.MusicVAE(
          "https://storage.googleapis.com/magentadata/js/checkpoints/groovae/tap2drum_2bar"
        );

        setModelStatus("Warming up the model...");
        await musicVAE.initialize();
        setModel(musicVAE);
        setModelStatus("Model ready!");
      } catch (err) {
        console.error("Initialization error details:", err);
        setError("Model initialization failed");
        setModelStatus("Model failed to load");
      }
    };

    initModel();

    // Cleanup
    return () => {
      if (model) {
        model.dispose();
      }
    };
  }, []);

  // Create a sequence with melody, drums, and bass
  const analyzeAudio = async (audioUrl: string): Promise<NoteSequence> => {
    setModelStatus("Analyzing audio...");

    // Create a sequence with melody, drums, and bass
    const sequence: NoteSequence = {
      notes: [
        // 🎶 **Melody (Program 0 - Piano) - C Major Scale**
        ...Array.from({ length: 12 }, (_, i) => ({
          pitch: [60, 62, 64, 67, 65, 69, 71, 72, 74, 76, 77, 79][i % 12],
          quantizedStartStep: i * 2, // Notes every 2 steps
          quantizedEndStep: i * 2 + (i % 4 === 0 ? 3 : 2), // Longer every 4th note
          velocity: 85 + (i % 3) * 10, // Adds natural volume variation
          program: 0,
          isDrum: false,
          startTime: i * 0.25, // Faster pacing
          endTime: i * 0.25 + (i % 4 === 0 ? 0.75 : 0.5),
        })),

        // 🎵 **Syncopated notes for expressiveness**
        ...Array.from({ length: 6 }, (_, i) => ({
          pitch: [61, 66, 70, 73, 75, 78][i], // Grace note additions
          quantizedStartStep: i * 4 + 1, // Slight offset for syncopation
          quantizedEndStep: i * 4 + 2,
          velocity: 75 + (i % 2) * 10,
          program: 0,
          isDrum: false,
          startTime: i * 0.5 + 0.1, // Syncopation effect
          endTime: i * 0.5 + 0.25,
        })),

        // 🎼 **Longer Sustained Notes for Contrast**
        ...Array.from({ length: 3 }, (_, i) => ({
          pitch: [72, 74, 76][i], // Higher notes for contrast
          quantizedStartStep: i * 8,
          quantizedEndStep: i * 8 + 6, // Holding longer notes
          velocity: 100,
          program: 0,
          isDrum: false,
          startTime: i * 1.0,
          endTime: i * 1.0 + 1.5,
        })),
      ],
      quantizationInfo: { stepsPerQuarter: 4 },
      tempos: [{ time: 0, qpm: 120 }],
      totalQuantizedSteps: 32, // ✅ Model limit
      totalTime: 8.0, // ✅ Matches 32-step limit
    };

    // unquantized -> quantized -> unquantized
    const quant = mm.sequences.quantizeNoteSequence(sequence, 4);
    const unquant = mm.sequences.unquantizeSequence(quant);

    for (let i = 0; i < unquant.notes.length; i++) {
      delete unquant.notes[i].quantizedStartStep;
      delete unquant.notes[i].quantizedEndStep;
    }
    delete unquant.totalQuantizedSteps;
    delete unquant.quantizationInfo;

    setInputSequence(sequence); // Store the input sequence

    return unquant;
  };

  const generateAccompaniment = async () => {
    if (!model || !mm || !audioURL) {
      setError("Model not ready yet");
      return;
    }

    setIsGenerating(true);
    try {
      // Analyze input audio
      const sequence = await analyzeAudio(audioURL);
      console.log("Input sequence:", sequence);
      setModelStatus("Generating accompaniment...");

      // Generate accompaniment with higher temperature for more variation
      const z = await model.encode([sequence]);
      console.log("Encoded latent:", z);

      const temperature = 0.8; // Higher temperature for more variation
      console.log("Using temperature:", temperature);

      // Generate multiple sequences and pick the best one
      const numTries = 15; // More attempts for better results
      let drumSequence = null;
      let maxScore = 0;
      const tempo = sequence.tempos[0].qpm;

      for (let i = 0; i < numTries; i++) {
        console.log(`Generation attempt ${i + 1}/${numTries}`);
        const sequences = await model.decode(
          z,
          temperature,
          undefined,
          undefined,
          tempo
        );
        console.log(`Attempt ${i + 1} sequences:`, sequences);

        if (sequences && sequences[0]) {
          console.log(
            "🥁 Drum notes in generated sequence:",
            sequences[0].notes.filter(
              (note: NoteSequence["notes"][0]) => note.isDrum
            )
          );
          const sequence = sequences[0];
          // Score based on number and distribution of notes
          const drumNotes = sequence.notes.filter(
            (note: NoteSequence["notes"][0]) => note.isDrum
          ).length;
          // Adjust scoring to prefer more bass notes
          const score = drumNotes; // Weight bass notes higher

          console.log(
            `Attempt ${i + 1} score:`,
            score,
            `(${drumNotes} drum notes`
          );

          if (score > maxScore) {
            maxScore = score;
            drumSequence = sequence;
          }
        }
      }

      if (!drumSequence || maxScore === 0) {
        throw new Error(
          "Failed to generate valid sequences with sufficient notes"
        );
      }

      console.log("Best sequence:", drumSequence);
      console.log("Total notes in best sequence:", drumSequence.notes.length);
      console.log("Score of best sequence:", maxScore);

      // Some drums are too quiet and they don't sound great, so mute them completely.
      for (let i = 0; i < drumSequence.notes.length; i++) {
        const note = drumSequence.notes[i];
        note.instrument = 1;
        if (note.velocity < 10) {
          note.velocity = 0;
        }
      }

      // Sometimes the first drum comes with a startTime < 0, so fix that.
      if (drumSequence.notes[0].startTime < 0) {
        drumSequence.notes[0].startTime = 0;
      }
      // Store generated sequences
      setGeneratedTracks({ drums: drumSequence, bass: null });

      z.dispose();

      setModelStatus("Generation complete!");
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate accompaniment");
    } finally {
      setIsGenerating(false);
    }
  };

  // Play function using Magenta.js Player
  const playSample = async (sequence: NoteSequence | null) => {
    if (!sequence || !mm || !Tone) return;

    try {
      // If already playing, stop the current playback
      if (isPlaying && currentPlayer) {
        currentPlayer.stop();
        setCurrentPlayer(null);
        setIsPlaying(false);
        setModelStatus("Playback stopped");
        return;
      }

      console.log("Starting playback of sequence:", sequence);
      console.log("Number of notes to play:", sequence.notes.length);
      console.log("Total duration:", sequence.totalTime);
      console.log("Tempo:", sequence.tempos[0].qpm);

      // Initialize audio context and Tone.js
      if (!Tone.context || Tone.context.state !== "running") {
        console.log("Starting Tone.js...");
        await Tone.start();
        console.log("Tone.js context state:", Tone.context.state);
      }

      // Create player with SoundFont
      console.log("Creating SoundFont player...");
      const player = new mm.SoundFontPlayer(
        "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus",
        undefined,
        Tone.context,
        undefined,
        {
          run: (note: any, currentTime: number) => {
            console.log("Playing note:", {
              pitch: note.pitch,
              velocity: note.velocity,
              startTime: currentTime,
              endTime: currentTime + (note.endTime - note.startTime),
              isDrum: note.isDrum,
              program: note.program,
            });
          },
          stop: () => {
            // Only reset state if we're not already starting a new loop
            if (!isPlaying) {
              player.start(sequence); // Restart playback for looping
            } else {
              console.log("Playback stopped");
              setModelStatus("Playback complete");
              setCurrentPlayer(null);
            }
          },
        }
      );

      // Load samples before playing
      console.log("Loading samples...");
      await player.loadSamples(sequence);
      console.log("Samples loaded successfully");

      // Start playback
      setIsPlaying(true);
      setCurrentPlayer(player);
      setModelStatus("Playing...");
      console.log("Starting playback...");
      await player.start(sequence);
      console.log("Playback started successfully");
    } catch (error: any) {
      console.error("Error playing sample:", error);
      console.error("Error details:", {
        name: error?.name || "Unknown error",
        message: error?.message || "No error message available",
        stack: error?.stack || "No stack trace available",
      });
      setError("Failed to play");
      setModelStatus("Playback failed");
      setIsPlaying(false);
      setCurrentPlayer(null);
    }
  };

  if (!show) return null;

  if (!audioURL) {
    return (
      <div
        className={`h-screen animated-gradient-generator ${
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
          <h1 className="text-white text-xl font-bold">
            Woah there rockstar, coming in a lil hot you think? Record your
            track first.
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen animated-gradient-generator ${
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
        <div className="w-[80%] max-w-3xl bg-black/20 backdrop-blur-sm p-8 rounded-lg text-center">
          <h2 className={`text-white text-4xl mb-6`}>Your Recorded Track</h2>
          <audio controls src={audioURL} className="w-full mb-6" />

          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-2xl">{modelStatus}</p>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={generateAccompaniment}
                disabled={!model || isGenerating}
                className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 
                ${
                  !model || isGenerating
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-jungle-green hover:bg-opacity-90"
                } 
                text-white text-xl`}
              >
                {isGenerating ? "Generating..." : "Generate Accompaniment"}
              </button>

              <button
                onClick={handleClose}
                className="w-full px-6 py-3 bg-jungle-green/20 hover:bg-jungle-green/30 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Let's wrap this up
              </button>
            </div>

            {generatedTracks.drums && (
              <div className="w-full space-y-4 mt-4">
                <div>
                  <h3 className="text-white text-lg mb-2">Generated Drums</h3>
                  <button
                    onClick={() => playSample(generatedTracks.drums)}
                    className="w-full px-6 py-3 bg-jungle-green/20 hover:bg-jungle-green/30 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
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
                        Stop Drums
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
                        Play Drums
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

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

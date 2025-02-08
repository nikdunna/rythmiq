"use client"; // Ensure this runs only on the client side
import "../globals.css";
import { useEffect, useState } from "react";
import { Monoton } from "next/font/google";
import { moveMessagePortToContext } from "worker_threads";

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

const patchMagentaGrooveConverter = () => {
  if (!mm) return;

  try {
    const GrooveConverter = mm.data.GrooveConverter;
    
    if (GrooveConverter) {
      const originalToTensor = GrooveConverter.prototype.toTensor;

      GrooveConverter.prototype.toTensor = function (noteSequence: any) {
        if (!noteSequence || !noteSequence.notes) {
          console.warn("⚠ GrooveConverter received an invalid NoteSequence.");
          return originalToTensor.call(this, { notes: [], tempos: [{ time: 0, qpm: 120 }], totalTime: 0 });
        }

        // ✅ Fix missing properties
        noteSequence.notes = noteSequence.notes.map((note: any) => ({
          ...note,
          startTime: note.startTime ?? 0,
          endTime: note.endTime ?? (note.startTime ?? 0) + 0.25,
          velocity: note.velocity ?? 100,
          program: note.isDrum ? 0 : 24, // Default electric guitar if not a drum
          isDrum: note.isDrum ?? false,
          quantizedStartStep: note.quantizedStartStep ?? 0,
          quantizedEndStep: note.quantizedEndStep ?? 1,
        }));

        if (!noteSequence.tempos || noteSequence.tempos.length === 0) {
          noteSequence.tempos = [{ time: 0, qpm: 120 }];
        }

        return originalToTensor.call(this, noteSequence);
      };

      console.log("✅ Patched GrooveConverter.toTensor to prevent crashes.");
    }
  } catch (err) {
    console.error("❌ Failed to patch GrooveConverter.toTensor:", err);
  }
};

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
          patchMagentaGrooveConverter();

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
  const [midiOutput, setMidiOutput] = useState<any>(null);
  const [generatedTracks, setGeneratedTracks] = useState<{
    drums: NoteSequence | null;
    bass: NoteSequence | null;
  }>({ drums: null, bass: null });

  // Initialize MIDI output
  useEffect(() => {
    const initMIDI = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const midiAccess = await navigator.requestMIDIAccess();
          const outputs = Array.from(midiAccess.outputs.values());
          if (outputs.length > 0) {
            setMidiOutput(outputs[0]);
            console.log("✅ MIDI output initialized:", outputs[0].name);
          } else {
            console.log("⚠ No MIDI outputs available");
          }
        } else {
          console.log("⚠ Web MIDI API not supported");
        }
      } catch (err) {
        console.error("❌ Error initializing MIDI:", err);
      }
    };

    initMIDI();
  }, []);

  // Parse the input NoteSequence from the base64 URL
  useEffect(() => {
    if (audioURL) {
      try {
        console.log("Received audioURL:", audioURL); // Debug log
        const base64Data = audioURL.split(",")[1];
        const jsonStr = atob(base64Data);
        console.log("Decoded JSON:", jsonStr); // Debug log
        const sequence = JSON.parse(jsonStr) as NoteSequence;

        // Set program to 24 (electric guitar nylon) for all notes
        sequence.notes = sequence.notes.map((note) => ({
          ...note,
          program: 24, // Electric guitar nylon
        }));

        console.log(
          "Parsed sequence in Generator with guitar program:",
          sequence
        );
        console.log("First note timing and program:", sequence.notes[0]);
        setInputSequence(sequence);
      } catch (err) {
        console.error("Failed to parse input sequence:", err);
        setError("Failed to parse input sequence");
      }
    }
  }, [audioURL]);

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
        // Warm up the model.
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

  const generateAccompaniment = async () => {
    if (
      !model ||
      !mm ||
      !inputSequence ||
      !inputSequence.notes ||
      inputSequence.notes.length === 0
    ) {
      setError("Model or input sequence not ready");
      return;
    }

    try {
      const processedSequence: NoteSequence =
        preprocessNoteSequence(inputSequence);

      const temperature = 0.6; // Higher temperature for more variation
      console.log("Using temperature:", temperature);

      const tempo = inputSequence.tempos[0].qpm;
      const z = await model.encode([processedSequence]);
      // Generate multiple sequences and pick the best one
      const numTries = 15; // More attempts for better results
      let drumSequence = null;
      let maxScore = 0;

    
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
      setInputSequence(processedSequence);

      z.dispose();

      setModelStatus("Generation complete!");
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate accompaniment");
    } finally {
      setIsGenerating(false);
    }
  };

  const preprocessNoteSequence = (sequence: NoteSequence): NoteSequence => {
    if (!sequence || !sequence.notes || sequence.notes.length === 0)
      throw new Error("Invalid sequence input.");

    return {
      ...sequence,
      notes: sequence.notes.map((note) => ({
        ...note,
        program: note.isDrum ? 0 : 24, // Assign correct program
        startTime: note.startTime ?? 0,
        endTime: note.endTime ?? (note.startTime ?? 0) + 0.25,
        velocity: note.velocity ?? 100,
        isDrum: note.isDrum ?? false,
      })),
      tempos:
        sequence.tempos && sequence.tempos.length > 0
          ? sequence.tempos
          : [{ time: 0, qpm: 120 }],
      totalTime:
        sequence.totalTime ||
        Math.max(...sequence.notes.map((n) => n.endTime ?? 0), 8),
      quantizationInfo: sequence.quantizationInfo || { stepsPerQuarter: 4 },
    };
  };

  const playSample = async (sequence: NoteSequence | null) => {
    if (!sequence || !mm || !Tone || !sequence.notes.length) return;

    try {
      // Stop existing playback if already playing
      if (isPlaying && currentPlayer) {
        currentPlayer.stop();
        setCurrentPlayer(null);
        setIsPlaying(false);
        setModelStatus("Playback stopped");
        return;
      }

      console.log("🔍 Starting playback of sequence:", sequence);

      // ✅ Fix the timing of the notes
      const quant = mm.sequences.quantizeNoteSequence(sequence, 4);
      const unquant = mm.sequences.unquantizeSequence(quant);

      for (let i = 0; i < unquant.notes.length; i++) {
        delete unquant.notes[i].quantizedStartStep;
        delete unquant.notes[i].quantizedEndStep;
      }
      delete unquant.totalQuantizedSteps;
      delete unquant.quantizationInfo;

      const processedSequence = unquant;

      // ✅ Initialize SoundFontPlayer
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
          setIsPlaying(false);
          setCurrentPlayer(null);
          setModelStatus("Playback complete");
        },
      };

      // Start playback
      setIsPlaying(true);
      setCurrentPlayer(player);
      setModelStatus("Playing...");

      // Add a small delay before starting playback
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start the sequence
      player.start(processedSequence);

      console.log("✅ Playback started successfully");
    } catch (error) {
      console.error("🚨 Error playing sample:", error);
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

          {/* Replace audio element with MIDI playback button */}
          <div className="mb-6">
            <button
              onClick={() => playSample(inputSequence)}
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
                  Stop Input Track
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
                  Play Input Track
                </>
              )}
            </button>
          </div>

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

"use client"; // Ensure this runs only on the client side
import "../globals.css";
import { useEffect, useState } from "react";

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

      // Initialize Tone.js properly
      Tone = ToneModule;
      await Tone.start();
      console.log("Tone.js started, context state:", Tone.context.state);

      // ✅ Override Magenta.js’s internal Tone.js reference
      (window as any).Tone = Tone;
      Object.defineProperty(magentaModule, "Tone", {
        get: () => Tone,
        set: () => {},
      });

      mm = magentaModule;

      console.log("✅ Magenta.js is now using the correct Tone.js version.");

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

export default function Generator({ audioURL, show }: GeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState<any | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [generatedTracks, setGeneratedTracks] = useState<{
    drums: NoteSequence | null;
    bass: NoteSequence | null;
  }>({ drums: null, bass: null });

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
          "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar"
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
        // Melody (Program 0 - Piano)
        ...Array.from({ length: 8 }, (_, i) => ({
          pitch: [60, 64, 67, 72][i % 4], // C major arpeggio
          quantizedStartStep: i * 4,
          quantizedEndStep: i * 4 + 2,
          velocity: 100,
          program: 0,
          isDrum: false,
          startTime: i * 0.5,
          endTime: i * 0.5 + 0.25,
        })),

        // **BASS LINE - BOOSTED LENGTH & VELOCITY**
        ...Array.from({ length: 8 }, (_, i) => ({
          pitch: [48, 48, 53, 53, 55, 55, 48, 48][i],
          quantizedStartStep: i * 4,
          quantizedEndStep: i * 4 + 8, // ✅ Make bass notes longer
          velocity: 127, // ✅ Maximum volume to make bass more "important"
          program: 32, // ✅ Correct bass program
          isDrum: false,
        })),

        // **Walking Bass Effect**
        ...Array.from({ length: 8 }, (_, i) => ({
          pitch: [51, 50, 55, 53, 57, 55, 50, 48][i], // Walking bass notes
          quantizedStartStep: i * 4 + 2,
          quantizedEndStep: i * 4 + 3, // Shorter passing notes
          velocity: 110, // Slightly lower than root bass notes
          program: 32,
          isDrum: false,
          startTime: i * 0.5 + 0.5,
          endTime: i * 0.5 + 0.75, // ✅ Keeps motion in the bassline
        })),

        // **Drums**
        // Kick drum
        ...Array.from({ length: 8 }, (_, i) => ({
          pitch: 36,
          quantizedStartStep: i * 4,
          quantizedEndStep: i * 4 + 1,
          velocity: 95,
          program: 0,
          isDrum: true,
          startTime: i * 0.5,
          endTime: i * 0.5 + 0.125,
        })),
        // Snare
        ...Array.from({ length: 4 }, (_, i) => ({
          pitch: 38,
          quantizedStartStep: i * 8 + 4,
          quantizedEndStep: i * 8 + 5,
          velocity: 90,
          program: 0,
          isDrum: true,
          startTime: i * 1.0 + 0.5,
          endTime: i * 1.0 + 0.625,
        })),
        // Hi-hat
        ...Array.from({ length: 16 }, (_, i) => ({
          pitch: 42,
          quantizedStartStep: i * 2,
          quantizedEndStep: i * 2 + 1,
          velocity: 80,
          program: 0,
          isDrum: true,
          startTime: i * 0.25,
          endTime: i * 0.25 + 0.125,
        })),
      ],
      quantizationInfo: { stepsPerQuarter: 4 },
      tempos: [{ time: 0, qpm: 120 }],
      totalQuantizedSteps: 32,
      totalTime: 8.0,
    };

    return sequence;
  };

  const generateAccompaniment = async () => {
    if (!model || !mm || !audioURL) {
      setError("Model not ready yet");
      return;
    }

    setIsGenerating(true);
    try {
      // Analyze input audio
      const inputSequence = await analyzeAudio(audioURL);
      console.log("Input sequence:", inputSequence);
      setModelStatus("Generating accompaniment...");

      //Bass check
      console.log("Input sequence before encoding:", inputSequence);
      console.log(
        "Bass notes in input sequence:",
        inputSequence.notes.filter(
          (note) => !note.isDrum && (note.program === 32 || note.program === 34)
        )
      );

      // Generate accompaniment with higher temperature for more variation
      const z = await model.encode([inputSequence]);
      console.log("Encoded latent:", z);

      const temperature = 0.8; // Higher temperature for more variation
      console.log("Using temperature:", temperature);

      // Generate multiple sequences and pick the best one
      const numTries = 15; // More attempts for better results
      let bestSequence = null;
      let maxScore = 0;

      for (let i = 0; i < numTries; i++) {
        console.log(`Generation attempt ${i + 1}/${numTries}`);
        const sequences = await model.decode(z, temperature);
        console.log(`Attempt ${i + 1} sequences:`, sequences);

        if (sequences && sequences[0]) {
          console.log("🎶 Generated sequence:", sequences[0]);
          console.log(
            "🥁 Drum notes in generated sequence:",
            sequences[0].notes.filter(
              (note: NoteSequence["notes"][0]) => note.isDrum
            )
          );
          console.log(
            "🎸 Bass notes in generated sequence:",
            sequences[0].notes.filter(
              (note: NoteSequence["notes"][0]) =>
                !note.isDrum && (note.program === 32 || note.program === 34)
            )
          );
          const sequence = sequences[0];
          // Score based on number and distribution of notes
          const drumNotes = sequence.notes.filter(
            (note: NoteSequence["notes"][0]) => note.isDrum
          ).length;
          const bassNotes = sequence.notes.filter(
            (note: NoteSequence["notes"][0]) =>
              !note.isDrum && (note.program === 32 || note.program === 34)
          ).length;
          // Adjust scoring to prefer more bass notes
          const score = drumNotes * 2 + bassNotes * 5; // Weight bass notes higher

          console.log(
            `Attempt ${i + 1} score:`,
            score,
            `(${drumNotes} drum notes, ${bassNotes} bass notes)`
          );

          if (score > maxScore) {
            maxScore = score;
            bestSequence = sequence;
          }
        }
      }

      if (!bestSequence || maxScore === 0) {
        throw new Error(
          "Failed to generate valid sequences with sufficient notes"
        );
      }

      console.log("Best sequence:", bestSequence);
      console.log("Total notes in best sequence:", bestSequence.notes.length);
      console.log("Score of best sequence:", maxScore);

      // Separate drum and bass sequences
      const drumsSequence = {
        ...bestSequence,
        notes: bestSequence.notes.filter(
          (note: NoteSequence["notes"][0]) => note.isDrum
        ),
        totalTime: bestSequence.totalTime,
        tempos: bestSequence.tempos,
        quantizationInfo: bestSequence.quantizationInfo,
      };

      const bassSequence = {
        ...bestSequence,
        notes: bestSequence.notes.filter(
          (note: NoteSequence["notes"][0]) =>
            !note.isDrum && (note.program === 32 || note.program === 34)
        ),
        totalTime: bestSequence.totalTime,
        tempos: bestSequence.tempos,
        quantizationInfo: bestSequence.quantizationInfo,
      };

      console.log("Drums sequence:", drumsSequence);
      console.log("Number of drum notes:", drumsSequence.notes.length);
      console.log("Sample drum note:", drumsSequence.notes[0]);
      console.log("Bass sequence:", bassSequence);
      console.log("Number of bass notes:", bassSequence.notes.length);
      console.log("Sample bass note:", bassSequence.notes[0]);

      // Store generated sequences
      setGeneratedTracks({ drums: drumsSequence, bass: bassSequence });

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
          run: (note: any) => {
            console.log("Playing note:", {
              pitch: note.pitch,
              velocity: note.velocity,
              startTime: note.startTime,
              endTime: note.endTime,
              isDrum: note.isDrum,
              program: note.program,
            });
          },
          stop: () => {
            console.log("Playback stopped");
            setModelStatus("Playback complete");
          },
        }
      );

      // Load samples before playing
      console.log("Loading samples...");
      await player.loadSamples(sequence);
      console.log("Samples loaded successfully");

      // Start playback
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
    }
  };

  if (!show) return null;

  if (!audioURL) {
    return (
      <div className="h-screen animated-gradient">
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <h1 className="text-white text-2xl font-bold">
            No audio recorded, problem!
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen animated-gradient">
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <div className="w-[80%] max-w-3xl bg-black/20 backdrop-blur-sm p-8 rounded-lg">
          <h2 className="text-white text-2xl mb-6">Your Recorded Track</h2>
          <audio controls src={audioURL} className="w-full mb-6" />

          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-lg">{modelStatus}</p>

            <button
              onClick={generateAccompaniment}
              disabled={!model || isGenerating}
              className={`px-6 py-3 rounded-lg transition-colors flex items-center gap-2 
                ${
                  !model || isGenerating
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-jungle-green hover:bg-opacity-90"
                } 
                text-white`}
            >
              {isGenerating ? "Generating..." : "Generate Accompaniment"}
            </button>

            {generatedTracks.drums && (
              <div className="w-full space-y-4 mt-4">
                <div>
                  <h3 className="text-white text-lg mb-2">Generated Drums</h3>
                  <button
                    onClick={() => playSample(generatedTracks.drums)}
                    className="w-full px-6 py-3 bg-jungle-green/20 hover:bg-jungle-green/30 text-white rounded-lg transition-colors"
                  >
                    Play Drums
                  </button>
                </div>
                <div>
                  <h3 className="text-white text-lg mb-2">Generated Bass</h3>
                  <button
                    onClick={() => playSample(generatedTracks.bass)}
                    className="w-full px-6 py-3 bg-jungle-green/20 hover:bg-jungle-green/30 text-white rounded-lg transition-colors"
                  >
                    Play Bass
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

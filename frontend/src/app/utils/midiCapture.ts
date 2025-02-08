// Remove the import
// import { NoteSequence } from "@magenta/music";

// Add our own interface
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

interface MidiNote {
  pitch: number;
  startTime: number;
  endTime?: number;
  velocity: number;
  program: number;
}

interface MidiCaptureState {
  activeNotes: Map<number, MidiNote>;
  recordedNotes: MidiNote[];
  isRecording: boolean;
  startTime: number;
  metronome: any; // Tone.Transport
  currentStep: number;
  stepsPerQuarter: number;
  tempo: number;
}

export class MidiCaptureUtil {
  private state: MidiCaptureState = {
    activeNotes: new Map(),
    recordedNotes: [],
    isRecording: false,
    startTime: 0,
    metronome: null,
    currentStep: -8, // Start at -8 to allow for 2 bars of pre-count (8 steps)
    stepsPerQuarter: 4,
    tempo: 120,
  };

  constructor(private canvasRef: React.RefObject<HTMLCanvasElement>) {}

  setTempo = (newTempo: number) => {
    this.state.tempo = newTempo;
    if (this.state.metronome) {
      this.state.metronome.bpm.value = newTempo;
    }
  };

  cleanup = () => {
    if (this.state.metronome) {
      this.state.metronome.stop();
      this.state.metronome.cancel();
    }
    this.state.activeNotes.clear();
    this.state.recordedNotes = [];
    this.state.isRecording = false;
    this.state.currentStep = -8; // Reset to pre-count
    if (this.canvasRef.current) {
      const ctx = this.canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
      }
    }
  };

  startCapture = async () => {
    try {
      this.cleanup();
      this.state.currentStep = -8; // Reset to pre-count

      // Request MIDI access
      const midiAccess = await navigator.requestMIDIAccess();
      
      // Set up MIDI input handlers for all inputs
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = this.handleMIDIMessage;
      });

      // Initialize Tone.js for metronome
      const Tone = require('tone');
      await Tone.start();

      // Create a synth for metronome sound
      const metronomeSound = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
      }).toDestination();

      // Set up metronome using Tone.js Transport
      this.state.metronome = Tone.Transport;
      this.state.metronome.bpm.value = this.state.tempo;

      // Schedule metronome ticks with sound
      this.state.metronome.scheduleRepeat((time: number) => {
        this.state.currentStep++;
        this.drawMetronome();
        
        // Play metronome sound (higher pitch on first beat of bar)
        const isFirstBeat = this.state.currentStep % 4 === 0;
        metronomeSound.triggerAttackRelease(
          isFirstBeat ? 'C5' : 'G4', 
          '32n', 
          time,
          isFirstBeat ? 1 : 0.5
        );
        
        // Stop recording after 32 steps of actual recording
        if (this.state.currentStep >= 32) {
          this.stopCapture();
        }
      }, "16n"); // Sixteenth note intervals for 4 steps per quarter

      // Start recording
      this.state.startTime = Tone.now();
      this.state.isRecording = true;
      this.state.metronome.start();

      // Start visualization
      this.drawVisualization();

      return true;
    } catch (err) {
      console.error("MIDI Capture Error:", err);
      this.cleanup();
      throw err;
    }
  };

  private handleMIDIMessage = (event: WebMidi.MIDIMessageEvent) => {
    // Only record MIDI if we're past the pre-count
    if (!this.state.isRecording || this.state.currentStep < 0) return;

    const [status, note, velocity] = event.data;
    const Tone = require('tone');
    
    // Calculate time based on current step and tempo
    const stepsPerBeat = 4; // Since we're using 16th notes
    const secondsPerBeat = 60.0 / this.state.tempo;
    const currentTime = (this.state.currentStep / stepsPerBeat) * secondsPerBeat;

    // Note On
    if ((status & 0xf0) === 0x90 && velocity > 0) {
      const midiNote: MidiNote = {
        pitch: note,
        startTime: currentTime,
        velocity: velocity,
        program: 0, // Piano
      };
      this.state.activeNotes.set(note, midiNote);
    }
    // Note Off
    else if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)) {
      const activeNote = this.state.activeNotes.get(note);
      if (activeNote) {
        activeNote.endTime = currentTime;
        // Create a copy of the note before adding to recorded notes
        this.state.recordedNotes.push({...activeNote});
        this.state.activeNotes.delete(note);
      }
    }
  };

  private drawVisualization = () => {
    if (!this.canvasRef.current) return;

    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!this.state.isRecording) return;

      // Clear canvas
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw active notes
      ctx.fillStyle = "#2BAF90";
      this.state.activeNotes.forEach((note) => {
        const x = (note.pitch - 21) * (canvas.width / 88); // 88 keys on piano
        const y = canvas.height - (note.velocity / 127) * canvas.height;
        ctx.fillRect(x, y, 10, 10);
      });

      // Draw recorded notes
      ctx.fillStyle = "#A1D4B1";
      this.state.recordedNotes.forEach((note) => {
        const x = (note.pitch - 21) * (canvas.width / 88);
        const y = canvas.height - (note.velocity / 127) * canvas.height;
        ctx.fillRect(x, y, 5, 5);
      });

      requestAnimationFrame(draw);
    };

    draw();
  };

  private drawMetronome = () => {
    if (!this.canvasRef.current) return;

    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous metronome visualization
    ctx.clearRect(0, 0, canvas.width, 20);

    // Draw pre-count or recording progress
    const totalSteps = 32;
    const beatWidth = canvas.width / totalSteps;
    
    // Draw all step markers
    for (let i = 0; i < totalSteps; i++) {
      const x = i * beatWidth;
      const isMainBeat = i % 4 === 0;
      ctx.fillStyle = isMainBeat ? "#F1A512" : "rgba(241, 165, 18, 0.3)";
      ctx.fillRect(x, 0, 2, isMainBeat ? 20 : 10);
    }

    // Draw current position if we're recording
    if (this.state.currentStep >= 0 && this.state.currentStep < totalSteps) {
      const x = this.state.currentStep * beatWidth;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - 1, 0, 4, 20);
    }
    // Draw pre-count position
    else if (this.state.currentStep < 0) {
      ctx.fillStyle = "#FF0000";
      const preCountText = Math.floor((-this.state.currentStep) / 4) + 1;
      ctx.font = "20px Arial";
      ctx.fillText(preCountText.toString(), canvas.width / 2, 16);
    }
  };

  stopCapture = (): NoteSequence => {
    this.state.isRecording = false;
    if (this.state.metronome) {
      this.state.metronome.stop();
      this.state.metronome.cancel();
    }

    // Convert any remaining active notes to recorded notes
    const secondsPerBeat = 60.0 / this.state.tempo;
    const currentTime = (this.state.currentStep / 4) * secondsPerBeat;
    
    this.state.activeNotes.forEach((note) => {
      note.endTime = currentTime;
      this.state.recordedNotes.push({...note});
    });
    this.state.activeNotes.clear();

    // Log recorded notes before conversion
    console.log("Recorded notes before conversion:", this.state.recordedNotes);

    // Convert recorded notes to NoteSequence format
    const noteSequence: NoteSequence = {
      notes: this.state.recordedNotes.map(note => ({
        pitch: note.pitch,
        startTime: note.startTime,
        endTime: note.endTime || note.startTime + 0.25,
        velocity: note.velocity,
        program: note.program,
      })),
      tempos: [{ time: 0, qpm: this.state.tempo }],
      quantizationInfo: { stepsPerQuarter: this.state.stepsPerQuarter },
      totalQuantizedSteps: 32,
      totalTime: 8.0, // 32 steps at 120 BPM = 8 seconds
    };

    // Log the final note sequence
    console.log("Final note sequence from MIDI capture:", noteSequence);
    console.log("Sample note timing - First note:", noteSequence.notes[0]);

    return noteSequence;
  };

  isActive = () => {
    return this.state.isRecording;
  };
}

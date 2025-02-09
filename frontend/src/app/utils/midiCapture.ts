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
    currentStep: -32, // Start at -8 to allow for 2 bars of pre-count (8 steps)
    stepsPerQuarter: 4,
    tempo: 120,
  };

  constructor(private canvasRef: React.RefObject<HTMLCanvasElement>) {
    // Initialize the metronome visualization when the component mounts
    this.initializeCanvas();
    
    // Add resize listener
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.initializeCanvas();
  };

  private initializeCanvas = () => {
    if (this.canvasRef.current) {
      const canvas = this.canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Ensure canvas is properly sized
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Draw initial metronome state
        this.drawMetronome();
      }
    }
  };

  setTempo = (newTempo: number) => {
    this.state.tempo = newTempo;
    if (this.state.metronome) {
      this.state.metronome.bpm.value = newTempo;
    }
  };

  cleanup = () => {
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize);

    if (this.state.metronome) {
      this.state.metronome.stop();
      this.state.metronome.cancel();
    }
    this.state.activeNotes.clear();
    this.state.recordedNotes = [];
    this.state.isRecording = false;
    this.state.currentStep = -32; // Reset to pre-count
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
      this.state.currentStep = -32; // Reset to pre-count

      // Initialize canvas and draw initial state
      this.initializeCanvas();

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

      // Start recording state before scheduling repeats
      this.state.startTime = Tone.now();
      this.state.isRecording = true;

      // Start visualization immediately
      this.drawVisualization();

      // Schedule metronome ticks with sound
      this.state.metronome.scheduleRepeat((time: number) => {
        this.state.currentStep++;
        this.drawMetronome();

        // Only play sound on quarter notes (every 4 steps)
        if (this.state.currentStep % 4 === 0) {
          metronomeSound.triggerAttackRelease("C5", "32n", time, 1);
        }

        if (this.state.currentStep >= 64) { // Extended to 4 bars (64 steps)
          this.stopCapture();
        }
      }, "16n"); // Sixteenth note intervals for 4 steps per quarter

      // Start the metronome
      this.state.metronome.start();

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
    
    // Calculate time based on current step and tempo
    const stepsPerBeat = 4; // Since we're using 16th notes
    const secondsPerBeat = 60.0 / this.state.tempo;
    const currentTime = (this.state.currentStep / stepsPerBeat) * secondsPerBeat;

    // Note On
    if ((status & 0xf0) === 0x90 && velocity > 0) {
      const midiNote: MidiNote = {
        pitch: note,
        startTime: currentTime,
        velocity: Math.min(Math.max(velocity, 20), 127), // Normalize velocity
        program: 0, // Piano
      };
      this.state.activeNotes.set(note, midiNote);
    }
    // Note Off
    else if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0)) {
      const activeNote = this.state.activeNotes.get(note);
      if (activeNote) {
        activeNote.endTime = currentTime;
        if (activeNote.endTime - activeNote.startTime >= 0.05) { 
          this.state.recordedNotes.push({...activeNote});
        }
        this.state.activeNotes.delete(note);
      }
    }
  };

  private optimizeRecordedNotes = (notes: MidiNote[]): NoteSequence["notes"] => {
    return notes
      .filter((note, index, self) => {
        const prevNote = self[index - 1];
        return (
          !prevNote || note.pitch !== prevNote.pitch || Math.abs(note.startTime - prevNote.startTime) > 0.05
        );
      })
      .map((note) => ({
        pitch: note.pitch,
        startTime: Math.max(0, note.startTime),
        endTime: Math.max(note.startTime + 0.1, note.endTime || note.startTime + 0.25),
        velocity: note.velocity,
        program: note.program,
      }));
  };

  private drawVisualization = () => {
    if (!this.canvasRef.current) return;

    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas is properly sized
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const draw = () => {
      if (!this.state.isRecording) return;

      // Clear canvas below the metronome area
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 20, canvas.width, canvas.height - 20);

      // Draw active notes
      ctx.fillStyle = "#2BAF90";
      this.state.activeNotes.forEach((note) => {
        const x = (note.pitch - 21) * (canvas.width / 88); // 88 keys on piano
        const y = 20 + (canvas.height - 20 - (note.velocity / 127) * (canvas.height - 20));
        ctx.fillRect(x, y, 15, 15);
      });

      // Draw recorded notes
      ctx.fillStyle = "#A1D4B1";
      this.state.recordedNotes.forEach((note) => {
        const x = (note.pitch - 21) * (canvas.width / 88);
        const y = 20 + (canvas.height - 20 - (note.velocity / 127) * (canvas.height - 20));
        ctx.fillRect(x, y, 10, 10);
      });

      // Draw metronome on every frame to ensure it's always visible
      this.drawMetronome();

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

    // Constants for visualization
    const totalPreCountSteps = 32; // 2 bars of pre-count
    const totalRecordingSteps = 64; // 4 bars of recording
    const totalSteps = totalPreCountSteps + totalRecordingSteps;
    const beatWidth = canvas.width / totalSteps; // Width based on recording section

    // Draw background for pre-count section
    const preCountWidth = (totalPreCountSteps * beatWidth);
    ctx.fillStyle = "rgba(139, 0, 0, 0.2)"; // Dark red for pre-count section
    ctx.fillRect(0, 0, preCountWidth, 20);

    // Draw background for recording section
    ctx.fillStyle = "rgba(43, 175, 144, 0.2)"; // Jungle green for recording section
    ctx.fillRect(preCountWidth, 0, canvas.width - preCountWidth, 20);

    // Draw all step markers for both pre-count and recording
    for (let i = -totalPreCountSteps; i < totalRecordingSteps; i++) {
      const x = ((i + totalPreCountSteps) * beatWidth);
      const isMainBeat = i % 4 === 0;
      
      // Different colors for pre-count and recording sections
      if (i < 0) {
        ctx.fillStyle = isMainBeat ? "#FF4444" : "rgba(255, 68, 68, 0.3)";
      } else {
        ctx.fillStyle = isMainBeat ? "#F1A512" : "rgba(241, 165, 18, 0.3)";
      }
      
      ctx.fillRect(x, 0, 2, isMainBeat ? 20 : 10);
    }

    // Draw current position
    const currentX = ((this.state.currentStep + totalPreCountSteps) * beatWidth);
    if (currentX >= 0 && currentX <= canvas.width) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(currentX - 1, 0, 4, 20);

      // Show count-in numbers during pre-count
      if (this.state.currentStep < 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "start";
        const countInNumber = Math.floor((-this.state.currentStep - 1) / 4) + 1;
        ctx.fillText(countInNumber.toString(), canvas.width / 2, 16);
      }
    }

    // Add labels
    ctx.font = "12px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    if (this.state.currentStep < 0) {
      ctx.fillText("Count In", 10, 14);
    } else {
      ctx.fillText("Recording", preCountWidth + 10, 14);
    }
  };

  stopCapture = (): NoteSequence => {
    this.state.isRecording = false;
    if (this.state.metronome) {
      this.state.metronome.stop();
      this.state.metronome.cancel();
    }

    const secondsPerBeat = 60.0 / this.state.tempo;
    const currentTime = (this.state.currentStep / 4) * secondsPerBeat;
    
    this.state.activeNotes.forEach((note) => {
      note.endTime = currentTime;
      if (note.endTime - note.startTime >= 0.05) {
        this.state.recordedNotes.push({...note});
      }
    });
    this.state.activeNotes.clear();

    console.log("Recorded Notes:", this.state.recordedNotes);

    const processedNotes = this.optimizeRecordedNotes(this.state.recordedNotes);

    const noteSequence: NoteSequence = {
      notes: processedNotes,
      tempos: [{ time: 0, qpm: this.state.tempo }],
      quantizationInfo: { stepsPerQuarter: this.state.stepsPerQuarter },
      totalQuantizedSteps: 64, // 4 bars * 16 steps per bar
      totalTime: (60 / this.state.tempo) * 16 // Convert 16 beats to seconds based on tempo
    };

    console.log("Final Optimized Note Sequence:", noteSequence);
    return noteSequence;
  };

  isActive = () => {
    return this.state.isRecording;
  };
}

interface AudioVisualizerState {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  stream: MediaStream | null;
  animationFrame: number | null;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
}

export class AudioVisualizerUtil {
  private state: AudioVisualizerState = {
    audioContext: null,
    analyser: null,
    stream: null,
    animationFrame: null,
    mediaRecorder: null,
    audioChunks: [],
  };

  constructor(private canvasRef: React.RefObject<HTMLCanvasElement>) {}

  cleanup = () => {
    if (this.state.animationFrame) {
      cancelAnimationFrame(this.state.animationFrame);
      this.state.animationFrame = null;
    }
    if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
      this.state.mediaRecorder.stop();
    }
    if (this.state.stream) {
      this.state.stream.getTracks().forEach((track) => track.stop());
      this.state.stream = null;
    }
    if (this.state.audioContext) {
      this.state.audioContext.close();
      this.state.audioContext = null;
    }
    this.state.analyser = null;
    this.state.mediaRecorder = null;
    this.state.audioChunks = [];
  };

  startVisualization = async () => {
    try {
      this.cleanup(); // Ensure no previous audio context is active

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create an AudioContext **only after user interaction**
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      // Resume only if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      // Connect audio nodes
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Initialize MediaRecorder with specific MIME type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      this.state.audioChunks = [];
      
      // Collect data every second
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.audioChunks.push(event.data);
        }
      };

      // Store references
      this.state.audioContext = audioContext;
      this.state.analyser = analyser;
      this.state.stream = stream;
      this.state.mediaRecorder = mediaRecorder;

      // Start recording with 1 second timeslices
      mediaRecorder.start(1000);

      // Start drawing
      if (this.canvasRef.current) {
        this.drawWaveform();
      }

      return true;
    } catch (err) {
      console.error("Error:", err);
      this.cleanup();
      throw err;
    }
  };

  stopRecording = async (): Promise<Blob> => {
    return new Promise((resolve) => {
      if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
        // Get final chunk of data
        this.state.mediaRecorder.requestData();
        
        this.state.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.state.audioChunks, { 
            type: 'audio/webm;codecs=opus' 
          });
          this.cleanup();
          resolve(audioBlob);
        };
        this.state.mediaRecorder.stop();
      } else {
        this.cleanup();
        resolve(new Blob([]));
      }
    });
  };

  private drawWaveform = () => {
    const canvas = this.canvasRef.current;
    const analyser = this.state.analyser;

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set initial canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.state.animationFrame = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2BAF90";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();
    };

    draw();
  };

  isActive = () => {
    return this.state.mediaRecorder !== null && this.state.mediaRecorder.state === 'recording';
  };
} 
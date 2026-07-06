import { useRef, useEffect } from 'react';

interface WaveformProps {
  analyserNode: AnalyserNode | null;
  active: boolean;
}

export function Waveform({ analyserNode, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !active) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 40;
      const barWidth = width / barCount - 2;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = value * height * 0.85;

        // Gradient from cyan to purple
        const hue = 180 + (i / barCount) * 120;
        const lightness = 50 + value * 20;
        ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
      }
    };

    draw();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyserNode, active]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={80}
      className="rounded-xl bg-secondary/50 border border-border"
    />
  );
}

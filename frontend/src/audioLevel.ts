export type StopFn = () => void;

function createAudioContext(): AudioContext | null {
  const AnyWin = (
    typeof window !== "undefined" ? (window as any) : undefined
  ) as any;
  const Ctx = AnyWin?.AudioContext || AnyWin?.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx: AudioContext = new Ctx();
    // Autoplay policies can start contexts as 'suspended'
    if ((ctx.state as any) === "suspended") {
      try {
        (ctx as any).resume?.();
      } catch {}
    }
    return ctx;
  } catch {
    return null;
  }
}

export function monitorStreamLevel(
  stream: MediaStream,
  onLevel: (level01: number) => void
): StopFn {
  const ctx = createAudioContext();
  if (!ctx) return () => {};
  const source = ctx.createMediaStreamSource(stream as any);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const data = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  let raf = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const level = Math.min(1, Math.max(0, rms * 2));
    onLevel(level);
    raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame(loop)
        : (setTimeout(loop, 50) as any);
  };
  loop();
  return () => {
    stopped = true;
    if (raf && typeof cancelAnimationFrame !== "undefined")
      cancelAnimationFrame(raf as any);
    try {
      source.disconnect();
    } catch {}
    try {
      analyser.disconnect();
    } catch {}
    try {
      ctx.close();
    } catch {}
  };
}

export function monitorAudioElementLevel(
  audioEl: HTMLAudioElement,
  onLevel: (level01: number) => void
): StopFn {
  const ctx = createAudioContext();
  if (!ctx) return () => {};
  const source = ctx.createMediaElementSource(audioEl);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const data = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  analyser.connect(ctx.destination);
  let raf = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const level = Math.min(1, Math.max(0, rms * 2));
    onLevel(level);
    raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame(loop)
        : (setTimeout(loop, 50) as any);
  };
  loop();
  return () => {
    stopped = true;
    if (raf && typeof cancelAnimationFrame !== "undefined")
      cancelAnimationFrame(raf as any);
    try {
      source.disconnect();
    } catch {}
    try {
      analyser.disconnect();
    } catch {}
    try {
      ctx.close();
    } catch {}
  };
}

// Native fallback for Android/iOS: monitor local mic level using WebRTC stats.
// Works with react-native-webrtc when an audio sender exists on the RTCPeerConnection.
export function monitorSenderOutboundAudioLevel(
  pc: any,
  onLevel: (level01: number) => void
): StopFn {
  let stopped = false;
  let timer: any = null;
  const sample = async () => {
    if (stopped) return;
    let level = 0;
    try {
      const senders = (pc?.getSenders?.() || []) as any[];
      const audioSender =
        senders.find((s: any) => s?.track?.kind === "audio") || senders[0];
      if (audioSender && audioSender.getStats) {
        const report: any = await audioSender.getStats();
        // Iterate Map-like or object-like stats
        if (report && typeof report.forEach === "function") {
          report.forEach((stat: any) => {
            const t = stat?.type;
            if (
              (t === "media-source" || t === "track") &&
              stat?.kind === "audio" &&
              typeof stat?.audioLevel === "number"
            ) {
              level = Math.max(level, Number(stat.audioLevel));
            } else if (
              t === "outbound-rtp" &&
              typeof stat?.audioLevel === "number"
            ) {
              level = Math.max(level, Number(stat.audioLevel));
            }
          });
        } else if (report) {
          for (const k of Object.keys(report)) {
            const stat: any = (report as any)[k];
            const t = stat?.type;
            if (
              (t === "media-source" || t === "track") &&
              stat?.kind === "audio" &&
              typeof stat?.audioLevel === "number"
            ) {
              level = Math.max(level, Number(stat.audioLevel));
            } else if (
              t === "outbound-rtp" &&
              typeof stat?.audioLevel === "number"
            ) {
              level = Math.max(level, Number(stat.audioLevel));
            }
          }
        }
      }
    } catch {}
    try {
      onLevel(Math.min(1, Math.max(0, level || 0)));
    } catch {}
    timer = setTimeout(sample, 250);
  };
  sample();
  return () => {
    stopped = true;
    if (timer) {
      try {
        clearTimeout(timer);
      } catch {}
    }
  };
}

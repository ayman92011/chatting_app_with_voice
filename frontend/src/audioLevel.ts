export type StopFn = () => void;

function createAudioContext(): AudioContext | null {
	const AnyWin = (typeof window !== 'undefined' ? (window as any) : undefined) as any;
	const Ctx = AnyWin?.AudioContext || AnyWin?.webkitAudioContext;
	if (!Ctx) return null;
	try {
		return new Ctx();
	} catch {
		return null;
	}
}

export function monitorStreamLevel(stream: MediaStream, onLevel: (level01: number) => void): StopFn {
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
		raf = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(loop) : setTimeout(loop, 50) as any);
	};
	loop();
	return () => {
		stopped = true;
		if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf as any);
		try { source.disconnect(); } catch {}
		try { analyser.disconnect(); } catch {}
		try { ctx.close(); } catch {}
	};
}

export function monitorAudioElementLevel(audioEl: HTMLAudioElement, onLevel: (level01: number) => void): StopFn {
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
		raf = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(loop) : setTimeout(loop, 50) as any);
	};
	loop();
	return () => {
		stopped = true;
		if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf as any);
		try { source.disconnect(); } catch {}
		try { analyser.disconnect(); } catch {}
		try { ctx.close(); } catch {}
	};
}
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, X } from "lucide-react";

const MAX_SECONDS = 300;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function format(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Кнопка микрофона в поле ответа: запись → отправка одним нажатием. */
export function VoiceRecorder({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (file: File, seconds: number) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.1));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const cleanup = useRef<() => void>(() => undefined);

  useEffect(() => () => cleanup.current(), []);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  if (pickMime() === null) return null;

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      alert("Разрешите доступ к микрофону в настройках браузера, чтобы записать голосовое.");
      return;
    }
    const mime = pickMime() || undefined;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    cancelled.current = false;
    recorder.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.onstop = async () => {
      cleanup.current();
      setRecording(false);
      const duration = (Date.now() - started.current) / 1000;
      if (cancelled.current) return;
      if (duration < 1) return;
      const type = recorder.mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const file = new File(chunks.current, `voice.${ext}`, { type });
      setSending(true);
      try {
        await onSend(file, Math.round(duration));
      } finally {
        setSending(false);
      }
    };

    // Живая волна по громкости микрофона.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (t - last < 70) return;
      last = t;
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevels((l) => [...l.slice(1), Math.max(0.1, Math.min(1, peak / 50))]);
      setSeconds((Date.now() - started.current) / 1000);
    };
    frame = requestAnimationFrame(tick);
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
      ctx.close().catch(() => undefined);
    };

    rec.current = recorder;
    started.current = Date.now();
    setSeconds(0);
    setLevels(Array(28).fill(0.1));
    recorder.start(250);
    setRecording(true);
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  function cancel() {
    cancelled.current = true;
    stop();
  }

  if (recording) {
    return (
      <div className="voice-rec" role="group" aria-label="Запись голосового">
        <button type="button" className="voice-rec-cancel" onClick={cancel} aria-label="Отменить запись">
          <X size={15} />
        </button>
        <span className="voice-rec-dot" />
        <div className="voice-rec-wave">
          {levels.map((l, i) => (
            <span key={i} style={{ height: `${4 + l * 22}px`, opacity: 0.35 + l * 0.65 }} />
          ))}
        </div>
        <time>{format(seconds)}</time>
        <button type="button" className="voice-rec-send" onClick={stop} aria-label="Отправить голосовое">
          <Square size={13} fill="currentColor" /> Отправить
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="voice-mic"
      onClick={start}
      disabled={disabled || sending}
      title="Записать голосовое"
      aria-label="Записать голосовое"
    >
      {sending ? <span className="voice-spinner" /> : <Mic size={17} />}
    </button>
  );
}

/** Голосовое сообщение в обсуждении: плеер и расшифровка от ИИ. */
export function VoicePlayer({
  src,
  seconds,
  transcript,
}: {
  src: string;
  seconds: number | null;
  transcript: string | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(seconds ?? 0);
  const progress = duration ? Math.min(1, time / duration) : 0;

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => undefined);
    else a.pause();
  }

  return (
    <div className="voice-msg">
      <div className="voice-msg-player">
        <button type="button" onClick={toggle} aria-label={playing ? "Пауза" : "Слушать"}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <div
          className="voice-msg-track"
          onClick={(e) => {
            const a = audio.current;
            if (!a || !duration) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * duration;
          }}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <time>{format(playing || time ? time : duration)}</time>
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
        />
      </div>
      {transcript === null ? (
        <small className="voice-msg-text is-pending">Расшифровываем…</small>
      ) : transcript ? (
        <small className="voice-msg-text">«{transcript}»</small>
      ) : null}
    </div>
  );
}

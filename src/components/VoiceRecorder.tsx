import React, { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Square, RotateCcw, Loader2, Check, AlertCircle, Volume2 } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string, providerUsed?: string) => void;
  label?: string;
}

const MAX_SECONDS = 300; // 5 minutes cap
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export function VoiceRecorder({
  onTranscriptReady,
  label = 'Record or upload a voice note',
}: VoiceRecorderProps) {
  const [mode, setMode] = useState<'record' | 'upload'>('record');
  const [status, setStatus] = useState<
    'idle' | 'requesting_permission' | 'recording' | 'recorded' | 'transcribing' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(15);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState<string>('recording.webm');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanupMedia = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupMedia();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMsg('Your browser does not support microphone recording. Please upload an audio file or type your notes instead.');
      setMode('upload');
      return;
    }

    setStatus('requesting_permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const ext = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setAudioFilename(`voice-note.${ext}`);
        setStatus('recorded');
        cleanupMedia();
      };

      // Simple Web Audio level meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(Math.min(100, Math.max(12, Math.round((avg / 140) * 100))));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch {
        // Level meter is non-critical if AudioContext fails
      }

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setSeconds(0);
      setStatus('recording');

      timerRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err: any) {
      cleanupMedia();
      setStatus('error');
      setErrorMsg(
        'Microphone permission was denied or no microphone was found. You can upload an audio file or type your notes instead.'
      );
      setMode('upload');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    cleanupMedia();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
    setErrorMsg(null);
    setStatus('idle');
  };

  const handleFileChange = (file: File | null | undefined) => {
    if (!file) return;
    setErrorMsg(null);

    if (file.size > MAX_FILE_BYTES) {
      setStatus('error');
      setErrorMsg('This file is over the 25 MB limit. Please pick a smaller or shorter audio file.');
      return;
    }

    const validExts = ['webm', 'ogg', 'mp3', 'm4a', 'mp4', 'wav', 'flac', 'mpeg'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!validExts.includes(ext) && !file.type.startsWith('audio/')) {
      setStatus('error');
      setErrorMsg('Unsupported file format. Please upload an mp3, m4a, wav, webm, ogg, or flac file.');
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    setAudioFilename(file.name);
    setStatus('recorded');
  };

  const transcribeBlob = async () => {
    if (!audioBlob) return;
    setStatus('transcribing');
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, audioFilename);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'We could not transcribe this audio. You can type the notes instead.');
      }

      onTranscriptReady(data.transcript, data.providerUsed);
      setStatus('idle');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'We could not transcribe this audio. You can type the notes instead.');
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remainingSeconds = MAX_SECONDS - seconds;

  return (
    <div className="bg-[#F7F7F5] border border-[#E7E5E0] rounded-[10px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5F5C55]">
          {label}
        </span>

        <div className="inline-flex rounded-lg border border-[#E7E5E0] bg-white p-0.5">
          <button
            type="button"
            onClick={() => {
              resetRecording();
              setMode('record');
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              mode === 'record'
                ? 'bg-[#0F766E] text-white'
                : 'text-[#5F5C55] hover:text-[#1C1B19]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Record</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetRecording();
              setMode('upload');
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              mode === 'upload'
                ? 'bg-[#0F766E] text-white'
                : 'text-[#5F5C55] hover:text-[#1C1B19]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload audio file</span>
          </button>
        </div>
      </div>

      {/* RECORD MODE */}
      {mode === 'record' && status === 'idle' && (
        <div className="bg-white border border-[#E7E5E0] rounded-lg p-5 text-center">
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-sm font-medium transition cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Start recording</span>
          </button>
          <p className="text-xs text-[#8C8980] mt-2">
            Speak naturally in English or Hinglish (up to 5 minutes).
          </p>
        </div>
      )}

      {status === 'requesting_permission' && (
        <div className="bg-white border border-[#E7E5E0] rounded-lg p-5 text-center">
          <Loader2 className="w-5 h-5 text-[#0F766E] animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-[#1C1B19]">Asking for microphone permission...</p>
          <p className="text-xs text-[#8C8980] mt-1">Please click "Allow" in your browser prompt.</p>
        </div>
      )}

      {/* Calm teal recording indicator (red-free per spec) */}
      {status === 'recording' && (
        <div className="bg-white border border-[#0F766E] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E] animate-ping" />
              <span className="text-sm font-semibold text-[#0F766E]">Recording in progress</span>
            </div>
            <span className="text-sm font-mono font-semibold text-[#1C1B19]">
              {formatTimer(seconds)} / 5:00
            </span>
          </div>

          {/* Simple level meter */}
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="w-4 h-4 text-[#0F766E] shrink-0" />
            <div className="w-full h-2 bg-[#E6F2F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F766E] transition-all duration-75 rounded-full"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>

          {remainingSeconds <= 60 && (
            <p className="text-xs text-[#B54708] font-medium mb-3">
              Auto-stopping in {remainingSeconds} seconds (5-minute limit).
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-medium cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop recording</span>
            </button>
          </div>
        </div>
      )}

      {/* UPLOAD MODE */}
      {mode === 'upload' && status === 'idle' && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileChange(e.dataTransfer.files?.[0]);
          }}
          className="block bg-white border border-dashed border-[#8C8980] hover:border-[#0F766E] rounded-lg p-5 text-center cursor-pointer transition"
        >
          <Upload className="w-5 h-5 text-[#5F5C55] mx-auto mb-1.5" />
          <span className="text-sm font-medium text-[#1C1B19] block">
            Click to choose an audio file or drag and drop
          </span>
          <span className="text-xs text-[#8C8980] block mt-1">
            Supports mp3, m4a, wav, webm, ogg, flac (max 25 MB)
          </span>
          <input
            type="file"
            accept=".webm,.ogg,.mp3,.m4a,.mp4,.wav,.flac,.mpeg,audio/*"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            className="hidden"
          />
        </label>
      )}

      {/* RECORDED / READY TO TRANSCRIBE */}
      {status === 'recorded' && audioUrl && (
        <div className="bg-white border border-[#E7E5E0] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5F5C55]">
            <span className="font-medium text-[#1C1B19] truncate">{audioFilename}</span>
            <span>Ready to transcribe</span>
          </div>
          <audio src={audioUrl} controls className="w-full h-9" />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E7E5E0] bg-white hover:bg-[#F7F7F5] text-xs font-medium text-[#1C1B19] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-record / Change</span>
            </button>
            <button
              type="button"
              onClick={transcribeBlob}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D6560] text-white text-xs font-medium cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Transcribe</span>
            </button>
          </div>
        </div>
      )}

      {/* TRANSCRIBING STATE */}
      {status === 'transcribing' && (
        <div className="bg-white border border-[#E7E5E0] rounded-lg p-5 text-center">
          <Loader2 className="w-5 h-5 text-[#0F766E] animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium text-[#1C1B19]">Transcribing...</p>
          <p className="text-xs text-[#8C8980] mt-1">
            Converting speech to text via Whisper / Gemini Audio
          </p>
        </div>
      )}

      {/* ERROR STATE */}
      {status === 'error' && errorMsg && (
        <div className="bg-[#FDECEA] border border-[#F9D2CE] rounded-lg p-3.5 mt-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[#B42318]">{errorMsg}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStatus('idle');
                  }}
                  className="text-xs font-semibold text-[#1C1B19] underline cursor-pointer"
                >
                  Try again
                </button>
                {mode !== 'upload' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setStatus('idle');
                      setMode('upload');
                    }}
                    className="text-xs font-semibold text-[#0F766E] underline cursor-pointer"
                  >
                    Switch to file upload
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#8C8980] mt-2.5">
        Audio is sent for transcription and is not stored. Only the transcript is saved.
      </p>
    </div>
  );
}
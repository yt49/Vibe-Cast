import { useRef, useState, useCallback } from 'react';
import fixWebmDuration from 'fix-webm-duration';

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const start = useCallback((stream: MediaStream) => {
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mrRef.current = mr;

    mr.ondataavailable = (e) => chunksRef.current.push(e.data);

    mr.start();
    startTimeRef.current = Date.now();
    setRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mr = mrRef.current;
      if (!mr) return;
      const duration = Date.now() - startTimeRef.current;
      mr.onstop = () => {
        const raw = new Blob(chunksRef.current, { type: 'audio/webm' });
        fixWebmDuration(raw, duration, (fixed: Blob) => {
          setAudioUrl(URL.createObjectURL(fixed));
          resolve(fixed);
        });
      };
      mr.stop();
      setRecording(false);
    });
  }, []);

  return { start, stop, recording, audioUrl };
}

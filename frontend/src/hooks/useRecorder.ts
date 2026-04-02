import { useRef, useState, useCallback } from 'react';

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback((stream: MediaStream) => {
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mrRef.current = mr;

    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioUrl(URL.createObjectURL(blob));
    };

    mr.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    mrRef.current?.stop();
    setRecording(false);
  }, []);

  return { start, stop, recording, audioUrl };
}

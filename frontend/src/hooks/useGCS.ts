import { useState, useCallback } from 'react';

const BACKEND_URL = 'https://vibe-cast-backend-905541599300.asia-northeast1.run.app';

export function useGCS() {
  const [uploading, setUploading] = useState(false);
  const [gcsPath, setGcsPath] = useState<string | null>(null);

  const upload = useCallback(async (blob: Blob, role: 'host' | 'guest', episodeId: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, `${role}_track.webm`);

      const res = await fetch(
        `${BACKEND_URL}/audio/upload?role=${role}&episode_id=${episodeId}`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();
      setGcsPath(data.gcs_path);
      return data as { episode_id: string; gcs_path: string };
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, gcsPath };
}

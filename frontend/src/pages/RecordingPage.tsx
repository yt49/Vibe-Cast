import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRecorder } from '../hooks/useRecorder';
import { useGCS } from '../hooks/useGCS';
import { useVolumeLevel } from '../hooks/useVolumeLevel';

const ROOM_ID = 'vibe-cast-room-1';

function generateEpisodeId() {
  return new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
}

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RecordingPage() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [elapsed, setElapsed] = useState(0);
  const [episodeId, setEpisodeId] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const { connect, disconnect, connected, remoteStream, sendSessionId } = useWebRTC(ROOM_ID, setEpisodeId);
  const { start, stop, recording, audioUrl } = useRecorder();
  const { upload, uploading, gcsPath } = useGCS();
  const { volume, start: startVolume, stop: stopVolume } = useVolumeLevel();
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<{ host: string | null; guest: string | null } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<Record<string, string> | null>(null);

  const handleConnect = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    setLocalStream(stream);
    startVolume(stream);
    await connect(stream);
  };

  const handleStart = () => {
    if (!localStream) return;
    setElapsed(0);
    start(localStream);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    if (role === 'host') {
      const id = generateEpisodeId();
      setEpisodeId(id);
      sendSessionId(id);
    }
  };

  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stop();
    await upload(blob, role, episodeId);
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const res = await fetch(
        'https://vibe-cast-backend-905541599300.asia-northeast1.run.app/ai/transcribe',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episode_id: episodeId }),
        }
      );
      const data = await res.json();
      setTranscript({ host: data.host, guest: data.guest });
    } finally {
      setTranscribing(false);
    }
  };

  const handleSummarize = async () => {
    if (!transcript) return;
    setSummarizing(true);
    try {
      const res = await fetch(
        'https://vibe-cast-backend-905541599300.asia-northeast1.run.app/ai/summarize',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host: transcript.host, guest: transcript.guest }),
        }
      );
      const data = await res.json();
      setSummary(data);
    } finally {
      setSummarizing(false);
    }
  };

  const handleDisconnect = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    stopVolume();
    disconnect();
  };

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1 style={{ marginBottom: 8 }}>🎙 vibe-cast</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>AIに仕事奪われてみたチャンネル</p>

      {/* ロール選択（接続後は変更不可） */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 16 }}>
          <input type="radio" value="host" checked={role === 'host'} onChange={() => setRole('host')} disabled={!!localStream} />
          {' '}ホスト（鶴岡）
        </label>
        <label>
          <input type="radio" value="guest" checked={role === 'guest'} onChange={() => setRole('guest')} disabled={!!localStream} />
          {' '}ゲスト（大悟）
        </label>
      </div>

      {/* 接続状態 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <p style={{ margin: 0 }}>
          {connected ? '🟢 接続中' : localStream ? '🟡 相手を待っています...' : '⚪ 未接続'}
        </p>
        {localStream && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>🎤 マイク音量</div>
            <div style={{ background: '#ddd', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(volume * 100)}%`,
                background: volume > 0.7 ? '#f44336' : volume > 0.4 ? '#FF9800' : '#4CAF50',
                transition: 'width 0.05s ease',
              }} />
            </div>
          </div>
        )}
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* 接続ボタン */}
      <div style={{ marginBottom: 24 }}>
        {!localStream ? (
          <button onClick={handleConnect} style={btn('#4CAF50')}>
            📞 接続する
          </button>
        ) : (
          <button onClick={handleDisconnect} style={btn('#f44336')}>
            📵 切断する
          </button>
        )}
      </div>

      {/* 録音ボタン（ホストのみ） */}
      <div style={{ marginBottom: 24 }}>
        {role === 'guest' ? (
          <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, color: '#888', textAlign: 'center' }}>
            🎙 録音はホストが操作します
          </div>
        ) : !recording ? (
          <button
            onClick={handleStart}
            disabled={!localStream}
            style={btn(localStream ? '#2196F3' : '#ccc')}
          >
            ● 録音開始
          </button>
        ) : (
          <>
            <div style={{ textAlign: 'center', fontSize: 32, fontVariantNumeric: 'tabular-nums', marginBottom: 12, letterSpacing: 2 }}>
              🔴 {formatTime(elapsed)}
            </div>
            <button onClick={handleStop} style={btn('#FF5722')}>
              ■ 録音停止 & アップロード
            </button>
          </>
        )}
      </div>

      {/* アップロード中 */}
      {uploading && (
        <div style={{ padding: 16, background: '#fff3e0', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: 0 }}>⬆️ GCSにアップロード中...</p>
        </div>
      )}

      {/* 完了 */}
      {gcsPath && (
        <div style={{ padding: 16, background: '#e8f5e9', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ marginTop: 0 }}>✅ アップロード完了！</p>
          <p style={{ fontSize: 12, color: '#555', wordBreak: 'break-all', margin: 0 }}>{gcsPath}</p>
        </div>
      )}

      {/* 文字起こし */}
      {gcsPath && !transcript && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleTranscribe}
            disabled={transcribing}
            style={btn(transcribing ? '#ccc' : '#9C27B0')}
          >
            {transcribing ? '⏳ 文字起こし中...' : '📝 Whisperで文字起こし'}
          </button>
        </div>
      )}

      {transcript && (
        <div style={{ padding: 16, background: '#f3e5f5', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ marginTop: 0, fontWeight: 'bold' }}>📝 文字起こし完了</p>
          {transcript.host && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>🎙 ホスト（鶴岡）</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{transcript.host}</div>
            </div>
          )}
          {transcript.guest && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>🎙 ゲスト（大悟）</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{transcript.guest}</div>
            </div>
          )}
        </div>
      )}

      {/* Gemini要約 */}
      {transcript && !summary && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            style={btn(summarizing ? '#ccc' : '#FF6F00')}
          >
            {summarizing ? '⏳ Geminiが分析中...' : '🤖 Geminiで要約・構造化'}
          </button>
        </div>
      )}

      {summary && (
        <div style={{ padding: 16, background: '#FFF8E1', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ marginTop: 0, fontWeight: 'bold' }}>🤖 Gemini分析結果</p>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>テーマ</span>
            <p style={{ margin: '4px 0', fontWeight: 'bold' }}>{summary.theme}</p>
          </div>
          {[
            { label: '🎙 鶴岡の主張', key: 'host_claim' },
            { label: '🎙 大悟の主張', key: 'guest_claim' },
            { label: '✅ 合意したこと', key: 'agreed' },
            { label: '⚡ まだ対立していること', key: 'disagreed' },
            { label: '❓ 鶴岡の問い', key: 'host_question' },
            { label: '❓ 大悟の問い', key: 'guest_question' },
          ].map(({ label, key }) => summary[key] && (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{summary[key]}</div>
            </div>
          ))}
        </div>
      )}

      {/* ローカル再生 */}
      {audioUrl && (
        <div style={{ padding: 16, background: '#f3e5f5', borderRadius: 8 }}>
          <p style={{ marginTop: 0 }}>🎧 ローカルで確認</p>
          <audio src={audioUrl} controls style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 8,
    cursor: color === '#ccc' ? 'not-allowed' : 'pointer',
    fontSize: 16,
    width: '100%',
  };
}

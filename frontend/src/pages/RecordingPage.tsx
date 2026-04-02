import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRecorder } from '../hooks/useRecorder';
import { useGCS } from '../hooks/useGCS';

const ROOM_ID = 'vibe-cast-room-1';
const EPISODE_ID = new Date().toISOString().slice(0, 10).replace(/-/g, '');

export default function RecordingPage() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const { connect, disconnect, connected, remoteStream } = useWebRTC(ROOM_ID);
  const { start, stop, recording, audioUrl } = useRecorder();
  const { upload, uploading, gcsPath } = useGCS();

  const handleConnect = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setLocalStream(stream);
    await connect(stream);
  };

  const handleStop = async () => {
    const blob = await stop();
    await upload(blob, role, EPISODE_ID);
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

      {/* ロール選択 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 16 }}>
          <input type="radio" value="host" checked={role === 'host'} onChange={() => setRole('host')} />
          {' '}ホスト（鶴岡）
        </label>
        <label>
          <input type="radio" value="guest" checked={role === 'guest'} onChange={() => setRole('guest')} />
          {' '}ゲスト（大悟）
        </label>
      </div>

      {/* 接続状態 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <p style={{ margin: 0 }}>
          {connected ? '🟢 接続中' : localStream ? '🟡 相手を待っています...' : '⚪ 未接続'}
        </p>
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
          <button onClick={disconnect} style={btn('#f44336')}>
            📵 切断する
          </button>
        )}
      </div>

      {/* 録音ボタン */}
      <div style={{ marginBottom: 24 }}>
        {!recording ? (
          <button
            onClick={() => localStream && start(localStream)}
            disabled={!localStream}
            style={btn(localStream ? '#2196F3' : '#ccc')}
          >
            ● 録音開始
          </button>
        ) : (
          <button onClick={handleStop} style={btn('#FF5722')}>
            ■ 録音停止 & アップロード
          </button>
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

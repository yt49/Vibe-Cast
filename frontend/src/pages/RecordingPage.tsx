import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRecorder } from '../hooks/useRecorder';
import { useGCS } from '../hooks/useGCS';
import { useVolumeLevel } from '../hooks/useVolumeLevel';

const ROOM_ID = 'vibe-cast-room-1';

const C = {
  bg: '#131314', surface: '#1e1f20', surfaceHigh: '#2d2e2f', border: '#3c4043',
  textPrimary: '#e3e3e3', textSecondary: '#c4c7c5', textTertiary: '#9aa0a6', textDisabled: '#5f6368',
  primary: '#a8c7fa', onPrimary: '#0842a0', green: '#34a853', yellow: '#fbbc04', red: '#ea4335',
} as const;

const font = "'Noto Sans JP', 'Google Sans', ui-sans-serif, system-ui, sans-serif";

function mixStreams(local: MediaStream, remote: MediaStream | null): MediaStream {
  if (!remote) return local;
  try {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(local).connect(dest);
    ctx.createMediaStreamSource(remote).connect(dest);
    return dest.stream;
  } catch {
    return local;
  }
}

function generateEpisodeId() {
  // JST (UTC+9) で生成
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 19).replace(/[-T:]/g, '');
}
function formatTime(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-rounded" style={{ fontSize: size, lineHeight: 1, userSelect: 'none' }}>{name}</span>;
}
function Spinner() {
  return (
    <svg style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function RecordingPage() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [elapsed, setElapsed] = useState(0);
  const [episodeId, setEpisodeId] = useState('');
  const [roleConflict, setRoleConflict] = useState(false);
  const [guestShouldStop, setGuestShouldStop] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const guestRecordingStartedRef = useRef(false);  // 二重起動防止

  const { start, stop, recording, audioUrl } = useRecorder();
  const { upload, uploading, gcsPath } = useGCS();
  const { volume, start: startVolume, stop: stopVolume } = useVolumeLevel();
  const [episodeName, setEpisodeName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<{ host: string | null; guest: string | null } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<Record<string, string> & { journey?: { departure: string; wandering: string[]; landing: string; unresolved: string } } | null>(null);

  // stop/upload を useEffect 内で使うためのref
  const stopRef = useRef(stop);
  const uploadRef = useRef(upload);
  stopRef.current = stop;
  uploadRef.current = upload;

  const { connect, disconnect, connected, remoteStream, sendSessionId, sendRecordingStop } = useWebRTC(
    ROOM_ID,
    setEpisodeId,                           // onSessionId: ゲストのepisodeIdを更新
    () => setGuestShouldStop(true),         // onRecordingStop: ホストから停止シグナル
    () => setRoleConflict(true),            // onRoleConflict: 同ロール衝突
  );

  // ── ゲスト自動録音開始 ──
  // episodeId が届いた（ホストが録音開始した）タイミングで useEffect が発火
  useEffect(() => {
    if (role !== 'guest') return;
    if (!episodeId) return;
    if (!localStream) return;
    if (guestRecordingStartedRef.current) return;
    guestRecordingStartedRef.current = true;
    setElapsed(0);
    start(mixStreams(localStream, remoteStream));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [episodeId, role, localStream, remoteStream]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── ゲスト自動録音停止 ──
  // ホストから session_stop を受け取ったとき
  useEffect(() => {
    if (!guestShouldStop) return;
    setGuestShouldStop(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const doStop = async () => {
      const blob = await stopRef.current();
      // episodeId は setEpisodeId で更新済みのはずだが、クロージャで捕まえておく
      const currentEpisodeId = episodeId;
      await uploadRef.current(blob, 'guest', currentEpisodeId);
    };
    doStop();
  }, [guestShouldStop]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setRoleConflict(false);
    guestRecordingStartedRef.current = false;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    setLocalStream(stream);
    startVolume(stream);
    await connect(stream, role);
  };

  const handleStart = () => {
    if (!localStream) return;
    setElapsed(0);
    start(mixStreams(localStream, remoteStream));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    const id = generateEpisodeId();
    setEpisodeId(id);
    sendSessionId(id);
  };

  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stop();
    await upload(blob, 'host', episodeId);
    sendRecordingStop();
  };

  const handleDisconnect = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    stopVolume();
    disconnect();
    setRoleConflict(false);
    guestRecordingStartedRef.current = false;
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/ai/transcribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_id: episodeId }),
      });
      const data = await res.json();
      setTranscript({ host: data.host, guest: data.guest });
    } finally { setTranscribing(false); }
  };

  const handleSaveName = async () => {
    if (!episodeName.trim() || !episodeId) return;
    setSavingName(true);
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/episodes/${episodeId}/meta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: episodeName.trim() }),
      });
      setNameSaved(true);
    } finally { setSavingName(false); }
  };

  const handleSummarize = async () => {
    if (!transcript) return;
    setSummarizing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/ai/summarize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_id: episodeId, host: transcript.host, guest: transcript.guest }),
      });
      const data = await res.json();
      setSummary(data);
    } finally { setSummarizing(false); }
  };

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const statusColor = connected ? C.green : localStream ? C.yellow : C.textDisabled;
  const statusLabel = connected ? '接続中' : localStream ? '相手を待っています' : '未接続';

  const fabBg = !localStream ? C.surfaceHigh : recording ? C.red : '#c2e7ff';
  const fabColor = !localStream ? C.textDisabled : recording ? '#fff' : '#001d35';
  const fabShadow = localStream ? (recording ? `0 0 0 10px ${C.red}22,0 4px 16px ${C.red}44` : '0 0 0 10px #c2e7ff18,0 4px 16px #0000004d') : 'none';

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', fontFamily: font, color: C.textPrimary }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '48px 24px 120px' }}>

        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>vibe-cast</h1>
          <p style={{ fontSize: 13, color: C.textDisabled, margin: '6px 0 0' }}>AIに仕事を奪われてみたチャンネル</p>
        </header>

        {/* ロール選択 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {(['host', 'guest'] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} disabled={!!localStream} style={{
              padding: '8px 20px', borderRadius: 999, fontSize: 14, fontWeight: 500, fontFamily: font,
              cursor: localStream ? 'not-allowed' : 'pointer', opacity: localStream ? 0.5 : 1,
              border: role === r ? 'none' : `1px solid ${C.border}`,
              backgroundColor: role === r ? C.primary : 'transparent',
              color: role === r ? C.onPrimary : C.textTertiary,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
            }}>
              <Icon name={r === 'host' ? 'radio_button_checked' : 'person'} size={16} />
              {r === 'host' ? 'Host' : 'Guest'}
            </button>
          ))}
        </div>

        {/* ロール競合エラー */}
        {roleConflict && (
          <div style={{ padding: '14px 20px', backgroundColor: '#2d1a1a', borderRadius: 12, borderLeft: `3px solid ${C.red}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 4 }}>ロールが重複しています</div>
            <div style={{ fontSize: 12, color: C.textTertiary }}>一方がHost、もう一方がGuestを選んでください。</div>
          </div>
        )}

        {/* 接続状態カード */}
        <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, boxShadow: connected ? `0 0 0 3px ${C.green}33` : 'none' }} />
            <span style={{ fontSize: 14, color: C.textSecondary }}>{statusLabel}</span>
            {episodeId && <span style={{ fontSize: 11, color: C.textDisabled, fontFamily: 'monospace', marginLeft: 'auto' }}>{episodeId}</span>}
          </div>
          {localStream && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mic</span>
                <span style={{ fontSize: 11, color: C.textDisabled }}>{Math.round(volume * 100)}%</span>
              </div>
              <div style={{ height: 2, backgroundColor: C.surfaceHigh, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(volume * 100)}%`, backgroundColor: volume > 0.7 ? C.red : volume > 0.4 ? C.yellow : C.green, transition: 'width 50ms ease', borderRadius: 2 }} />
              </div>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />
        </div>

        {/* 接続/切断ボタン */}
        <div style={{ marginBottom: 48 }}>
          {!localStream ? (
            <button onClick={handleConnect} style={{ width: '100%', padding: '14px', borderRadius: 999, backgroundColor: C.primary, color: C.onPrimary, border: 'none', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="wifi" size={18} />接続する
            </button>
          ) : (
            <button onClick={handleDisconnect} style={{ width: '100%', padding: '14px', borderRadius: 999, backgroundColor: 'transparent', color: C.textTertiary, border: `1px solid ${C.border}`, fontSize: 14, fontWeight: 500, fontFamily: font, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="wifi_off" size={18} />切断する
            </button>
          )}
        </div>

        {/* 録音セクション */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.red, animation: 'pulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: 42, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{formatTime(elapsed)}</span>
            </div>
          )}

          {role === 'host' ? (
            <>
              <button
                onClick={recording ? handleStop : handleStart}
                disabled={!localStream}
                style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: fabBg, color: fabColor, border: 'none', cursor: localStream ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: fabShadow }}
              >
                <Icon name={recording ? 'stop' : 'mic'} size={32} />
              </button>
              <span style={{ fontSize: 12, color: C.textDisabled, textAlign: 'center' }}>
                {!localStream ? '先に接続してください' : recording ? '停止するとゲストも自動停止します' : 'タップで録音開始（ゲストも自動開始）'}
              </span>
            </>
          ) : (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: recording ? C.red : C.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? `0 0 0 10px ${C.red}22,0 4px 16px ${C.red}44` : 'none', transition: 'all 0.2s' }}>
                <Icon name="mic" size={32} />
              </div>
              <span style={{ fontSize: 12, color: C.textDisabled, textAlign: 'center' }}>
                {recording ? 'ホストが停止するまで録音中' : localStream ? 'ホストが録音を開始すると自動で開始します' : '先に接続してください'}
              </span>
            </>
          )}
        </div>

        {/* アップロード状態 */}
        {uploading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', backgroundColor: C.surface, borderRadius: 12, marginBottom: 12, color: C.textTertiary, fontSize: 14 }}>
            <Spinner />アップロード中
          </div>
        )}
        {gcsPath && !uploading && (
          <div style={{ padding: '16px 20px', backgroundColor: C.surface, borderRadius: 12, borderLeft: `3px solid ${C.green}`, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 8 }}>アップロード完了</div>
            {nameSaved ? (
              <div style={{ fontSize: 13, color: C.textSecondary }}>{episodeName}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={episodeName}
                  onChange={(e) => setEpisodeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  placeholder="エピソード名を入力..."
                  style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.textPrimary, fontFamily: font, outline: 'none' }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !episodeName.trim()}
                  style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: episodeName.trim() ? C.primary : C.surfaceHigh, color: episodeName.trim() ? C.onPrimary : C.textDisabled, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: font, cursor: episodeName.trim() ? 'pointer' : 'default' }}
                >
                  {savingName ? '...' : '保存'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 文字起こし（ホストのみ） */}
        {role === 'host' && gcsPath && !transcript && (
          <button onClick={handleTranscribe} disabled={transcribing} style={{ width: '100%', padding: '14px', borderRadius: 999, backgroundColor: 'transparent', color: transcribing ? C.textDisabled : C.primary, border: `1px solid ${transcribing ? C.border : C.primary}`, fontSize: 14, fontWeight: 500, fontFamily: font, cursor: transcribing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, opacity: transcribing ? 0.7 : 1 }}>
            {transcribing ? <Spinner /> : <Icon name="record_voice_over" size={18} />}
            {transcribing ? '文字起こし中...' : 'Whisper で文字起こし'}
          </button>
        )}

        {/* トランスクリプト */}
        {transcript && (
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Transcript</div>
            {transcript.host && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 6 }}>鶴岡 / Host</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, margin: 0 }}>{transcript.host}</p>
              </div>
            )}
            {transcript.guest && (
              <div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 6 }}>大悟 / Guest</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, margin: 0 }}>{transcript.guest}</p>
              </div>
            )}
          </div>
        )}

        {/* 要約 */}
        {transcript && !summary && (
          <button onClick={handleSummarize} disabled={summarizing} style={{ width: '100%', padding: '14px', borderRadius: 999, backgroundColor: summarizing ? 'transparent' : C.primary, color: summarizing ? C.textDisabled : C.onPrimary, border: summarizing ? `1px solid ${C.border}` : 'none', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: summarizing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            {summarizing ? <Spinner /> : <Icon name="auto_awesome" size={18} />}
            {summarizing ? 'Gemini が分析中...' : 'Gemini で要約'}
          </button>
        )}

        {/* サマリー */}
        {summary && (
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>AI Summary</div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 6 }}>テーマ</div>
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{summary.theme}</p>
            </div>
            {[
              { label: '鶴岡の主張', key: 'host_claim' }, { label: '大悟の主張', key: 'guest_claim' },
              { label: '合意点', key: 'agreed' }, { label: '対立点', key: 'disagreed' },
              { label: '鶴岡の問い', key: 'host_question' }, { label: '大悟の問い', key: 'guest_question' },
            ].map(({ label, key }) => summary[key] ? (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>{label}</div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.75, margin: 0 }}>{summary[key]}</p>
              </div>
            ) : null)}

            {/* 思考の旅路 */}
            {summary.journey && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Journey</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* 出発点 */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.primary, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ width: 1, flex: 1, backgroundColor: C.border, marginTop: 4 }} />
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <div style={{ fontSize: 11, color: C.textDisabled, marginBottom: 2 }}>出発点</div>
                      <p style={{ fontSize: 14, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>{summary.journey.departure}</p>
                    </div>
                  </div>
                  {/* 寄り道 */}
                  {(summary.journey.wandering ?? []).map((w: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.border, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ width: 1, flex: 1, backgroundColor: C.border, marginTop: 4 }} />
                      </div>
                      <div style={{ paddingBottom: 14 }}>
                        <p style={{ fontSize: 13, color: C.textTertiary, margin: 0, lineHeight: 1.6 }}>{w}</p>
                      </div>
                    </div>
                  ))}
                  {/* 着地点 */}
                  {summary.journey.landing && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.green, marginTop: 4, flexShrink: 0 }} />
                        {summary.journey.unresolved && <div style={{ width: 1, flex: 1, backgroundColor: C.border, marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: summary.journey.unresolved ? 16 : 0 }}>
                        <div style={{ fontSize: 11, color: C.textDisabled, marginBottom: 2 }}>着地点</div>
                        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>{summary.journey.landing}</p>
                      </div>
                    </div>
                  )}
                  {/* 持ち越し */}
                  {summary.journey.unresolved && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: C.yellow, marginTop: 4, flexShrink: 0 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textDisabled, marginBottom: 2 }}>持ち越し</div>
                        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>{summary.journey.unresolved}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ローカル再生 */}
        {audioUrl && (
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Local Playback</div>
            <audio src={audioUrl} controls style={{ width: '100%' }} />
          </div>
        )}

      </div>
    </div>
  );
}

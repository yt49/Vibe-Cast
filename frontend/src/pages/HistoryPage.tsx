import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;

const C = {
  bg: '#131314', surface: '#1e1f20', surfaceHigh: '#2d2e2f', border: '#3c4043',
  textPrimary: '#e3e3e3', textSecondary: '#c4c7c5', textTertiary: '#9aa0a6', textDisabled: '#5f6368',
  primary: '#a8c7fa', onPrimary: '#0842a0', green: '#34a853', yellow: '#fbbc04', red: '#ea4335',
} as const;

const font = "'Noto Sans JP', 'Google Sans', ui-sans-serif, system-ui, sans-serif";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-rounded" style={{ fontSize: size, lineHeight: 1, userSelect: 'none' }}>{name}</span>;
}
function Spinner() {
  return (
    <svg style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function formatEpisodeId(id: string | undefined) {
  if (!id) return '';
  if (id.length === 14) {
    const y = id.slice(0, 4), mo = id.slice(4, 6), d = id.slice(6, 8);
    const h = id.slice(8, 10), mi = id.slice(10, 12);
    return `${y}/${mo}/${d} ${h}:${mi}`;
  }
  return id;
}

type Transcript = { host: string | null; guest: string | null };
type Summary = Record<string, unknown> & {
  theme?: string;
  journey?: { departure: string; wandering: string[]; landing: string; unresolved: string };
};

type EpisodeState = {
  expanded: boolean;
  transcript: Transcript | null;
  transcribing: boolean;
  summary: Summary | null;
  summarizing: boolean;
  deleting: boolean;
  editingName: string;
  savingName: boolean;
};

type EpisodeMeta = { id: string; name: string };

export default function HistoryPage() {
  const [episodes, setEpisodes] = useState<EpisodeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<Record<string, EpisodeState>>({});

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/episodes`);
      const data = await res.json();
      const raw = data.episodes ?? [];
      // バックエンドが旧形式（文字列配列）を返す場合にも対応
      const normalized: EpisodeMeta[] = raw.map((e: EpisodeMeta | string) =>
        typeof e === 'string' ? { id: e, name: '' } : e
      );
      setEpisodes(normalized);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEpisodes(); }, [fetchEpisodes]);

  const defaultState: EpisodeState = {
    expanded: false,
    transcript: null, transcribing: false, summary: null, summarizing: false, deleting: false,
    editingName: '', savingName: false,
  };
  function getState(id: string): EpisodeState {
    return states[id] ?? defaultState;
  }
  function patchState(id: string, patch: Partial<EpisodeState>) {
    setStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? defaultState), ...patch },
    }));
  }

  const handleExpand = async (id: string) => {
    // staleなstatesを参照しないようfunctional updateで現在のexpanded状態を取得
    let wasExpanded = false;
    setStates((prev) => {
      const cur = prev[id] ?? defaultState;
      wasExpanded = cur.expanded;
      return { ...prev, [id]: { ...cur, expanded: !cur.expanded } };
    });

    if (wasExpanded) return;

    // 展開時に現在のエピソード名を編集フィールドに初期セット
    const currentName = episodes.find((e) => e.id === id)?.name ?? '';
    patchState(id, { editingName: currentName });

    // transcript・summary を並列取得（音声はストリーミングURLを直接audio srcに渡す）
    const [transcriptRes, summaryRes] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/episodes/${id}/transcript`),
      fetch(`${BACKEND_URL}/episodes/${id}/summary`),
    ]);

    const transcript = transcriptRes.status === 'fulfilled' && transcriptRes.value.ok
      ? await transcriptRes.value.json() : null;
    const summary = summaryRes.status === 'fulfilled' && summaryRes.value.ok
      ? await summaryRes.value.json() : null;

    patchState(id, { transcript, summary });
  };

  const handleTranscribe = async (id: string) => {
    patchState(id, { transcribing: true });
    try {
      const res = await fetch(`${BACKEND_URL}/ai/transcribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_id: id }),
      });
      if (res.ok) {
        const data = await res.json();
        patchState(id, { transcript: { host: data.host, guest: data.guest } });
      }
    } finally {
      patchState(id, { transcribing: false });
    }
  };

  const handleSummarize = async (id: string) => {
    const s = getState(id);
    if (!s.transcript) return;
    patchState(id, { summarizing: true });
    try {
      const res = await fetch(`${BACKEND_URL}/ai/summarize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_id: id, host: s.transcript.host, guest: s.transcript.guest }),
      });
      if (res.ok) {
        const data = await res.json();
        patchState(id, { summary: data });
      }
    } finally {
      patchState(id, { summarizing: false });
    }
  };

  const handleSaveName = async (id: string) => {
    const s = getState(id);
    if (!s.editingName.trim()) return;
    patchState(id, { savingName: true });
    try {
      const res = await fetch(`${BACKEND_URL}/episodes/${id}/meta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.editingName.trim() }),
      });
      if (res.ok) {
        setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, name: s.editingName.trim() } : e));
      }
    } finally {
      patchState(id, { savingName: false });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`エピソード ${formatEpisodeId(id)} を削除しますか？`)) return;
    patchState(id, { deleting: true });
    try {
      const res = await fetch(`${BACKEND_URL}/episodes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEpisodes((prev) => prev.filter((e) => e.id !== id));
        setStates((prev) => { const next = { ...prev }; delete next[id]; return next; });
      }
    } finally {
      patchState(id, { deleting: false });
    }
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', fontFamily: font, color: C.textPrimary }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '48px 24px 100px' }}>

        <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>過去の録音</h1>
            <p style={{ fontSize: 13, color: C.textDisabled, margin: '6px 0 0' }}>録音・文字起こし・要約を確認</p>
          </div>
          <button onClick={fetchEpisodes} style={{ background: 'none', border: 'none', color: C.textTertiary, cursor: 'pointer', padding: 8 }}>
            <Icon name="refresh" size={20} />
          </button>
        </header>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textTertiary, fontSize: 14 }}>
            <Spinner /> 読み込み中...
          </div>
        )}

        {!loading && episodes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textDisabled, fontSize: 14 }}>
            <Icon name="mic_off" size={40} />
            <p style={{ marginTop: 12 }}>録音がまだありません</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {episodes.map(({ id, name }) => {
            const s = getState(id);
            return (
              <div key={id} style={{ backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden' }}>
                {/* ヘッダー行 */}
                <div
                  onClick={() => handleExpand(id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 12 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{name || formatEpisodeId(id)}</div>
                    <div style={{ fontSize: 11, color: C.textDisabled, marginTop: 2 }}>{formatEpisodeId(id)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.transcript && <Icon name="record_voice_over" size={16} />}
                    {s.summary && <Icon name="auto_awesome" size={16} />}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                      disabled={s.deleting}
                      style={{ background: 'none', border: 'none', color: C.textDisabled, cursor: 'pointer', padding: 4, display: 'flex' }}
                    >
                      {s.deleting ? <Spinner /> : <Icon name="delete" size={18} />}
                    </button>
                    <Icon name={s.expanded ? 'expand_less' : 'expand_more'} size={20} />
                  </div>
                </div>

                {/* 展開エリア */}
                {s.expanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}` }}>

                    {/* エピソード名編集 */}
                    <div style={{ paddingTop: 16, display: 'flex', gap: 8 }}>
                      <input
                        value={s.editingName}
                        onChange={(e) => patchState(id, { editingName: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(id)}
                        placeholder="エピソード名を入力..."
                        style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.textPrimary, fontFamily: font, outline: 'none' }}
                      />
                      <button
                        onClick={() => handleSaveName(id)}
                        disabled={s.savingName || !s.editingName.trim()}
                        style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: s.editingName.trim() ? C.primary : C.surfaceHigh, color: s.editingName.trim() ? C.onPrimary : C.textDisabled, border: 'none', fontSize: 13, fontWeight: 600, fontFamily: font, cursor: s.editingName.trim() ? 'pointer' : 'default' }}
                      >
                        {s.savingName ? '...' : '保存'}
                      </button>
                    </div>

                    {/* 音声プレイヤー（ストリーミングURLを直接指定） */}
                    <div style={{ paddingTop: 16 }}>
                      <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Audio</div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>Host</div>
                        <audio src={`${BACKEND_URL}/episodes/${id}/audio?role=host`} controls style={{ width: '100%' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.textTertiary, marginBottom: 4 }}>Guest</div>
                        <audio src={`${BACKEND_URL}/episodes/${id}/audio?role=guest`} controls style={{ width: '100%' }} />
                      </div>
                    </div>

                    {/* 文字起こしボタン */}
                    {!s.transcript && (
                      <button
                        onClick={() => handleTranscribe(id)}
                        disabled={s.transcribing}
                        style={{ width: '100%', padding: '12px', borderRadius: 999, backgroundColor: 'transparent', color: s.transcribing ? C.textDisabled : C.primary, border: `1px solid ${s.transcribing ? C.border : C.primary}`, fontSize: 13, fontWeight: 500, fontFamily: font, cursor: s.transcribing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, opacity: s.transcribing ? 0.7 : 1 }}
                      >
                        {s.transcribing ? <Spinner /> : <Icon name="record_voice_over" size={16} />}
                        {s.transcribing ? '文字起こし中...' : 'Whisper で文字起こし'}
                      </button>
                    )}

                    {/* トランスクリプト */}
                    {s.transcript && (
                      <div style={{ marginTop: 16, backgroundColor: C.surfaceHigh, borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Transcript</div>
                        {s.transcript.host && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 4 }}>Host</div>
                            <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>{s.transcript.host}</p>
                          </div>
                        )}
                        {s.transcript.guest && (
                          <div>
                            <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 4 }}>Guest</div>
                            <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>{s.transcript.guest}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 要約ボタン */}
                    {s.transcript && !s.summary && (
                      <button
                        onClick={() => handleSummarize(id)}
                        disabled={s.summarizing}
                        style={{ width: '100%', padding: '12px', borderRadius: 999, backgroundColor: s.summarizing ? 'transparent' : C.primary, color: s.summarizing ? C.textDisabled : C.onPrimary, border: s.summarizing ? `1px solid ${C.border}` : 'none', fontSize: 13, fontWeight: 600, fontFamily: font, cursor: s.summarizing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}
                      >
                        {s.summarizing ? <Spinner /> : <Icon name="auto_awesome" size={16} />}
                        {s.summarizing ? 'Gemini が分析中...' : 'Gemini で要約'}
                      </button>
                    )}

                    {/* サマリー */}
                    {s.summary && (
                      <div style={{ marginTop: 12, backgroundColor: C.surfaceHigh, borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>AI Summary</div>
                        {s.summary.theme && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 4 }}>テーマ</div>
                            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{s.summary.theme as string}</p>
                          </div>
                        )}
                        {([
                          { label: 'ホストの主張', key: 'host_claim' }, { label: 'ゲストの主張', key: 'guest_claim' },
                          { label: '合意点', key: 'agreed' }, { label: '対立点', key: 'disagreed' },
                        ] as const).map(({ label, key }) => s.summary![key as string] ? (
                          <div key={key} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: C.textTertiary, marginBottom: 2 }}>{label}</div>
                            <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>{s.summary![key as string] as string}</p>
                          </div>
                        ) : null)}

                        {/* Journey */}
                        {s.summary.journey && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.textDisabled, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Journey</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                              <JourneyNode color={C.primary} label="出発点" text={s.summary.journey.departure} hasLine />
                              {(s.summary.journey.wandering ?? []).map((w: string, i: number) => (
                                <JourneyNode key={i} color={C.border} text={w} small hasLine />
                              ))}
                              {s.summary.journey.landing && (
                                <JourneyNode color={C.green} label="着地点" text={s.summary.journey.landing} hasLine={!!s.summary.journey.unresolved} />
                              )}
                              {s.summary.journey.unresolved && (
                                <JourneyNode color={C.yellow} label="持ち越し" text={s.summary.journey.unresolved} />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function JourneyNode({ color, label, text, small, hasLine }: {
  color: string; label?: string; text: string; small?: boolean; hasLine?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: small ? 6 : 8, height: small ? 6 : 8, borderRadius: '50%', backgroundColor: color, marginTop: small ? 5 : 4, flexShrink: 0 }} />
        {hasLine && <div style={{ width: 1, flex: 1, backgroundColor: C.border, marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: hasLine ? 12 : 0 }}>
        {label && <div style={{ fontSize: 10, color: C.textDisabled, marginBottom: 2 }}>{label}</div>}
        <p style={{ fontSize: small ? 12 : 13, color: small ? C.textTertiary : C.textSecondary, margin: 0, lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  );
}

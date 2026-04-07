import { useState, useCallback } from 'react';
import RecordingPage from './pages/RecordingPage';
import HistoryPage from './pages/HistoryPage';
import TrendDashboard from './pages/TrendDashboard';

const C = {
  bg: '#131314', surface: '#1e1f20', border: '#3c4043',
  textPrimary: '#e3e3e3', textDisabled: '#5f6368',
  primary: '#a8c7fa', onPrimary: '#0842a0', red: '#ea4335',
} as const;

const font = "'Noto Sans JP', 'Google Sans', ui-sans-serif, system-ui, sans-serif";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-rounded" style={{ fontSize: size, lineHeight: 1, userSelect: 'none' }}>{name}</span>;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type Tab = 'record' | 'history' | 'trend';

export default function App() {
  const [tab, setTab] = useState<Tab>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  const handleRecordingChange = useCallback((recording: boolean, elapsed: number) => {
    setIsRecording(recording);
    setRecordingElapsed(elapsed);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: C.bg }}>
      {/* 録音中バナー（録音タブ以外で録音中のとき表示） */}
      {isRecording && tab !== 'record' && (
        <div
          onClick={() => setTab('record')}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
            backgroundColor: C.red, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '10px 16px', fontFamily: font,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>録音中 {formatTime(recordingElapsed)}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>タップで録音画面へ</span>
          <Icon name="chevron_right" size={18} />
        </div>
      )}

      {/* タブコンテンツ: display切替でアンマウントさせず録音を継続 */}
      <div style={{ display: tab === 'record' ? 'block' : 'none' }}>
        <RecordingPage onRecordingChange={handleRecordingChange} />
      </div>
      <div style={{ display: tab === 'history' ? 'block' : 'none' }}><HistoryPage /></div>
      <div style={{ display: tab === 'trend' ? 'block' : 'none' }}><TrendDashboard /></div>

      {/* ボトムタブバー */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: C.surface,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        fontFamily: font,
        zIndex: 100,
      }}>
        {([
          { id: 'record', icon: 'mic', label: '録音' },
          { id: 'history', icon: 'history', label: '履歴' },
          { id: 'trend', icon: 'hub', label: 'トレンド' },
        ] as { id: Tab; icon: string; label: string }[]).map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, padding: '12px 0 16px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === id ? C.primary : C.textDisabled,
              transition: 'color 0.15s',
            }}
          >
            <div style={{
              padding: '4px 20px', borderRadius: 999,
              backgroundColor: tab === id ? `${C.primary}22` : 'transparent',
              transition: 'background-color 0.15s',
            }}>
              <Icon name={icon} size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: tab === id ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

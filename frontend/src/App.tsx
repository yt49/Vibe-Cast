import { useState } from 'react';
import RecordingPage from './pages/RecordingPage';
import HistoryPage from './pages/HistoryPage';

const C = {
  bg: '#131314', surface: '#1e1f20', border: '#3c4043',
  textPrimary: '#e3e3e3', textDisabled: '#5f6368',
  primary: '#a8c7fa', onPrimary: '#0842a0',
} as const;

const font = "'Noto Sans JP', 'Google Sans', ui-sans-serif, system-ui, sans-serif";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="material-symbols-rounded" style={{ fontSize: size, lineHeight: 1, userSelect: 'none' }}>{name}</span>;
}

type Tab = 'record' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('record');

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: C.bg }}>
      {/* タブコンテンツ: display切替でアンマウントさせず録音を継続 */}
      <div style={{ display: tab === 'record' ? 'block' : 'none' }}><RecordingPage /></div>
      <div style={{ display: tab === 'history' ? 'block' : 'none' }}><HistoryPage /></div>

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

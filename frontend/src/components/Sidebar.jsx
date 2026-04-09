/**
 * Sidebar Component
 * =================
 * Compact navigation sidebar with icon buttons.
 */
import React from 'react';

const icons = {
  mic: '🎤',
  midi: '🎹',
  analyze: '📊',
  theory: '🎵',
  settings: '⚙️',
  export: '📤',
};

export default function Sidebar({ activeView, onViewChange }) {
  const items = [
    { id: 'record', icon: icons.mic, label: 'Record' },
    { id: 'midi', icon: icons.midi, label: 'MIDI' },
    { id: 'analyze', icon: icons.analyze, label: 'Analysis' },
  ];

  return (
    <div id="sidebar" style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoText}>F</span>
      </div>
      <nav style={styles.nav}>
        {items.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            style={{
              ...styles.navBtn,
              ...(activeView === item.id ? styles.navBtnActive : {}),
            }}
            onClick={() => onViewChange(item.id)}
            data-tooltip={item.label}
            title={item.label}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
      <div style={styles.bottom}>
        <button style={styles.navBtn} title="Settings">
          <span style={styles.navIcon}>{icons.settings}</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 64,
    minWidth: 64,
    height: '100%',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
    zIndex: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    boxShadow: '0 0 12px var(--glow-primary)',
  },
  logoText: {
    color: '#000',
    fontWeight: 800,
    fontSize: '1rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  navBtn: {
    width: 52,
    height: 48,
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    color: 'var(--text-secondary)',
  },
  navBtnActive: {
    background: 'rgba(0, 212, 255, 0.1)',
    color: 'var(--accent-primary)',
    boxShadow: 'inset 2px 0 0 var(--accent-primary)',
  },
  navIcon: {
    fontSize: '1.2rem',
    lineHeight: 1,
  },
  navLabel: {
    fontSize: '0.55rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    lineHeight: 1.1,
  },
  bottom: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
};

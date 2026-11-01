import React from 'react';
import { Home, Clock, Trophy, Dices, User } from 'lucide-react';

export default function BottomNav({ activeNav, onNavChange }) {
  const items = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'inplay', label: 'In-Play', icon: Clock },
    { key: 'sports', label: 'Sports', icon: Trophy, isCenter: true },
    { key: 'casino', label: 'Casino', icon: Dices },
    { key: 'account', label: 'Account', icon: User }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '62px',
      background: '#243a48',
      borderTop: '1px solid #1a2832',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 1000,
      maxWidth: '500px',
      margin: '0 auto',
      boxShadow: '0 -4px 10px rgba(0,0,0,0.3)'
    }}>
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = activeNav === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onNavChange(it.key)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              flex: 1,
              position: 'relative',
              top: it.isCenter ? '-8px' : '0'
            }}
          >
            {it.isCenter ? (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#1a2832',
                border: '3px solid #243a48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? '#38bdf8' : '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)'
              }}>
                <Icon size={20} />
              </div>
            ) : (
              <Icon size={20} style={{ color: isActive ? '#38bdf8' : '#94a3b8' }} />
            )}
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              marginTop: '2px',
              color: isActive ? '#ffffff' : '#94a3b8'
            }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}


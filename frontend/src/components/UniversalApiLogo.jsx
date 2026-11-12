import React from 'react';

export default function UniversalApiLogo({ size = 'md', align = 'left', onClick }) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const iconBoxSize = isLarge ? '38px' : isSmall ? '28px' : '32px';
  const svgSize = isLarge ? 22 : isSmall ? 16 : 18;
  const titleSize = isLarge ? '17px' : isSmall ? '13px' : '15px';
  const subtitleSize = isLarge ? '10px' : isSmall ? '8px' : '9px';
  const subtitleSpacing = isLarge ? '4px' : '3px';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: isLarge ? '12px' : '10px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        textDecoration: 'none',
      }}
    >
      {/* Sleek Tomato Red Emblem with Off-White [U] & Sage Border */}
      <div
        style={{
          width: iconBoxSize,
          height: iconBoxSize,
          borderRadius: '8px',
          border: '1.5px solid #9CAF88',
          background: '#E8412C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(232, 65, 44, 0.25)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Modern geometric U path in Off-White */}
          <path
            d="M6.5 5.5V13C6.5 16.0376 8.96243 18.5 12 18.5C15.0376 18.5 17.5 16.0376 17.5 13V5.5"
            stroke="#F7F5EF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Accent Core Pip */}
          <circle cx="12" cy="10" r="1.6" fill="#F7F5EF" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            letterSpacing: '0.8px',
            color: '#1e261f',
            textTransform: 'uppercase',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            margin: 0,
            padding: 0,
          }}
        >
          UNIVERSAL
        </span>
        <span
          style={{
            fontSize: subtitleSize,
            fontWeight: 800,
            letterSpacing: subtitleSpacing,
            color: '#E8412C',
            textTransform: 'uppercase',
            marginTop: '3px',
            padding: 0,
          }}
        >
          API
        </span>
      </div>
    </div>
  );
}


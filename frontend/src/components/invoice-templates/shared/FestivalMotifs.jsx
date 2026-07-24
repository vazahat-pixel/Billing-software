import React from 'react';

/** Thin print-safe corner / border motifs — never cover text */
export function FestivalMotifs({ motif = 'marigold', accents = {}, variant = 'corners' }) {
  const primary = accents.primary || '#7f1d1d';
  const secondary = accents.secondary || '#d97706';

  if (variant === 'border') {
    return (
      <div
        aria-hidden
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${primary}, ${secondary}, ${primary})`,
          opacity: 0.85,
        }}
      />
    );
  }

  const corner = (pos) => {
    const base = {
      position: 'absolute',
      width: 28,
      height: 28,
      pointerEvents: 'none',
      opacity: 0.55,
      zIndex: 0,
    };
    if (pos === 'tl') Object.assign(base, { top: 4, left: 4 });
    if (pos === 'tr') Object.assign(base, { top: 4, right: 4, transform: 'scaleX(-1)' });
    if (pos === 'bl') Object.assign(base, { bottom: 4, left: 4, transform: 'scaleY(-1)' });
    if (pos === 'br') Object.assign(base, { bottom: 4, right: 4, transform: 'scale(-1)' });

    if (motif === 'diya') {
      return (
        <svg key={pos} style={base} viewBox="0 0 32 32" fill="none">
          <ellipse cx="16" cy="24" rx="10" ry="4" stroke={primary} strokeWidth="1.2" />
          <path d="M16 6c2 4 4 6 4 10a4 4 0 11-8 0c0-4 2-6 4-10z" fill={secondary} opacity="0.7" />
          <path d="M6 22h20" stroke={primary} strokeWidth="1" />
        </svg>
      );
    }
    if (motif === 'rangoli') {
      return (
        <svg key={pos} style={base} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="3" fill={secondary} />
          <circle cx="16" cy="16" r="8" stroke={primary} strokeWidth="1" />
          <circle cx="16" cy="16" r="12" stroke={secondary} strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>
      );
    }
    if (motif === 'toran') {
      return (
        <svg key={pos} style={base} viewBox="0 0 32 32" fill="none">
          <path d="M4 6h24" stroke={primary} strokeWidth="1.5" />
          <path d="M8 6v10l-2 4M16 6v12l-2 4M24 6v10l-2 4" stroke={secondary} strokeWidth="1.2" />
        </svg>
      );
    }
    // marigold default
    return (
      <svg key={pos} style={base} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="5" fill={secondary} opacity="0.8" />
        {[0, 45, 90, 135].map((deg) => (
          <ellipse
            key={deg}
            cx="16"
            cy="16"
            rx="3"
            ry="10"
            fill={primary}
            opacity="0.35"
            transform={`rotate(${deg} 16 16)`}
          />
        ))}
      </svg>
    );
  };

  return <>{['tl', 'tr', 'bl', 'br'].map(corner)}</>;
}

export function FestivalGreeting({ greeting, accent }) {
  if (!greeting) return null;
  return (
    <div
      style={{
        textAlign: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: accent || '#7f1d1d',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 8,
        opacity: 0.9,
      }}
    >
      ✦ {greeting} ✦
    </div>
  );
}

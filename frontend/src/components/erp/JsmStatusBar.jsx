import React, { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

/**
 * JSM's bottom status line: "| code | COMPANY | 2026-27 | SC27 | 30/10/2026 | Ver.x | 03:46 PM".
 * Blank parts are left out instead of showing empty cells.
 */
const JsmStatusBar = ({ code, company, year, path, className = '' }) => {
  const [now, setNow] = useState(() => new Date());
  const [version, setVersion] = useState('');
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.textileDesktop : null;
    if (!bridge?.version) return;
    Promise.resolve(bridge.version()).then((v) => setVersion(String(v || ''))).catch(() => {});
  }, []);
  const h = now.getHours();
  const time = `${pad(((h + 11) % 12) + 1)}:${pad(now.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const parts = [code, company && String(company).toUpperCase(), year, path, date, version && `Ver.${version}`, time]
    .filter((p) => p != null && String(p).trim() !== '');
  return (
    <div className={`erp-jsm-status ${className}`.trim()} role="status" aria-label="Company status">
      {parts.map((p, i) => (
        <span key={`${i}-${p}`} className={i === 0 ? 'erp-jsm-status__lead' : ''}>| {p} </span>
      ))}
      <span className="erp-jsm-status__dot" aria-hidden />
    </div>
  );
};

export default JsmStatusBar;

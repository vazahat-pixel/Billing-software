import React from 'react';

export const EmptyStateSVG = ({ className = "w-48 h-48 text-[var(--accent)]/10" }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="40" width="100" height="120" rx="8" fill="currentColor" opacity="0.2" />
    <path d="M50 48C50 43.5817 53.5817 40 58 40H142C146.418 40 150 43.5817 150 48V60H50V48Z" fill="currentColor" opacity="0.4" />
    <circle cx="70" cy="50" r="4" fill="var(--bg-card)" />
    <circle cx="85" cy="50" r="4" fill="var(--bg-card)" />
    <rect x="70" y="80" width="60" height="6" rx="3" fill="currentColor" opacity="0.3" />
    <rect x="70" y="100" width="40" height="6" rx="3" fill="currentColor" opacity="0.3" />
    <rect x="70" y="120" width="50" height="6" rx="3" fill="currentColor" opacity="0.3" />
    <path d="M120 140L160 180" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5"/>
    <circle cx="160" cy="180" r="8" fill="currentColor" opacity="0.8" />
  </svg>
);

export const NoSearchSVG = ({ className = "w-48 h-48 text-[var(--accent)]/10" }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="90" cy="90" r="50" stroke="currentColor" strokeWidth="8" opacity="0.3" />
    <path d="M125 125L170 170" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
    <path d="M75 75L105 105M105 75L75 105" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
    <rect x="40" y="30" width="20" height="20" rx="4" fill="currentColor" opacity="0.1" />
    <circle cx="160" cy="50" r="10" fill="currentColor" opacity="0.1" />
  </svg>
);

export const SuccessSVG = ({ className = "w-32 h-32 text-[var(--emerald)]" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.1" />
    <circle cx="50" cy="50" r="30" fill="currentColor" opacity="0.2" />
    <path d="M35 50L45 60L65 40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ErrorSVG = ({ className = "w-32 h-32 text-[var(--red)]" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.1" />
    <path d="M35 35L65 65M65 35L35 65" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

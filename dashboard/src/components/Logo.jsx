import React from 'react';

// Neutral monogram (the original build used the company logo, removed for the public repo)
export const Logo = ({ width = 40, height = 40, className = '' }) => (
  <svg width={width} height={height} viewBox="0 0 40 40" className={className} role="img" aria-label="Auto Monitoring">
    <rect x="1" y="1" width="38" height="38" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 26 L14 18 L19 23 L25 12 L32 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Logo;

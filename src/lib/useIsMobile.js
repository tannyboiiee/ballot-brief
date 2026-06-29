import { useState, useEffect } from 'react';

// Every component in this redesign uses inline style objects (no Tailwind,
// no CSS modules), which was fine for matching the Claude Design export
// pixel-for-pixel, but means there's no stylesheet to attach @media queries
// to. This hook is the workaround: components read `isMobile` and switch
// their layout (grid columns, stacking, font sizes) in JS instead.
// Breakpoint at 640px — a standard "phone vs not" cutoff.
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}

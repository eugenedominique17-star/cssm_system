import React from 'react';
import { useMediaQuery } from '@mui/material';

export default function AnimatedNumber({ value }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const [display, setDisplay] = React.useState(value);
  React.useEffect(() => {
    if (!numeric || reducedMotion) { setDisplay(value); return undefined; }
    let frame;
    let start;
    const tick = time => {
      if (start === undefined) start = time;
      const progress = Math.min((time - start) / 650, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, numeric, reducedMotion]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}><span className="sr-only">{value}</span><span aria-hidden="true">{display}</span></span>;
}

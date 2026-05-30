interface SparklineProps {
  data?: number[];
}

export const Sparkline = ({ data }: SparklineProps) => {
  const points = data && data.length > 0 ? data : Array.from({ length: 30 }, () => 0);
  const max = Math.max(...points, 1);
  const width = 200;
  const height = 60;
  const padding = 4;

  const coords = points.map((val, i) => ({
    x: (i / (points.length - 1)) * width,
    y: height - padding - ((val / max) * (height - padding * 2)),
  }));

  // Build smooth path
  const linePath = coords.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }).join(' ');

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const lastPoint = coords[coords.length - 1];

  return (
    <svg width="100%" height="60" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(168, 85, 247, 0.2)" />
          <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-gradient)" />
      <path
        d={linePath}
        fill="none"
        stroke="#a855f7"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="5" fill="white" stroke="#a855f7" strokeWidth="2" />
      )}
    </svg>
  );
};

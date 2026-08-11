export function ClockIllustration(props: React.SVGProps<SVGSVGElement>) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180
    const outer = 178
    const inner = i % 3 === 0 ? 156 : 166
    const x1 = 200 + outer * Math.sin(angle)
    const y1 = 200 - outer * Math.cos(angle)
    const x2 = 200 + inner * Math.sin(angle)
    const y2 = 200 - inner * Math.cos(angle)
    return { x1, y1, x2, y2 }
  })

  return (
    <svg viewBox='0 0 400 400' fill='none' {...props}>
      <circle cx='200' cy='200' r='190' stroke='currentColor' strokeWidth='2' />
      <circle cx='200' cy='200' r='160' stroke='currentColor' strokeWidth='1' />
      {ticks.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke='currentColor'
          strokeWidth={i % 3 === 0 ? 4 : 2}
          strokeLinecap='round'
        />
      ))}
      {/* hour hand */}
      <line
        x1='200'
        y1='200'
        x2='150'
        y2='130'
        stroke='currentColor'
        strokeWidth='8'
        strokeLinecap='round'
      />
      {/* minute hand */}
      <line
        x1='200'
        y1='200'
        x2='285'
        y2='150'
        stroke='currentColor'
        strokeWidth='6'
        strokeLinecap='round'
      />
      {/* second hand */}
      <line
        x1='200'
        y1='200'
        x2='200'
        y2='70'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <circle cx='200' cy='200' r='10' fill='currentColor' />
    </svg>
  )
}

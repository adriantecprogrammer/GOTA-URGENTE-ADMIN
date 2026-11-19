const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

export function timeAgo(ts: number, now = Date.now()) {
  const min = Math.round((ts - now) / 6e4)
  if (min > -60) return rtf.format(min, 'minute')
  const h = Math.round(min / 60)
  if (h > -24) return rtf.format(h, 'hour')
  return rtf.format(Math.round(h / 24), 'day')
}

export const fmtCoords = (p: { lat: number, lng: number }) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`

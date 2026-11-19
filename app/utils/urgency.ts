// Urgency and grouping are computed by the API; these are the shared enums and their display copy.
export type Severity = 'goteo' | 'chorro' | 'inundacion'
export type Status = 'pendiente' | 'en_atencion' | 'resuelta' | 'descartada'
export type Level = 'critica' | 'alta' | 'media' | 'baja'

export const isOpen = (s: Status) => s === 'pendiente' || s === 'en_atencion'

export const SEVERITY: Record<Severity, { label: string, icon: string }> = {
  goteo: { label: 'Goteo', icon: 'i-lucide-droplet' },
  chorro: { label: 'Chorro', icon: 'i-lucide-droplets' },
  inundacion: { label: 'Inundación', icon: 'i-lucide-waves' }
}

/** `step`: how far along the repair is, out of 3. Drawn as filled drops by StatusSteps. */
export const STATUS: Record<Status, { label: string, step: 0 | 1 | 2 | 3 }> = {
  pendiente: { label: 'Pendiente', step: 1 },
  en_atencion: { label: 'En atención', step: 2 },
  resuelta: { label: 'Resuelta', step: 3 },
  descartada: { label: 'Descartada', step: 0 }
}

export const LEVEL: Record<Level, { label: string, hex: string }> = {
  critica: { label: 'Crítica', hex: '#DE1135' },
  alta: { label: 'Alta', hex: '#F56A00' },
  // Colour means "act on this": only the top two levels get one. The rest share the brand ink.
  media: { label: 'Media', hex: '#002F59' },
  baja: { label: 'Baja', hex: '#002F59' }
}

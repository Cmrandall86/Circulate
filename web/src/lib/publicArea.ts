/** Trim, collapse whitespace, and title-case segments (ADR 0001). */
export function normalizePublicArea(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  return trimmed
    .split(/(\s|,)/)
    .map((part) => {
      if (part === ' ' || part === ',') return part
      if (!part) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join('')
}

/** Item override wins; otherwise inherit owner profile public area. */
export function resolveItemPublicArea(
  itemOverride: string | null | undefined,
  ownerPublicArea: string | null | undefined,
): string | null {
  const override = itemOverride?.trim()
  if (override) return override
  const inherited = ownerPublicArea?.trim()
  return inherited || null
}

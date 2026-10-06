/**
 * Reine Helfer für die Kontenverwaltung (Server und Client nutzbar).
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 10

/** Liefert eine Fehlermeldung oder null, wenn das Passwort ok ist. */
export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
  }
  if (pw.length > 72) return "Das Passwort darf höchstens 72 Zeichen haben."
  return null
}

/** Zufallspasswort ohne verwechselbare Zeichen (kein 0/O, 1/l/I). */
export function generatePassword(length = 16): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

export type AccountKind = "team_owner" | "member" | "single"

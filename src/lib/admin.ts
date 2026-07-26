// Admin (developer) mode: unlock every sector, ignore all damage.
//
// This is a client-side cheat switch, not a security boundary — the password
// ships in the bundle and anyone can read it. It exists to keep the mode out of
// the way of ordinary players, nothing more. Admin runs are never submitted to
// the leaderboard.

export const ADMIN_PASSWORD = 'dagoat'

const KEY = 'cosmic-crusade-admin'

export function loadAdmin(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveAdmin(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // ignore quota / private-mode errors
  }
}

export function checkPassword(input: string): boolean {
  return input.trim().toLowerCase() === ADMIN_PASSWORD
}

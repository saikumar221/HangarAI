import { getStoredUser, type StoredUser } from '../api/auth'

export function useUser(): StoredUser | null {
  return getStoredUser()
}

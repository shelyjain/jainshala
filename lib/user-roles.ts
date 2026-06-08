export type UserRole = 'user' | 'admin';

export const DEFAULT_ROLES: UserRole[] = ['user'];

export function isAdminRole(roles: string[] | undefined | null): boolean {
  return Array.isArray(roles) && roles.includes('admin');
}

export function normalizeRoles(roles: unknown): UserRole[] {
  if (!Array.isArray(roles)) return [...DEFAULT_ROLES];
  const valid = roles.filter((r): r is UserRole => r === 'user' || r === 'admin');
  return valid.length > 0 ? valid : [...DEFAULT_ROLES];
}

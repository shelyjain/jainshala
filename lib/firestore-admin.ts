import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isFirestorePermissionError } from './firestore-user';
import { DEFAULT_ROLES, normalizeRoles, type UserRole } from './user-roles';
import {
  grantAdminViaApi,
  listUsersViaApi,
  revokeAdminViaApi,
  type AdminUserRow,
} from './admin-api';

export type { AdminUserRow };

export async function listUsersForAdmin(): Promise<AdminUserRow[] | null> {
  try {
    const fromApi = await listUsersViaApi();
    return fromApi.map(row => ({
      ...row,
      roles: normalizeRoles(row.roles),
    }));
  } catch (apiErr) {
    console.warn('[Admin] API user list failed, trying Firestore:', apiErr);
  }

  try {
    const snap = await getDocs(collection(db, 'users'));
    const rows: AdminUserRow[] = snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        email: String(data.email ?? ''),
        displayName: String(data.displayName ?? ''),
        roles: normalizeRoles(data.roles),
      };
    });
    rows.sort((a, b) => a.email.localeCompare(b.email) || a.displayName.localeCompare(b.displayName));
    return rows;
  } catch (err: unknown) {
    if (isFirestorePermissionError(err)) return null;
    throw err;
  }
}

export async function setUserRoles(uid: string, roles: UserRole[]): Promise<boolean> {
  const safe = roles.includes('user') ? roles : (['user', ...roles] as UserRole[]);
  try {
    await setDoc(doc(db, 'users', uid), { roles: safe }, { merge: true });
    return true;
  } catch (err: unknown) {
    if (!isFirestorePermissionError(err)) throw err;
  }
  return false;
}

export async function grantAdminRole(uid: string): Promise<boolean> {
  try {
    await grantAdminViaApi(uid);
    return true;
  } catch (apiErr) {
    console.warn('[Admin] API grant failed, trying Firestore:', apiErr);
  }
  return setUserRoles(uid, ['user', 'admin']);
}

export async function revokeAdminRole(uid: string): Promise<boolean> {
  try {
    await revokeAdminViaApi(uid);
    return true;
  } catch (apiErr) {
    console.warn('[Admin] API revoke failed, trying Firestore:', apiErr);
  }
  return setUserRoles(uid, [...DEFAULT_ROLES]);
}

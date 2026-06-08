import { auth } from './firebase';
import { API_URL } from '../constants/api';

async function adminAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  roles: string[];
};

export async function listUsersViaApi(): Promise<AdminUserRow[]> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_URL}/admin/users`, { headers });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function grantAdminViaApi(uid: string): Promise<void> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_URL}/admin/users/${uid}/grant-admin`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function revokeAdminViaApi(uid: string): Promise<void> {
  const headers = await adminAuthHeaders();
  const res = await fetch(`${API_URL}/admin/users/${uid}/revoke-admin`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

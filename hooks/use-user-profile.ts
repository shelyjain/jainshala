import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import { subscribeUserDoc } from '../lib/firestore-user';
import { isAdminRole, normalizeRoles, type UserRole } from '../lib/user-roles';

export function useUserProfile() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setPermissionDenied(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPermissionDenied(false);

    const unsubscribe = subscribeUserDoc(user.uid, (data, error) => {
      if (error === 'permission') {
        setPermissionDenied(true);
        setRoles([]);
        setLoading(false);
        return;
      }
      setPermissionDenied(false);
      setRoles(normalizeRoles(data?.roles));
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, refreshKey]);

  return {
    roles,
    isAdmin: isAdminRole(roles),
    loading,
    permissionDenied,
    refresh,
  };
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { getUserDocSafe, mergeUserDoc } from '../lib/firestore-user';
import { DEFAULT_ROLES } from '../lib/user-roles';
import { completeGoogleRedirectSignIn } from '../lib/google-sign-in';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  syncUserProfile: (user: User) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    const saved = await mergeUserDoc(credential.user.uid, {
      email,
      displayName,
      createdAt: serverTimestamp(),
      roles: DEFAULT_ROLES,
      completedSutras: [],
      progressDetails: {},
    });
    if (!saved) {
      throw new Error(
        'Account created but cloud sync is blocked. In Firebase Console → Firestore → Rules, allow users/{userId} for signed-in users, then try again.'
      );
    }
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const syncUserProfile = async (firebaseUser: User): Promise<boolean> => {
    const profileFields = {
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? '',
      photoURL: firebaseUser.photoURL ?? '',
    };

    const snap = await getUserDocSafe(firebaseUser.uid);
    const docExists = snap?.exists() ?? false;

    const saved = await mergeUserDoc(
      firebaseUser.uid,
      docExists
        ? profileFields
        : {
            ...profileFields,
            createdAt: serverTimestamp(),
            roles: DEFAULT_ROLES,
            completedSutras: [],
            progressDetails: {},
          },
    );

    return saved;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    void (async () => {
      try {
        const result = await completeGoogleRedirectSignIn();
        if (result?.user) {
          await syncUserProfile(result.user);
        }
      } catch (error) {
        console.error('Google redirect sign-in failed:', error);
      }
    })();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, syncUserProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

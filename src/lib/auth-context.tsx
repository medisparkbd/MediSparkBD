"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";import {
  fetchEnrollments,
  isActiveEnrollment,
  type Enrollment,
} from "./enrollments";

export type StudentProfile = {
  uid: string;
  studentId: string;
  fullName: string;
  gender: string;
  institution: string;
  hscBatch: string;
  studentLevel?: string;
  contactNumber: string;
  email: string;
  facebookUrl: string;
  profilePictureUrl: string;
  provider: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type StudentAccess = {
  registered: boolean;
  hasEnrollment: boolean;
  hasPaidEnrollment: boolean;
};

type AuthContextValue = {
  user: User | null;
  profile: StudentProfile | null;
  enrollments: Enrollment[];
  access: StudentAccess;
  authLoading: boolean;
  profileLoading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<StudentProfile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshEnrollments: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(user: User): Promise<StudentProfile | null> {
  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { profile?: StudentProfile | null };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadUserData = useCallback(async (firebaseUser: User) => {
    setProfileLoading(true);
    const [studentProfile, studentEnrollments] = await Promise.all([
      fetchProfile(firebaseUser),
      fetchEnrollments(firebaseUser),
    ]);
    setProfile(studentProfile);
    setEnrollments(studentEnrollments);
    setProfileLoading(false);
    return studentProfile;
  }, []);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — clear the initial loading state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (!firebaseUser) {
        setProfile(null);
        setEnrollments([]);
        setProfileLoading(false);
        return;
      }
      await loadUserData(firebaseUser);
    });

    // Process a completed redirect sign-in. The page reloads after Google
    // returns, so this must run on mount (not only from the button handler)
    // to complete the sign-in.
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setAuthLoading(false);
          void loadUserData(result.user);
        }
      })
      .catch((err) => {
        console.error("[auth] getRedirectResult failed:", err);
        // Surface redirect errors to the UI instead of silent fail
        const msg =
          err instanceof Error ? err.message : String(err ?? "Unknown error");
        // Store for LoginClient to show — use sessionStorage to survive the redirect
        try {
          sessionStorage.setItem("medispark:auth-redirect-error", msg);
        } catch {}
      });

    return unsubscribe;
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    const studentProfile = await fetchProfile(user);
    setProfile(studentProfile);
    setProfileLoading(false);
  }, [user]);

  const refreshEnrollments = useCallback(async () => {
    if (!user) {
      setEnrollments([]);
      return;
    }
    const studentEnrollments = await fetchEnrollments(user);
    setEnrollments(studentEnrollments);
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      throw new Error("Firebase authentication is not configured.");
    }
    // Try a popup first (fast, no page reload). Some desktop browsers block
    // the popup's third-party storage/cookies, in which case the popup
    // promise NEVER settles (no resolve, no reject) and the UI would hang
    // on "Signing in..." forever. Race it against a timeout so a hung popup
    // falls back to full-page redirect, which uses top-level navigation and
    // works even with third-party cookies blocked. Redirect completion is
    // handled by getRedirectResult + onAuthStateChanged on mount above.
    const POPUP_TIMEOUT_MS = 60_000;
    let popupTimer: ReturnType<typeof setTimeout> | null = null;
    const popupTimeout = new Promise<never>((_, reject) => {
      popupTimer = setTimeout(
        () => reject({ code: "auth/popup-timeout" }),
        POPUP_TIMEOUT_MS,
      );
    });
    try {
      const result = await Promise.race([
        signInWithPopup(auth, googleProvider),
        popupTimeout,
      ]);
      setUser(result.user);
      setAuthLoading(false);
      // loadUserData already fetches the profile — reuse it instead of a
      // second /api/me round-trip.
      return loadUserData(result.user);
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/web-storage-unsupported" ||
        code === "auth/internal-error" ||
        code === "auth/network-request-failed" ||
        code === "auth/popup-timeout"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      if (code === "auth/popup-closed-by-user") {
        throw new Error("Login popup closed before completing. Please try again.");
      }
      throw err;
    } finally {
      if (popupTimer) clearTimeout(popupTimer);
    }
  }, [loadUserData]);

  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
    setEnrollments([]);
  }, []);

const access = useMemo<StudentAccess>(() => {
    const activeEnrollments = enrollments.filter(isActiveEnrollment);
    return {
      registered: profile !== null,
      hasEnrollment: activeEnrollments.length > 0,
      hasPaidEnrollment: activeEnrollments.some(
        (enrollment) => enrollment.courseKind === "paid",
      ),
    };
  }, [profile, enrollments]);

  const value = useMemo(
    () => ({
      user,
      profile,
      enrollments,
      access,
      authLoading,
      profileLoading,
      configured: isFirebaseConfigured,
      signInWithGoogle,
      logout,
      refreshProfile,
      refreshEnrollments,
    }),
    [
      user,
      profile,
      enrollments,
      access,
      authLoading,
      profileLoading,
      signInWithGoogle,
      logout,
      refreshProfile,
      refreshEnrollments,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
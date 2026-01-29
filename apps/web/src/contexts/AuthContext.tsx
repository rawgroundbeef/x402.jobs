"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import useSWR from "swr";
import { supabase } from "../lib/supabase";
import { authenticatedFetcher } from "../lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    username?: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check admin status using SWR for proper caching
  const { data: authMeData } = useSWR<{ isAdmin?: boolean }>(
    session ? "/auth/me" : null,
    authenticatedFetcher,
    { dedupingInterval: 60000 }, // Dedupe for 60 seconds
  );

  // Update isAdmin when authMeData changes
  useEffect(() => {
    setIsAdmin(authMeData?.isAdmin ?? false);
  }, [authMeData]);

  const signInWithGoogle = async () => {
    try {
      // Clear any existing session to prevent OAuth conflicts
      await supabase.auth.signOut();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.error("Google sign in error:", error);
        throw error;
      }
    } catch (err) {
      console.error("Failed to connect to Google:", err);
      throw err;
    }
  };

  const signInWithTwitter = async () => {
    try {
      // Clear any existing session to prevent OAuth conflicts
      await supabase.auth.signOut();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "twitter",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("Twitter sign in error:", error);
        throw error;
      }
    } catch (err) {
      console.error("Failed to connect to Twitter:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    username?: string,
  ) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: username
            ? {
                username: username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
              }
            : undefined,
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Supabase signOut error:", err);
    }

    // Manually clear Supabase auth tokens from localStorage as a fallback
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("-auth-token"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (err) {
      console.error("Failed to clear localStorage:", err);
    }

    setSession(null);
    setUser(null);
    window.location.href = "/";
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signInWithGoogle,
    signInWithTwitter,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return default values for SSR compatibility
    return {
      user: null,
      session: null,
      loading: true,
      isAdmin: false,
      signInWithGoogle: async () => {},
      signInWithTwitter: async () => {},
      signInWithEmail: async () => ({ error: null }),
      signUpWithEmail: async (_e: string, _p: string, _u?: string) => ({
        error: null,
      }),
      signOut: async () => {},
    };
  }
  return context;
}

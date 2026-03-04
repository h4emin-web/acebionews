import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (name: string) => {
    const email = `${name.toLowerCase().replace(/[^a-z0-9가-힣]/g, "")}@bionews.local`;
    // Try sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: "1234" });
    if (!signInError) return { success: true };
    // If user doesn't exist, sign up
    if (signInError.message.includes("Invalid login")) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password: "1234" });
      if (signUpError) return { success: false, error: signUpError.message };
      return { success: true };
    }
    return { success: false, error: signInError.message };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, login, logout };
}

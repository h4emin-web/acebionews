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
    const sanitized = Array.from(name).map(c => c.charCodeAt(0)).join('');
    const email = `u${sanitized}@bionews.local`;
    const password = `bio_${sanitized}_pass`;
    // Try sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      await supabase.auth.updateUser({ data: { display_name: name } });
      return { success: true };
    }
    // If user doesn't exist, sign up
    if (signInError.message.includes("Invalid login")) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      if (signUpError) return { success: false, error: signUpError.message };
      return { success: true };
    }
    return { success: false, error: signInError.message };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "";

  return { user, loading, login, logout, displayName };
}

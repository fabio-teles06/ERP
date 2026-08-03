import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

export function useSupabase() {
    const { getToken } = useAuth();

    return useMemo(() => {
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
            global: {
                fetch: async (url, options = {}) => {
                    const clerkToken = await getToken({ template: "supabase" });

                    const headers = new Headers(options?.headers);
                    if (clerkToken) {
                        headers.set("Authorization", `Bearer ${clerkToken}`);
                    }

                    return fetch(url, {
                        ...options,
                        headers,
                    })
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            }
        })
    }, [getToken]);
}
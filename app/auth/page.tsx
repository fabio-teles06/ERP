import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Loading from "./loading";


export default async function Page() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const currentUser = await supabase.auth.getUser();
    const loggedIn = currentUser.data.user != null;
    
    return (
        <div>

            <Suspense fallback={<Loading />}>
                <p>{loggedIn ? "Verdadeiro" : "Falso"}</p>
                {loggedIn && <p>
                    {JSON.stringify(currentUser.data)}
                </p>}
            </Suspense>
        </div>
    )
}
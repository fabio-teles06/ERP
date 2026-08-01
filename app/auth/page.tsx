import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";


export default async function Page() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const currentUser = await supabase.auth.getUser();
    const loggedIn = currentUser.data.user != null;

    return (
        <div>
            <p>{loggedIn ? "Verdadeiro" : "Falso"}</p>

            {loggedIn && <p>
                {JSON.stringify(currentUser.data)}
            </p>}
        </div>
    )
}
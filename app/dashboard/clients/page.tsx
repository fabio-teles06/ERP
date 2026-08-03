import { auth } from "@clerk/nextjs/server"


export default async function () {
    const { getToken } = await auth.protect();

    async function load() {
        const token = await getToken({ template: "supabase" });

        console.log("Token: ", token);
    }

    await load();

    return (
        <>
            <h1>T</h1>
        </>
    )
}
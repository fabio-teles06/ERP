import { SignIn } from "@clerk/nextjs";


export default async function Login() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
            <h1 className="text-2xl font-bold">Welcome to the App</h1>
            <SignIn />
        </div>
    )
}
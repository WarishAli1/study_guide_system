"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { SessionProvider } from "@/lib/session-store";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
                <SessionProvider>
                    <Toaster position="top-right" />
                    {children}
                </SessionProvider>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}
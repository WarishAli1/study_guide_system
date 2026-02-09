"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "react-hot-toast";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
                {children}
                <Toaster position="bottom-right" />
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}
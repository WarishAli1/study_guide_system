"use client";

import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { SessionProvider } from "@/lib/session-store";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SessionProvider>
                <Toaster position="top-right" />
                {children}
            </SessionProvider>
        </AuthProvider>
    );
}
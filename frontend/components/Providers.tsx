"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace-store";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
                <WorkspaceProvider>
                    <Toaster position="top-right" />
                    {children}
                </WorkspaceProvider>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}
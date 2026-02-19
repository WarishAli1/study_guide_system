"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";
import { BookOpen } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
    const { login, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && isAuthenticated) router.replace("/dashboard");
    }, [isAuthenticated, isLoading, router]);

    const handleSuccess = async (credentialResponse: any) => {
        try {
            await login(credentialResponse.credential);
            toast.success("Welcome!");
            router.push("/dashboard");
        } catch {
            toast.error("Login failed. Please try again.");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <BookOpen className="w-6 h-6 text-neutral-900" />
                        <span className="text-xl font-bold text-neutral-900">ExamGuide</span>
                    </div>
                    <h1 className="text-lg font-semibold text-neutral-900 mb-1">Sign in</h1>
                    <p className="text-sm text-neutral-500">
                        Continue to your study sessions
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleSuccess}
                            onError={() => toast.error("Google sign-in failed")}
                            theme="outline"
                            size="large"
                            text="continue_with"
                            shape="rectangular"
                        />
                    </div>
                    <p className="text-[11px] text-neutral-400 text-center mt-5">
                        By signing in you agree to let ExamGuide process the documents you
                        upload for study-guide generation.
                    </p>
                </div>
            </div>
        </div>
    );
}
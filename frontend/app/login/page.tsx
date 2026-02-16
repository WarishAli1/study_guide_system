"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";
import { BookOpen, FileText, BarChart3, MessageSquare } from "lucide-react";
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
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white flex-col justify-center px-16">
                <div className="max-w-md">
                    <div className="flex items-center gap-3 mb-8">
                        <BookOpen className="w-10 h-10" />
                        <span className="text-3xl font-bold tracking-tight">ExamGuide</span>
                    </div>

                    <h2 className="text-4xl font-extrabold leading-tight mb-6">
                        Study smarter,<br />not harder.
                    </h2>

                    <p className="text-indigo-200 text-lg mb-10">
                        Upload your syllabus, notes and past papers — let AI pinpoint
                        exactly what to focus on.
                    </p>

                    <div className="space-y-5">
                        {[
                            {
                                icon: <FileText className="w-5 h-5" />,
                                text: "Intelligent document analysis",
                            },
                            {
                                icon: <BarChart3 className="w-5 h-5" />,
                                text: "Topic importance ranking",
                            },
                            {
                                icon: <MessageSquare className="w-5 h-5" />,
                                text: "Chat with your materials via RAG",
                            },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-indigo-100">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10">
                                    {item.icon}
                                </div>
                                <span>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-16">
                <div className="w-full max-w-md">
                    <div className="flex items-center gap-2 mb-10 lg:hidden">
                        <BookOpen className="w-7 h-7 text-indigo-600" />
                        <span className="text-2xl font-bold text-gray-900">ExamGuide</span>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-2xl mb-4 lg:hidden">
                                <BookOpen className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                            <p className="text-gray-500 mt-1 text-sm">
                                Sign in to continue to ExamGuide
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleSuccess}
                                onError={() => toast.error("Google sign-in failed")}
                                theme="outline"
                                size="large"
                                text="continue_with"
                                shape="pill"
                            />
                        </div>

                        <p className="text-xs text-gray-400 text-center mt-8">
                            By signing in you agree to let ExamGuide process the documents you
                            upload for study-guide generation.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
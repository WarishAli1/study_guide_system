"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";
import { BookOpen, FileText, BarChart3, CircleHelp } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
    const { login, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && isAuthenticated) router.replace("/dashboard");
    }, [isAuthenticated, isLoading, router]);

    const handleGoogleLogin = useGoogleLogin({
        flow: "implicit",
        onSuccess: async (tokenResponse) => {
            try {
                await login(tokenResponse.access_token);
                toast.success("Welcome!");
                router.push("/dashboard");
            } catch {
                toast.error("Login failed. Please try again.");
            }
        },
        onError: () => {
            toast.error("Google sign-in failed");
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFF]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full bg-[#F8FAFF] flex items-center justify-center px-4 py-12">

            {/* Centered card */}
            <div className="w-full max-w-4xl rounded-2xl border border-blue-100 shadow-xl shadow-blue-50 overflow-hidden flex min-h-[520px]">

                {/* Left: Login */}
                <div className="flex flex-col justify-center w-full lg:w-[420px] shrink-0 px-10 py-12 bg-white relative">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5 mb-10 relative">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-base font-bold text-slate-900 tracking-tight">ExamGuide</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8 relative">
                        <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-widest mb-2">
                            Get started free
                        </p>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug mb-2">
                            Study smarter,<br />
                            <span className="text-blue-600">not harder.</span>
                        </h1>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Sign in to access your sessions, study guides, and past paper analysis.
                        </p>
                    </div>

                    {/* Google Button */}
                    <button
                        type="button"
                        onClick={() => handleGoogleLogin()}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200
                            bg-white px-4 py-3 text-sm font-medium text-slate-700
                            hover:bg-blue-50 hover:border-blue-200
                            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2
                            transition-all shadow-sm mb-4"
                    >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="flex-1 text-center">Continue with Google</span>
                    </button>

                    <p className="text-center text-[11px] text-slate-300 leading-relaxed">
                        By signing in, you agree to let ExamGuide<br />process the documents you upload.
                    </p>
                </div>

                {/* Right: Visual panel */}
                <div className="hidden lg:flex flex-1 flex-col justify-between border-l border-blue-100 px-10 py-12 relative overflow-hidden"
                    style={{ background: "linear-gradient(145deg, #eff6ff 0%, #f8faff 60%, #eef2ff 100%)" }}
                >
                    {/* Feature list */}
                    <div className="relative space-y-3 my-auto">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-5">What you get</p>

                        <FeatureRow
                            icon={<FileText className="w-3.5 h-3.5 text-blue-500" />}
                            iconBg="bg-blue-50 border-blue-100"
                            title="Study Guide"
                            desc="Chapter priorities, credit hours & key topics"
                        />
                        <FeatureRow
                            icon={<BarChart3 className="w-3.5 h-3.5 text-amber-500" />}
                            iconBg="bg-amber-50 border-amber-100"
                            title="Past Paper Analysis"
                            desc="Frequency-ranked questions from real exams"
                        />
                        <FeatureRow
                            icon={<CircleHelp className="w-3.5 h-3.5 text-violet-500" />}
                            iconBg="bg-violet-50 border-violet-100"
                            title="Auto Quiz"
                            desc="MCQs generated from your own notes"
                        />
                        <FeatureRow
                            icon={<BookOpen className="w-3.5 h-3.5 text-emerald-500" />}
                            iconBg="bg-emerald-50 border-emerald-100"
                            title="Document Chat"
                            desc="Ask questions, get cited answers"
                        />
                    </div>

                    {/* Bottom quote */}
                    <div className="relative">
                        <p className="text-xs text-slate-300 italic">
                            "Built for students who value their time."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureRow({
    icon,
    iconBg,
    title,
    desc,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    desc: string;
}) {
    return (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white border border-blue-50 shadow-sm shadow-blue-50/50">
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">{title}</p>
                <p className="text-[11px] text-slate-400 truncate">{desc}</p>
            </div>
        </div>
    );
}
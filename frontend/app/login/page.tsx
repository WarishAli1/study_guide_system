import { BookOpen, BrainCircuit, MessageSquareText, FileSearch } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function LoginPage() {
    return (
        <div className="min-h-dvh w-full lg:grid lg:grid-cols-12">
            <div className="hidden lg:flex lg:col-span-7 flex-col justify-between bg-zinc-950 px-14 py-14 text-white">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
                        <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-medium tracking-tight">ExamGuide</span>
                </div>

                <div className="mx-auto w-full max-w-xl">
                    <div className="space-y-10">
                        <div className="space-y-5">
                            <h1 className="tracking-tight leading-tight">
                                <span style={{ fontFamily: '"Instrument Serif", serif' }} className="italic block text-5xl">
                                    Study Smarter,
                                </span>
                                <span style={{ fontFamily: '"Instrument Serif", serif' }} className="block text-5xl text-zinc-500">
                                    Not Harder
                                </span>
                            </h1>

                            <p className="max-w-prose text-zinc-400 text-base leading-relaxed">
                                Upload your course materials and let our AI build a personalized study plan
                                that optimizes your preparation time.
                            </p>
                        </div>

                        <div className="grid gap-3">
                            <FeatureItem
                                icon={<FileSearch className="w-5 h-5" />}
                                title="Intelligent Document Analysis"
                                desc="We extract and organize key concepts automatically."
                            />
                            <FeatureItem
                                icon={<BrainCircuit className="w-5 h-5" />}
                                title="High-Priority Topic Detection"
                                desc="Focus on chapters with the highest exam weightage."
                            />
                            <FeatureItem
                                icon={<MessageSquareText className="w-5 h-5" />}
                                title="Interactive Document Chat"
                                desc="Ask questions directly to your PDF documents."
                            />
                        </div>
                    </div>
                </div>

                <div className="text-sm text-zinc-600">
                    Built for students who value their time.
                </div>
            </div>

            <div className="lg:col-span-5 flex min-h-dvh flex-col justify-center bg-white px-8 py-14 sm:px-12 lg:px-16">
                <div className="mx-auto w-full max-w-md">
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                                Get started
                            </h2>
                            <p className="text-sm text-gray-500">
                                Sign in to access your study sessions
                            </p>
                        </div>

                        <div className="space-y-6">
                            <button
                                type="button"
                                className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </button>

                            <p className="text-center text-xs text-gray-500">
                                By signing in you agree to let ExamGuide process the documents you upload.
                            </p>

                            <div className="flex justify-center">
                                <Link href="#" className="text-xs text-gray-400 hover:text-gray-600">
                                    New here? Sign in to create your first session &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureItem({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
    return (
        <div className="flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-white/5">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800">
                {icon}
            </div>
            <div className="space-y-1">
                <h3 className="text-zinc-200 font-medium text-sm leading-5">{title}</h3>
                <p className="text-zinc-500 text-sm leading-5">{desc}</p>
            </div>
        </div>
    );
}
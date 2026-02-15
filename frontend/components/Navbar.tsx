"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { BookOpen, Upload, LogOut } from "lucide-react";

export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();
    const router = useRouter();

    if (!isAuthenticated) return null;

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <nav className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/upload" className="flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    <span className="text-xl font-bold text-gray-900">ExamGuide</span>
                </Link>

                <div className="flex items-center gap-6">
                    <Link
                        href="/upload"
                        className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600 transition-colors text-sm font-medium"
                    >
                        <Upload className="w-4 h-4" />
                        Upload
                    </Link>

                    <div className="flex items-center gap-3">
                        {user?.picture && (
                            <img
                                src={user.picture}
                                alt={user.name}
                                className="w-8 h-8 rounded-full"
                                referrerPolicy="no-referrer"
                            />
                        )}
                        <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                            {user?.name}
                        </span>
                        <button
                            onClick={handleLogout}
                            title="Sign out"
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useSessionStore } from "@/lib/session-store";
import Sidebar from "@/components/Sidebar";
import CreateSessionModal from "@/components/CreateSessionModal";
import { Menu } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const { sidebarOpen, toggleSidebar } = useSessionStore();
    const router = useRouter();
    const [ssModalOpen, setSsModalOpen] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.replace("/login");
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="h-screen flex overflow-hidden bg-white">
            <Sidebar onCreateSession={() => setSsModalOpen(true)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="bg-white border-b border-neutral-100 px-4 py-2 flex items-center">
                    <button
                        onClick={toggleSidebar}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-500"
                        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>

            <CreateSessionModal
                open={ssModalOpen}
                onClose={() => setSsModalOpen(false)}
            />
        </div>
    );
}
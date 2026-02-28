"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useSessionStore, type SessionView } from "@/lib/session-store";
import Sidebar from "@/components/Sidebar";
import CreateSessionModal from "@/components/CreateSessionModal";
import { Menu, ChevronRight } from "lucide-react";

const VIEW_LABELS: Record<SessionView, string> = {
    dashboard: "Dashboard",
    documents: "Documents",
    chat: "Chat",
    guide: "Study Guide",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const {
        sidebarOpen,
        toggleSidebar,
        activeView,
        activeConversationId,
        getActiveSession,
        getActiveConversation,
    } = useSessionStore();
    const router = useRouter();
    const [ssModalOpen, setSsModalOpen] = useState(false);

    const activeSession = getActiveSession();
    const activeConv = getActiveConversation();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.replace("/login");
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        const handler = () => setSsModalOpen(true);
        window.addEventListener("open-create-session-modal", handler);
        return () => window.removeEventListener("open-create-session-modal", handler);
    }, []);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-200/25">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="h-screen flex overflow-hidden bg-neutral-200/25">
            <Sidebar onCreateSession={() => setSsModalOpen(true)} />
            <div
                className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-white
          rounded-tl-2xl rounded-tr-2xl shadow-xl
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "ml-0" : "ml-2 lg:ml-2"}
          mr-2 mt-2`}
                style={{
                    boxShadow: "0 -4px 30px rgba(0, 0, 0, 0.07), 0 0 12px rgba(0, 0, 0, 0.03)",
                }}
            >
                <div className="bg-white rounded-tl-2xl rounded-tr-2xl px-4 py-2 flex items-center gap-2 shrink-0 border-b border-none">
                    <button
                        onClick={toggleSidebar}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-500"
                        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <Menu className="w-4 h-4" />
                    </button>

                    {activeSession && (
                        <div className="flex items-center gap-1.5 text-sm ml-1 min-w-0">
                            <span className="font-medium text-neutral-900 truncate max-w-[200px]">
                                {activeSession.name}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                            <span className="text-neutral-500 shrink-0">
                                {VIEW_LABELS[activeView]}
                            </span>
                            {activeView === "chat" && activeConv && activeConv.title !== "New Chat" && (
                                <>
                                    <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                                    <span className="text-neutral-400 truncate max-w-[200px]">
                                        {activeConv.title}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <main className="flex-1 overflow-hidden min-h-0">{children}</main>
            </div>

            <CreateSessionModal
                open={ssModalOpen}
                onClose={() => setSsModalOpen(false)}
            />
        </div>
    );
}
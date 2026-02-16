"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWorkspaceStore } from "@/lib/workspace-store";
import Sidebar from "@/components/Sidebar";
import CreateWorkspaceModal from "@/components/CreateWorkspaceModal";
import CreateSessionModal from "@/components/CreateSessionModal";
import { Menu } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const { sidebarOpen, toggleSidebar, activeWorkspaceId } = useWorkspaceStore();
    const router = useRouter();

    const [wsModalOpen, setWsModalOpen] = useState(false);
    const [ssModalOpen, setSsModalOpen] = useState(false);
    const [ssTargetWorkspace, setSsTargetWorkspace] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.replace("/login");
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
        );
    }

    const handleCreateSession = (workspaceId: string) => {
        setSsTargetWorkspace(workspaceId);
        setSsModalOpen(true);
    };

    return (
        <div className="h-screen flex overflow-hidden bg-gray-50">
            <Sidebar
                onCreateWorkspace={() => setWsModalOpen(true)}
                onCreateSession={handleCreateSession}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 lg:px-6 shrink-0">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="h-5 w-px bg-gray-200" />
                    <span className="text-sm text-gray-500">
                        {activeWorkspaceId ? "Workspace" : "Dashboard"}
                    </span>
                </div>

                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>

            <CreateWorkspaceModal open={wsModalOpen} onClose={() => setWsModalOpen(false)} />
            <CreateSessionModal
                open={ssModalOpen}
                workspaceId={ssTargetWorkspace}
                onClose={() => {
                    setSsModalOpen(false);
                    setSsTargetWorkspace(null);
                }}
            />
        </div>
    );
}
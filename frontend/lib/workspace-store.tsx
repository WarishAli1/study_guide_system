"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type { Workspace, Session, SessionDocument } from "./types";

export const WORKSPACE_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#a855f7",
];

interface WorkspaceStore {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
    activeSessionId: string | null;
    sidebarOpen: boolean;

    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    createWorkspace: (name: string, description: string, color: string) => Workspace;
    updateWorkspace: (id: string, updates: Partial<Pick<Workspace, "name" | "description" | "color">>) => void;
    deleteWorkspace: (id: string) => void;
    setActiveWorkspace: (id: string | null) => void;

    createSession: (workspaceId: string, name: string, subject: string) => Session;
    updateSession: (workspaceId: string, sessionId: string, updates: Partial<Pick<Session, "name" | "subject">>) => void;
    deleteSession: (workspaceId: string, sessionId: string) => void;
    setActiveSession: (sessionId: string | null) => void;

    // Document tracking within sessions
    addDocument: (workspaceId: string, sessionId: string, doc: SessionDocument) => void;
    updateDocument: (workspaceId: string, sessionId: string, docId: string, updates: Partial<SessionDocument>) => void;
    removeDocument: (workspaceId: string, sessionId: string, docId: string) => void;

    getActiveWorkspace: () => Workspace | undefined;
    getActiveSession: () => Session | undefined;
}

const WorkspaceContext = createContext<WorkspaceStore | undefined>(undefined);

const STORAGE_KEY = "examguide_workspaces";
const ACTIVE_WS_KEY = "examguide_active_workspace";
const ACTIVE_SS_KEY = "examguide_active_session";

function loadFromStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setWorkspaces(loadFromStorage<Workspace[]>(STORAGE_KEY, []));
        setActiveWorkspaceId(loadFromStorage<string | null>(ACTIVE_WS_KEY, null));
        setActiveSessionId(loadFromStorage<string | null>(ACTIVE_SS_KEY, null));
        setSidebarOpen(window.innerWidth >= 1024);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
    }, [workspaces, hydrated]);

    useEffect(() => {
        if (hydrated) {
            if (activeWorkspaceId) localStorage.setItem(ACTIVE_WS_KEY, JSON.stringify(activeWorkspaceId));
            else localStorage.removeItem(ACTIVE_WS_KEY);
        }
    }, [activeWorkspaceId, hydrated]);

    useEffect(() => {
        if (hydrated) {
            if (activeSessionId) localStorage.setItem(ACTIVE_SS_KEY, JSON.stringify(activeSessionId));
            else localStorage.removeItem(ACTIVE_SS_KEY);
        }
    }, [activeSessionId, hydrated]);

    const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);

    const createWorkspace = useCallback(
        (name: string, description: string, color: string): Workspace => {
            const now = new Date().toISOString();
            const ws: Workspace = {
                id: uuidv4(), name, description, color,
                createdAt: now, updatedAt: now, sessions: [],
            };
            setWorkspaces((prev) => [ws, ...prev]);
            setActiveWorkspaceId(ws.id);
            setActiveSessionId(null);
            return ws;
        }, []
    );

    const updateWorkspace = useCallback(
        (id: string, updates: Partial<Pick<Workspace, "name" | "description" | "color">>) => {
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === id ? { ...ws, ...updates, updatedAt: new Date().toISOString() } : ws)
            );
        }, []
    );

    const deleteWorkspace = useCallback(
        (id: string) => {
            setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
            if (activeWorkspaceId === id) { setActiveWorkspaceId(null); setActiveSessionId(null); }
        }, [activeWorkspaceId]
    );

    const setActiveWorkspace = useCallback((id: string | null) => {
        setActiveWorkspaceId(id);
        setActiveSessionId(null);
    }, []);

    const createSession = useCallback(
        (workspaceId: string, name: string, subject: string): Session => {
            const now = new Date().toISOString();
            const session: Session = {
                id: uuidv4(), name, subject,
                createdAt: now, updatedAt: now, documents: [], messages: [],
            };
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? { ...ws, sessions: [session, ...ws.sessions], updatedAt: now }
                    : ws
                )
            );
            setActiveSessionId(session.id);
            return session;
        }, []
    );

    const updateSession = useCallback(
        (workspaceId: string, sessionId: string, updates: Partial<Pick<Session, "name" | "subject">>) => {
            const now = new Date().toISOString();
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? {
                        ...ws, updatedAt: now,
                        sessions: ws.sessions.map((s) => s.id === sessionId ? { ...s, ...updates, updatedAt: now } : s),
                    }
                    : ws
                )
            );
        }, []
    );

    const deleteSession = useCallback(
        (workspaceId: string, sessionId: string) => {
            const now = new Date().toISOString();
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? { ...ws, updatedAt: now, sessions: ws.sessions.filter((s) => s.id !== sessionId) }
                    : ws
                )
            );
            if (activeSessionId === sessionId) setActiveSessionId(null);
        }, [activeSessionId]
    );

    const setActiveSession = useCallback((sessionId: string | null) => {
        setActiveSessionId(sessionId);
    }, []);

    const addDocument = useCallback(
        (workspaceId: string, sessionId: string, doc: SessionDocument) => {
            const now = new Date().toISOString();
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? {
                        ...ws, updatedAt: now,
                        sessions: ws.sessions.map((s) => s.id === sessionId
                            ? { ...s, documents: [...s.documents, doc], updatedAt: now }
                            : s
                        ),
                    }
                    : ws
                )
            );
        }, []
    );

    const updateDocument = useCallback(
        (workspaceId: string, sessionId: string, docId: string, updates: Partial<SessionDocument>) => {
            const now = new Date().toISOString();
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? {
                        ...ws, updatedAt: now,
                        sessions: ws.sessions.map((s) => s.id === sessionId
                            ? {
                                ...s, updatedAt: now,
                                documents: s.documents.map((d) => d.id === docId ? { ...d, ...updates } : d),
                            }
                            : s
                        ),
                    }
                    : ws
                )
            );
        }, []
    );

    const removeDocument = useCallback(
        (workspaceId: string, sessionId: string, docId: string) => {
            const now = new Date().toISOString();
            setWorkspaces((prev) =>
                prev.map((ws) => ws.id === workspaceId
                    ? {
                        ...ws, updatedAt: now,
                        sessions: ws.sessions.map((s) => s.id === sessionId
                            ? { ...s, updatedAt: now, documents: s.documents.filter((d) => d.id !== docId) }
                            : s
                        ),
                    }
                    : ws
                )
            );
        }, []
    );

    const getActiveWorkspace = useCallback(
        () => workspaces.find((ws) => ws.id === activeWorkspaceId),
        [workspaces, activeWorkspaceId]
    );

    const getActiveSession = useCallback(() => {
        const ws = workspaces.find((w) => w.id === activeWorkspaceId);
        return ws?.sessions.find((s) => s.id === activeSessionId);
    }, [workspaces, activeWorkspaceId, activeSessionId]);

    const value: WorkspaceStore = {
        workspaces, activeWorkspaceId, activeSessionId, sidebarOpen,
        setSidebarOpen, toggleSidebar,
        createWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace,
        createSession, updateSession, deleteSession, setActiveSession,
        addDocument, updateDocument, removeDocument,
        getActiveWorkspace, getActiveSession,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspaceStore() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error("useWorkspaceStore must be used within <WorkspaceProvider>");
    return ctx;
}
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
import type {
    Session,
    SessionDocument,
    StudyGuideReport,
    ChatMessage,
} from "./types";

export type SessionView = "dashboard" | "documents" | "chat" | "guide";

interface SessionStore {
    sessions: Session[];
    activeSessionId: string | null;
    activeView: SessionView;
    sidebarOpen: boolean;
    pendingChatPrompt: string | null;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    createSession: (name: string, description: string) => Session;
    updateSession: (
        sessionId: string,
        updates: Partial<Pick<Session, "name" | "description">>
    ) => void;
    deleteSession: (sessionId: string) => void;
    setActiveSession: (sessionId: string | null) => void;
    setActiveView: (view: SessionView) => void;

    addDocument: (sessionId: string, doc: SessionDocument) => void;
    updateDocument: (
        sessionId: string,
        docId: string,
        updates: Partial<SessionDocument>
    ) => void;
    removeDocument: (sessionId: string, docId: string) => void;

    addMessage: (sessionId: string, message: ChatMessage) => void;

    setCachedGuide: (
        sessionId: string,
        guide: StudyGuideReport | null
    ) => void;

    setPendingChatPrompt: (prompt: string | null) => void;
    navigateToChatWithPrompt: (prompt: string) => void;

    getActiveSession: () => Session | undefined;
}

const SessionContext = createContext<SessionStore | undefined>(undefined);

const STORAGE_KEY = "examguide_sessions";
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

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<SessionView>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const loaded = loadFromStorage<Session[]>(STORAGE_KEY, []);
        const migrated = loaded.map((s) => ({
            ...s,
            cachedGuide: s.cachedGuide ?? null,
            messages: s.messages ?? [],
        }));
        setSessions(migrated);
        setActiveSessionId(loadFromStorage<string | null>(ACTIVE_SS_KEY, null));
        setSidebarOpen(window.innerWidth >= 1024);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }, [sessions, hydrated]);

    useEffect(() => {
        if (hydrated) {
            if (activeSessionId)
                localStorage.setItem(ACTIVE_SS_KEY, JSON.stringify(activeSessionId));
            else localStorage.removeItem(ACTIVE_SS_KEY);
        }
    }, [activeSessionId, hydrated]);

    const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);

    const createSession = useCallback(
        (name: string, description: string): Session => {
            const now = new Date().toISOString();
            const session: Session = {
                id: uuidv4(),
                name,
                description,
                createdAt: now,
                updatedAt: now,
                documents: [],
                messages: [],
                cachedGuide: null,
            };
            setSessions((prev) => [session, ...prev]);
            setActiveSessionId(session.id);
            setActiveView("dashboard");
            return session;
        },
        []
    );

    const updateSession = useCallback(
        (sessionId: string, updates: Partial<Pick<Session, "name" | "description">>) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId ? { ...s, ...updates, updatedAt: now } : s
                )
            );
        },
        []
    );

    const deleteSession = useCallback((sessionId: string) => {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setActiveSessionId((current) => {
            if (current === sessionId) {
                setActiveView("dashboard");
                return null;
            }
            return current;
        });
    }, []);

    const setActiveSessionCb = useCallback((sessionId: string | null) => {
        setActiveSessionId(sessionId);
        setActiveView("dashboard");
    }, []);

    const setActiveViewCb = useCallback((view: SessionView) => {
        setActiveView(view);
    }, []);

    const addDocument = useCallback(
        (sessionId: string, doc: SessionDocument) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? { ...s, documents: [...s.documents, doc], updatedAt: now }
                        : s
                )
            );
        },
        []
    );

    const updateDocument = useCallback(
        (sessionId: string, docId: string, updates: Partial<SessionDocument>) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            updatedAt: now,
                            documents: s.documents.map((d) =>
                                d.id === docId ? { ...d, ...updates } : d
                            ),
                        }
                        : s
                )
            );
        },
        []
    );

    const removeDocument = useCallback(
        (sessionId: string, docId: string) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            updatedAt: now,
                            documents: s.documents.filter((d) => d.id !== docId),
                        }
                        : s
                )
            );
        },
        []
    );

    const addMessage = useCallback(
        (sessionId: string, message: ChatMessage) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? { ...s, messages: [...s.messages, message], updatedAt: now }
                        : s
                )
            );
        },
        []
    );

    const setCachedGuide = useCallback(
        (sessionId: string, guide: StudyGuideReport | null) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? { ...s, cachedGuide: guide, updatedAt: now }
                        : s
                )
            );
        },
        []
    );

    const navigateToChatWithPrompt = useCallback((prompt: string) => {
        setPendingChatPrompt(prompt);
        setActiveView("chat");
    }, []);

    const getActiveSession = useCallback(
        () => sessions.find((s) => s.id === activeSessionId),
        [sessions, activeSessionId]
    );

    const value: SessionStore = {
        sessions,
        activeSessionId,
        activeView,
        sidebarOpen,
        pendingChatPrompt,
        setSidebarOpen,
        toggleSidebar,
        createSession,
        updateSession,
        deleteSession,
        setActiveSession: setActiveSessionCb,
        setActiveView: setActiveViewCb,
        addDocument,
        updateDocument,
        removeDocument,
        addMessage,
        setCachedGuide,
        setPendingChatPrompt,
        navigateToChatWithPrompt,
        getActiveSession,
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSessionStore() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSessionStore must be used within <SessionProvider>");
    return ctx;
}
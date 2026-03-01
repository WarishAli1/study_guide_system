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
    ChatConversation,
} from "./types";

export type SessionView = "dashboard" | "documents" | "chat" | "guide" | "quiz";

interface SessionStore {
    sessions: Session[];
    activeSessionId: string | null;
    activeView: SessionView;
    activeConversationId: string | null;
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

    // Conversation management
    createConversation: (sessionId: string) => ChatConversation;
    setActiveConversation: (conversationId: string | null) => void;
    deleteConversation: (sessionId: string, conversationId: string) => void;
    addMessageToConversation: (
        sessionId: string,
        conversationId: string,
        message: ChatMessage
    ) => void;
    updateConversationTitle: (
        sessionId: string,
        conversationId: string,
        title: string
    ) => void;
    getActiveConversation: () => ChatConversation | undefined;

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
const ACTIVE_CONV_KEY = "examguide_active_conversation";

function safeLocalStorageSave(key: string, sessions: Session[]) {
    try {
        localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e: any) {
        if (
            e?.name === "QuotaExceededError" ||
            e?.code === 22 ||
            e?.code === 1014
        ) {
            console.warn(
                "[SessionStore] localStorage quota exceeded, stripping chat metadata..."
            );
            const trimmed = sessions.map((s) => ({
                ...s,
                conversations: s.conversations.map((conv) => ({
                    ...conv,
                    messages: conv.messages.map((m, idx) => {
                        if (idx < conv.messages.length - 20) {
                            const { sources, relatedQuestions, ...rest } = m;
                            return rest;
                        }
                        return m;
                    }),
                })),
            }));
            try {
                localStorage.setItem(key, JSON.stringify(trimmed));
            } catch {
                console.warn(
                    "[SessionStore] Still too large, truncating conversations..."
                );
                const truncated = trimmed.map((s) => ({
                    ...s,
                    conversations: s.conversations.slice(-10).map((conv) => ({
                        ...conv,
                        messages: conv.messages.slice(-50),
                    })),
                }));
                try {
                    localStorage.setItem(key, JSON.stringify(truncated));
                } catch {
                    console.error(
                        "[SessionStore] Failed to save even after truncation"
                    );
                }
            }
        }
    }
}

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
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<SessionView>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const loaded = loadFromStorage<Session[]>(STORAGE_KEY, []);
        const migrated = loaded.map((s) => ({
            ...s,
            cachedGuide: s.cachedGuide ?? null,
            conversations: s.conversations ?? (
                s.messages && (s as any).messages.length > 0
                    ? [{
                        id: uuidv4(),
                        title: (s as any).messages.find((m: any) => m.role === "user")?.content?.slice(0, 40) || "Chat",
                        createdAt: (s as any).messages[0]?.timestamp || s.createdAt,
                        updatedAt: (s as any).messages[(s as any).messages.length - 1]?.timestamp || s.updatedAt,
                        messages: (s as any).messages,
                    }]
                    : []
            ),
        }));
        // Remove old messages field
        const cleaned = migrated.map(({ messages, ...rest }: any) => rest);
        setSessions(cleaned);
        setActiveSessionId(loadFromStorage<string | null>(ACTIVE_SS_KEY, null));
        setActiveConversationId(loadFromStorage<string | null>(ACTIVE_CONV_KEY, null));
        setSidebarOpen(window.innerWidth >= 1024);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) safeLocalStorageSave(STORAGE_KEY, sessions);
    }, [sessions, hydrated]);

    useEffect(() => {
        if (hydrated) {
            if (activeSessionId)
                localStorage.setItem(ACTIVE_SS_KEY, JSON.stringify(activeSessionId));
            else localStorage.removeItem(ACTIVE_SS_KEY);
        }
    }, [activeSessionId, hydrated]);

    useEffect(() => {
        if (hydrated) {
            if (activeConversationId)
                localStorage.setItem(ACTIVE_CONV_KEY, JSON.stringify(activeConversationId));
            else localStorage.removeItem(ACTIVE_CONV_KEY);
        }
    }, [activeConversationId, hydrated]);

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
                conversations: [],
                cachedGuide: null,
            };
            setSessions((prev) => [session, ...prev]);
            setActiveSessionId(session.id);
            setActiveConversationId(null);
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
                setActiveConversationId(null);
                return null;
            }
            return current;
        });
    }, []);

    const setActiveSessionCb = useCallback((sessionId: string | null) => {
        setActiveSessionId(sessionId);
        setActiveConversationId(null);
        setActiveView("dashboard");
    }, []);

    const setActiveViewCb = useCallback((view: SessionView) => {
        setActiveView(view);
        // When switching to chat, don't auto-select a conversation
        // Let the user pick one or create new
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

    // ── Conversation management ──

    const createConversation = useCallback(
        (sessionId: string): ChatConversation => {
            const now = new Date().toISOString();
            const conv: ChatConversation = {
                id: uuidv4(),
                title: "New Chat",
                createdAt: now,
                updatedAt: now,
                messages: [],
            };
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            conversations: [conv, ...s.conversations],
                            updatedAt: now,
                        }
                        : s
                )
            );
            setActiveConversationId(conv.id);
            return conv;
        },
        []
    );

    const setActiveConversationCb = useCallback((conversationId: string | null) => {
        setActiveConversationId(conversationId);
    }, []);

    const deleteConversation = useCallback(
        (sessionId: string, conversationId: string) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            conversations: s.conversations.filter(
                                (c) => c.id !== conversationId
                            ),
                            updatedAt: now,
                        }
                        : s
                )
            );
            setActiveConversationId((current) =>
                current === conversationId ? null : current
            );
        },
        []
    );

    const addMessageToConversation = useCallback(
        (sessionId: string, conversationId: string, message: ChatMessage) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) => {
                    if (s.id !== sessionId) return s;
                    return {
                        ...s,
                        updatedAt: now,
                        conversations: s.conversations.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            const updated = {
                                ...conv,
                                messages: [...conv.messages, message],
                                updatedAt: now,
                            };
                            // Auto-title from first user message
                            if (
                                updated.title === "New Chat" &&
                                message.role === "user"
                            ) {
                                updated.title =
                                    message.content.length > 50
                                        ? message.content.slice(0, 50) + "…"
                                        : message.content;
                            }
                            return updated;
                        }),
                    };
                })
            );
        },
        []
    );

    const updateConversationTitle = useCallback(
        (sessionId: string, conversationId: string, title: string) => {
            const now = new Date().toISOString();
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            updatedAt: now,
                            conversations: s.conversations.map((c) =>
                                c.id === conversationId
                                    ? { ...c, title, updatedAt: now }
                                    : c
                            ),
                        }
                        : s
                )
            );
        },
        []
    );

    const getActiveConversation = useCallback(() => {
        if (!activeSessionId || !activeConversationId) return undefined;
        const session = sessions.find((s) => s.id === activeSessionId);
        return session?.conversations.find((c) => c.id === activeConversationId);
    }, [sessions, activeSessionId, activeConversationId]);

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
        setActiveConversationId(null); // Will create new conversation
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
        activeConversationId,
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
        createConversation,
        setActiveConversation: setActiveConversationCb,
        deleteConversation,
        addMessageToConversation,
        updateConversationTitle,
        getActiveConversation,
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
    if (!ctx)
        throw new Error("useSessionStore must be used within <SessionProvider>");
    return ctx;
}
"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import { authAPI } from "./api";
import type { User, AuthState } from "./types";

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const savedToken = localStorage.getItem("token");
            const savedUser = localStorage.getItem("user");
            if (savedToken && savedUser) {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            }
        } catch {
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = async (googleToken: string) => {
        const res = await authAPI.googleLogin(googleToken);
        const { token: accessToken, user: userData } = res.data;

        setToken(accessToken);
        setUser(userData);
        localStorage.setItem("token", accessToken);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider
            value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}
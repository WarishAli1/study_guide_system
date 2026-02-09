export interface User {
    id: number;
    email: string;
    name: string;
    picture: string;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (googleToken: string) => Promise<void>;
    logout: () => void;
}

export interface UploadResponse {
    status: string;
    filename: string;
    extracted_path: string;
}
import axios from 'axios';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { apiClient } from '../api/client';

export interface AuthRole {
    id: number;
    name: string;
    slug: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: AuthRole | null;
    permissions: string[];
    is_active: boolean;
}

interface AuthResponse {
    user: AuthUser;
}

type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'error';

interface AuthContextValue {
    user: AuthUser | null;
    status: AuthStatus;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setStatus('loading');
        setError(null);

        try {
            const response = await apiClient.get<AuthResponse>('/api/user');
            setUser(response.data.user);
            setStatus('authenticated');
        } catch (requestError) {
            if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
                setUser(null);
                setStatus('guest');
                return;
            }

            setError('We could not verify your session. Check your connection and try again.');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const interceptorId = apiClient.interceptors.response.use(
            (response) => response,
            (requestError: unknown) => {
                if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
                    setUser(null);
                    setStatus('guest');
                }

                return Promise.reject(requestError);
            },
        );

        return () => apiClient.interceptors.response.eject(interceptorId);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        await apiClient.get('/sanctum/csrf-cookie');
        const response = await apiClient.post<AuthResponse>('/login', { email, password });
        setUser(response.data.user);
        setError(null);
        setStatus('authenticated');
    }, []);

    const logout = useCallback(async () => {
        await apiClient.post('/logout');
        setUser(null);
        setStatus('guest');
    }, []);

    const value = useMemo(
        () => ({ user, status, error, login, logout, retry: refresh }),
        [user, status, error, login, logout, refresh],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return context;
}

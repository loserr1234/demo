import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'PARENT';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

// Load from localStorage
const storedUser = localStorage.getItem('school_user');
const storedToken = localStorage.getItem('school_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,
  isAuthenticated: !!storedToken,

  login: (user, token) => {
    localStorage.setItem('school_token', token);
    localStorage.setItem('school_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('school_token');
    localStorage.removeItem('school_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

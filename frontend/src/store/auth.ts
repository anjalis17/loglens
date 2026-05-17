"use client";

import { create } from "zustand";
import { getToken, setToken, clearToken } from "@/lib/auth";
import type { UserOut } from "@/types/api";

interface AuthState {
  token: string | null;
  user: UserOut | null;
  setAuth: (token: string, user: UserOut) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => {
    setToken(token);
    set({ token, user });
  },
  logout: () => {
    clearToken();
    set({ token: null, user: null });
  },
  hydrate: () => {
    const token = getToken();
    set({ token });
  },
}));

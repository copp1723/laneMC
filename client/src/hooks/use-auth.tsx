import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await apiRequest('GET', '/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('auth_token');
        setUser(null);
      }
    } catch (error) {
      console.log('Auth error:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiRequest('POST', '/api/auth/login', { email, password });
    const data = await response.json();

    localStorage.setItem('auth_token', data.token);
    setUser(data.user);

    // Small delay to ensure user state is updated before redirect
    setTimeout(() => {
      setLocation('/');
    }, 100);
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await apiRequest('POST', '/api/auth/register', { username, email, password });
    const data = await response.json();
    
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    setLocation('/');
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

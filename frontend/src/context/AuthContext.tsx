import React, { createContext, useContext, useState, useEffect } from 'react';
import { ownerApi } from '../services/api';

interface Owner {
  id: string;
  email: string;
}

interface AuthContextType {
  owner: Owner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkSession = async () => {
    try {
      setIsLoading(true);
      const data = await ownerApi.getMe();
      if (data?.success && data?.owner) {
        setOwner(data.owner);
        setIsAuthenticated(true);
      } else {
        setOwner(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setOwner(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (credentials: any) => {
    setIsLoading(true);
    try {
      const data = await ownerApi.login(credentials);
      if (data?.success && data?.owner) {
        setOwner(data.owner);
        setIsAuthenticated(true);
      }
    } catch (error) {
      setOwner(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await ownerApi.logout();
    } catch (error) {
      console.error('Logout request failed', error);
    } finally {
      setOwner(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      window.location.href = '/owner/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        owner,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

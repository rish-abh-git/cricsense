import React, { createContext, useContext, useState, useEffect } from 'react';

type Role = 'admin' | 'viewer';

interface AuthContextType {
  role: Role;
  isAdmin: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role>('viewer');

  useEffect(() => {
    const savedRole = localStorage.getItem('cricsense_role') as Role;
    if (savedRole === 'admin') {
      setRole('admin');
    }
  }, []);

  const login = (pin: string) => {
    // Basic hardcoded PIN for simplicity based on user request ("morya2026")
    if (pin === 'morya2026') {
      localStorage.setItem('cricsense_role', 'admin');
      setRole('admin');
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('cricsense_role');
    setRole('viewer');
  };

  return (
    <AuthContext.Provider value={{ role, isAdmin: role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

interface User {
  id: string;
  username: string;
  rol: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular?: string;
  empresa?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  selectedEmpresaId: string | null;
  setSelectedEmpresaId: (id: string | null) => void;
  activeEmpresa: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [selectedEmpresaId, setSelectedEmpresaIdState] = useState<string | null>(localStorage.getItem('selectedEmpresaId'));
  const [activeEmpresa, setActiveEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token && user) {
      if (user.rol === 'SUPER_ADMIN') {
        const currentSaved = localStorage.getItem('selectedEmpresaId');
        api.get('/empresas')
          .then((res) => {
            if (res.data.length > 0) {
              const defaultId = currentSaved || res.data[0].id;
              if (!currentSaved) {
                localStorage.setItem('selectedEmpresaId', defaultId);
                setSelectedEmpresaIdState(defaultId);
              }
              const found = res.data.find((e: any) => e.id === defaultId);
              setActiveEmpresa(found || null);
            }
          })
          .catch((err) => console.error(err));
      } else {
        api.get('/empresas/mi-empresa')
          .then((res) => {
            setActiveEmpresa(res.data);
          })
          .catch((err) => console.error(err));
      }
    } else {
      setActiveEmpresa(null);
    }
  }, [token, user, selectedEmpresaId]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedEmpresaId');
    setToken(null);
    setUser(null);
    setSelectedEmpresaIdState(null);
    setActiveEmpresa(null);
  };

  const setSelectedEmpresaId = (id: string | null) => {
    if (id) localStorage.setItem('selectedEmpresaId', id);
    else localStorage.removeItem('selectedEmpresaId');
    setSelectedEmpresaIdState(id);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, selectedEmpresaId, setSelectedEmpresaId, activeEmpresa }}>
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

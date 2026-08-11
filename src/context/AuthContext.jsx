import React, { createContext, useContext, useState, useEffect } from 'react';
import { getClient, initTelegramClient } from '../telegramClient';
import { db } from '../firebase';
import { ref, get, child } from 'firebase/database';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const savedSession = localStorage.getItem('tg_session');
        const tgUserId = localStorage.getItem('tg_user_id');
        
        if (savedSession && tgUserId) {
          await initTelegramClient(savedSession);
          const client = getClient();
          await client.connect();
          if (client && await client.checkAuthorization()) {
            const me = await client.getMe();
            setUser({ ...me, id: tgUserId });
          } else {
            localStorage.removeItem('tg_session');
            localStorage.removeItem('tg_user_id');
          }
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = (userData, sessionString) => {
    localStorage.setItem('tg_session', sessionString);
    localStorage.setItem('tg_user_id', userData.id.toString());
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('tg_session');
    localStorage.removeItem('tg_user_id');
    setUser(null);
    const client = getClient();
    if (client) client.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

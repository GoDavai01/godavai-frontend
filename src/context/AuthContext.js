import React, { createContext, useContext, useState, useEffect } from "react";

import axios from "axios";

const AuthContext = createContext();

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("token") || "";
  });
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    return safeParse(localStorage.getItem("user"), null);
  });
  const [addresses, setAddresses] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = "Bearer " + token;
      if (typeof window !== "undefined") localStorage.setItem("token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      if (typeof window !== "undefined") localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (user?._id) {
      axios
        .get(`${API_BASE_URL}/api/users/${user._id}/addresses`)
        .then((res) => setAddresses(res.data || []))
        .catch(() => setAddresses([]));
    } else {
      setAddresses([]);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      axios
        .get(`${API_BASE_URL}/api/profile`, {
          headers: { Authorization: "Bearer " + token },
        })
        .then((res) => setUser(res.data))
        .catch(() => setUser(null));
    }
  }, [token]);

  const updateAddresses = async (nextAddresses) => {
    if (!user?._id) return;
    setAddresses(nextAddresses);
    await axios.put(`${API_BASE_URL}/api/users/${user._id}/addresses`, {
      addresses: nextAddresses,
    });
  };

  const login = (userData, jwt) => {
    setToken(jwt);
    setUser(userData);
  };

  const logout = () => {
  setUser(null);
  setToken("");
  setAddresses([]);

  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("profileCompleted");
  }
};

  return (
    <AuthContext.Provider
      value={{ user, token, setUser, login, logout, addresses, updateAddresses }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
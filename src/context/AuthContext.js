import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { getUserAuthToken } from "../lib/userAuth";

const AuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const USER_STORAGE_KEY = "user";
const ACCESS_TOKEN_STORAGE_KEY = "token";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function readRefreshTokenFromStorage() {
  if (typeof window === "undefined") return "";
  try {
    return String(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function applyAxiosAccessToken(token = "") {
  const normalized = getUserAuthToken(token);
  if (normalized) {
    axios.defaults.headers.common.Authorization = `Bearer ${normalized}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return getUserAuthToken(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "");
  });
  const [refreshToken, setRefreshToken] = useState(() => readRefreshTokenFromStorage());
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    return safeParse(localStorage.getItem(USER_STORAGE_KEY), null);
  });
  const [addresses, setAddresses] = useState([]);

  const tokenRef = useRef(token);
  const refreshTokenRef = useRef(refreshToken);
  const refreshPromiseRef = useRef(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken("");
    setRefreshToken("");
    setAddresses([]);

    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      localStorage.removeItem("profileCompleted");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const activeRefreshToken =
      refreshTokenRef.current || readRefreshTokenFromStorage();
    if (!activeRefreshToken) {
      throw new Error("Missing refresh token");
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = axios
        .post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken: activeRefreshToken },
          { skipAuthRefresh: true }
        )
        .then((res) => {
          const nextAccessToken = getUserAuthToken(
            res?.data?.accessToken || res?.data?.token || ""
          );
          const nextRefreshToken = String(res?.data?.refreshToken || "").trim();

          if (!nextAccessToken || !nextRefreshToken) {
            throw new Error("Invalid refresh response");
          }

          setToken(nextAccessToken);
          setRefreshToken(nextRefreshToken);
          if (res?.data?.user) setUser(res.data.user);
          return nextAccessToken;
        })
        .catch((err) => {
          clearAuthState();
          throw err;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }

    return refreshPromiseRef.current;
  }, [clearAuthState]);

  useEffect(() => {
    if (!token && refreshToken) {
      refreshSession().catch(() => {});
    }
  }, [token, refreshToken, refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    applyAxiosAccessToken(token);
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  }, [refreshToken]);

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      if (config?.skipAuthRefresh) return config;
      const activeToken = tokenRef.current || getUserAuthToken("");
      if (!activeToken) return config;
      config.headers = config.headers || {};
      if (!config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = `Bearer ${activeToken}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config || {};
        if (status !== 401) return Promise.reject(error);
        if (originalRequest?._retry || originalRequest?.skipAuthRefresh) {
          return Promise.reject(error);
        }

        const requestUrl = String(originalRequest?.url || "");
        if (
          requestUrl.includes("/api/auth/send-otp") ||
          requestUrl.includes("/api/auth/verify-otp") ||
          requestUrl.includes("/api/auth/refresh") ||
          requestUrl.includes("/api/auth/logout")
        ) {
          return Promise.reject(error);
        }

        const reqAuthHeader = String(
          originalRequest?.headers?.Authorization ||
            originalRequest?.headers?.authorization ||
            ""
        );
        const activeAccessToken = tokenRef.current || "";
        if (reqAuthHeader && !activeAccessToken) {
          return Promise.reject(error);
        }
        if (
          reqAuthHeader &&
          activeAccessToken &&
          !reqAuthHeader.includes(activeAccessToken)
        ) {
          return Promise.reject(error);
        }

        if (!refreshTokenRef.current) {
          clearAuthState();
          return Promise.reject(error);
        }

        originalRequest._retry = true;
        try {
          const nextAccessToken = await refreshSession();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
          return axios(originalRequest);
        } catch (refreshErr) {
          clearAuthState();
          return Promise.reject(refreshErr);
        }
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [clearAuthState, refreshSession]);

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
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/api/profile`)
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err?.response?.status === 401) {
          clearAuthState();
        }
      });
  }, [token, clearAuthState]);

  const updateAddresses = async (nextAddresses) => {
    if (!user?._id) return;
    setAddresses(nextAddresses);
    await axios.put(`${API_BASE_URL}/api/users/${user._id}/addresses`, {
      addresses: nextAddresses,
    });
  };

  const login = (userData, accessToken, nextRefreshToken = "") => {
    const normalizedAccessToken = getUserAuthToken(accessToken);
    if (normalizedAccessToken) setToken(normalizedAccessToken);
    if (nextRefreshToken) setRefreshToken(String(nextRefreshToken).trim());
    setUser(userData || null);
  };

  const logout = async () => {
    const currentRefreshToken = refreshTokenRef.current || readRefreshTokenFromStorage();
    clearAuthState();
    if (!currentRefreshToken) return;
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        { refreshToken: currentRefreshToken },
        { skipAuthRefresh: true }
      );
    } catch (_) {
      // Local logout is still considered successful even if server revoke fails.
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        setUser,
        login,
        logout,
        addresses,
        updateAddresses,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

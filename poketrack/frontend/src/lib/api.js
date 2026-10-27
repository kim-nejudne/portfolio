// API client + auth helpers.
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("poketrack_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A token the API no longer honours — expired, or a demo session whose sandbox
// is gone — would otherwise leave every page failing toast by toast.
api.interceptors.response.use(undefined, (error) => {
  const url = error.config?.url || "";
  if (error.response?.status === 401 && !url.startsWith("/auth/") && getToken()) {
    setToken(null);
    setUser(null);
    window.location.assign("/sign-in?ended=1");
  }
  return Promise.reject(error);
});

export function setToken(token) {
  if (token) localStorage.setItem("poketrack_token", token);
  else localStorage.removeItem("poketrack_token");
}

export function getToken() {
  return localStorage.getItem("poketrack_token");
}

export function setUser(user) {
  if (user) localStorage.setItem("poketrack_user", JSON.stringify(user));
  else localStorage.removeItem("poketrack_user");
}

export function getUser() {
  const raw = localStorage.getItem("poketrack_user");
  return raw ? JSON.parse(raw) : null;
}

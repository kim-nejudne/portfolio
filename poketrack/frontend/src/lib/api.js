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

import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import Environment from "@/config/env";
import { clearAccessToken, getAccessToken } from "@/utils/accessToken";

const hackatonApi: AxiosInstance = axios.create({
  baseURL: Environment.VITE_HACKATON_API_URL,
  headers: { "Content-Type": "application/json" },
});

hackatonApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers = config.headers || {};

    const token = Environment.VITE_HACKATON_API_TOKEN;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // Token de sessão legado repassado pelo host via `?accessToken=`.
    // Persistido no boot (ver main.tsx); o backend valida contra o
    // endpoint legado /users/get-token-info.
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers["X-Access-Token"] = accessToken;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

/**
 * No 401 o access token sumiu ou é inválido: limpa o cache pra que
 * retries não fiquem em loop com o mesmo token ruim, e notifica o host
 * (iframe pai) pra que ele reaja — reemitir o iframe com token novo ou
 * mostrar UI de sessão expirada.
 */
function notifyHostUnauthorized() {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(
    { type: "p360:hackaton:unauthorized", version: 1 },
    "*",
  );
}

const handleResponseError = (error: AxiosError) => {
  if (error.response?.status === 401) {
    clearAccessToken();
    notifyHostUnauthorized();
  }
  return Promise.reject(error);
};

hackatonApi.interceptors.response.use(
  (r: AxiosResponse) => r,
  handleResponseError,
);

export { hackatonApi };

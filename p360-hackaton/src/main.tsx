import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChakraProvider, theme } from "@cursosactive/p360-new-ui";

import AppRouter from "./routes";
import { captureAccessTokenFromUrl } from "./utils/accessToken";

import "./lib/i18n";
import "./index.css";

// Persiste `?accessToken=` (enviado pelo host legado) antes do app
// montar, pra que o interceptor axios anexe o header `X-Access-Token`
// nas requisições ao backend.
captureAccessTokenFromUrl();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={theme}>
        <AppRouter />
      </ChakraProvider>
    </QueryClientProvider>
  </StrictMode>,
);

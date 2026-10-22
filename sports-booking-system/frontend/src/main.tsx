import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "sonner";
import { App } from "./app/App";
import { AuthProvider } from "./features/auth/hooks/useAuth";
import { LanguageProvider } from "./lib/i18n";
import { queryClient } from "./lib/queryClient";
import "./index.css";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "235786600045-sn6mqht28l6v4fuf0mpiu24inhfnlch3.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <App />
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

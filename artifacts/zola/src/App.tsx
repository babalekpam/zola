// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AuthCallbackPage from "@/pages/auth-callback";
import ProjectsPage from "@/pages/projects";
import InvitePage from "@/pages/invite";
import WorkspacePage from "@/pages/workspace";
import BillingPage from "@/pages/billing";
import AccountPage from "@/pages/account";
import PricingPage from "@/pages/pricing";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/projects/:id" component={WorkspacePage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route>
        <main className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold">404</h1>
            <p className="text-muted-foreground">Page not found</p>
            <a href="/" className="inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Go home</a>
          </div>
        </main>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster position="bottom-right" theme="dark" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

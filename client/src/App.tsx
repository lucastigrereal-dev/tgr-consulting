import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense } from "react";

const DashboardLayout = lazy(() => import("@/components/DashboardLayout"));
const Boardroom = lazy(() => import("./pages/Boardroom"));
const Builder = lazy(() => import("./pages/Builder"));
const CostCatalog = lazy(() => import("./pages/CostCatalog"));
const Decisions = lazy(() => import("./pages/Decisions"));
const Scenarios = lazy(() => import("./pages/Scenarios"));
const Governance = lazy(() => import("./pages/Governance"));

function PanelFallback() {
  return <div className="mx-auto max-w-7xl space-y-4 p-2" aria-live="polite"><div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-card/70"/><div className="grid gap-3 md:grid-cols-3"><div className="h-32 animate-pulse rounded-xl border border-white/10 bg-card/60"/><div className="h-32 animate-pulse rounded-xl border border-white/10 bg-card/60"/><div className="h-32 animate-pulse rounded-xl border border-white/10 bg-card/60"/></div><p className="text-sm text-muted-foreground">Carregando painel e memória de decisão…</p></div>;
}

function Router() {
  const Shell = ({ children }: { children: React.ReactNode }) => <DashboardLayout>{children}</DashboardLayout>;
  const Panel = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<PanelFallback />}><Shell>{children}</Shell></Suspense>;
  return (
    <Switch>
      <Route path={"/"}>{() => <Panel><Builder /></Panel>}</Route>
      <Route path={"/builder"}>{() => <Panel><Builder /></Panel>}</Route>
      <Route path={"/study"}>{() => <Panel><Boardroom /></Panel>}</Route>
      <Route path={"/costs"}>{() => <Panel><CostCatalog /></Panel>}</Route>
      <Route path={"/decisions"}>{() => <Panel><Decisions /></Panel>}</Route>
      <Route path={"/scenarios"}>{() => <Panel><Scenarios /></Panel>}</Route>
      <Route path={"/governance"}>{() => <Panel><Governance /></Panel>}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

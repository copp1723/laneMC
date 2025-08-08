import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import AccountSettings from "@/pages/AccountSettings";
import MemoryManagement from "@/pages/memory-management";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  console.log("Current route:", location);
  
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/account-settings" component={AccountSettings} />
      <Route path="/memory-management" component={MemoryManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

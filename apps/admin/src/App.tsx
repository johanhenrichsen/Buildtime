import { useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Layout } from '@/components/Layout';
import { getUser } from '@/lib/auth';
import Login from '@/pages/Login';
import Workers from '@/pages/Workers';
import WorkerDetail from '@/pages/WorkerDetail';
import Sites from '@/pages/Sites';
import Payroll from '@/pages/Payroll';
import PayrollDetail from '@/pages/PayrollDetail';
import Flagged from '@/pages/Flagged';
import FlaggedDetail from '@/pages/FlaggedDetail';
import Enrollment from '@/pages/Enrollment';
import AuditLog from '@/pages/AuditLog';
import CashAdvances from '@/pages/CashAdvances';
import Reports from '@/pages/Reports';
import NotFound from '@/pages/NotFound';

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function AppShell() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/workers" />} />
        <Route path="/workers" component={Workers} />
        <Route path="/workers/:id" component={WorkerDetail} />
        <Route path="/sites" component={Sites} />
        <Route path="/enrollment" component={Enrollment} />
        <Route path="/payroll" component={Payroll} />
        <Route path="/payroll/:cutoffId" component={PayrollDetail} />
        <Route path="/flagged" component={Flagged} />
        <Route path="/flagged/:id" component={FlaggedDetail} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/advances" component={CashAdvances} />
        <Route path="/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <WouterRouter>
        <Switch>
          <Route path="/login" component={Login} />
          <Route>
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          </Route>
        </Switch>
        <Toaster />
      </WouterRouter>
    </TooltipProvider>
  );
}

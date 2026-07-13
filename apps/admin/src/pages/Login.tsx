import { useState } from 'react';
import { useLocation } from 'wouter';
import { HardHat, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api';
import { setToken, getUser } from '@/lib/auth';

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (getUser()) {
    setLocation('/workers');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { access_token } = await login(email, password);
      setToken(access_token);
      setLocation('/workers');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 bg-sidebar-primary rounded-xl flex items-center justify-center">
          <HardHat className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">BuildTime</h1>
          <p className="text-sm text-white/50">Construction Check-In System</p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold">System Administrator</p>
              <p className="text-white/50 text-sm mt-0.5">Manage workers, payroll, and site data</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-white/70 text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sidebar-primary"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-white/70 text-xs">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-sidebar-primary"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs">BuildTime Admin Portal</p>
      </div>
    </div>
  );
}

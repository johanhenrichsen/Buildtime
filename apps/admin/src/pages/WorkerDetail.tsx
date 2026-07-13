import { useLocation, useParams } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useWorkers, useUpdateWorker } from '@/lib/queries';
import { useState } from 'react';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useWorkers();
  const updateWorker = useUpdateWorker();

  const worker = data?.data.find((w) => w.id === id);

  const [form, setForm] = useState<{
    name?: string;
    dailyRate?: string;
    status?: string;
    employmentType?: string;
  }>({});

  function field(key: 'name' | 'dailyRate' | 'status' | 'employmentType') {
    if (key in form && form[key] !== undefined) return form[key] as string;
    if (!worker) return '';
    return String(worker[key] ?? '');
  }

  async function handleSave() {
    if (!id) return;
    try {
      await updateWorker.mutateAsync({ id, data: form });
      setForm({});
      toast({ title: 'Changes saved', description: 'Worker record updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-5" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Worker not found.</p>
        <Button variant="link" onClick={() => setLocation('/workers')}>Back to Workers</Button>
      </div>
    );
  }

  const statusValue = (field('status') as string) || worker.status;

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={() => setLocation('/workers')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workers
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
          {getInitials(worker.name)}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{worker.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{worker.employeeNo}</p>
        </div>
        <Badge
          className={`ml-2 ${worker.status === 'active'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
        >
          {worker.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 text-foreground">Worker Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              className="mt-1"
              value={field('name') || worker.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="empNo">Employee No.</Label>
            <Input id="empNo" className="mt-1 bg-muted" value={worker.employeeNo} readOnly />
          </div>
          <div>
            <Label htmlFor="dailyRate">Daily Rate (PHP)</Label>
            <Input
              id="dailyRate"
              type="number"
              className="mt-1"
              value={field('dailyRate') || worker.dailyRate}
              onChange={(e) => setForm((p) => ({ ...p, dailyRate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="hireDate">Hire Date</Label>
            <Input
              id="hireDate"
              className="mt-1 bg-muted"
              value={worker.hireDate ? worker.hireDate.slice(0, 10) : '—'}
              readOnly
            />
          </div>
          <div>
            <Label>Employment Type</Label>
            <Select
              value={field('employmentType') || worker.employmentType}
              onValueChange={(v) => setForm((p) => ({ ...p, employmentType: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateWorker.isPending || Object.keys(form).length === 0}>
            {updateWorker.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

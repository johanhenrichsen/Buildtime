import { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useWorkers, useCreateWorker } from '@/lib/queries';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatPeso(val: string | number) {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Workers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useWorkers();
  const createWorker = useCreateWorker();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWorker, setNewWorker] = useState({
    name: '',
    employeeNo: '',
    email: '',
    dailyRate: '',
    employmentType: 'regular',
    status: 'active' as 'active' | 'inactive',
    password: '',
  });

  const workers = data?.data ?? [];

  const filtered = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.employeeNo.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || w.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  async function handleAddWorker() {
    if (!newWorker.name || !newWorker.employeeNo || !newWorker.dailyRate || !newWorker.password) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    try {
      await createWorker.mutateAsync({
        name: newWorker.name,
        employeeNo: newWorker.employeeNo,
        email: newWorker.email || undefined,
        dailyRate: newWorker.dailyRate,
        employmentType: newWorker.employmentType,
        status: newWorker.status,
        password: newWorker.password,
      });
      setShowAddDialog(false);
      setNewWorker({ name: '', employeeNo: '', email: '', dailyRate: '', employmentType: 'regular', status: 'active', password: '' });
      toast({ title: 'Worker added', description: `${newWorker.name} has been added.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add worker.', variant: 'destructive' });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {workers.filter((w) => w.status === 'active').length} active workers
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Worker
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or employee no…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${
                filterStatus === s ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Worker</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Daily Rate</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No workers found.
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => setLocation(`/workers/${w.id}`)}
                    className="border-b border-border last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {getInitials(w.name)}
                        </div>
                        <span className="font-medium">{w.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{w.employeeNo}</td>
                    <td className="px-4 py-3">{formatPeso(w.dailyRate)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{w.employmentType}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={w.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'}
                      >
                        {w.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" placeholder="e.g. Juan dela Cruz" value={newWorker.name} onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="empNo">Employee No. *</Label>
              <Input id="empNo" placeholder="e.g. EMP-009" value={newWorker.employeeNo} onChange={(e) => setNewWorker((p) => ({ ...p, employeeNo: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="juan@example.com" value={newWorker.email} onChange={(e) => setNewWorker((p) => ({ ...p, email: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="rate">Daily Rate (PHP) *</Label>
              <Input id="rate" type="number" placeholder="850" value={newWorker.dailyRate} onChange={(e) => setNewWorker((p) => ({ ...p, dailyRate: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select value={newWorker.employmentType} onValueChange={(v) => setNewWorker((p) => ({ ...p, employmentType: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="project-based">Project-Based</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" placeholder="Temporary password" value={newWorker.password} onChange={(e) => setNewWorker((p) => ({ ...p, password: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddWorker} disabled={createWorker.isPending}>
              {createWorker.isPending ? 'Adding…' : 'Add Worker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

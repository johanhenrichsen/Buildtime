import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
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
import { useWorkers, useUpdateWorker, useEnrollmentStatus, useRevokeEnrollment } from '@/lib/queries';
import { EnrollmentCamera } from '@/components/EnrollmentCamera';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useWorkers();
  const updateWorker = useUpdateWorker();
  const { data: enrollStatus, refetch: refetchEnroll } = useEnrollmentStatus(id ?? '');
  const revokeEnrollment = useRevokeEnrollment();

  const worker = data?.data.find((w) => w.id === id);

  const [form, setForm] = useState<{
    name?: string;
    dailyRate?: string;
    status?: string;
    employmentType?: string;
  }>({});
  const [enrollResult, setEnrollResult] = useState<{ msg: string; success: boolean } | null>(null);

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

  async function handleRevoke() {
    if (!id) return;
    try {
      await revokeEnrollment.mutateAsync(id);
      setEnrollResult(null);
      toast({ title: 'Enrollment revoked', description: 'Face data removed.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke enrollment.', variant: 'destructive' });
    }
  }

  function handleEnrollResult(msg: string, success: boolean) {
    setEnrollResult({ msg, success });
    if (success) refetchEnroll();
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
  const isEnrolled = enrollStatus?.enrolled ?? false;

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <button
        onClick={() => setLocation('/workers')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workers
      </button>

      <div className="flex items-center gap-4">
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

      {/* Worker info */}
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
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="project-based">Project-Based</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
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

      {/* Face enrollment */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Face Enrollment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Required for face-recognition check-in at the kiosk</p>
          </div>
          <div className="flex items-center gap-2">
            {isEnrolled ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Enrolled</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleRevoke}
                  disabled={revokeEnrollment.isPending}
                >
                  {revokeEnrollment.isPending ? 'Revoking…' : 'Revoke'}
                </Button>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Not enrolled</span>
              </>
            )}
          </div>
        </div>

        {enrollStatus?.embedding && (
          <p className="text-xs text-muted-foreground mb-4">
            Last enrolled {new Date(enrollStatus.embedding.enrolledAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
            {enrollStatus.embedding.enrolledByWorker ? ` by ${enrollStatus.embedding.enrolledByWorker.name}` : ''}
            {' · '}quality {(enrollStatus.embedding.qualityScore * 100).toFixed(0)}%
          </p>
        )}

        {enrollResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm border ${
            enrollResult.success
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {enrollResult.msg}
          </div>
        )}

        {worker.status === 'active' ? (
          <EnrollmentCamera workerId={worker.id} onResult={handleEnrollResult} />
        ) : (
          <p className="text-sm text-muted-foreground">Worker must be active to enroll.</p>
        )}
      </div>
    </div>
  );
}

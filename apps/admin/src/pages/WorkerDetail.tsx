import { useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, CheckCircle2, XCircle, LogIn, LogOut, Upload } from 'lucide-react';
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
import { useWorkers, useUpdateWorker, useEnrollmentStatus, useRevokeEnrollment, useSites, useManualAttendance } from '@/lib/queries';
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

  const { data: sitesData } = useSites();
  const manualAttendance = useManualAttendance();
  const sites = sitesData?.data ?? [];

  const [form, setForm] = useState<{
    name?: string;
    dailyRate?: string;
    status?: string;
    employmentType?: string;
  }>({});
  const [enrollResult, setEnrollResult] = useState<{ msg: string; success: boolean } | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function field(key: 'name' | 'dailyRate' | 'status' | 'employmentType') {
    if (key in form && form[key] !== undefined) return form[key] as string;
    if (!worker) return '';
    return String(worker[key] ?? '');
  }

  async function handleManualClock(eventType: 'in' | 'out') {
    if (!id) return;
    if (!selectedSite) {
      toast({ title: 'Select a site', description: 'Please choose a site before recording attendance.', variant: 'destructive' });
      return;
    }
    try {
      const result = await manualAttendance.mutateAsync({ workerId: id, eventType, siteId: selectedSite });
      const label = eventType === 'in' ? 'Clock In' : 'Clock Out';
      const time = new Date(result.serverTs).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      toast({ title: `${label} recorded`, description: `${worker?.name} — ${time}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to record attendance.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  async function handleSave() {
    if (!id) return;
    try {
      await updateWorker.mutateAsync({ id, data: form });
      setForm({});
      toast({ title: 'Changes saved', description: 'Worker record updated.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save changes.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
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

  function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 256;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setPhotoPreview(dataUrl);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handlePhotoSave() {
    if (!id || !photoPreview) return;
    try {
      await updateWorker.mutateAsync({ id, data: { photo: photoPreview } });
      setPhotoPreview(null);
      toast({ title: 'Photo saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save photo.', variant: 'destructive' });
    }
  }

  async function handlePhotoRemove() {
    if (!id) return;
    try {
      await updateWorker.mutateAsync({ id, data: { photo: null } });
      setPhotoPreview(null);
      toast({ title: 'Photo removed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove photo.', variant: 'destructive' });
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
  const isEnrolled = enrollStatus?.enrolled ?? false;

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-5">
      <button
        onClick={() => setLocation('/workers')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Workers
      </button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden">
          {worker.photo
            ? <img src={worker.photo} alt={worker.name} className="w-full h-full object-cover" />
            : getInitials(worker.name)
          }
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

      {/* Photo */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4">Worker Photo</h2>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {photoPreview
              ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              : worker.photo
              ? <img src={worker.photo} alt={worker.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-muted-foreground">{getInitials(worker.name)}</span>
            }
          </div>
          <div className="space-y-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoFile}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {worker.photo ? 'Change photo' : 'Upload photo'}
              </Button>
              {photoPreview && (
                <Button size="sm" onClick={handlePhotoSave} disabled={updateWorker.isPending}>
                  {updateWorker.isPending ? 'Saving…' : 'Save photo'}
                </Button>
              )}
              {worker.photo && !photoPreview && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handlePhotoRemove}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">256×256 max, JPEG. Used in dashboard and on-site view.</p>
          </div>
        </div>
      </div>

      {/* Manual attendance */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Manual Attendance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Record a clock-in or clock-out event for this worker</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="w-full sm:w-64">
            <Label className="text-xs mb-1 block">Site</Label>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="— select site —" />
              </SelectTrigger>
              <SelectContent>
                {sites.filter((s) => s.status === 'active').map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={manualAttendance.isPending || !selectedSite}
              onClick={() => handleManualClock('in')}
            >
              <LogIn className="w-4 h-4" />
              Clock In
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
              disabled={manualAttendance.isPending || !selectedSite}
              onClick={() => handleManualClock('out')}
            >
              <LogOut className="w-4 h-4" />
              Clock Out
            </Button>
          </div>
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

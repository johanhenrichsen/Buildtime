import { useState } from 'react';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift, useSites, useUpdateSite } from '@/lib/queries';
import type { Shift } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Plus, X } from 'lucide-react';

function fmt(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

interface ShiftFormProps {
  initial?: Shift;
  onSave: (data: { name: string; startTime: string; endTime: string; graceMinutes: number }) => Promise<void>;
  onCancel: () => void;
}

function ShiftForm({ initial, onSave, onCancel }: ShiftFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '07:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '16:00');
  const [grace, setGrace] = useState(String(initial?.graceMinutes ?? 15));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, startTime, endTime, graceMinutes: parseInt(grace, 10) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-5 bg-card space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Shift name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Day Shift" required className="mt-1" />
        </div>
        <div>
          <Label>Start time</Label>
          <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>End time</Label>
          <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Grace period (min)</Label>
          <Input type="number" min={0} max={120} value={grace} onChange={e => setGrace(e.target.value)} required className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>
    </form>
  );
}

export default function Shifts() {
  const { data: shifts = [], isLoading } = useShifts();
  const { data: sitesResp } = useSites();
  const sites = sitesResp?.data ?? [];
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const updateSite = useUpdateSite();
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function handleCreate(data: Parameters<typeof createShift.mutateAsync>[0]) {
    await createShift.mutateAsync(data);
    setCreating(false);
    toast({ title: 'Shift created' });
  }

  async function handleUpdate(id: string, data: Parameters<typeof updateShift.mutateAsync>[0]['data']) {
    await updateShift.mutateAsync({ id, data });
    setEditId(null);
    toast({ title: 'Shift updated' });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shift? Sites using it will have no shift assigned.')) return;
    await deleteShift.mutateAsync(id);
    toast({ title: 'Shift deleted' });
  }

  async function handleSiteShiftChange(siteId: string, shiftId: string) {
    await updateSite.mutateAsync({ id: siteId, data: { shiftId: shiftId || undefined } });
    toast({ title: 'Site shift updated' });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shifts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define work schedules used for DTR computation</p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Shift
          </Button>
        )}
      </div>

      {creating && (
        <ShiftForm onSave={handleCreate} onCancel={() => setCreating(false)} />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && shifts.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">No shifts defined yet.</p>
      )}

      <div className="space-y-3">
        {shifts.map(shift => (
          <div key={shift.id}>
            {editId === shift.id ? (
              <ShiftForm
                initial={shift}
                onSave={data => handleUpdate(shift.id, data)}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div className="border border-border rounded-lg px-5 py-4 flex items-center gap-4 bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{shift.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmt(shift.startTime)} – {fmt(shift.endTime)} &middot; {shift.graceMinutes} min grace
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditId(shift.id)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(shift.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Site-to-shift assignment */}
      {sites.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Assign shifts to sites</h2>
          <div className="border border-border rounded-lg divide-y divide-border">
            {sites.map(site => (
              <div key={site.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{site.name}</p>
                  {site.address && <p className="text-xs text-muted-foreground truncate">{site.address}</p>}
                </div>
                <select
                  className="text-sm border border-input rounded-md px-2 py-1 bg-background"
                  value={site.shiftId ?? ''}
                  onChange={e => handleSiteShiftChange(site.id, e.target.value)}
                >
                  <option value="">— No shift —</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

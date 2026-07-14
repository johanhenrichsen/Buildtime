import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useEnrollmentStatus(workerId: string) {
  return useQuery({
    queryKey: ['enrollment', workerId],
    queryFn: () => api.getEnrollmentStatus(workerId),
    enabled: !!workerId,
  })
}

export function useRevokeEnrollment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workerId: string) => api.revokeEnrollment(workerId),
    onSuccess: (_data, workerId) => qc.invalidateQueries({ queryKey: ['enrollment', workerId] }),
  })
}

export function useWorkers(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workers', params],
    queryFn: () => api.getWorkers(params),
  })
}

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: () => api.getSites(),
  })
}

export function useCutoffs() {
  return useQuery({
    queryKey: ['cutoffs'],
    queryFn: () => api.getCutoffs(),
  })
}

export function useDtr(cutoffId: string) {
  return useQuery({
    queryKey: ['dtr', cutoffId],
    queryFn: () => api.getDtr(cutoffId),
    enabled: !!cutoffId,
  })
}

export function useFlagged(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['flagged', params],
    queryFn: () => api.getFlagged(params),
  })
}

export function useAuditLog(params?: { entity?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => api.getAuditLog(params),
  })
}

export function useCreateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createWorker>[0]) => api.createWorker(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
  })
}

export function useUpdateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateWorker>[1] }) =>
      api.updateWorker(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
  })
}

export function useCreateCutoff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createCutoff>[0]) => api.createCutoff(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cutoffs'] }),
  })
}

export function useComputeDtr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cutoffId: string) => api.computeDtr(cutoffId),
    onSuccess: (_data, cutoffId) => qc.invalidateQueries({ queryKey: ['dtr', cutoffId] }),
  })
}

export function useUpdateDtr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateDtr>[1] }) =>
      api.updateDtr(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dtr'] }),
  })
}

export function useReviewFlagged() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approve' | 'reject'; reason: string }) =>
      api.reviewFlagged(id, decision, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flagged'] }),
  })
}

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call, type Schemas } from '@/api/client';
import { walletKeys } from '@/features/wallet/queries';

export type Shipment = Schemas['Shipment'];
export type ShipmentEvent = Schemas['ShipmentEvent'];
export type ShipmentStatus = Schemas['ShipmentStatus'];
export type ShipmentInput = Schemas['ShipmentInput'];

export const shipmentKeys = {
  all: ['shipments'] as const,
  list: (filter: string) => ['shipments', 'list', filter] as const,
  one: (id: string) => ['shipments', 'one', id] as const,
  events: (id: string) => ['shipments', 'events', id] as const,
};

/**
 * Which statuses each status may move to; mirrors the transitions table
 * in services/core/internal/shipments/model.go. The core enforces it; this
 * only decides which buttons to show.
 */
export const nextStatuses: Record<ShipmentStatus, ShipmentStatus[]> = {
  booked: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'customs', 'delivered', 'exception'],
  in_transit: ['customs', 'delivered', 'exception'],
  customs: ['in_transit', 'delivered', 'exception'],
  exception: ['in_transit', 'customs', 'delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const activeStatuses: ShipmentStatus[] = ['booked', 'picked_up', 'in_transit', 'customs', 'exception'];

export function useShipments(filter: 'active' | 'done') {
  const status = filter === 'active' ? activeStatuses.join(',') : 'delivered,cancelled';
  return useInfiniteQuery({
    queryKey: shipmentKeys.list(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      call(api.GET('/v1/shipments', { params: { query: { status, limit: 30, cursor: pageParam } } })),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: shipmentKeys.one(id),
    queryFn: () => call(api.GET('/v1/shipments/{id}', { params: { path: { id } } })),
  });
}

export function useShipmentEvents(id: string) {
  return useQuery({
    queryKey: shipmentKeys.events(id),
    queryFn: () => call(api.GET('/v1/shipments/{id}/events', { params: { path: { id } } })),
  });
}

export function useBookShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: ShipmentInput; idempotencyKey: string }) =>
      call(api.POST('/v1/shipments', { body: input, params: { header: { 'Idempotency-Key': idempotencyKey } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shipmentKeys.all });
      void qc.invalidateQueries({ queryKey: walletKeys.wallet });
    },
  });
}

export function useMoveShipment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { status: ShipmentStatus; location?: string; note?: string }) =>
      call(api.POST('/v1/shipments/{id}/status', { params: { path: { id } }, body: { internal: false, ...body } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: shipmentKeys.all }),
  });
}

export function useAddEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: 'checkpoint' | 'delay' | 'note'; location?: string; note?: string }) =>
      call(api.POST('/v1/shipments/{id}/events', { params: { path: { id } }, body: { internal: false, ...body } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: shipmentKeys.events(id) }),
  });
}

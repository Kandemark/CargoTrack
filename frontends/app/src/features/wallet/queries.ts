import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, call, type Schemas } from '@/api/client';

export type LedgerEntry = Schemas['LedgerEntry'];
export type TopUp = Schemas['TopUp'];

export const walletKeys = {
  wallet: ['wallet'] as const,
  ledger: ['wallet', 'ledger'] as const,
};

export function useWallet() {
  return useQuery({
    queryKey: walletKeys.wallet,
    queryFn: () => call(api.GET('/v1/billing/wallet')),
  });
}

export function useLedger() {
  return useInfiniteQuery({
    queryKey: walletKeys.ledger,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      call(api.GET('/v1/billing/ledger', { params: { query: { limit: 30, before: pageParam } } })),
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}

export function useStartTopUp() {
  return useMutation({
    mutationFn: (body: { amount_cents: number; phone: string }) =>
      call(api.POST('/v1/billing/topups', { body: { provider: 'mpesa', ...body } })),
  });
}

/** Asks the core to check with M-Pesa now; it rate-limits per top-up. */
export async function checkTopUp(id: string): Promise<TopUp> {
  return call(api.POST('/v1/billing/topups/{id}/check', { params: { path: { id } } }));
}

export function useRefreshWallet() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: walletKeys.wallet });
}

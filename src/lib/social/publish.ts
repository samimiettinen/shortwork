import { supabase } from '@/integrations/supabase/client';
import type { DeliveryResult, PublishPayload } from '../../../supabase/functions/_shared/publishing-contract';

export interface PublishResponse {
  postId: string;
  status: string;
  replayed: boolean;
  results: (DeliveryResult & { accountId: string; platform: string })[];
  summary: { total: number; succeeded: number; failed: number; needsAction: number };
}

export async function sendPublish(payload: PublishPayload): Promise<PublishResponse> {
  const { data, error } = await supabase.functions.invoke('social-publish', { body: payload });
  if (error) {
    if (error.context instanceof Response) {
      const details = await error.context.json().catch(() => null);
      if (typeof details?.error === 'string') throw new Error(details.error);
    }
    throw new Error('The request could not be confirmed. Check Queue before retrying; retrying this unchanged draft uses the same request ID.');
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.postId || !Array.isArray(data.results)) throw new Error('Unexpected publishing response. Check Queue before retrying.');
  return data as PublishResponse;
}

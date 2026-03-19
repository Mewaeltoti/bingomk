import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvokeOptions {
  body: Record<string, any>;
  retries?: number;
  retryDelay?: number;
}

/**
 * Invoke a Supabase edge function with automatic retry on failure.
 * Returns { data, error } — error is null on success.
 */
export async function invokeWithRetry(
  functionName: string,
  { body, retries = 2, retryDelay = 1500 }: InvokeOptions
): Promise<{ data: any; error: string | null }> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        lastError = error.message || 'Request failed';
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
          continue;
        }
        return { data: null, error: lastError };
      }

      // Check for application-level errors in response
      if (data?.error) {
        return { data, error: data.error };
      }

      return { data, error: null };
    } catch (e: any) {
      lastError = e?.message || 'Network error';
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  return { data: null, error: lastError || 'Request failed after retries' };
}

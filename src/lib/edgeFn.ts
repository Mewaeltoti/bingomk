import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

interface InvokeOptions<T> {
  body: Record<string, unknown>;
  retries?: number;
  retryDelay?: number;
  schema?: z.ZodType<T>;
}

/**
 * Invoke a Supabase edge function with automatic retry and optional Zod validation.
 * Returns { data, error } — error is null on success.
 */
export async function invokeWithRetry<T = any>(
  functionName: string,
  { body, retries = 2, retryDelay = 1500, schema }: InvokeOptions<T>
): Promise<{ data: T | null; error: string | null }> {
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

      // Validate response with schema if provided
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          console.warn(`[${functionName}] response validation failed`, result.error.flatten());
          // Still return data but log the mismatch
          return { data: data as T, error: null };
        }
        return { data: result.data, error: null };
      }

      return { data: data as T, error: null };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Network error';
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  return { data: null, error: lastError || 'Request failed after retries' };
}

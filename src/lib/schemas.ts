import { z } from 'zod';

// ─── Edge Function: purchase-cartela response ───────────────
export const PurchaseCartelaSuccessSchema = z.object({
  ok: z.literal(true),
  purchased: z.number(),
  cost: z.number(),
  new_balance: z.number(),
  prize_amount: z.number(),
});

export const PurchaseCartelaErrorSchema = z.object({
  error: z.string(),
  cost: z.number().optional(),
  new_balance: z.number().optional(),
});

export const PurchaseCartelaResponseSchema = z.union([
  PurchaseCartelaSuccessSchema,
  PurchaseCartelaErrorSchema,
]);

export type PurchaseCartelaSuccess = z.infer<typeof PurchaseCartelaSuccessSchema>;
export type PurchaseCartelaError = z.infer<typeof PurchaseCartelaErrorSchema>;

// ─── Edge Function: game-lifecycle response ─────────────────
export const GameLifecycleResponseSchema = z.object({
  ok: z.boolean(),
  status: z.string().optional(),
  session_number: z.number().optional(),
  error: z.string().optional(),
});

export type GameLifecycleResponse = z.infer<typeof GameLifecycleResponseSchema>;

// ─── Edge Function: verify-claim response ───────────────────
export const VerifyClaimResponseSchema = z.object({
  valid: z.boolean().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type VerifyClaimResponse = z.infer<typeof VerifyClaimResponseSchema>;

// ─── Edge Function: approve-transaction response ────────────
export const ApproveTransactionResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
});

export type ApproveTransactionResponse = z.infer<typeof ApproveTransactionResponseSchema>;

// ─── Edge Function: admin-reset-password response ───────────
export const AdminResetPasswordResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
});

export type AdminResetPasswordResponse = z.infer<typeof AdminResetPasswordResponseSchema>;

// ─── Supabase row types (runtime validation) ────────────────
export const GameRowSchema = z.object({
  id: z.string(),
  status: z.string(),
  pattern: z.string(),
  prize_amount: z.number(),
  cartela_price: z.number(),
  session_number: z.number(),
  auto_draw: z.boolean(),
  draw_speed: z.number(),
  winner_id: z.string().nullable(),
  created_at: z.string(),
});

export type GameRow = z.infer<typeof GameRowSchema>;

export const ProfileRowSchema = z.object({
  id: z.string(),
  balance: z.number(),
  display_name: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
});

export type ProfileRow = z.infer<typeof ProfileRowSchema>;

export const CartelaRowSchema = z.object({
  id: z.number(),
  numbers: z.any(), // JSONB — validated at usage site
  is_used: z.boolean(),
  owner_id: z.string().nullable(),
  banned_for_game: z.boolean(),
  is_favorite: z.boolean(),
  created_at: z.string(),
});

export type CartelaRow = z.infer<typeof CartelaRowSchema>;

export const DepositRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  amount: z.number(),
  bank: z.string(),
  reference: z.string(),
  status: z.string(),
  reviewed_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DepositRow = z.infer<typeof DepositRowSchema>;

export const WithdrawalRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  amount: z.number(),
  bank: z.string(),
  account_number: z.string(),
  status: z.string(),
  reviewed_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type WithdrawalRow = z.infer<typeof WithdrawalRowSchema>;

// ─── Helper: safe parse with fallback ───────────────────────
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn('[schema validation]', result.error.flatten());
    return null;
  }
  return result.data;
}

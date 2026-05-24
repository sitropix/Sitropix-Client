import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  inviteToken: z.string().min(16).max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const requestResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200),
});

export const patchProfileSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.union([z.string().max(32), z.literal("")]).optional(),
  })
  .strict()
  .refine((b) => b.email !== undefined || b.phoneNumber !== undefined, {
    message: "at_least_one_field",
  });

export const patchUiPreferencesSchema = z
  .object({
    uiPrefs: z.record(z.string(), z.unknown()),
  })
  .strict();

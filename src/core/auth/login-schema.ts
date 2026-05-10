import { z } from 'zod';

// Schéma Zod du formulaire de login. Les messages sont des clés i18n
// (résolues au rendu via t()), ce qui permet la traduction et la
// réutilisation en validation côté domaine.
export const loginSchema = z.object({
  instanceUrl: z
    .string()
    .trim()
    .min(1, 'login.errors.instanceUrlRequired')
    .url('login.errors.instanceUrlInvalid')
    .refine((value) => value.startsWith('https://'), 'login.errors.instanceUrlNotHttps'),
  email: z.string().trim().min(1, 'login.errors.emailRequired').email('login.errors.emailInvalid'),
  password: z.string().min(1, 'login.errors.passwordRequired'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

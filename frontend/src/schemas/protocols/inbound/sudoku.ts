import { z } from 'zod';
import { MtprotoClientSchema } from './mtproto';

export const SudokuClientSchema = MtprotoClientSchema.omit({ adTag: true, secret: true }).extend({
  id: z.string().default(''),
  sudokuKey:z.string().default(''),
});
export const SudokuInboundSettingsSchema = z.object({
  masterKey: z.string().default(''),
  publicKey: z.string().default(''),
  aead: z.enum(['chacha20-poly1305', 'aes-128-gcm', 'none']).default('chacha20-poly1305'),
  table: z
    .enum(['prefer_ascii', 'prefer_entropy', 'up_ascii_down_entropy', 'up_entropy_down_ascii'])
    .default('prefer_ascii'),
  clients: z.array(SudokuClientSchema).default([]),
  legacyId: z.string().optional(),
  legacyDevices: z.record(z.string(), z.string()).optional(),
  revokedKeyHashes: z.array(z.string()).optional(),
});
export type SudokuInboundSettings = z.infer<typeof SudokuInboundSettingsSchema>;

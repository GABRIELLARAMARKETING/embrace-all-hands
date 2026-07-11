import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_HELIX_CONFIG,
  HELIX_SETTINGS_RANGES,
  clampSettings,
  settingsForDifficulty,
  type HelixDifficultyConfig,
  type HelixSettings,
} from "@/game/config/difficulty";

const PLATFORM_KEY = "helix_difficulty";

const settingsSchema = z.object({
  ballSpeed: z.number().min(HELIX_SETTINGS_RANGES.ballSpeed[0]).max(HELIX_SETTINGS_RANGES.ballSpeed[1]),
  towerRotationSpeed: z
    .number()
    .min(HELIX_SETTINGS_RANGES.towerRotationSpeed[0])
    .max(HELIX_SETTINGS_RANGES.towerRotationSpeed[1]),
  obstacleDensity: z
    .number()
    .min(HELIX_SETTINGS_RANGES.obstacleDensity[0])
    .max(HELIX_SETTINGS_RANGES.obstacleDensity[1]),
  obstacleFrequency: z
    .number()
    .min(HELIX_SETTINGS_RANGES.obstacleFrequency[0])
    .max(HELIX_SETTINGS_RANGES.obstacleFrequency[1]),
  gapSize: z.number().min(HELIX_SETTINGS_RANGES.gapSize[0]).max(HELIX_SETTINGS_RANGES.gapSize[1]),
  gravity: z.number().min(HELIX_SETTINGS_RANGES.gravity[0]).max(HELIX_SETTINGS_RANGES.gravity[1]),
  scoreMultiplier: z
    .number()
    .min(HELIX_SETTINGS_RANGES.scoreMultiplier[0])
    .max(HELIX_SETTINGS_RANGES.scoreMultiplier[1]),
  difficultyProgressionRate: z
    .number()
    .min(HELIX_SETTINGS_RANGES.difficultyProgressionRate[0])
    .max(HELIX_SETTINGS_RANGES.difficultyProgressionRate[1]),
}) satisfies z.ZodType<HelixSettings>;

const difficultySchema = z.enum([
  "easy",
  "normal",
  "hard",
  "extreme",
  "insane",
  "nightmare",
  "custom",
]);

/**
 * Endpoint público — lido pelo jogo ao iniciar.
 * Sem middleware de auth para funcionar em SSR/pré-render.
 * Se a linha não existir no banco, retorna a dificuldade Normal (fallback seguro).
 */
export const getHelixDifficulty = createServerFn({ method: "GET" }).handler(
  async (): Promise<HelixDifficultyConfig> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("platform_settings")
        .select("value")
        .eq("key", PLATFORM_KEY)
        .maybeSingle();
      if (error || !data?.value) return DEFAULT_HELIX_CONFIG;
      const raw = data.value as { difficulty?: string; settings?: Partial<HelixSettings> };
      const difficulty = difficultySchema.safeParse(raw.difficulty).success
        ? (raw.difficulty as HelixDifficultyConfig["difficulty"])
        : "normal";
      const settings =
        difficulty === "custom"
          ? clampSettings(raw.settings ?? {})
          : settingsForDifficulty(difficulty);
      return { difficulty, settings };
    } catch {
      return DEFAULT_HELIX_CONFIG;
    }
  },
);

/**
 * Endpoint admin — atualiza a dificuldade ativa.
 * Requer usuário autenticado com role admin/super_admin.
 */
export const setHelixDifficulty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        difficulty: difficultySchema,
        settings: settingsSchema.optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<HelixDifficultyConfig> => {
    const { data: isAdmin, error: adminErr } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (adminErr) throw new Error(adminErr.message);
    if (!isAdmin) throw new Error("Sem permissão.");

    const settings =
      data.difficulty === "custom"
        ? clampSettings(data.settings ?? {})
        : settingsForDifficulty(data.difficulty);

    const payload: HelixDifficultyConfig = { difficulty: data.difficulty, settings };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings").upsert(
      {
        key: PLATFORM_KEY,
        value: payload as never,
        type: "json",
        description: "Dificuldade ativa do jogo Helix",
        is_critical: false,
        updated_by_id: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "helix_difficulty.update",
      entity_type: "platform_setting",
      entity_id: PLATFORM_KEY,
      new_value: payload as never,
    });

    return payload;
  });

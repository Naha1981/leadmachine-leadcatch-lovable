import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runLeadMachineGeminiAgent } from "@/lib/gemini-agent.server";

export const runLeadMachineGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) =>
    z
      .object({
        message: z.string().trim().min(1).max(6000),
        previousInteractionId: z.string().trim().max(200).optional(),
      })
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", context.userId)
      .single();

    if (error || !profile?.tenant_id) throw new Error("Workspace not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return runLeadMachineGeminiAgent(
      {
        db: context.supabase,
        adminDb: supabaseAdmin as any,
        tenantId: profile.tenant_id as string,
        userId: context.userId,
      },
      data.message,
      data.previousInteractionId,
    );
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getSalesExecutionStatus,
  resolveSalesExecutionApproval,
} from "./agent-workforce-execution.server";

const ActionInput = z.object({
  actionId: z.string().uuid(),
});

const DecisionInput = ActionInput.extend({
  note: z.string().trim().max(1000).optional(),
});

export const approveSalesExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => DecisionInput.parse(value))
  .handler(async ({ context, data }) =>
    resolveSalesExecutionApproval(context.userId, data.actionId, "approved", data.note),
  );

export const rejectSalesExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => DecisionInput.parse(value))
  .handler(async ({ context, data }) =>
    resolveSalesExecutionApproval(context.userId, data.actionId, "rejected", data.note),
  );

export const getSalesExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => ActionInput.parse(value))
  .handler(async ({ context, data }) =>
    getSalesExecutionStatus(context.userId, data.actionId),
  );

import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Workspace = {
  tenantId: string;
  userEmail: string;
  profile: Tables<"business_profiles">;
  config: Tables<"auto_reply_configs">;
};

/** Load (and on first sign-in, create) the user's tenant, profile and auto-reply config. */
export async function loadWorkspace(): Promise<Workspace> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  let { data: tenant } = await supabase.from("tenants").select("id").eq("owner_id", u.user.id).maybeSingle();
  if (!tenant) {
    const r = await supabase.from("tenants").insert({ owner_id: u.user.id }).select("id").single();
    if (r.error) throw r.error;
    tenant = r.data;
  }
  let { data: profile } = await supabase.from("business_profiles").select("*").eq("tenant_id", tenant.id).maybeSingle();
  if (!profile) {
    const r = await supabase.from("business_profiles").insert({ tenant_id: tenant.id }).select("*").single();
    if (r.error) throw r.error;
    profile = r.data;
  }
  let { data: config } = await supabase.from("auto_reply_configs").select("*").eq("tenant_id", tenant.id).maybeSingle();
  if (!config) {
    const r = await supabase
      .from("auto_reply_configs")
      .insert({ tenant_id: tenant.id, questions: ["What service do you need?", "What area are you in?"] })
      .select("*")
      .single();
    if (r.error) throw r.error;
    config = r.data;
  }
  return { tenantId: tenant.id, userEmail: u.user.email ?? "", profile, config };
}

export const workspaceQuery = queryOptions({ queryKey: ["workspace"], queryFn: loadWorkspace, staleTime: 30_000 });

export function useWorkspace() {
  return useQuery(workspaceQuery);
}

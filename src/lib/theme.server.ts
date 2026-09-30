import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export type PersistedTheme = "light" | "dark";

export const getPersistedTheme = createServerFn({ method: "GET" }).handler((): PersistedTheme => {
  return getCookie("leadmachine-theme") === "dark" ? "dark" : "light";
});

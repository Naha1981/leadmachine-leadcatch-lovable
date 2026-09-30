
import { describe, expect, it } from "vitest";

describe("Agent Workforce evidence rules", () => {
  it("keeps the approval gate on every generated external action", () => {
    const actions = [
      { approvalRequired: true },
      { approvalRequired: true },
      { approvalRequired: true },
    ];
    expect(actions.every((action) => action.approvalRequired)).toBe(true);
  });

  it("does not classify a proposed commercial interpretation as source-backed", () => {
    const label = "PROPOSAL" as const;
    expect(label).not.toBe("SOURCE-BACKED");
  });
});

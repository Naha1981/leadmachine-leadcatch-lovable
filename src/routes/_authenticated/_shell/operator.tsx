import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { runLeadMachineGemini } from "@/lib/gemini-agent.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/operator")({
  head: () => ({
    meta: [
      { title: "Gemini Operator — LeadMachine" },
      {
        name: "description",
        content: "Operate LeadMachine from one natural-language window with Gemini.",
      },
    ],
  }),
  component: GeminiOperatorPage,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function GeminiOperatorPage() {
  const run = useServerFn(runLeadMachineGemini);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm connected to this LeadMachine workspace. Ask me to find leads, inspect conversations, re-score a lead, update a lead, or schedule a follow-up.",
    },
  ]);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolUse, setToolUse] = useState<string[]>([]);

  async function submit() {
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    setToolUse([]);
    setText("");
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const result = await run({
        data: {
          message,
          previousInteractionId: interactionId ?? undefined,
        },
      });
      setInteractionId(result.interactionId ?? null);
      setToolUse(result.toolEvents.map((event) => event.name + (event.status === "failed" ? " failed" : "")));
      setMessages((current) => [...current, { role: "assistant", content: result.outputText }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Gemini could not complete that request.";
      setMessages((current) => [...current, { role: "assistant", content: messageText }]);
      toast.error(messageText);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <PageHeader
        title="Gemini Operator"
        subtitle="One window for LeadMachine operations."
      />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4" />
            LeadMachine control plane
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Gemini can read and operate your lead pipeline through controlled LeadMachine tools.
          </p>
        </div>

        <div className="min-h-[420px] space-y-4 p-4">
          {messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[90%]"}>
              <div
                className={
                  message.role === "user"
                    ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "rounded-2xl rounded-bl-md bg-secondary px-4 py-3 text-sm text-secondary-foreground"
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-4">
          {toolUse.length > 0 && (
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Used: {toolUse.join(" · ")}
            </p>
          )}
          <div className="flex gap-2">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              maxLength={6000}
              disabled={busy}
              placeholder='Try: "Show me my hot leads that are still new."'
              className="rounded-xl"
            />
            <Button onClick={() => void submit()} disabled={busy || !text.trim()} className="self-end rounded-xl">
              <Send className="mr-2 h-4 w-4" />
              {busy ? "Running…" : "Run"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

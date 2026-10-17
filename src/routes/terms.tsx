import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — RevenueDesk" },
      { name: "description", content: "The terms that govern your use of RevenueDesk." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 17 October 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-foreground">
        <p>
          These terms are between you and NahaLabs (Pty) Ltd ("NahaLabs", "we"), the operator of
          RevenueDesk. By creating an account or using RevenueDesk you accept them. South African
          law applies.
        </p>

        <section>
          <h2 className="text-base font-semibold">The service</h2>
          <p className="mt-2 text-muted-foreground">
            RevenueDesk is an AI front desk for service businesses: it captures enquiries on the
            channels you connect, qualifies leads, books follow-ups and shows you where revenue is
            leaking. Features may change as we improve the product.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Your account</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>You must be authorised to link the WhatsApp number and inboxes you connect.</li>
            <li>
              Keep your credentials confidential; you are responsible for activity on your account.
            </li>
            <li>One account per business unless we agree otherwise.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Acceptable use</h2>
          <p className="mt-2 text-muted-foreground">
            You may not use RevenueDesk to send spam or unlawful marketing, to harass, to process
            data you have no right to process, or to interfere with the service. You are responsible
            for complying with WhatsApp's terms, POPIA and direct-marketing rules when the assistant
            messages your customers. We may suspend accounts that break these rules.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Automated replies</h2>
          <p className="mt-2 text-muted-foreground">
            The AI front desk answers on your behalf using the business details and rules you
            configure. Review its behaviour before switching it on for customers. Quotes, prices and
            commitments it produces are drafts until your business confirms them; you remain
            responsible for what is sent in your name.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Fees</h2>
          <p className="mt-2 text-muted-foreground">
            Paid plans, when they apply to your account, are shown in the product or agreed in
            writing. Free and trial use may be limited. We will never charge you without your
            agreement first.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Availability and liability</h2>
          <p className="mt-2 text-muted-foreground">
            We work to keep RevenueDesk available and your data safe, but the service is provided
            "as is" without warranties of uninterrupted operation. To the extent the law allows,
            NahaLabs is not liable for indirect losses (such as lost profits) arising from use of
            the service. Nothing in these terms limits liability that cannot be limited under South
            African law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Ending the relationship</h2>
          <p className="mt-2 text-muted-foreground">
            You can stop using RevenueDesk and delete your account at any time in Settings → Account
            → Delete account; this removes your workspace data. We may suspend or close accounts
            that breach these terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            NahaLabs (Pty) Ltd ·{" "}
            <a
              href="mailto:sales@nahalabs.co.za"
              className="text-primary underline underline-offset-2"
            >
              sales@nahalabs.co.za
            </a>
          </p>
        </section>
      </div>

      <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground">
        <Link to="/auth" className="hover:text-foreground">
          Sign in
        </Link>
        <Link to="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link to="/landing" className="hover:text-foreground">
          About RevenueDesk
        </Link>
      </div>
    </div>
  );
}

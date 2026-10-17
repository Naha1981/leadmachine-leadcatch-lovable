import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — RevenueDesk" },
      {
        name: "description",
        content: "How RevenueDesk collects, uses and protects your information under POPIA.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 17 October 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-foreground">
        <p>
          RevenueDesk is operated by NahaLabs (Pty) Ltd ("NahaLabs", "we"), a South African company.
          This policy explains what we collect when you use RevenueDesk, why, and the choices you
          have. We process personal information in line with the Protection of Personal Information
          Act, 2013 (POPIA).
        </p>

        <section>
          <h2 className="text-base font-semibold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Account details: your email address and sign-in credentials.</li>
            <li>
              Business profile: business name, industry, service area, working hours and the
              services you sell.
            </li>
            <li>
              Channel data: the WhatsApp number you choose to link, and the customer enquiries,
              messages and lead records that flow through it.
            </li>
            <li>
              Usage data: actions you take in the product so we can operate, secure and improve it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">How we use it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              To run your AI front desk: answering, qualifying and logging enquiries on your behalf.
            </li>
            <li>To show you your inbox, lead queue, revenue leaks and insights.</li>
            <li>To keep the service secure, prevent abuse and fix problems.</li>
            <li>To contact you about your account when needed.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            We do not sell your information or your customers' information to anyone.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Where it is stored and who processes it</h2>
          <p className="mt-2 text-muted-foreground">
            Data is stored on Supabase infrastructure and processed by the subprocessors needed to
            run the service (hosting, authentication and the WhatsApp linking service). We only
            share what each service needs to do its job.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Your customers' data</h2>
          <p className="mt-2 text-muted-foreground">
            When your customers message your linked WhatsApp number, you are the responsible party
            for those conversations under POPIA and we act as your operator. You are responsible for
            telling your customers that an automated assistant may answer, and for honouring their
            requests to stop or to be forgotten.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Your rights</h2>
          <p className="mt-2 text-muted-foreground">
            You may access, correct or delete your information at any time. You can delete your
            whole account and all workspace data yourself in Settings → Account → Delete account.
            You may also object to processing or ask us for a copy of your data by writing to us.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Retention and security</h2>
          <p className="mt-2 text-muted-foreground">
            We keep your data while your account is active and delete it when you delete your
            account. Access is protected with encryption in transit, row-level tenant isolation and
            least-privilege service credentials.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Information officer: NahaLabs (Pty) Ltd. Email{" "}
            <a
              href="mailto:sales@nahalabs.co.za"
              className="text-primary underline underline-offset-2"
            >
              sales@nahalabs.co.za
            </a>{" "}
            for privacy questions, access requests or complaints. You also have the right to
            complain to the Information Regulator (South Africa) at inforegulator.org.za.
          </p>
        </section>
      </div>

      <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground">
        <Link to="/auth" className="hover:text-foreground">
          Sign in
        </Link>
        <Link to="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link to="/landing" className="hover:text-foreground">
          About RevenueDesk
        </Link>
      </div>
    </div>
  );
}

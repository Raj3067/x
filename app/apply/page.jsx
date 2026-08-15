import { applicationForm, site } from '@/content/site.config';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import FaqList from '@/components/FaqList';
import ApplicationForm from '@/components/ApplicationForm';
import Icon from '@/components/Icon';

export const metadata = {
  title: 'Apply',
  description: `Apply for staff on the ${site.serverName} Discord server.`,
};

export default function ApplyPage() {
  // Rendered server-side, so the check happens without exposing anything about
  // the webhook to the browser — only whether it exists.
  const configured = Boolean(process.env.DISCORD_WEBHOOK_URL);

  return (
    <>
      <PageHeader
        eyebrow="Questions and applications"
        title="Apply"
        lead="Common questions first, then the staff application. Read the rules before applying — most of what we look for is in there."
      />

      <Section id="faq" eyebrow="FAQ" title="Frequently asked">
        <div className="mt-8">
          <FaqList />
        </div>
      </Section>

      <Section id="apply" eyebrow="Staff" title={applicationForm.heading}>
        <Reveal className="mt-4 max-w-prose text-base leading-relaxed text-muted">
          <p>{applicationForm.intro}</p>
        </Reveal>

        {/* Setup warning — only you see this, because it disappears the moment
            the webhook is configured. Better than letting an applicant fill in
            seven fields and hit a wall. */}
        {!configured ? (
          <Reveal className="mt-8 flex gap-4 rounded-sm border border-dashed border-cta/50 bg-cta/5 p-6">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
            <div className="text-sm leading-relaxed text-muted">
              <p className="font-semibold text-body">
                Applications are not connected yet
              </p>
              <p className="mt-2 max-w-prose">
                Create a webhook in your private staff channel (Channel Settings &rarr;
                Integrations &rarr; Webhooks &rarr; New Webhook &rarr; Copy Webhook
                URL), then paste it into{' '}
                <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                  DISCORD_WEBHOOK_URL
                </code>{' '}
                in{' '}
                <code className="rounded-sm bg-ink/70 px-1.5 py-0.5 text-xs text-primary">
                  .env.local
                </code>{' '}
                and restart the dev server. Submissions will fail until then, and
                this notice disappears once it works.
              </p>
            </div>
          </Reveal>
        ) : null}

        <Reveal className="mt-10 rounded-sm border border-edge/60 bg-surface/40 p-6 sm:p-8">
          <ApplicationForm />
        </Reveal>
      </Section>
    </>
  );
}

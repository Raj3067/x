import { site } from '@/content/site.config';
import Section, { PageHeader } from '@/components/Section';
import Reveal from '@/components/Reveal';
import StaffGrid from '@/components/StaffGrid';
import { ButtonLink } from '@/components/Button';

export const metadata = {
  title: 'Staff',
  description: `The moderation team behind the ${site.serverName} Discord server.`,
};

export default function StaffPage() {
  return (
    <>
      <PageHeader
        eyebrow="The team"
        title="Staff"
        lead="The people who keep the server running. If something needs attention, any of them can help — or open a ticket and it reaches all of us."
      />

      <Section>
        <div className="mt-2">
          <StaffGrid />
        </div>

        <Reveal className="mt-12 rounded-sm border border-edge/60 bg-surface/50 p-6 sm:p-8">
          <h2 className="text-xl uppercase tracking-wide text-body">
            Want to join the team?
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
            We promote from within the community more often than not. Being around,
            being helpful, and keeping a level head counts for more than a long list
            of servers you have modded before.
          </p>
          <div className="mt-6">
            <ButtonLink href="/apply" variant="primary" size="md" icon="arrowRight">
              Apply for staff
            </ButtonLink>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

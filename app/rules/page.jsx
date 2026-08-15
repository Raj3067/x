import { rules, site } from '@/content/site.config';
import { PageHeader } from '@/components/Section';
import Section from '@/components/Section';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { ButtonLink } from '@/components/Button';

export const metadata = {
  title: 'Rules',
  description: `The rules for the ${site.serverName} Discord server.`,
};

export default function RulesPage() {
  return (
    <>
      <PageHeader eyebrow="Before you post" title="Server rules" lead={rules.intro} />

      <Section>
        <ol className="mt-2 space-y-4">
          {rules.items.map((rule, index) => (
            <Reveal
              as="li"
              key={rule.title}
              delay={index * 40}
              className="group flex gap-5 rounded-sm border border-edge/60 bg-surface/50 p-6 transition-colors duration-200 hover:border-primary/50"
            >
              {/* Number is decorative — the ordered list already conveys
                  sequence to assistive tech. */}
              <span
                aria-hidden="true"
                className="shrink-0 font-display text-2xl leading-none text-primary/70 transition-colors duration-200 group-hover:text-primary sm:text-3xl"
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <div>
                <h2 className="text-lg uppercase tracking-wide text-body">
                  {rule.title}
                </h2>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                  {rule.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>

        {/* Consequences notice. Rose border since it's a warning, with an icon
            alongside so colour isn't the only signal. */}
        <Reveal className="mt-10 flex gap-4 rounded-sm border border-cta/40 bg-cta/5 p-6">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            {rules.footnote}
          </p>
        </Reveal>

        <Reveal className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={site.inviteUrl} variant="cta" size="md" icon="discord">
            Join the server
          </ButtonLink>
          <ButtonLink href="/apply" variant="outline" size="md">
            Apply for staff
          </ButtonLink>
        </Reveal>
      </Section>
    </>
  );
}

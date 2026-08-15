'use client';

import { useState } from 'react';
import { faq } from '@/content/site.config';
import Icon from './Icon';
import Reveal from './Reveal';

// ---------------------------------------------------------------------------
// FaqList — expandable questions.
//
// Built on buttons with aria-expanded and aria-controls rather than
// <details>/<summary>, so the open/close state can be styled and animated
// consistently across browsers.
//
// Multiple items can be open at once — a visitor comparing two answers
// shouldn't have one snap shut when they open the other.
// ---------------------------------------------------------------------------

export default function FaqList() {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (index) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <ul className="divide-y divide-edge/40 overflow-hidden rounded-sm border border-edge/60 bg-surface/50">
      {faq.map((item, index) => {
        const isOpen = open.has(index);
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <Reveal as="li" key={item.q} delay={index * 40}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors duration-200 hover:bg-ink/40"
              >
                <span className="text-base leading-snug text-body">{item.q}</span>
                <Icon
                  name="chevronDown"
                  className={`h-4 w-4 shrink-0 text-primary transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>

            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <p className="max-w-prose px-6 pb-6 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </div>
          </Reveal>
        );
      })}
    </ul>
  );
}

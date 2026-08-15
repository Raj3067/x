'use client';

import { useRef, useState } from 'react';
import { applicationForm } from '@/content/site.config';
import Button from './Button';
import Icon from './Icon';

// ---------------------------------------------------------------------------
// ApplicationForm
//
// Fields are generated from `applicationForm.fields` in site.config.js, so
// editing that array changes the form, the validation, and the Discord embed
// together — nothing to keep in sync by hand.
//
// Accessibility notes:
//   - every input has a real <label for>, never a placeholder as its label
//   - errors sit next to their field, linked via aria-describedby, and the
//     field is marked aria-invalid
//   - the result banner is a live region so it's announced, not just seen
//   - the submit button disables while in flight so a double-click can't
//     submit twice
// ---------------------------------------------------------------------------

const inputBase =
  'w-full rounded-sm border bg-ink/60 px-4 py-3 text-base text-body placeholder:text-muted/60 transition-colors duration-200 focus:outline-none';

export default function ApplicationForm() {
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null); // { ok, message }
  const [submitting, setSubmitting] = useState(false);
  const bannerRef = useRef(null);

  if (applicationForm.closedNotice) {
    return (
      <div className="flex gap-4 rounded-sm border border-cta/40 bg-cta/5 p-6">
        <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
        <p className="text-sm leading-relaxed text-body">
          {applicationForm.closedNotice}
        </p>
      </div>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));

      if (response.ok && json.ok) {
        setResult({
          ok: true,
          message:
            'Application sent. Staff will read it and get back to you if you are moving forward.',
        });
        event.currentTarget.reset();
      } else if (json.errors) {
        setErrors(json.errors);
        setResult({
          ok: false,
          message: 'Some answers need another look — see the notes below each field.',
        });
      } else {
        setResult({
          ok: false,
          message:
            json.message ??
            'Something went wrong sending your application. Please open a ticket in Discord instead.',
        });
      }
    } catch {
      setResult({
        ok: false,
        message:
          'Could not reach the server. Check your connection and try again, or open a ticket in Discord.',
      });
    } finally {
      setSubmitting(false);
      // Move focus to the banner so the outcome is announced immediately.
      requestAnimationFrame(() => bannerRef.current?.focus());
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/* Honeypot. Off-screen rather than display:none so naive bots still fill
          it, and aria-hidden + tabIndex keep it away from real users. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="_hp">Leave this empty</label>
        <input id="_hp" name="_hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {result ? (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={`flex gap-4 rounded-sm border p-5 ${
            result.ok
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-cta/40 bg-cta/5'
          }`}
        >
          <Icon
            name={result.ok ? 'check' : 'alert'}
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              result.ok ? 'text-emerald-400' : 'text-cta'
            }`}
          />
          <p className="text-sm leading-relaxed text-body">{result.message}</p>
        </div>
      ) : null}

      {applicationForm.fields.map((field) => (
        <Field key={field.name} field={field} error={errors[field.name]} />
      ))}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          {submitting ? 'Sending' : 'Submit application'}
        </Button>
        <p className="text-xs text-muted">
          Read once, kept private, never shared outside the staff team.
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Field — one labelled input, with optional help text and an error slot.
// ---------------------------------------------------------------------------

function Field({ field, error }) {
  const helpId = field.help ? `${field.name}-help` : null;
  const errorId = error ? `${field.name}-error` : null;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const borderClass = error
    ? 'border-cta focus:border-cta'
    : 'border-edge/70 focus:border-primary';

  return (
    <div>
      <label
        htmlFor={field.name}
        className="block text-sm font-semibold uppercase tracking-[0.12em] text-body"
      >
        {field.label}
        {field.required ? (
          <span className="ml-1 text-cta" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal normal-case tracking-normal text-muted">
            (optional)
          </span>
        )}
      </label>

      {field.help ? (
        <p id={helpId} className="mt-1.5 text-xs text-muted">
          {field.help}
        </p>
      ) : null}

      <div className="mt-2.5">
        {field.type === 'textarea' ? (
          <textarea
            id={field.name}
            name={field.name}
            rows={5}
            required={field.required}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`${inputBase} ${borderClass} resize-y leading-relaxed`}
          />
        ) : field.type === 'select' ? (
          <div className="relative">
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              defaultValue=""
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={describedBy}
              className={`${inputBase} ${borderClass} cursor-pointer appearance-none pr-11`}
            >
              <option value="" disabled>
                Choose one
              </option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
          </div>
        ) : (
          <input
            id={field.name}
            name={field.name}
            type={field.type === 'number' ? 'number' : 'text'}
            required={field.required}
            maxLength={field.maxLength}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            autoComplete="off"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            className={`${inputBase} ${borderClass}`}
          />
        )}
      </div>

      {/* Error sits directly under its field, with an icon so colour isn't the
          only indicator. */}
      {error ? (
        <p id={errorId} className="mt-2 flex items-center gap-2 text-xs text-cta">
          <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

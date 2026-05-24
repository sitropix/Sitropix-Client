import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

type CommonProps = {
  label?: string;
  helpText?: ReactNode;
  errorText?: ReactNode;
  hideLabel?: boolean;
  containerClassName?: string;
};

const fieldBase =
  "w-full font-ui text-sx-sm text-[var(--text-primary)] " +
  "bg-[var(--surface-card)] border rounded-sx-md " +
  "outline-none transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] " +
  "placeholder:text-[var(--text-tertiary)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

const fieldHeight = "h-[38px] px-3";

function statusClasses(hasError: boolean) {
  if (hasError) {
    return "border-[var(--color-danger-500)] focus:shadow-[0_0_0_3px_rgba(200,65,44,0.18)]";
  }
  return "border-[var(--border-default)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:shadow-sx-focus";
}

function Label({ id, label, hideLabel }: { id: string; label?: string; hideLabel?: boolean }) {
  if (!label) return null;
  return (
    <label
      htmlFor={id}
      className={hideLabel ? "sr-only" : "block text-sx-xs font-semibold text-[var(--text-primary)]"}
    >
      {label}
    </label>
  );
}

function HelpRow({
  helpText,
  errorText,
}: {
  helpText?: ReactNode;
  errorText?: ReactNode;
}) {
  if (errorText) {
    return <p className="text-sx-xs text-[var(--color-danger-fg)]">{errorText}</p>;
  }
  if (helpText) {
    return <p className="text-sx-xs text-[var(--text-tertiary)]">{helpText}</p>;
  }
  return null;
}

export interface SxInputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    CommonProps {}

export const SxInput = forwardRef<HTMLInputElement, SxInputProps>(function SxInput(
  {
    label,
    helpText,
    errorText,
    hideLabel,
    containerClassName = "",
    className = "",
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hasError = Boolean(errorText);
  return (
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      <Label id={fieldId} label={label} hideLabel={hideLabel} />
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${fieldId}-error` : undefined}
        className={[fieldBase, fieldHeight, statusClasses(hasError), className].join(" ")}
        {...rest}
      />
      <div id={hasError ? `${fieldId}-error` : undefined}>
        <HelpRow helpText={helpText} errorText={errorText} />
      </div>
    </div>
  );
});

export interface SxTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    CommonProps {
  rows?: number;
}

export const SxTextarea = forwardRef<HTMLTextAreaElement, SxTextareaProps>(
  function SxTextarea(
    {
      label,
      helpText,
      errorText,
      hideLabel,
      containerClassName = "",
      className = "",
      rows = 4,
      id,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const hasError = Boolean(errorText);
    return (
      <div className={`flex flex-col gap-2 ${containerClassName}`}>
        <Label id={fieldId} label={label} hideLabel={hideLabel} />
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${fieldId}-error` : undefined}
          className={[
            fieldBase,
            "px-3 py-2 min-h-[80px] resize-y",
            statusClasses(hasError),
            className,
          ].join(" ")}
          {...rest}
        />
        <div id={hasError ? `${fieldId}-error` : undefined}>
          <HelpRow helpText={helpText} errorText={errorText} />
        </div>
      </div>
    );
  },
);

export interface SxSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    CommonProps {}

export const SxSelect = forwardRef<HTMLSelectElement, SxSelectProps>(function SxSelect(
  {
    label,
    helpText,
    errorText,
    hideLabel,
    containerClassName = "",
    className = "",
    id,
    children,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hasError = Boolean(errorText);
  return (
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      <Label id={fieldId} label={label} hideLabel={hideLabel} />
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${fieldId}-error` : undefined}
        className={[fieldBase, fieldHeight, "pr-8", statusClasses(hasError), className].join(" ")}
        {...rest}
      >
        {children}
      </select>
      <div id={hasError ? `${fieldId}-error` : undefined}>
        <HelpRow helpText={helpText} errorText={errorText} />
      </div>
    </div>
  );
});

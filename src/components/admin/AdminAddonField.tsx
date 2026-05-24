import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function AdminAddonFieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
      {children}
    </span>
  );
}

const inputCls =
  "rounded border border-[#24292E] bg-[#15191C] px-2 py-1.5 text-xs text-white outline-none focus:border-brand-lime/35";

type LabeledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AdminAddonLabeledInput({ label, hint, className, ...props }: LabeledInputProps) {
  return (
    <label className="flex flex-col gap-1">
      <AdminAddonFieldLabel>{label}</AdminAddonFieldLabel>
      <input className={[inputCls, className].filter(Boolean).join(" ")} {...props} />
      {hint ? <span className="text-[10px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

type LabeledSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
};

export function AdminAddonLabeledSelect({ label, className, children, ...props }: LabeledSelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <AdminAddonFieldLabel>{label}</AdminAddonFieldLabel>
      <select className={[inputCls, className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
    </label>
  );
}

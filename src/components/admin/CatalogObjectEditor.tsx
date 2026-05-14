import { useCallback } from "react";

export type CatalogValueType = "boolean" | "number" | "string" | "json";

export type CatalogEditRow = {
  uid: string;
  key: string;
  valueType: CatalogValueType;
  valueStr: string;
};

let _uid = 0;
function newUid() {
  _uid += 1;
  return `cf_${_uid}_${Date.now()}`;
}

export function catalogToRows(obj: Record<string, unknown> | undefined | null): CatalogEditRow[] {
  const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  return Object.keys(o)
    .sort()
    .map((key) => {
      const val = o[key];
      if (typeof val === "boolean") {
        return { uid: newUid(), key, valueType: "boolean" as const, valueStr: val ? "true" : "false" };
      }
      if (typeof val === "number" && Number.isFinite(val)) {
        return { uid: newUid(), key, valueType: "number" as const, valueStr: String(val) };
      }
      if (val !== null && typeof val === "object") {
        try {
          return { uid: newUid(), key, valueType: "json" as const, valueStr: JSON.stringify(val, null, 2) };
        } catch {
          return { uid: newUid(), key, valueType: "string" as const, valueStr: String(val) };
        }
      }
      return {
        uid: newUid(),
        key,
        valueType: "string" as const,
        valueStr: val === undefined || val === null ? "" : String(val),
      };
    });
}

export function rowsToCatalog(rows: CatalogEditRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    if (r.valueType === "boolean") {
      out[k] = r.valueStr === "true" || r.valueStr === "1" || r.valueStr.toLowerCase() === "yes";
    } else if (r.valueType === "number") {
      const n = parseFloat(String(r.valueStr).replace(/,/g, ""));
      out[k] = Number.isFinite(n) ? n : 0;
    } else if (r.valueType === "json") {
      const t = r.valueStr.trim();
      if (!t) out[k] = {};
      else {
        try {
          out[k] = JSON.parse(t);
        } catch {
          throw new Error(`Invalid JSON for key "${k}"`);
        }
      }
    } else {
      out[k] = r.valueStr;
    }
  }
  return out;
}

type Props = {
  rows: CatalogEditRow[];
  onChange: (next: CatalogEditRow[]) => void;
  title?: string;
};

export function CatalogObjectEditor({ rows, onChange, title = "Catalog fields" }: Props) {
  const updateRow = useCallback(
    (uid: string, patch: Partial<CatalogEditRow>) => {
      onChange(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    },
    [rows, onChange],
  );

  const removeRow = useCallback(
    (uid: string) => {
      onChange(rows.filter((r) => r.uid !== uid));
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, { uid: newUid(), key: "", valueType: "string", valueStr: "" }]);
  }, [rows, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">{title}</label>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-white hover:border-brand-lime/35"
        >
          Add field
        </button>
      </div>
      <div className="max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-[#24292E] bg-[#0f1318]">
        <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-[1] bg-[#1a1f26] text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="border-b border-[#2A3037] px-2 py-2">Key</th>
              <th className="border-b border-[#2A3037] px-2 py-2">Type</th>
              <th className="border-b border-[#2A3037] px-2 py-2">Value</th>
              <th className="border-b border-[#2A3037] px-1 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid} className="border-b border-[#2A3037]/80">
                <td className="align-top px-2 py-1.5">
                  <input
                    value={r.key}
                    onChange={(e) => updateRow(r.uid, { key: e.target.value })}
                    placeholder="field_key"
                    spellCheck={false}
                    className="w-full rounded border border-[#2A3037] bg-[#15191C] px-2 py-1 font-mono text-[11px] text-white"
                  />
                </td>
                <td className="align-top px-2 py-1.5">
                  <select
                    value={r.valueType}
                    onChange={(e) => updateRow(r.uid, { valueType: e.target.value as CatalogValueType })}
                    className="w-full rounded border border-[#2A3037] bg-[#15191C] px-1 py-1 text-[11px] text-white"
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON (object/array)</option>
                  </select>
                </td>
                <td className="align-top px-2 py-1.5">
                  {r.valueType === "boolean" ? (
                    <label className="flex items-center gap-2 px-1 py-1 text-white">
                      <input
                        type="checkbox"
                        checked={r.valueStr === "true" || r.valueStr === "1"}
                        onChange={(e) => updateRow(r.uid, { valueStr: e.target.checked ? "true" : "false" })}
                        className="accent-brand-lime"
                      />
                      <span className="text-zinc-400">{r.valueStr === "true" ? "true" : "false"}</span>
                    </label>
                  ) : r.valueType === "json" ? (
                    <textarea
                      value={r.valueStr}
                      onChange={(e) => updateRow(r.uid, { valueStr: e.target.value })}
                      rows={3}
                      spellCheck={false}
                      className="w-full min-w-[200px] rounded border border-[#2A3037] bg-[#15191C] px-2 py-1 font-mono text-[10px] text-white"
                    />
                  ) : (
                    <input
                      value={r.valueStr}
                      onChange={(e) => updateRow(r.uid, { valueStr: e.target.value })}
                      type={r.valueType === "number" ? "number" : "text"}
                      step={r.valueType === "number" ? "any" : undefined}
                      className="w-full rounded border border-[#2A3037] bg-[#15191C] px-2 py-1 font-mono text-[11px] text-white"
                    />
                  )}
                </td>
                <td className="align-top px-1 py-1.5">
                  <button
                    type="button"
                    onClick={() => removeRow(r.uid)}
                    className="rounded px-1.5 py-0.5 text-rose-300 hover:bg-rose-500/15"
                    title="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-4 text-center text-[11px] text-zinc-500">No catalog fields. Add one or leave empty.</p> : null}
      </div>
    </div>
  );
}

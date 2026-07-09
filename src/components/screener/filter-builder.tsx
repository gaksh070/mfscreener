"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTER_FIELDS, type FilterOp, type FilterRule } from "@/lib/filter-engine";

const NUMBER_OPS: { op: FilterOp; label: string }[] = [
  { op: "gt", label: "is greater than" },
  { op: "lt", label: "is less than" },
  { op: "between", label: "is between" },
];
const STRING_OPS: { op: FilterOp; label: string }[] = [{ op: "in", label: "is one of" }];

export function FilterBuilder({
  onAdd,
  disabled,
}: {
  onAdd: (rule: FilterRule) => void;
  disabled: boolean;
}) {
  const [field, setField] = useState(FILTER_FIELDS[0].field);
  const [op, setOp] = useState<FilterOp>("gt");
  const [value, setValue] = useState("");
  const [valueHi, setValueHi] = useState("");

  const fieldDef = FILTER_FIELDS.find((f) => f.field === field) ?? FILTER_FIELDS[0];
  const ops = fieldDef.type === "number" ? NUMBER_OPS : STRING_OPS;

  function handleFieldChange(next: string) {
    setField(next);
    const nextDef = FILTER_FIELDS.find((f) => f.field === next) ?? FILTER_FIELDS[0];
    setOp(nextDef.type === "number" ? "gt" : "in");
    setValue("");
    setValueHi("");
  }

  function handleAdd() {
    if (!value.trim()) return;
    if (fieldDef.type === "number") {
      if (op === "between") {
        const lo = Number(value);
        const hi = Number(valueHi);
        if (Number.isNaN(lo) || Number.isNaN(hi)) return;
        onAdd({ field, op, value: [lo, hi] });
      } else {
        const n = Number(value);
        if (Number.isNaN(n)) return;
        onAdd({ field, op, value: n });
      }
    } else {
      const list = value.split(",").map((v) => v.trim()).filter(Boolean);
      if (list.length === 0) return;
      onAdd({ field, op: "in", value: list });
    }
    setValue("");
    setValueHi("");
  }

  return (
    <div className="mfs-card flex flex-col gap-3 p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Add filter</p>

      <Select value={field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_FIELDS.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={op} onValueChange={(v) => setOp(v as FilterOp)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o.op} value={o.op}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {op === "between" ? (
        <div className="flex items-center gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Min" inputMode="decimal" />
          <span className="text-[var(--ink-soft)]">–</span>
          <Input value={valueHi} onChange={(e) => setValueHi(e.target.value)} placeholder="Max" inputMode="decimal" />
        </div>
      ) : fieldDef.type === "number" ? (
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" inputMode="decimal" />
      ) : (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Mid Cap Fund, Small Cap Fund"
        />
      )}

      <Button onClick={handleAdd} disabled={disabled} className="self-start">
        <Plus size={14} weight="bold" />
        Add filter
      </Button>
    </div>
  );
}

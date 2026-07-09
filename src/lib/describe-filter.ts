import { FILTER_FIELDS, type FilterRule } from "./filter-engine";

export function describeFilter(rule: FilterRule): string {
  const label = FILTER_FIELDS.find((f) => f.field === rule.field)?.label ?? rule.field;
  switch (rule.op) {
    case "gt":
      return `${label} > ${rule.value}`;
    case "lt":
      return `${label} < ${rule.value}`;
    case "between": {
      const [lo, hi] = rule.value as [number, number];
      return `${label}: ${lo}–${hi}`;
    }
    case "in":
      return `${label}: ${(rule.value as string[]).join(", ")}`;
    default:
      return label;
  }
}

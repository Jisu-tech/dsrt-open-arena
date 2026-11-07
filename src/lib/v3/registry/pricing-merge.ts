/**
 * DSRT Open Arena V3 — Pricing Merge Logic (NEW)
 * 
 * Three-way pricing merge that NEVER erases known pricing.
 * 
 * Rules:
 *   - A new source supplies pricing field by field, each with a "supplied" flag
 *   - If the new source did NOT supply a field (supplied=false), the prior value
 *     is preserved and the field is marked inherited
 *   - If the new source supplied a field with an explicit null, that is recorded
 *     as a confirmed-unknown
 *   - If the new source supplied a value, it replaces the prior value
 *   - A new snapshot is created ONLY if at least one field changed OR the source
 *     differs from the previous snapshot
 * 
 * @module v3/registry/pricing-merge
 */

import type {
  ModelPricingSnapshot,
  SuppliedPricing,
  SuppliedPrice,
  PricingSource,
} from '../contracts/registry';
import { computeContentHash } from './content-hash';

// ─────────────────────────────────────────────
// Merge result
// ─────────────────────────────────────────────

export interface MergedPricing {
  readonly inputPricePerMillion: string | null;
  readonly outputPricePerMillion: string | null;
  readonly reasoningPricePerMillion: string | null;
  readonly cachedInputPricePerMillion: string | null;

  readonly inputPriceSupplied: boolean;
  readonly outputPriceSupplied: boolean;
  readonly reasoningPriceSupplied: boolean;
  readonly cachedInputPriceSupplied: boolean;

  readonly currency: string;
  readonly pricingSource: PricingSource;
  readonly pricingSourceDetail: string | null;

  readonly fieldSources: {
    readonly input: PricingSource;
    readonly output: PricingSource;
    readonly reasoning: PricingSource;
    readonly cachedInput: PricingSource;
  };
}

export interface MergeOutcome {
  readonly merged: MergedPricing;
  readonly hasChanges: boolean;
  readonly changeSummary: string;
  readonly fieldsChanged: readonly string[];
  readonly inheritedFieldCount: number;
}

// ─────────────────────────────────────────────
// Merge function
// ─────────────────────────────────────────────

/**
 * Merge a new SuppliedPricing against an existing snapshot (or null if first time).
 */
export function mergePricing(
  newPricing: SuppliedPricing,
  existingSnapshot: ModelPricingSnapshot | null,
): MergeOutcome {
  const mergeField = (
    newField: SuppliedPrice,
    existingValue: string | null,
    existingSupplied: boolean,
  ): { value: string | null; supplied: boolean; inherited: boolean; changed: boolean } => {
    if (newField.supplied) {
      // New source addresses this field
      const changed = normalizeStr(newField.value) !== normalizeStr(existingValue)
                   || !existingSupplied;
      return {
        value: newField.value,
        supplied: true,
        inherited: false,
        changed,
      };
    }
    // New source did not address this field — preserve existing
    return {
      value: existingValue,
      supplied: existingSupplied,
      inherited: existingSupplied, // Inherited only if there was prior data
      changed: false,
    };
  };

  const existing = existingSnapshot;

  const input = mergeField(
    newPricing.input,
    existing?.inputPricePerMillion ?? null,
    existing?.inputPriceSupplied ?? false,
  );
  const output = mergeField(
    newPricing.output,
    existing?.outputPricePerMillion ?? null,
    existing?.outputPriceSupplied ?? false,
  );
  const reasoning = mergeField(
    newPricing.reasoning,
    existing?.reasoningPricePerMillion ?? null,
    existing?.reasoningPriceSupplied ?? false,
  );
  const cachedInput = mergeField(
    newPricing.cachedInput,
    existing?.cachedInputPricePerMillion ?? null,
    existing?.cachedInputPriceSupplied ?? false,
  );

  const fieldsChanged: string[] = [];
  if (input.changed) fieldsChanged.push('input');
  if (output.changed) fieldsChanged.push('output');
  if (reasoning.changed) fieldsChanged.push('reasoning');
  if (cachedInput.changed) fieldsChanged.push('cached_input');

  const inheritedFieldCount =
    (input.inherited ? 1 : 0) +
    (output.inherited ? 1 : 0) +
    (reasoning.inherited ? 1 : 0) +
    (cachedInput.inherited ? 1 : 0);

  // Determine overall source: if ANY field was inherited, overall is inherited;
  // otherwise it's the new source
  const anyFieldFromNewSource = input.changed || output.changed || reasoning.changed || cachedInput.changed
                             || (input.supplied && !input.inherited)
                             || (output.supplied && !output.inherited)
                             || (reasoning.supplied && !reasoning.inherited)
                             || (cachedInput.supplied && !cachedInput.inherited);

  const overallSource: PricingSource = anyFieldFromNewSource
    ? newPricing.source
    : (existing ? (existing.pricingSource ?? 'inherited' as PricingSource) : newPricing.source);

  const fieldSources = {
    input: input.inherited ? ('inherited' as PricingSource) : (input.supplied ? newPricing.source : ('inherited' as PricingSource)),
    output: output.inherited ? ('inherited' as PricingSource) : (output.supplied ? newPricing.source : ('inherited' as PricingSource)),
    reasoning: reasoning.inherited ? ('inherited' as PricingSource) : (reasoning.supplied ? newPricing.source : ('inherited' as PricingSource)),
    cachedInput: cachedInput.inherited ? ('inherited' as PricingSource) : (cachedInput.supplied ? newPricing.source : ('inherited' as PricingSource)),
  };

  const merged: MergedPricing = {
    inputPricePerMillion: input.value,
    outputPricePerMillion: output.value,
    reasoningPricePerMillion: reasoning.value,
    cachedInputPricePerMillion: cachedInput.value,

    inputPriceSupplied: input.supplied,
    outputPriceSupplied: output.supplied,
    reasoningPriceSupplied: reasoning.supplied,
    cachedInputPriceSupplied: cachedInput.supplied,

    currency: newPricing.currency || existing?.currency || 'USD',
    pricingSource: overallSource,
    pricingSourceDetail: newPricing.sourceDetail ?? existing?.pricingSourceDetail ?? null,
    fieldSources,
  };

  const hasChanges = fieldsChanged.length > 0 || existing === null;
  const changeSummary = buildChangeSummary(fieldsChanged, inheritedFieldCount, newPricing.source, existing);

  return {
    merged,
    hasChanges,
    changeSummary,
    fieldsChanged,
    inheritedFieldCount,
  };
}

/**
 * Compute the content hash for a merged pricing block.
 */
export async function hashMergedPricing(merged: MergedPricing): Promise<string> {
  const canonical = {
    input: { v: merged.inputPricePerMillion, s: merged.inputPriceSupplied },
    output: { v: merged.outputPricePerMillion, s: merged.outputPriceSupplied },
    reasoning: { v: merged.reasoningPricePerMillion, s: merged.reasoningPriceSupplied },
    cached_input: { v: merged.cachedInputPricePerMillion, s: merged.cachedInputPriceSupplied },
    currency: merged.currency,
    source: merged.pricingSource,
  };
  return computeContentHash(JSON.stringify(canonical));
}

function normalizeStr(v: string | null): string {
  if (v === null || v === undefined) return '__null__';
  // Normalize numeric strings to a consistent form for comparison
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  return n.toFixed(8);
}

function buildChangeSummary(
  fieldsChanged: readonly string[],
  inheritedCount: number,
  newSource: PricingSource,
  existing: ModelPricingSnapshot | null,
): string {
  if (existing === null) {
    return `Initial pricing snapshot from ${newSource}. Supplied fields: ${fieldsChanged.join(', ') || 'none'}`;
  }
  if (fieldsChanged.length === 0) {
    return `No pricing changes from ${newSource}. ${inheritedCount} field(s) inherited from prior snapshot.`;
  }
  return `Updated by ${newSource}. Changed: ${fieldsChanged.join(', ')}. Inherited: ${inheritedCount} field(s) from prior snapshot.`;
}
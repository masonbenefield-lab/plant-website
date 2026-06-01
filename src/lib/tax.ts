import { getStripe } from "@/lib/stripe";

// Kept for client-side preview only (step 2 shipping selection).
// Server-side tax always uses the Stripe Tax Calculation API below.
export const STATE_TAX_RATES: Record<string, number> = {
  TX: 0.0825, // 6.25% state + ~2% avg local
};

export function calcTaxCents(itemAmountCents: number, state: string): number {
  const rate = STATE_TAX_RATES[state.trim().toUpperCase()] ?? 0;
  return Math.round(itemAmountCents * rate);
}

/**
 * Call Stripe Tax Calculation API to get the authoritative tax amount.
 * The returned calculationId must be passed to
 * stripe.tax.transactions.createFromCalculation() in the webhook after payment
 * so the transaction appears in Stripe Tax → Transactions.
 *
 * Falls back to calcTaxCents() if the Stripe Tax API errors.
 */
export async function createStripeTaxCalculation(
  itemAmountCents: number,
  shippingCents: number,
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  },
  reference?: string
): Promise<{ taxCents: number; calculationId: string | null; stripeError?: string }> {
  const lineItems = [
    {
      amount: itemAmountCents,
      reference: reference ?? "item",
      tax_behavior: "exclusive" as const,
    },
    ...(shippingCents > 0
      ? [{
          amount: shippingCents,
          reference: "shipping_cost",
          tax_behavior: "exclusive" as const,
        }]
      : []),
  ];

  try {
    const calc = await getStripe().tax.calculations.create({
      currency: "usd",
      line_items: lineItems,
      customer_details: {
        address: {
          line1: address.line1,
          ...(address.line2 ? { line2: address.line2 } : {}),
          city: address.city,
          state: address.state,
          postal_code: address.zip,
          country: address.country || "US",
        },
        address_source: "shipping",
      },
    });

    return { taxCents: calc.tax_amount_exclusive, calculationId: calc.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[StripeTax] Calculation failed:", msg);
    const fallback = calcTaxCents(itemAmountCents, address.state);
    return { taxCents: fallback, calculationId: null, stripeError: msg };
  }
}

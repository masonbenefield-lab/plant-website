import { Shippo } from "shippo";

let _client: Shippo | null = null;

function getClient() {
  if (!_client) {
    _client = new Shippo({ apiKeyHeader: process.env.SHIPPO_API_KEY! });
  }
  return _client;
}

export interface ShipFromAddress {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShipToAddress {
  name: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ShippoRate {
  objectId: string;
  provider: string;
  servicelevelName: string;
  servicelevelToken: string;
  amount: string;
  currency: string;
  estimatedDays: number | null;
}

export async function getShippingRates(params: {
  from: ShipFromAddress;
  to: ShipToAddress;
  weightOz: number;
  enabledServices?: string[];
}): Promise<ShippoRate[]> {
  const client = getClient();
  const { from, to, weightOz, enabledServices } = params;

  const shipment = await client.shipments.create({
    addressFrom: {
      name: from.name,
      street1: from.street1,
      city: from.city,
      state: from.state,
      zip: from.zip,
      country: from.country,
      phone: from.phone ?? "",
      email: from.email ?? "",
      isResidential: false,
    },
    addressTo: {
      name: to.name,
      street1: to.street1,
      street2: to.street2 ?? "",
      city: to.city,
      state: to.state,
      zip: to.zip,
      country: to.country,
      isResidential: true,
    },
    parcels: [
      {
        massUnit: "oz",
        weight: String(Math.max(1, Math.round(weightOz))),
        distanceUnit: "in",
        length: "10",
        width: "8",
        height: "4",
      },
    ],
    async: false,
  });

  const rates = (shipment.rates ?? [])
    .filter((r) => {
      if (!enabledServices?.length) return true;
      return enabledServices.includes(r.servicelevel?.token ?? "");
    })
    .map((r) => ({
      objectId: r.objectId ?? "",
      provider: r.provider ?? "",
      servicelevelName: r.servicelevel?.name ?? "",
      servicelevelToken: r.servicelevel?.token ?? "",
      amount: r.amount ?? "0",
      currency: r.currency ?? "USD",
      estimatedDays: r.estimatedDays ?? null,
    }))
    .filter((r) => r.objectId);

  return rates;
}

export async function purchaseLabel(rateId: string): Promise<{
  transactionId: string;
  trackingNumber: string;
  labelUrl: string;
}> {
  const client = getClient();
  const transaction = await client.transactions.create({
    rate: rateId,
    async: false,
  });

  if (!transaction.trackingNumber || !transaction.labelUrl || !transaction.objectId) {
    const msgs = transaction.messages?.map((m) => m.text).filter(Boolean).join("; ") || "Label purchase failed";
    throw new Error(msgs);
  }

  return {
    transactionId: transaction.objectId,
    trackingNumber: transaction.trackingNumber,
    labelUrl: transaction.labelUrl,
  };
}

import { NextRequest, NextResponse } from "next/server";

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

function toStateAbbr(state: string): string {
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBR[state.toLowerCase()] ?? state;
}

async function getUspsToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://api.usps.com/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error("Failed to get USPS token");
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { line1, line2, city, state, zip, country } = body as {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };

  if (country && country !== "US") {
    return NextResponse.json({ valid: true });
  }

  const clientId = process.env.USPS_CLIENT_ID;
  const clientSecret = process.env.USPS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ valid: true });
  }

  try {
    const token = await getUspsToken(clientId, clientSecret);

    const params = new URLSearchParams({
      streetAddress: line1,
      city,
      state: toStateAbbr(state),
      ZIPCode: zip.slice(0, 5),
    });
    if (line2) params.set("secondaryAddress", line2);

    const res = await fetch(`https://api.usps.com/addresses/v3/address?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = (err as { error?: { message?: string } })?.error?.message
        ?? "Address could not be verified. Please check and try again.";
      return NextResponse.json({ valid: false, messages: [message] });
    }

    return NextResponse.json({ valid: true });
  } catch {
    // If USPS is unreachable, don't block the save
    return NextResponse.json({ valid: true });
  }
}

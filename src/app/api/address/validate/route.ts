import { NextRequest, NextResponse } from "next/server";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  const userId = process.env.USPS_USER_ID;
  if (!userId) {
    return NextResponse.json({ valid: true });
  }

  // USPS Web Tools: Address1 = apt/suite (line2), Address2 = street (line1)
  const xml = [
    `<AddressValidateRequest USERID="${escapeXml(userId)}">`,
    `<Revision>1</Revision>`,
    `<Address ID="0">`,
    `<Address1>${escapeXml(line2 ?? "")}</Address1>`,
    `<Address2>${escapeXml(line1)}</Address2>`,
    `<City>${escapeXml(city)}</City>`,
    `<State>${escapeXml(state)}</State>`,
    `<Zip5>${escapeXml(zip.slice(0, 5))}</Zip5>`,
    `<Zip4></Zip4>`,
    `</Address>`,
    `</AddressValidateRequest>`,
  ].join("");

  const uspsUrl = `https://secure.shippingapis.com/ShippingAPI.dll?API=Verify&XML=${encodeURIComponent(xml)}`;

  try {
    const res = await fetch(uspsUrl);
    const text = await res.text();

    const errorMatch = text.match(/<Description>(.*?)<\/Description>/);
    if (errorMatch) {
      return NextResponse.json({ valid: false, messages: [errorMatch[1]] });
    }

    return NextResponse.json({ valid: true });
  } catch {
    // If USPS is unreachable, don't block the user from saving
    return NextResponse.json({ valid: true });
  }
}

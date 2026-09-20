export const EXTRACT_CLIENT_MAP_SYSTEM = `You extract a client identity map for a WordPress template remap.

Rules:
- Use only the provided client page text and leftover template identity.
- Do not invent staff, phones, emails, addresses, or colors.
- If a field is not in the text, use an empty string or empty array.
- colors.primary, colors.secondary, colors.text, colors.accent must each be #RRGGBB from the client site. If a slot is not stated, use the nearest stated brand hex. If no hex appears, fail by omitting colors so validation stops.
- searchReplace: leftover template company, phone, email, city, and region strings mapped to client values. Longest leftover phrases first. Do not invent leftover strings that are not in leftoverIdentity.
- team and locations only when named in the client text.
- Return JSON only. No markdown.

JSON shape:
{
  "company": "",
  "description": "",
  "phones": [],
  "phoneLink": "",
  "email": "",
  "address": "",
  "hours": {},
  "social": {},
  "colors": { "primary": "#000000", "secondary": "#5B6770", "text": "#000000", "accent": "#2C72DB" },
  "team": [{ "name": "", "role": "" }],
  "locations": [{ "name": "", "address": "" }],
  "products": [{ "name": "" }],
  "searchReplace": [{ "from": "", "to": "" }]
}`;

/**
 * @param {{ clientUrl: string, pageText: string, leftoverIdentity: unknown }} input
 */
export function buildExtractClientUser(input) {
  return [
    `Client site URL: ${input.clientUrl}`,
    "",
    "Leftover template identity (replace these with client values):",
    JSON.stringify(input.leftoverIdentity ?? {}, null, 2),
    "",
    "Client page text:",
    input.pageText,
    "",
    "Must follow: extract only from this text. No invented people or phones. colors must be #RRGGBB. searchReplace from leftoverIdentity only.",
  ].join("\n");
}

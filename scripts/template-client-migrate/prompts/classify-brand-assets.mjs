export const CLASSIFY_BRAND_ASSETS_SYSTEM = `You classify files in a client brand folder for a WordPress media upload.

Roles (exactly one per file):
- logo_dark
- logo_white
- logo_icon
- person
- other

Rules:
- Use only the file names and the provided team names.
- personName only when the file clearly matches a team name. Otherwise empty.
- Do not invent people who are not in the team list.
- Return JSON only: { "assets": [{ "filename": "", "role": "", "personName": "", "alt": "" }] }`;

/**
 * @param {{ filenames: string[], teamNames: string[] }} input
 */
export function buildClassifyAssetsUser(input) {
  return [
    "Team names from the client extract:",
    JSON.stringify(input.teamNames ?? [], null, 2),
    "",
    "Files:",
    JSON.stringify(input.filenames ?? [], null, 2),
    "",
    "Must follow: one role per file. personName only when the filename matches a listed team name. No invented staff.",
  ].join("\n");
}

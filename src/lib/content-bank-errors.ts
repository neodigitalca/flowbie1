/** True when a bank API error only means the per-site content_bank_* table is not provisioned yet. */
export function isContentBankNotProvisionedMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find the table") ||
    m.includes("does not exist") ||
    m.includes("not created yet") ||
    m.includes("not provisioned") ||
    m.includes("physical table is missing")
  );
}

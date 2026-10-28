// The former platform CRM is not available here. Contact details are stored on the
// estimate request itself (contact_name / contact_phone), so this returns a local reference.
export async function contacts(_input: Record<string, unknown>): Promise<{ id: string }> {
  return { id: crypto.randomUUID() };
}

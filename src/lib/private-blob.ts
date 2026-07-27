import "server-only";

export function privateBlobToken() {
  const token = process.env.PRIVATE_DOCUMENTS_READ_WRITE_TOKEN;
  if (!token)
    throw new Error("Private document storage is not configured.");
  return token;
}

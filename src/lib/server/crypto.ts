const encoder = new TextEncoder();

export const toHex = (data: Uint8Array) =>
  Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const fromHex = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

export const randomToken = (length = 32) => toHex(crypto.getRandomValues(new Uint8Array(length)));

export const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
};

export const hashSecret = async (value: string) => sha256Hex(value);

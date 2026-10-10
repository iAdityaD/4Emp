import { gcm } from "@noble/ciphers/aes";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { utf8ToBytes, bytesToHex, hexToBytes } from "@noble/hashes/utils";
export interface Envelope {
  format: "4Employee";
  version: 1;
  algorithm: "AES-256-GCM";
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
}
export async function encryptBackup(
  plain: string,
  password: string,
  salt: Uint8Array,
  nonce: Uint8Array,
): Promise<Envelope> {
  if (password.length < 10)
    throw Error("Use a passphrase of at least 10 characters");
  const iterations = 210000;
  const key = await pbkdf2Async(sha256, utf8ToBytes(password), salt, {
    c: iterations,
    dkLen: 32,
  });
  try {
    return {
      format: "4Employee",
      version: 1,
      algorithm: "AES-256-GCM",
      iterations,
      salt: bytesToHex(salt),
      nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(gcm(key, nonce).encrypt(utf8ToBytes(plain))),
    };
  } finally {
    key.fill(0);
  }
}
export async function decryptBackup(e: Envelope, password: string) {
  if (
    e.format !== "4Employee" ||
    e.version !== 1 ||
    e.algorithm !== "AES-256-GCM" ||
    e.iterations !== 210000 ||
    e.salt.length !== 32 ||
    e.nonce.length !== 24 ||
    e.ciphertext.length > 50000000
  )
    throw Error("Unsupported or invalid backup");
  const key = await pbkdf2Async(
    sha256,
    utf8ToBytes(password),
    hexToBytes(e.salt),
    { c: e.iterations, dkLen: 32 },
  );
  try {
    const bytes = gcm(key, hexToBytes(e.nonce)).decrypt(
      hexToBytes(e.ciphertext),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    throw Error("Incorrect passphrase or damaged backup");
  } finally {
    key.fill(0);
  }
}
export function csv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? "");
          if (typeof value === "string" && /^[=+@\-]/.test(text))
            text = "'" + text;
          return '"' + text.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}

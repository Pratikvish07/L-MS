import * as Crypto from 'expo-crypto';

import { PAIRING_CODE_LENGTH } from './validation';

/** Stable, collision-resistant session ID for recordings, chapters and commands. */
export function createSessionId(): string {
  return Crypto.randomUUID();
}

/** Cryptographically random 6-digit code, e.g. "482019". Rejection sampling keeps digits uniform. */
export function createPairingCode(): string {
  let code = '';
  while (code.length < PAIRING_CODE_LENGTH) {
    for (const byte of Crypto.getRandomBytes(16)) {
      if (byte < 250 && code.length < PAIRING_CODE_LENGTH) code += String(byte % 10);
    }
  }
  return code;
}

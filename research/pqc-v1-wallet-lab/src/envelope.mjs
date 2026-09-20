import { sign, verify, generateKeyPairSync } from 'node:crypto';
import * as kit from '@solana/kit';
import { fixtureAddress } from './protocol.mjs';

export const RESOURCES = Object.freeze({ computeUnitLimit: 1_400_000, loadedAccountsDataSizeLimit: 65_536,
  heapRequested: null, defaultHeapBytes: 32_768, priorityFeeLamports: 0 });
const address = bytes => kit.getAddressDecoder().decode(bytes);
export function encodeEnvelope(payload, version = 1, withResources = true, payerKey = null) {
  const payer = payerKey ? address(payerKey.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)) : address(fixtureAddress('payer'));
  let message = kit.createTransactionMessage({ version });
  message = kit.setTransactionMessageFeePayer(payer, message);
  message = kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: address(fixtureAddress('not-a-blockhash')), lastValidBlockHeight: 1n }, message);
  message = kit.appendTransactionMessageInstruction({ programAddress: address(fixtureAddress('research-program')),
    accounts: [{ address: address(fixtureAddress('wallet')), role: kit.AccountRole.WRITABLE },
      { address: address(fixtureAddress('recipient')), role: kit.AccountRole.WRITABLE },
      { address: address(Buffer.alloc(32)), role: kit.AccountRole.READONLY }], data: payload }, message);
  if (withResources) {
    message = kit.setTransactionMessageComputeUnitLimit(RESOURCES.computeUnitLimit, message);
    message = kit.setTransactionMessageLoadedAccountsDataSizeLimit(RESOURCES.loadedAccountsDataSizeLimit, message);
  }
  const compiled = kit.compileTransaction(message);
  let nativeSignatureValid = null;
  let tx = compiled;
  if (payerKey) {
    const signature = sign(null, compiled.messageBytes, payerKey.privateKey);
    nativeSignatureValid = verify(null, compiled.messageBytes, payerKey.publicKey, signature);
    tx = { ...compiled, signatures: { [payer]: signature } };
  }
  const bytes = Buffer.from(kit.getTransactionEncoder().encode(tx));
  const decoded = kit.getTransactionDecoder().decode(bytes);
  const decodedMessage = kit.getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  const reencoded = Buffer.from(kit.getTransactionEncoder().encode(decoded));
  if (!reencoded.equals(bytes)) throw new Error('SDK round-trip mismatch');
  return { bytes, base64: bytes.toString('base64'), nativeSignatureValid, decodedMessage,
    version: decodedMessage.version, configMask: decodedMessage.configMask ?? null,
    configValues: decodedMessage.configValues ?? null, roundTrip: true };
}
const shortLength = n => n < 128 ? 1 : n < 16384 ? 2 : 3;
// Independent size formulas, not an alternate network encoder. One native signature, one action.
export function modeledEnvelopeBytes(payloadLength, version = 1, withResources = true) {
  if (!Number.isSafeInteger(payloadLength) || payloadLength < 0 || payloadLength > 65535) throw new Error('Invalid payload length');
  if (version === 1) return 1 + 3 + 4 + 32 + 1 + 1 + 5 * 32 + (withResources ? 8 : 0) + 4 + 3 + payloadLength + 64;
  if (![0, 'legacy'].includes(version)) throw new Error('Unsupported version');
  const accounts = withResources ? 6 : 5;
  const budgetInstructions = withResources ? 2 * (1 + 1 + 1 + 5) : 0;
  return 1 + 64 + (version === 0 ? 1 : 0) + 3 + 1 + accounts * 32 + 32 + 1
    + budgetInstructions + 1 + 1 + 3 + shortLength(payloadLength) + payloadLength + (version === 0 ? 1 : 0);
}
export const newNativePayer = () => generateKeyPairSync('ed25519');

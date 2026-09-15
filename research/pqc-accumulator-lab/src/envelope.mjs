import { sign, verify } from 'node:crypto';
import * as kit from '../../pqc-v1-wallet-lab/node_modules/@solana/kit/dist/index.node.mjs';
import { fixtureAddress } from '../../pqc-v1-wallet-lab/src/protocol.mjs';
import { newNativePayer, RESOURCES } from '../../pqc-v1-wallet-lab/src/envelope.mjs';

const address = bytes => kit.getAddressDecoder().decode(bytes);
const namedAddress = label => address(fixtureAddress(`accumulator-${label}`));

// Actual Kit v1 serialization of an approval transaction with fee payer, program, wallet PDA and pending PDA.
// Addresses and blockhash are inert fixtures: serialization evidence only, never submitted.
export function encodeApprovalEnvelope(data, payerKey = newNativePayer()) {
  const payer = address(payerKey.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32));
  let message = kit.createTransactionMessage({ version: 1 });
  message = kit.setTransactionMessageFeePayer(payer, message);
  message = kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: namedAddress('inert-blockhash'), lastValidBlockHeight: 1n }, message);
  message = kit.appendTransactionMessageInstruction({ programAddress: namedAddress('program'),
    accounts: [{ address: namedAddress('wallet'), role: kit.AccountRole.WRITABLE }, { address: namedAddress('pending'), role: kit.AccountRole.WRITABLE }],
    data }, message);
  message = kit.setTransactionMessageComputeUnitLimit(RESOURCES.computeUnitLimit, message);
  message = kit.setTransactionMessageLoadedAccountsDataSizeLimit(RESOURCES.loadedAccountsDataSizeLimit, message);
  const compiled = kit.compileTransaction(message);
  const nativeSignature = sign(null, compiled.messageBytes, payerKey.privateKey);
  if (!verify(null, compiled.messageBytes, payerKey.publicKey, nativeSignature)) throw new Error('Native fee payer signature failed');
  const bytes = Buffer.from(kit.getTransactionEncoder().encode({ ...compiled, signatures: { [payer]: nativeSignature } }));
  const decoded = kit.getTransactionDecoder().decode(bytes);
  const reencoded = Buffer.from(kit.getTransactionEncoder().encode(decoded));
  if (!bytes.equals(reencoded)) throw new Error('Kit round trip failed');
  return { bytes, configMask: kit.getCompiledTransactionMessageDecoder().decode(decoded.messageBytes).configMask, nativeSignatureValid: true };
}

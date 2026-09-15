// Read-only public RPC only. No credentials, signing, sends, simulations or funding requests.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const commands = ['rustc', 'cargo', 'solana', 'agave-validator', 'solana-test-validator', 'cargo-build-sbf'];
const toolchain = Object.fromEntries(commands.map(command => {
  const r = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 });
  return [command, { available: !r.error && r.status === 0, version: r.stdout?.trim() || null,
    error: r.error?.code ?? (r.status ? r.stderr?.trim() : null) }];
}));
const sdk = {};
for (const name of ['@solana/kit', '@solana/web3.js']) {
  try { sdk[name] = { version: require(`${name}/package.json`).version }; }
  catch (e) {
    try { sdk[name] = { version: JSON.parse(readFileSync(new URL(`node_modules/${name}/package.json`, root))).version }; }
    catch { sdk[name] = { error: e.code }; }
  }
}
try {
  const kit = await import('@solana/kit');
  const message = kit.createTransactionMessage({ version: 1 });
  sdk.kit_v1_message_creation = { result: message, warning: 'Construction alone does not establish serialization support.' };
} catch (e) { sdk.kit_v1_message_creation = { error: e.message }; }
let previousRpc;
try { previousRpc = JSON.parse(readFileSync(new URL('environment.json', root))).rpc; } catch {}
const result = { checked_at_utc: new Date().toISOString(), node: process.version, openssl: process.versions.openssl,
  platform: process.platform, architecture: process.arch, toolchain, sdk,
  onchain_compile: ['rustc', 'cargo', 'cargo-build-sbf'].every(name => toolchain[name].available)
    ? 'NOT_ATTEMPTED' : 'TOOLCHAIN_BLOCKED', onchain_execution: 'NOT_RUN', transactions_sent: 0,
  rpc: previousRpc ?? { status: 'NOT_REQUESTED', calls: [] } };
if (process.argv.includes('--public-rpc')) {
  result.rpc = { status: 'REQUESTED', checked_at_utc: new Date().toISOString(), calls: [] };
  const endpoint = 'https://api.mainnet-beta.solana.com';
  const feature = 'txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL';
  result.rpc.endpoint = endpoint;
  result.rpc.feature = feature;
  async function rpc(method, params) {
    const request = { jsonrpc: '2.0', id: result.rpc.calls.length + 1, method, params };
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
      const rawResponse = await r.text();
      const response = JSON.parse(rawResponse);
      result.rpc.calls.push({ requested_at_utc: new Date().toISOString(), request, http_status: r.status, raw_response: rawResponse, response });
      return response.result;
    } catch(e) { result.rpc.calls.push({ request, error: e.message }); return null; }
  }
  await rpc('getVersion', []);
  const epoch = await rpc('getEpochInfo', [{ commitment: 'finalized' }]);
  const info = await rpc('getAccountInfo', [feature, { encoding: 'base64', commitment: 'finalized' }]);
  result.rpc.epoch_info = epoch;
  const account = info?.value;
  if (account?.owner === 'Feature111111111111111111111111111111111111' && account.data?.[1] === 'base64') {
    const bytes = Buffer.from(account.data[0], 'base64');
    if (bytes.length >= 9 && bytes[0] === 1) {
      const slot = bytes.readBigUInt64LE(1);
      result.rpc.status = 'ACTIVE_ACCOUNT_OBSERVED';
      result.rpc.activation_slot = slot.toString();
      result.rpc.activation_block_time = await rpc('getBlockTime', [Number(slot)]);
    } else if (bytes.length && bytes[0] === 0) result.rpc.status = 'INACTIVE_ACCOUNT_OBSERVED';
    else result.rpc.status = 'UNKNOWN_ACCOUNT_LAYOUT';
  } else result.rpc.status = 'UNVERIFIED';
}
writeFileSync(new URL('environment.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

import { createTraceRecorder, summarizeTrace } from '../research/execution-casefile/trace.ts'

/** No network, wallet or transaction signing. Replace the callback only in an opted-in host app. */
async function main() {
  const recorder = createTraceRecorder({ attemptId: 'example-attempt', clockDomain: 'example-process', fixture: true })
  recorder.record({ type: 'MESSAGE_BUILT', revisionId: 'r1', messageHash: 'a'.repeat(64), lastValidBlockHeight: 100 })
  recorder.record({ type: 'SIGNED', revisionId: 'r1', signature: '1'.repeat(88) })
  const { result, telemetryError } = await recorder.observeSend(
    { type: 'SEND_STARTED', revisionId: 'r1', sendId: 'send-1', providerLabel: 'existing-rpc' },
    async () => ({ result: '1'.repeat(88) }), // application's existing send, mocked here
    response => ({ response: response.result === '1'.repeat(88) ? 'ACKNOWLEDGED' : 'REJECTED' }),
  )
  // A signature response is an acknowledgement, not a finalized receipt.
  recorder.record({ type: 'DEADLINE_REACHED' })
  console.log(JSON.stringify({ responsePresent: Boolean(result.result), telemetryError, summary: summarizeTrace(recorder.snapshot()) }, null, 2))
}
main().catch(() => { console.error('Example failed.'); process.exitCode = 1 })

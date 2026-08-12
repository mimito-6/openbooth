# Printer integration — OpenBooth ⇄ receipt-engine

OpenBooth knows exactly one thing about printing: **"print this transaction."**
It does not know BLE service UUIDs, how `GS v 0` is assembled, or that packets
are chunked. All of that belongs to [receipt-engine](https://github.com/mimito-6/receipt-engine).

## The boundary

```
front.js complete(s)
  └─ OB.store.addTransaction(tx)        ← sale is FINAL here
     ...cart cleared, sheet closed, success toast...
     └─ OB.printFlow.afterCheckout(savedTx)      js/print-flow.js
          └─ OB.printer.printTransaction(tx)     js/printer.js   ← the ONLY adapter
               └─ window.ReceiptBridge           (receipt-engine build artifact)
                    └─ BLE / ESC/POS / rasterize / chunking
```

Nothing above `js/printer.js` may import, reference, or reason about
receipt-engine. If you find yourself typing `576`, `384`, a UUID, or the word
`characteristic` anywhere else in this repo, it belongs in the adapter or,
better, upstream in receipt-engine.

## Files OpenBooth owns

| File | Responsibility |
|---|---|
| `js/printer.js` | `OB.printer` — the adapter. State machine, capability detection, error translation, profile→dots resolution. The only file that touches `window.ReceiptBridge`. |
| `js/print-flow.js` | `OB.printFlow` — seller-facing behaviour. Decides whether to auto-print, and turns a result into an actionable notice. Never talks to the engine. |
| `js/views/settings.js` | Printer settings UI (connect / disconnect / test print / profile / paper / transmission / auto-print) using OpenBooth's own components. |
| `js/views/record.js` | Reprint entry points (per row + "reprint last"). |
| `js/store.js` | Persistence. Printer settings live in the existing `openbooth_v3` state — **there is no second settings store.** |
| `tests/printer-flow.test.html` | Mock-printer test page. Open it over the dev server; no hardware required. |

## Files OpenBooth does NOT own

These are **build artifacts copied from receipt-engine** (`apps/openbooth-bridge/public/`):

- `js/openbooth-receipt-bridge.global.js` — exposes `window.ReceiptBridge`
- `js/openbooth-receipt.js` — the `OB.receipt` glue (receipt sheet, template import)

Do not put OpenBooth logic in them; a rebuild upstream overwrites both.

> ⚠️ As of this writing both files have **diverged** from the upstream build —
> OpenBooth's `openbooth-receipt.js` is ~6.5 KB larger because four-locale i18n
> was hand-added here (commit `fabf72d`). Re-copying from receipt-engine will
> destroy that. Reconcile before syncing.

## Adapter contract (`OB.printer`)

```js
OB.printer.STATES            // idle|connecting|connected|printing|success|failed|disconnected
OB.printer.getState()        // → current state string
OB.printer.getError()        // → { code, message } | null   message is ALREADY user-facing
OB.printer.subscribe(fn)     // fn(state, error) → returns unsubscribe()
OB.printer.support()         // → { engine, bluetooth, secureContext, usable }
OB.printer.isConnected()
OB.printer.profiles()        // → [{ id, label, paper, dots }]
OB.printer.profileById(id)
OB.printer.connect()         // → Promise<{name}>          rejects with a translated error
OB.printer.disconnect()
OB.printer.testPrint()       // → Promise<{ ok, error? }>  never rejects
OB.printer.printTransaction(tx)  // → Promise<{ ok, error? }>  never rejects
OB.printer.buildReceipt(tx, target)  // → Promise<{ svg, doc, metadata }>
```

`printTransaction` and `testPrint` **never reject**. Checkout must not be able
to fail because a printer failed.

## Guarantees enforced by tests

`tests/printer-flow.test.html` — 33 checks, all passing:

1. The transaction is persisted before any print work runs.
2. A print failure leaves the transaction present, non-voided, and unmodified.
3. Auto-print off never sends a job.
4. Auto-print on sends exactly one job.
5. A disconnected printer still completes the sale and shows a notice that says
   so, with reconnect and reprint actions.
6. Reprint creates no transaction — the persisted state stays byte-identical.
7. "Reprint last" picks the newest non-voided sale.
8. Reprinting an older transaction from history is equally non-mutating.
9. Dot width comes from the selected profile (58mm→384, 80mm→576), never a
   constant in app code.
10. State transitions are observable, and unsubscribe stops delivery.
11. A fresh install defaults to 80mm, auto-print off, standard transmission.
12. The add-on's legacy `autoPrint` flag is adopted, and no second settings
    store is created.

Raw `DOMException` / GATT text never reaches the UI — it is logged to the
console only. Test 2 asserts this.

## ⟪SWAP⟫ — what changes when receipt-engine ships its printer API

receipt-engine v0.1 exposes only `BluetoothThermalPrinter`, `printReceiptSvg`,
`receiptSvgToEscpos`, and `PrintOptions { chunkSize, delayMs }`. Profiles, a
paper enum, transmission modes, a state/event API, print queue, and receipt
metadata are on its roadmap (v0.3). Until then the adapter fills the gaps
locally. Each gap is marked `⟪SWAP⟫` in `js/printer.js`:

| Marker | Temporary local implementation | Replace with |
|---|---|---|
| profiles | `PROFILE_FALLBACK` table (id/label/paper/dots) | `ReceiptBridge.listPrinterProfiles()` — already probed for; delete the fallback once it exists |
| transmission | `TRANSMISSION_FALLBACK` → `{chunkSize, delayMs}` | `ReceiptBridge.transmissionPreset(mode)` — already probed for |
| dots | `sendSvg()` passes `profile.dots` | engine-resolved width; drop the `dots` option entirely |
| metadata | `readMetadata()` returns nulls when absent | `doc.metadata.estimatedLengthMm` / `estimatedReceiptsPerRoll` |
| state | adapter-local state machine | engine state events — **map onto the existing `STATES` strings, do not rename them downstream** |

The adapter already prefers the engine's version when the method exists, so
most of the swap is deleting fallbacks.

**Open question sent to the receipt-engine session:** whether `openbooth-receipt.js`
keeps its self-contained UI and its own `localStorage` (`openbooth_receipt_*`),
or becomes headless with OpenBooth owning all UI. OpenBooth currently assumes
the former and only reads `OB.receipt.getTemplate()` from it. If it goes
headless, only `buildReceipt()` in `js/printer.js` needs to change.

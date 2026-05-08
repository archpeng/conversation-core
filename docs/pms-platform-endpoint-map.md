# PMS Platform Endpoint Map

This MVP client must call only typed `pms-platform` routes and wrap returned PMS facts as evidence before Agent use.

| Client method | Route | Evidence rule |
| --- | --- | --- |
| `health()` | `GET /health` | operational probe only; not PMS truth |
| `capabilitiesManifest()` | `GET /v1/pms/capabilities/manifest` | capability evidence for tool availability |
| `searchAvailability(input)` | `POST /v1/pms/availability/search` | room/availability facts come from response evidence |
| `getRoom(input)` | `POST /v1/pms/room` | room facts come from response evidence |
| `getReservation(input)` | `POST /v1/pms/reservations/get` | reservation facts come from response evidence |
| `createReservationDraft(input)` | `POST /v1/pms/reservation-drafts/create` | draft refs are evidence refs, not customer-visible raw IDs |
| `updateReservationDraft(input)` | `POST /v1/pms/reservation-drafts/update` | draft mutation stays draft-only until pending-action approval |
| `quoteReservationDraft(input)` | `POST /v1/pms/reservation-drafts/quote` | quote facts come from response evidence |
| `prepareReservationConfirm(input)` | `POST /v1/pms/reservation-drafts/prepare-confirm` | produces `pms_pending_action` refs for approval cards |
| `pendingActionStatus(input)` | `POST /v1/pms/pending-actions/status` | status facts come from response evidence; readback only |
| `inventorySummary(input)` | `POST /v1/pms/inventory/summary` | inventory facts come from response evidence |
| `roomReservationContext(input)` | `POST /v1/pms/room/reservation-context` | room context facts come from response evidence |
| `todayArrivals(input)` | `POST /v1/pms/arrivals/today` | arrival facts come from response evidence |
| `todayDepartures(input)` | `POST /v1/pms/departures/today` | departure facts come from response evidence |
| `reservationLookup(input)` | `POST /v1/pms/reservations/get` | reservation facts by reservationCode from response evidence |

The `pms-agent-v2` natural-language client does not expose `confirmPendingAction(...)` or `cancelPendingAction(...)`.
Confirm/cancel routes are future adapter-callback-only surfaces for typed Feishu card actions:

| Adapter callback route | PMS route | Boundary |
| --- | --- | --- |
| typed card confirm | `POST /v1/pms/pending-actions/confirm` | callable only by `adapter-feishu` after typed approval callback |
| typed card cancel | `POST /v1/pms/pending-actions/cancel` | callable only by `adapter-feishu` after typed approval callback |

Natural-language PMS mutation is not a client method. Confirmation and cancellation use only typed pending-action callbacks owned by `adapter-feishu` card actions.

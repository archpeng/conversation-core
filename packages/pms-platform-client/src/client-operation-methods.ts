import { type ClientOptions, type PmsRoute, requestEvidence, validateInput } from "./client-core.js";
import {
  parseTypedOperationFact,
  validateExecuteTypedOperationInput,
  type ExecuteTypedOperationInput,
  type PmsTypedOperationKind,
  type TypedOperationFact
} from "./operation-schemas.js";
import type { PmsEvidence } from "./evidence.js";

export type PmsOperationClientMethods = {
  executeTypedOperation(input: ExecuteTypedOperationInput): Promise<PmsEvidence<TypedOperationFact>>;
};

const operationRoutes: Record<PmsTypedOperationKind, PmsRoute> = {
  check_in: "/v1/pms/check-in",
  check_out: "/v1/pms/check-out",
  housekeeping_done: "/v1/pms/housekeeping/done",
  housekeeping_inspection: "/v1/pms/housekeeping/inspection",
  housekeeping_rework: "/v1/pms/housekeeping/rework",
  maintenance_report: "/v1/pms/maintenance/report",
  maintenance_done: "/v1/pms/maintenance/done",
  maintenance_restore_sellable: "/v1/pms/maintenance/restore-sellable"
};

export function createPmsOperationClientMethods(options: ClientOptions): PmsOperationClientMethods {
  return {
    executeTypedOperation: (input) => {
      validateInput("executeTypedOperation", () => validateExecuteTypedOperationInput(input));
      return requestEvidence(
        options,
        "executeTypedOperation",
        input.tenantId,
        { method: "POST", route: operationRoutes[input.operation], body: typedOperationRequestBody(input, options.now) },
        (value) => parseTypedOperationFact(input.operation, input.targetRef, value),
        (fact) => `Typed PMS operation ${fact.operation} returned ${fact.status}.`
      );
    }
  };
}

function typedOperationRequestBody(input: ExecuteTypedOperationInput, now: () => Date): Record<string, unknown> {
  return {
    operation: `pms.${input.operation}`,
    targetRef: input.targetRef,
    actor: {
      type: input.actor.type,
      id: input.actor.id,
      ...(input.actor.displayName ? { displayName: input.actor.displayName } : {})
    },
    scope: { propertyId: input.propertyId ?? "property-small-hotel", channel: "typed_card" },
    cardPayloadRef: input.cardPayloadRef,
    requestedAt: now().toISOString()
  };
}

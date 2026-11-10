import { approvals, fmtMultiple, multipleOf } from "@/data/commercial";
import type { ContractApproval } from "@/data/commercial";

export { approvals };
export const fmtMultipleSafe = (a: ContractApproval) => fmtMultiple(multipleOf(a.revenuePerHead, a.breakEvenPerHead));

/**
 * Centralized status display utilities
 * Maps backend status values to user-friendly display text
 * Backend continues to store raw values: "approved", "rejected", etc.
 */

export type ClaimStatus = "needs_review" | "in_review" | "approved" | "rejected" | "rescored";

/**
 * Get display-friendly status text
 */
export function getStatusDisplay(status: string): string {
  const mapping: Record<string, string> = {
    needs_review: "Needs Review",
    in_review: "In Review",
    approved: "Claim Cleared",
    rejected: "Escalated to Investigation",
    rescored: "Rescored",
  };
  return mapping[status] || status;
}

/**
 * Get proper sentence for decision summary
 * Examples:
 *   "Claim cleared by Jake Thompson"
 *   "Escalated to investigation by Sarah Wilson"
 */
export function getDecisionSentence(status: string, decidedBy?: string): string {
  if (!decidedBy) return "";
  
  if (status === "approved") {
    return `Claim cleared by ${decidedBy}`;
  }
  
  if (status === "rejected") {
    return `Escalated to investigation by ${decidedBy}`;
  }
  
  return "";
}

/**
 * Get action type display text for audit logs
 */
export function getActionTypeDisplay(action: string): string {
  const mapping: Record<string, string> = {
    CLAIM_CREATED: "Claim Created",
    SCORE_GENERATED: "Score Generated",
    OVERRIDE: "Score Override",
    RESCORE: "Rescored",
    FIELD_EDIT: "Field Edited",
    STATUS_CHANGE: "Status Changed",
    DOCUMENT_UPLOADED: "Document Uploaded",
    APPROVE: "Claim Cleared",
    REJECT: "Escalated to Investigation",
  };
  return mapping[action] || action;
}

/**
 * Get button text for approve action
 */
export function getApproveButtonText(): string {
  return "Clear Claim";
}

/**
 * Get button text for reject action
 */
export function getRejectButtonText(): string {
  return "Escalate to Investigation";
}

/**
 * Get modal title for approve action
 */
export function getApproveModalTitle(): string {
  return "Clear Claim";
}

/**
 * Get modal title for reject action
 */
export function getRejectModalTitle(): string {
  return "Escalate to Investigation";
}

/**
 * Get success toast message for approve action
 */
export function getApproveSuccessMessage(): string {
  return "Claim cleared successfully";
}

/**
 * Get success toast message for reject action
 */
export function getRejectSuccessMessage(): string {
  return "Claim escalated to investigation";
}

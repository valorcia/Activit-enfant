import type { CreatorSubmissionStatus } from "@prisma/client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/creators/submissions";
import { cn } from "@/lib/utils";

const STYLES: Record<CreatorSubmissionStatus, string> = {
  DRAFT: "bg-ink/10 text-ink", SUBMITTED: "bg-honey-light text-honey-dark", CHANGES_REQUESTED: "bg-coral-light text-coral-dark", ACCEPTED: "bg-sky-light text-sky-dark",
  REJECTED: "bg-ink/5 text-ink-muted", IN_PRODUCTION: "bg-sky-light text-sky-dark", PREVIEW_READY: "bg-coral-light text-coral-dark", APPROVED: "bg-sage-light text-sage-dark", PUBLISHED: "bg-sage-light text-sage-dark",
};

export function SubmissionStatusBadge({ status }: { status: CreatorSubmissionStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold", STYLES[status])}>{SUBMISSION_STATUS_LABELS[status]}</span>;
}

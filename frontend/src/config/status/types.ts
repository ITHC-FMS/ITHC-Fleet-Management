/**
 * Built-status of requirements, written by Claude (never by the user).
 * "built"   = implemented in the demo UI against mock data on this screen.
 * "pending" = not implemented, or only partly. Always give a short note saying what is missing.
 * The user verifies separately with a checkbox in the slide-over; Claude never ticks that.
 *
 * Keys are "<roleSlug>/<pageSlug>" and indexes refer to that page's final `requirements` array
 * (the list the slide-over shows, in order, starting at 0).
 */
export interface PageStatus {
  /** Indexes that are NOT built. Everything else on the page counts as built. */
  pending?: Record<number, string>;
}
export type StatusMap = Record<string, PageStatus>;

/** All requirements built, except those listed (index -> what is missing). */
export const built = (pending: Record<number, string> = {}): PageStatus => ({ pending });
/** Whole page not built yet. */
export const NOT_BUILT: PageStatus | undefined = undefined;

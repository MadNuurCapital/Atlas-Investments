import { startReview } from "../../actions";

/**
 * Starting a review is a side effect, so it lives behind a route rather than
 * a link that mutates on GET. This page immediately performs the action and
 * redirects, which keeps "Start review" a single click from anywhere.
 */
export default async function StartReviewPage({
  params,
}: PageProps<"/reviews/start/[clientId]">) {
  const { clientId } = await params;
  await startReview(clientId);
}

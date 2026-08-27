import { redirect } from "next/navigation";

/**
 * Kept alive as a redirect. Access is a tab inside Staff now.
 *
 * The route is not deleted because it was a real destination for months: the
 * sidebar pointed at it, the Staff page linked to it, Settings had two shortcuts
 * onto it, and anybody who bookmarked the roles screen bookmarked this. A 404
 * for all of them is a worse answer than one hop.
 *
 * Server-side, so the browser is sent straight on without rendering a dashboard
 * frame it is about to leave - and so a link shared into Slack resolves to the
 * tab rather than to a flash of the wrong page.
 */
export default function DashboardAccessPage() {
  redirect("/dashboard/staff?tab=roles");
}

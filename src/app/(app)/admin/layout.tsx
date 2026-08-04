import { requireAdmin } from "@/lib/auth/dal";
import { AdminTabs } from "./admin-tabs";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // The single gate for every admin screen. Hiding the sidebar link is
  // presentation; this is what refuses someone who types the URL.
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Users, fund data, imports and system settings. Not client records."
      />
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}

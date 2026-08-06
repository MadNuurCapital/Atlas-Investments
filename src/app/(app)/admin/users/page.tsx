import type { Metadata } from "next";
import { Card, CardTitle, Badge } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/dal";
import { formatSgDate } from "@/lib/format";
import { InviteForm } from "./invite-form";
import { UserRowActions } from "./user-row-actions";
import { UserNameCell } from "./user-name-cell";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Invite a user</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          There is no public sign-up. An invitation is the only route to an
          Atlas account.
        </p>
        <InviteForm />
      </Card>

      <Card>
        <CardTitle>Users</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {(users ?? []).map((user) => {
              const isSelf = user.id === me.id;
              return (
                <TR key={user.id}>
                  <TD>
                    <UserNameCell
                      userId={user.id}
                      fullName={user.full_name}
                      isSelf={isSelf}
                    />
                  </TD>
                  <TD>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </TD>
                  <TD>
                    <Badge tone={user.role === "admin" ? "info" : "neutral"} className="capitalize">
                      {user.role}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={user.is_active ? "positive" : "negative"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD>{formatSgDate(user.created_at)}</TD>
                  <TD>
                    {isSelf ? (
                      <span className="text-xs text-subtle-foreground">
                        You cannot change your own role or status
                      </span>
                    ) : (
                      <UserRowActions
                        userId={user.id}
                        role={user.role === "admin" ? "admin" : "advisor"}
                        isActive={user.is_active}
                      />
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>

        <p className="mt-4 text-xs text-muted-foreground">
          You cannot change your own role or deactivate yourself — that would
          lock the firm out of user management with no way back. The database
          refuses it independently of this screen. Deactivating someone blocks
          their access immediately while leaving their client records intact.
        </p>
      </Card>
    </div>
  );
}

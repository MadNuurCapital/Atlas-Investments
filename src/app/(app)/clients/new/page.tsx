import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../client-form";
import { createClientRecord } from "../actions";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>

      <PageHeader
        title="Add client"
        description="Name and contact only. Atlas does not store NRIC, bank details or documents."
      />

      <ClientForm action={createClientRecord} submitLabel="Create client" />
    </>
  );
}

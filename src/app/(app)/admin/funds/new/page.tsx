import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FundForm } from "../fund-form";
import { createFund } from "../../actions";

export const metadata: Metadata = { title: "Add fund" };

export default function NewFundPage() {
  return (
    <>
      <Link
        href="/admin/funds"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to funds
      </Link>

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        The fields below follow the layout of a typical factsheet, so entering
        a fund is a straight copy-across. NAV history and the automatic data
        source are set up after the fund is saved.
      </p>

      <FundForm action={createFund} submitLabel="Create fund" />
    </>
  );
}

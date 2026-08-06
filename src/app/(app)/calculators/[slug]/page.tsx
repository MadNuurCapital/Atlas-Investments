import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CalculatorWorkspace } from "@/components/calculators/calculator-workspace";
import { findCalculator, CALCULATORS } from "@/lib/calculators/registry";
import { listClients } from "@/lib/data/clients";
import {
  getAffordabilityBands,
  getHajjDefaults,
  getScenarioRates,
} from "@/lib/data/settings";

export async function generateMetadata({
  params,
}: PageProps<"/calculators/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: findCalculator(slug)?.name ?? "Calculator" };
}

export function generateStaticParams() {
  return CALCULATORS.map((calculator) => ({ slug: calculator.slug }));
}

export default async function CalculatorPage({
  params,
}: PageProps<"/calculators/[slug]">) {
  const { slug } = await params;
  const calculator = findCalculator(slug);
  if (!calculator) notFound();

  const [clients, rates, bands, hajjDefaults] = await Promise.all([
    listClients(),
    getScenarioRates(),
    getAffordabilityBands(),
    getHajjDefaults(),
  ]);

  return (
    <>
      <Link
        href="/calculators"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All calculators
      </Link>

      <PageHeader title={calculator.name} description={calculator.summary} />

      <CalculatorWorkspace
        calculator={calculator}
        clients={clients.map((client) => ({
          id: client.id,
          full_name: client.full_name,
        }))}
        defaultRates={rates}
        affordabilityBands={bands}
        hajjDefaults={hajjDefaults}
      />
    </>
  );
}

import { AtlasLogoPrint } from "@/components/brand/atlas-logo";
import { ValueHistoryChart } from "@/components/value-history-chart";
import {
  formatPercent,
  formatSgDate,
  formatSgd,
  formatSignedSgd,
} from "@/lib/format";
import type { SnapshotData } from "@/lib/data/snapshot";

/**
 * The client-facing snapshot card.
 *
 * Fixed at 1200 × 1500 (4:5 portrait) — the tallest ratio WhatsApp and
 * Instagram show without cropping, and it fits a laptop screen without
 * scrolling.
 *
 * Colours are hard-coded light rather than taken from theme tokens. This is
 * deliberate: the card is screenshotted and printed, and an advisor working
 * in dark mode must not produce a dark card for their client or an
 * unreadable page on paper.
 *
 * It can only render what `getSnapshot` puts in `SnapshotData`, and that
 * object never contains internal notes, private contact details or database
 * ids — so there is nothing here to leak.
 */
export function ClientSnapshot({
  data,
  showAdvisorName = true,
}: {
  data: SnapshotData;
  showAdvisorName?: boolean;
}) {
  const gainTone =
    data.gainLoss === null
      ? "#4a5f73"
      : data.gainLoss > 0
        ? "#0b5d48"
        : data.gainLoss < 0
          ? "#8f1f19"
          : "#0f1d2a";

  return (
    <div
      id="client-snapshot"
      style={{
        width: 1200,
        minHeight: 1500,
        backgroundColor: "#ffffff",
        color: "#0f1d2a",
        padding: 64,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
      }}
    >
      {/* --- Header ---------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          borderBottom: "2px solid #1a6597",
          paddingBottom: 24,
        }}
      >
        <AtlasLogoPrint height={56} />

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#4a5f73" }}>Review date</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatSgDate(data.reviewDate)}
          </div>
        </div>
      </div>

      {/* --- Client ---------------------------------------------------- */}
      <div style={{ marginTop: 36 }}>
        <div style={{ fontSize: 13, color: "#4a5f73", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Portfolio summary for
        </div>
        <div style={{ fontSize: 42, fontWeight: 600, marginTop: 4 }}>
          {data.clientName}
        </div>
        {data.investmentGoal && (
          <div style={{ fontSize: 16, color: "#4a5f73", marginTop: 8 }}>
            Goal: {data.investmentGoal}
          </div>
        )}
      </div>

      {/* --- Headline figures ------------------------------------------ */}
      <div
        style={{
          marginTop: 36,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 24,
        }}
      >
        <Figure label="Total contributed" value={formatSgd(data.totalContributed)} />
        <Figure label="Current value" value={formatSgd(data.currentValue)} />
        <Figure
          label="Gain / loss"
          value={formatSignedSgd(data.gainLoss)}
          sub={
            data.gainLossFraction === null
              ? "No contributions to measure against"
              : formatPercent(data.gainLossFraction, { signed: true })
          }
          color={gainTone}
        />
        <Figure
          label="Monthly contribution"
          value={formatSgd(data.monthlyContribution)}
          sub={
            data.dividendsThisPeriod > 0
              ? `Distributions received: ${formatSgd(data.dividendsThisPeriod)}`
              : undefined
          }
        />
      </div>

      {/* --- History --------------------------------------------------- */}
      <div style={{ marginTop: 44, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            color: "#4a5f73",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Value at each review
        </div>
        <ValueHistoryChart points={data.valueHistory} height={300} />
      </div>

      {/* --- Footer ---------------------------------------------------- */}
      <div style={{ marginTop: 36, borderTop: "1px solid #d5dee6", paddingTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <div>
            <span style={{ color: "#4a5f73" }}>Next review: </span>
            <span style={{ fontWeight: 600 }}>{formatSgDate(data.nextReviewDate)}</span>
          </div>
          {showAdvisorName && (
            <div>
              <span style={{ color: "#4a5f73" }}>Your adviser: </span>
              <span style={{ fontWeight: 600 }}>{data.advisorName}</span>
            </div>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: 11, lineHeight: 1.6, color: "#4a5f73" }}>
          Figures are as at {formatSgDate(data.reviewDate)} and are based on
          values recorded by your adviser from provider statements. Gain and
          loss compare total contributed against current value plus any
          withdrawals and distributions; it does not account for the timing of
          payments and is not a time-weighted return. Investment values can
          fall as well as rise and past performance is not a guide to future
          returns. This summary is for information only and is not a personal
          recommendation.
          {data.isCorrected && " This review has been corrected since it was first completed."}
        </p>

        <p style={{ marginTop: 10, fontSize: 11, color: "#8296a8" }}>
          Prepared {formatSgDate(data.generatedOn)} · Integrated Barakah Wealth
          Advisory
        </p>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  color = "#0f1d2a",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #d5dee6",
        borderRadius: 10,
        padding: 24,
        backgroundColor: "#fbfcfd",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#4a5f73",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 600,
          marginTop: 6,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: "#4a5f73", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

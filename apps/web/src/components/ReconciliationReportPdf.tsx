import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ─── Brand Tokens ──────────────────────────────────────────────────
const BRAND_GREEN = "#0F5A47";
const BRAND_DARK = "#0F172A";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";
const TEXT_SECONDARY = "#475569";
const SUCCESS_BG = "#ECFDF5";
const SUCCESS_TEXT = "#059669";
const AMBER_BG = "#FFFBEB";
const AMBER_TEXT = "#D97706";
const RED_BG = "#FEF2F2";
const RED_TEXT = "#DC2626";
const ALT_ROW = "#F8FAFC";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: BRAND_DARK,
    backgroundColor: "#FFFFFF",
  },

  // ── Header Banner ──────────────────────────────────────────────
  headerBanner: {
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 36,
    paddingTop: 26,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 8,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  headerPeriodBlock: {
    alignItems: "flex-end",
  },
  headerPeriodLabel: {
    fontSize: 7,
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerPeriodValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.9)",
    marginTop: 3,
  },

  // ── Green accent bar ───────────────────────────────────────────
  accentBar: {
    height: 4,
    backgroundColor: BRAND_GREEN,
  },

  // ── KPI Strip ─────────────────────────────────────────────────
  kpiStrip: {
    flexDirection: "row",
    gap: 0,
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 14,
    marginRight: 10,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GREEN,
  },
  kpiCardLast: {
    marginRight: 0,
  },
  kpiLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
  },
  kpiSub: {
    fontSize: 7,
    color: TEXT_MUTED,
    marginTop: 3,
  },

  // ── Body ────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 36,
  },

  // ── Section Title ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },

  // ── Table ──────────────────────────────────────────────────────
  tableWrapper: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.9)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: "#FFFFFF",
  },
  tableRowAlt: {
    backgroundColor: ALT_ROW,
  },
  tableCell: {
    fontSize: 8,
    color: BRAND_DARK,
  },
  tableCellMuted: {
    fontSize: 7,
    color: TEXT_MUTED,
  },

  // Column widths
  colDate: { width: "15%" },
  colStudent: { width: "28%" },
  colFeeType: { width: "22%" },
  colChannel: { width: "13%" },
  colAmount: { width: "12%", textAlign: "right" },
  colStatus: { width: "10%", textAlign: "center" },

  // ── Status Badges ──────────────────────────────────────────────
  badgePosted: {
    backgroundColor: SUCCESS_BG,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: SUCCESS_TEXT,
    textAlign: "center",
  },
  badgeFlagged: {
    backgroundColor: RED_BG,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: RED_TEXT,
    textAlign: "center",
  },
  badgePending: {
    backgroundColor: AMBER_BG,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: AMBER_TEXT,
    textAlign: "center",
  },
  badgeDefault: {
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 6,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },

  // ── Summary Totals Row ─────────────────────────────────────────
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: BRAND_DARK,
  },
  summaryLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.85)",
  },
  summaryAmount: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textAlign: "right",
  },

  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 36,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 6.5,
    color: "rgba(255,255,255,0.5)",
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.85)",
  },

  // ── Page Number ────────────────────────────────────────────────
  pageNumber: {
    fontSize: 7,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
    textAlign: "right",
  },
});

// ─── Status Badge helper ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "posted") return <Text style={styles.badgePosted}>POSTED</Text>;
  if (s === "flagged") return <Text style={styles.badgeFlagged}>FLAGGED</Text>;
  if (s.includes("pending")) return <Text style={styles.badgePending}>PENDING</Text>;
  return <Text style={styles.badgeDefault}>{s.toUpperCase()}</Text>;
}

// ─── Props ────────────────────────────────────────────────────────
interface Row {
  channel: string;
  amount: number;
  reconciliationStatus: string;
  postedAt: string;
  studentName?: string;
  feeType?: string;
}

interface Props {
  startDate: string;
  endDate: string;
  totalCollected: number;
  outstandingDuesTotal: number;
  transactions: Row[];
  schoolName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────
export const ReconciliationReportPdf = ({
  startDate,
  endDate,
  totalCollected,
  outstandingDuesTotal,
  transactions,
  schoolName = "Your School",
}: Props) => {
  const generatedOn = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const postedTotal = transactions
    .filter((t) => t.reconciliationStatus === "posted")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>

        {/* ── Header Banner ── */}
        <View style={styles.headerBanner} fixed>
          <View>
            <Text style={styles.headerTitle}>Reconciliation Report</Text>
            <Text style={styles.headerSubtitle}>
              {schoolName} • Generated on {generatedOn}
            </Text>
          </View>
          <View style={styles.headerPeriodBlock}>
            <Text style={styles.headerPeriodLabel}>Reporting Period</Text>
            <Text style={styles.headerPeriodValue}>
              {startDate} → {endDate}
            </Text>
          </View>
        </View>

        {/* ── Accent Bar ── */}
        <View style={styles.accentBar} fixed />

        {/* ── KPI Strip ── */}
        <View style={styles.kpiStrip}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Collected</Text>
            <Text style={styles.kpiValue}>{formatINR(totalCollected)}</Text>
            <Text style={styles.kpiSub}>All posted transactions</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Outstanding Dues</Text>
            <Text style={[styles.kpiValue, { color: "#D97706" }]}>
              {formatINR(outstandingDuesTotal)}
            </Text>
            <Text style={styles.kpiSub}>Unpaid &amp; pending fees</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiCardLast]}>
            <Text style={styles.kpiLabel}>Transactions</Text>
            <Text style={styles.kpiValue}>{transactions.length}</Text>
            <Text style={styles.kpiSub}>{transactions.filter(t => t.reconciliationStatus === "posted").length} posted</Text>
          </View>
        </View>

        {/* ── Transactions Table ── */}
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Transaction Ledger</Text>
          <View style={styles.tableWrapper}>

            {/* Table Header */}
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderText, styles.colStudent]}>Student</Text>
              <Text style={[styles.tableHeaderText, styles.colFeeType]}>Fee Type</Text>
              <Text style={[styles.tableHeaderText, styles.colChannel]}>Channel</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
              <Text style={[styles.tableHeaderText, styles.colStatus]}>Status</Text>
            </View>

            {/* Data Rows */}
            {transactions.map((t, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colDate]}>
                  {formatDate(t.postedAt)}
                </Text>
                <Text style={[styles.tableCell, styles.colStudent]}>
                  {t.studentName ?? "—"}
                </Text>
                <Text style={[styles.tableCellMuted, styles.colFeeType]}>
                  {t.feeType ?? "Tuition Fee"}
                </Text>
                <Text style={[styles.tableCell, styles.colChannel]}>
                  {t.channel.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.colAmount,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {formatINR(t.amount)}
                </Text>
                <View style={[styles.colStatus]}>
                  <StatusBadge status={t.reconciliationStatus} />
                </View>
              </View>
            ))}

            {/* Summary Total Row */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.colDate]}>Total</Text>
              <Text style={[styles.summaryLabel, { flex: 1 }]}>
                {transactions.length} transactions
              </Text>
              <Text style={[styles.summaryAmount, styles.colAmount]}>
                {formatINR(postedTotal)}
              </Text>
              <Text style={[styles.summaryLabel, styles.colStatus]} />
            </View>

          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerText}>
              This report is auto-generated by Finora Ledger Engine. For reconciliation support, contact your finance team.
            </Text>
            <Text style={[styles.footerText, { marginTop: 2 }]}>
              Confidential — Authorised recipients only. Generated: {generatedOn}
            </Text>
          </View>
          <View>
            <Text style={styles.footerBrand}>Powered by Finora</Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

      </Page>
    </Document>
  );
};

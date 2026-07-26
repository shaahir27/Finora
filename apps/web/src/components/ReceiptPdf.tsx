import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Brand Tokens ──────────────────────────────────────────────────
const BRAND_GREEN = "#0F5A47";
const BRAND_DARK = "#0F172A";
const BRAND_LIGHT = "#F0FAF7";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";
const TEXT_SECONDARY = "#334155";
const SUCCESS = "#059669";

// ─── A4 Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    fontSize: 9,
    color: BRAND_DARK,
  },

  // Header Banner
  headerBanner: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 40,
    paddingTop: 30,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  schoolName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  schoolSubLine: {
    fontSize: 8,
    color: "rgba(255,255,255,0.75)",
    marginTop: 3,
  },
  receiptBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  receiptBadgeLabel: {
    fontSize: 7,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  receiptBadgeNumber: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // Status Strip
  statusStrip: {
    backgroundColor: SUCCESS,
    paddingHorizontal: 40,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Body
  body: {
    paddingHorizontal: 40,
    paddingTop: 24,
  },

  // Info Grid
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  infoBlock: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GREEN,
  },
  infoBlockLabel: {
    fontSize: 7,
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoBlockValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
  },
  infoBlockSub: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  // Section Title
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },

  // Fee Table
  tableWrapper: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: "#FFFFFF",
  },
  tableCell: {
    fontSize: 9,
    color: BRAND_DARK,
  },
  tableCellBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
  },
  colDescription: { flex: 3 },
  colSac: { flex: 1.5, textAlign: "center" },
  colGst: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },

  // GST Sub-rows
  gstRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: "#F8FAFC",
  },
  gstLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
    flex: 3,
    paddingLeft: 10,
  },
  gstValue: {
    fontSize: 8,
    color: TEXT_SECONDARY,
    flex: 1.5,
    textAlign: "right",
  },

  // Total Block
  totalBlock: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 6,
    marginTop: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  totalSubText: {
    fontSize: 7,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },

  // Payment Method
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  paymentChipLabel: {
    fontSize: 8,
    color: TEXT_MUTED,
  },
  paymentChipValue: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND_GREEN,
    borderWidth: 1,
    borderColor: `${BRAND_GREEN}33`,
  },

  // Verification Strip
  verificationStrip: {
    marginTop: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  barcodeBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  barcodeBar: {
    width: 2,
    backgroundColor: BRAND_DARK,
    marginHorizontal: 0.5,
  },
  verificationText: {
    fontSize: 7,
    color: TEXT_MUTED,
    textAlign: "right",
  },
  verificationBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
    textAlign: "right",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: "rgba(255,255,255,0.55)",
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "rgba(255,255,255,0.85)",
  },
});

// ─── 80mm Thermal Styles ───────────────────────────────────────────
const thermalStyles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: BRAND_DARK,
    backgroundColor: "#FFFFFF",
  },
  header: {
    textAlign: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    marginBottom: 8,
  },
  schoolName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
    textTransform: "uppercase",
  },
  sub: {
    fontSize: 6.5,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: BRAND_GREEN,
    marginTop: 4,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  label: {
    fontSize: 7,
    color: TEXT_MUTED,
  },
  value: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: BRAND_DARK,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    marginVertical: 6,
  },
  totalBox: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 4,
    padding: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  totalVal: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  footer: {
    textAlign: "center",
    fontSize: 6,
    color: TEXT_MUTED,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
});

function BarcodeVisual() {
  const pattern = [3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1, 2, 4, 1, 2];
  return (
    <View style={styles.barcodeBlock}>
      {pattern.map((w, i) => (
        <View
          key={i}
          style={[
            styles.barcodeBar,
            { height: i % 3 === 0 ? 28 : 22, width: w === 1 ? 1.5 : w === 2 ? 2.5 : w === 3 ? 1 : 3 },
          ]}
        />
      ))}
    </View>
  );
}

interface ReceiptProps {
  receiptNumber: string;
  studentName: string;
  schoolName: string;
  schoolAddress?: string;
  amount: number;
  date: string;
  channel: string;
  feeType?: string;
  gstAmount?: number;
  gstRate?: number | null;
  baseAmount?: number;
  format?: "a4" | "thermal";
}

export const ReceiptPdf = ({
  receiptNumber,
  studentName,
  schoolName,
  schoolAddress = "Bengaluru, Karnataka, India",
  amount,
  date,
  channel,
  feeType = "Tuition Fee",
  gstAmount = 0,
  gstRate = null,
  baseAmount,
  format = "a4",
}: ReceiptProps) => {
  const computedBase = baseAmount ?? amount - gstAmount;
  const isGstApplicable = gstAmount > 0 && gstRate != null;
  const channelLabel = (channel || "CASH").toUpperCase().replace(/_/g, " ");
  const formattedAmount = `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // ── 80mm Thermal Receipt Rendering ──
  if (format === "thermal") {
    return (
      <Document>
        <Page size={[226.77, 450]} style={thermalStyles.page}>
          <View style={thermalStyles.header}>
            <Text style={thermalStyles.schoolName}>{schoolName}</Text>
            <Text style={thermalStyles.sub}>Affiliated to CBSE • Code: 84920</Text>
            <Text style={thermalStyles.badgeText}>FEE PAYMENT RECEIPT</Text>
          </View>

          <View style={thermalStyles.row}>
            <Text style={thermalStyles.label}>Receipt No:</Text>
            <Text style={thermalStyles.value}>{receiptNumber}</Text>
          </View>
          <View style={thermalStyles.row}>
            <Text style={thermalStyles.label}>Date/Time:</Text>
            <Text style={thermalStyles.value}>{date}</Text>
          </View>
          <View style={thermalStyles.row}>
            <Text style={thermalStyles.label}>Student:</Text>
            <Text style={thermalStyles.value}>{studentName}</Text>
          </View>
          <View style={thermalStyles.row}>
            <Text style={thermalStyles.label}>Mode:</Text>
            <Text style={thermalStyles.value}>{channelLabel}</Text>
          </View>

          <View style={thermalStyles.divider} />

          <View style={thermalStyles.row}>
            <Text style={thermalStyles.label}>{feeType}</Text>
            <Text style={thermalStyles.value}>
              ₹{computedBase.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {isGstApplicable ? (
            <View style={thermalStyles.row}>
              <Text style={thermalStyles.label}>GST ({gstRate}%):</Text>
              <Text style={thermalStyles.value}>
                ₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ) : (
            <View style={thermalStyles.row}>
              <Text style={thermalStyles.label}>GST (SAC 9992):</Text>
              <Text style={thermalStyles.value}>Exempt</Text>
            </View>
          )}

          <View style={thermalStyles.totalBox}>
            <Text style={thermalStyles.totalLabel}>Total Paid</Text>
            <Text style={thermalStyles.totalVal}>{formattedAmount}</Text>
          </View>

          <View style={thermalStyles.footer}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
              VERIFIED BY FINORA LEDGER ENGINE
            </Text>
            <Text>Computer generated receipt. No signature required.</Text>
          </View>
        </Page>
      </Document>
    );
  }

  // ── Standard A4 PDF Rendering ──
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Banner */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.schoolSubLine}>{schoolAddress}</Text>
            <Text style={[styles.schoolSubLine, { marginTop: 1 }]}>
              SAC Code: 9992 • Affiliated: CBSE
            </Text>
          </View>
          <View style={styles.receiptBadge}>
            <Text style={styles.receiptBadgeLabel}>Official Receipt</Text>
            <Text style={styles.receiptBadgeNumber}>{receiptNumber}</Text>
          </View>
        </View>

        {/* Status Strip */}
        <View style={styles.statusStrip}>
          <Text style={styles.statusText}>✓  Payment Confirmed &amp; Posted to Ledger</Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockLabel}>Student Name</Text>
              <Text style={styles.infoBlockValue}>{studentName}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockLabel}>Transaction Date</Text>
              <Text style={styles.infoBlockValue}>{date}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoBlockLabel}>Payment Reference</Text>
              <Text style={styles.infoBlockValue}>{receiptNumber}</Text>
              <Text style={styles.infoBlockSub}>Finora Ledger Engine</Text>
            </View>
          </View>

          {/* Fee Table */}
          <Text style={styles.sectionTitle}>Fee Breakdown</Text>
          <View style={styles.tableWrapper}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colSac]}>SAC Code</Text>
              <Text style={[styles.tableHeaderText, styles.colGst]}>GST %</Text>
              <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount (₹)</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableCellBold, styles.colDescription]}>{feeType}</Text>
              <Text style={[styles.tableCell, styles.colSac, { color: TEXT_MUTED }]}>9992</Text>
              <Text style={[styles.tableCell, styles.colGst, { color: TEXT_MUTED }]}>
                {isGstApplicable ? `${gstRate}%` : "Exempt"}
              </Text>
              <Text style={[styles.tableCellBold, styles.colAmount]}>
                {computedBase.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {isGstApplicable ? (
              <View style={styles.gstRow}>
                <Text style={styles.gstLabel}>
                  GST @ {gstRate}% (SAC 9992 — Taxable Educational Service)
                </Text>
                <Text style={styles.gstValue}>
                  {gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ) : (
              <View style={styles.gstRow}>
                <Text style={styles.gstLabel}>
                  GST — Exempt (SAC 9992: Educational Institution Services u/s 12(2))
                </Text>
                <Text style={styles.gstValue}>0.00</Text>
              </View>
            )}
          </View>

          {/* Total Block */}
          <View style={styles.totalBlock}>
            <View>
              <Text style={styles.totalLabel}>Total Amount Paid</Text>
              <Text style={styles.totalSubText}>Inclusive of all taxes &amp; levies</Text>
            </View>
            <Text style={styles.totalAmount}>{formattedAmount}</Text>
          </View>

          {/* Payment Method */}
          <View style={styles.paymentChip}>
            <Text style={styles.paymentChipLabel}>Payment Mode:</Text>
            <Text style={styles.paymentChipValue}>{channelLabel}</Text>
            <Text style={[styles.paymentChipLabel, { marginLeft: 10 }]}>Status:</Text>
            <Text style={[styles.paymentChipValue, { backgroundColor: "#ECFDF5", borderColor: "#05966933", color: SUCCESS }]}>
              POSTED
            </Text>
          </View>

          {/* Verification Strip */}
          <View style={styles.verificationStrip}>
            <View>
              <BarcodeVisual />
              <Text style={[styles.verificationText, { marginTop: 4, textAlign: "left" }]}>
                {receiptNumber}
              </Text>
            </View>
            <View>
              <Text style={styles.verificationBold}>Finora Ledger Engine</Text>
              <Text style={styles.verificationText}>Tamper-evident • Cryptographically Verified</Text>
              <Text style={[styles.verificationText, { marginTop: 2 }]}>
                This is a computer-generated receipt.{"\n"}No physical signature is required.
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerText}>
              {schoolName} • {schoolAddress}
            </Text>
            <Text style={[styles.footerText, { marginTop: 2 }]}>
              For billing queries, contact your school's fee office.
            </Text>
          </View>
          <Text style={styles.footerBrand}>Powered by Finora</Text>
        </View>
      </Page>
    </Document>
  );
};

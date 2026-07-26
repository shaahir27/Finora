const fs = require("fs");
const path = require("path");

// Load root .env
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  envText.split("\n").forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

const { prisma } = require("@smart-school/db");
const { createClient } = require("@supabase/supabase-js");
const React = require("react");
const { renderToStream, Document, Page, Text, View, StyleSheet } = require("@react-pdf/renderer");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase env vars!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  header: { fontSize: 24, marginBottom: 20, textAlign: "center", fontWeight: "bold" },
  subHeader: { textAlign: "center", fontSize: 14, marginBottom: 30, color: "#4CAF82" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  label: { fontSize: 12, color: "#666" },
  value: { fontSize: 12, fontWeight: "bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#eee", marginVertical: 20 },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, textAlign: "center", fontSize: 10, color: "#999" }
});

function createReceiptDoc(props) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.header }, props.schoolName),
      React.createElement(Text, { style: styles.subHeader }, "PAYMENT RECEIPT"),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Receipt Number:"),
        React.createElement(Text, { style: styles.value }, props.receiptNumber)
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Date:"),
        React.createElement(Text, { style: styles.value }, props.date)
      ),
      React.createElement(View, { style: styles.divider }),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Student Name:"),
        React.createElement(Text, { style: styles.value }, props.studentName)
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Payment Method:"),
        React.createElement(Text, { style: styles.value }, String(props.channel).toUpperCase())
      ),
      React.createElement(View, { style: styles.divider }),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, "Amount Paid:"),
        React.createElement(Text, { style: styles.value }, `₹ ${props.amount.toFixed(2)}`)
      ),
      React.createElement(
        Text,
        { style: styles.footer },
        "Thank you for your payment. This is a computer-generated receipt."
      )
    )
  );
}

async function main() {
  console.log("Fetching posted transactions from DB...");
  const transactions = await prisma.transaction.findMany({
    where: { reconciliationStatus: "posted" },
    include: {
      feeAssignment: { include: { feeType: true, school: true } },
      student: true,
      receipt: true,
    },
  });

  console.log(`Found ${transactions.length} posted transactions in DB.`);

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const receiptNumber = tx.receipt?.receiptNumber || `RCP-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`;
    const schoolId = tx.schoolId;
    const filePath = `${schoolId}/${receiptNumber}.pdf`;

    console.log(`\n[${i + 1}/${transactions.length}] Generating PDF for TX ${tx.id} (${receiptNumber})...`);

    const doc = createReceiptDoc({
      receiptNumber,
      studentName: tx.student?.name || "Student",
      schoolName: tx.feeAssignment?.school?.name || "Smart School",
      amount: Number(tx.amount),
      date: new Date(tx.postedAt).toLocaleDateString(),
      channel: tx.channel,
    });

    const pdfStream = await renderToStream(doc);
    const chunks = [];
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    console.log(`Uploading PDF (${pdfBuffer.length} bytes) to Supabase Storage ('receipts' / '${filePath}')...`);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload error for ${receiptNumber}:`, uploadError.message);
      continue;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("receipts")
      .getPublicUrl(filePath);

    const pdfUrl = publicUrlData.publicUrl;
    console.log(`Uploaded! Public URL: ${pdfUrl}`);

    const gstRate = tx.feeAssignment?.feeType?.gstRate ? Number(tx.feeAssignment.feeType.gstRate) : 0;
    const amountNum = Number(tx.amount);
    const gstAmount = tx.feeAssignment?.feeType?.gstTreatment === "taxable" && gstRate > 0
      ? Math.round(amountNum * (gstRate / (100 + gstRate)) * 100) / 100
      : 0;

    await prisma.receipt.upsert({
      where: { transactionId: tx.id },
      create: {
        transactionId: tx.id,
        format: "a4",
        receiptNumber,
        gstAmount,
        gstDetails: {
          treatment: tx.feeAssignment?.feeType?.gstTreatment || "exempt",
          rate: gstRate,
          baseAmount: amountNum - gstAmount,
        },
        pdfUrl,
      },
      update: {
        pdfUrl,
        receiptNumber,
      },
    });

    console.log(`Saved DB receipt row for ${receiptNumber}.`);
  }

  console.log("\nFINISHED: All receipts generated, uploaded to Supabase Storage, and seeded in DB.");
}

main()
  .catch((e) => console.error("Error running receipt seed:", e))
  .finally(() => prisma.$disconnect());

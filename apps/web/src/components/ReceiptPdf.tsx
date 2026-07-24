import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 12, fontWeight: 'bold' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#eee', marginVertical: 20 },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#999' }
});

interface ReceiptProps {
  receiptNumber: string;
  studentName: string;
  schoolName: string;
  amount: number;
  date: string;
  channel: string;
}

export const ReceiptPdf = ({ receiptNumber, studentName, schoolName, amount, date, channel }: ReceiptProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{schoolName}</Text>
      <Text style={{ textAlign: 'center', fontSize: 14, marginBottom: 30, color: '#4CAF82' }}>PAYMENT RECEIPT</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Receipt Number:</Text>
        <Text style={styles.value}>{receiptNumber}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Date:</Text>
        <Text style={styles.value}>{date}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Student Name:</Text>
        <Text style={styles.value}>{studentName}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Payment Method:</Text>
        <Text style={styles.value}>{channel.toUpperCase()}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Amount Paid:</Text>
        <Text style={styles.value}>₹ {amount.toFixed(2)}</Text>
      </View>
      
      <Text style={styles.footer}>Thank you for your payment. This is a computer-generated receipt.</Text>
    </Page>
  </Document>
);

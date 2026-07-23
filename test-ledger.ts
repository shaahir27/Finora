import { getLedgerSnapshot } from "./apps/web/src/app/actions/ledger";

async function main() {
  try {
    console.log("Testing getLedgerSnapshot...");
    const result = await getLedgerSnapshot("demo-school-id");
    console.log("Success! Data:", result);
  } catch (error) {
    console.error("Error in getLedgerSnapshot:", error);
  }
}

main();

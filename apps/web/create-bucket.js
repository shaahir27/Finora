const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Checking if 'receipts' bucket exists...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    process.exit(1);
  }

  const receiptsBucket = buckets.find(b => b.name === "receipts");
  
  if (!receiptsBucket) {
    console.log("Creating 'receipts' bucket...");
    const { data, error } = await supabase.storage.createBucket("receipts", {
      public: true, // Need public access to view PDFs directly
      fileSizeLimit: 10485760, // 10MB
    });

    if (error) {
      console.error("Failed to create bucket:", error);
      process.exit(1);
    }
    console.log("Bucket 'receipts' created successfully.");
  } else {
    console.log("Bucket 'receipts' already exists.");
    
    // Ensure it's public
    if (!receiptsBucket.public) {
      console.log("Updating bucket to be public...");
      await supabase.storage.updateBucket("receipts", {
        public: true,
      });
    }
  }
}

main().catch(console.error);

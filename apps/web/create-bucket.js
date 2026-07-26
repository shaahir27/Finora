const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("Error listing buckets:", listError);
    process.exit(1);
  }

  for (const bucketName of ["receipts", "reports"]) {
    console.log(`Checking if '${bucketName}' bucket exists...`);
    const existing = buckets.find((b) => b.name === bucketName);

    if (!existing) {
      console.log(`Creating '${bucketName}' bucket...`);
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760,
      });

      if (error) {
        console.error(`Failed to create bucket '${bucketName}':`, error);
        process.exit(1);
      }
      console.log(`Bucket '${bucketName}' created successfully.`);
    } else if (!existing.public) {
      console.log(`Updating '${bucketName}' bucket to be public...`);
      await supabase.storage.updateBucket(bucketName, { public: true });
    } else {
      console.log(`Bucket '${bucketName}' already exists.`);
    }
  }
}

main().catch(console.error);

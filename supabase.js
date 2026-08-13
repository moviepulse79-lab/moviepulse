const SUPABASE_URL = "https://rvzgqxpocdjuljkpgqvt.supabase.co/rest/v1/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Z26c1bNgensaBpFjoERlbQ_77n44IcK";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

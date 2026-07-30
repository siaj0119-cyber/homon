const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ctszrxwezwvisvqkcrzg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0c3pyeHdlend2aXN2cWtjcnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDI2NjEsImV4cCI6MjEwMDk3ODY2MX0.ElX97vgA6rULL_W-SwD87cOvAlTI00gKaVgansTLiXg';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    try {
        const query = supabase.from('leads').select('*', { count: 'exact' }).limit(1);
        const viewsQuery = supabase.from('page_views').select('*', { count: 'exact', head: true });
        
        const [ res1, res2 ] = await Promise.all([
            query,
            viewsQuery.catch(() => ({ count: 0, error: null }))
        ]);
        console.log("Res1:", res1);
        console.log("Res2:", res2);
    } catch(e) {
        console.error("Crash:", e);
    }
}
test();

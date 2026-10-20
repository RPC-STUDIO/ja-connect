// Initialisation du client Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://sthtgplfmnxzootkplgx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_RLMfMHeNz2Rde9xXKu8npw_3-xKmIqJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

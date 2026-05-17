import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ztjglfjmsfijhekjptml.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0amdsZmptc2Zpamhla2pwdG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTM1MzUsImV4cCI6MjA5NDU4OTUzNX0.iXegDMK_a1kGZ0JEeHntGoUsAHwvbagOiINc05NqW6I'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
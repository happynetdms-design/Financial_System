import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ediyxnoffdnenxszkmgs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaXl4bm9mZmRuZW54c3prbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODU2NDUsImV4cCI6MjEwMjE2MTY0NX0.uqJDJDW4oGItfGyy869PFZGTKaM9dflBISPiRR_frlA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
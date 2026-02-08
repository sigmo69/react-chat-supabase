import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xjlmdvjuuppjlrowsowa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbG1kdmp1dXBwamxyb3dzb3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0Nzg1MzYsImV4cCI6MjA4NjA1NDUzNn0.PiGapY6N-BMLadYqtcw59bjq7jRdJ1R3q-j2fzzZ2Jc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
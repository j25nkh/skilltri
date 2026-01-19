import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버에서도 동일한 클라이언트 사용
export const supabaseAdmin = supabase;

export interface CourseRow {
  id: number;
  slug: string;
  title: string;
  url: string;
  category: string;
  thumbnail: string | null;
  keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface CourseWithMatchCount extends CourseRow {
  match_count: number;
}

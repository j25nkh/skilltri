import OpenAI from "openai";
import { supabaseAdmin, CourseRow, CourseWithMatchCount } from "./supabase";
import { Course, fetchCourseDetail } from "./fastcampus";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 강의 제목과 내용에서 기술 키워드 추출 (OpenAI)
 */
export async function extractCourseKeywords(
  title: string,
  content?: string
): Promise<string[]> {
  const text = content ? `${title}\n\n${content}` : title;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `IT 강의에서 기술 키워드를 추출하세요. JSON으로 응답하세요.

규칙:
- 영문 소문자만 사용 (한글 X)
- 공백 없이 붙여쓰기 (after effects → aftereffects)
- 공식 명칭 사용 (react.js → react)
- 버전 번호 제외 (python3 → python)
- 프로그래밍 언어, 프레임워크, 라이브러리, 도구명만
- 최대 15개

예시:
- After Effects → aftereffects
- React.js → react
- Node.js → nodejs
- VS Code → vscode
- 파이썬 → python

응답 형식: {"keywords": ["react", "typescript", "nextjs"]}`,
        },
        {
          role: "user",
          content: text.slice(0, 4000),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 200,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: string) => k.toLowerCase().replace(/\s+/g, "").trim())
      : [];

    return keywords;
  } catch (error) {
    console.error("키워드 추출 실패:", error);
    return [];
  }
}

/**
 * 강의 저장 (upsert)
 */
export async function upsertCourse(course: Course, keywords?: string[]): Promise<CourseRow | null> {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .upsert(
      {
        slug: course.slug,
        title: course.title,
        url: course.url,
        category: course.category,
        thumbnail: course.thumbnail || null,
        keywords: keywords || [],
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) {
    console.error("강의 저장 실패:", error);
    return null;
  }
  return data;
}

/**
 * 여러 강의 배치 저장
 */
export async function upsertCoursesBatch(courses: Course[]): Promise<number> {
  const { error } = await supabaseAdmin
    .from("courses")
    .upsert(
      courses.map((c) => ({
        slug: c.slug,
        title: c.title,
        url: c.url,
        category: c.category,
        thumbnail: c.thumbnail || null,
      })),
      { onConflict: "slug" }
    );

  if (error) {
    console.error("배치 저장 실패:", error);
    return 0;
  }
  return courses.length;
}

/**
 * 키워드 없는 강의 조회
 */
export async function getCoursesWithoutKeywords(limit: number = 50): Promise<CourseRow[]> {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select("*")
    .or("keywords.is.null,keywords.eq.{}")
    .limit(limit);

  if (error) {
    console.error("조회 실패:", error);
    return [];
  }
  return data || [];
}

/**
 * 키워드 업데이트
 */
export async function updateCourseKeywords(courseId: number, keywords: string[]): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("courses")
    .update({ keywords })
    .eq("id", courseId);

  return !error;
}

/**
 * 키워드로 강의 검색
 */
export async function findCoursesByKeywords(keywords: string[]): Promise<CourseWithMatchCount[]> {
  if (!keywords.length) return [];

  const normalized = keywords.map((k) => k.toLowerCase().trim());

  const { data, error } = await supabaseAdmin.rpc("find_courses_by_keywords", {
    search_keywords: normalized,
  });

  if (error) {
    console.error("매칭 실패:", error);
    return [];
  }
  return data || [];
}

/**
 * 전체 강의 조회
 */
export async function getAllCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select("*")
    .order("title");

  if (error) return [];
  return data || [];
}

/**
 * 강의 처리 (상세 가져오기 → 키워드 추출 → 저장)
 */
export async function processAndSaveCourse(course: Course): Promise<CourseRow | null> {
  const detail = await fetchCourseDetail(course.slug);
  const keywords = await extractCourseKeywords(course.title, detail?.content);
  return upsertCourse(course, keywords);
}

/**
 * 강의 수 조회
 */
export async function getCourseCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("courses")
    .select("*", { count: "exact", head: true });
  return count || 0;
}

/**
 * 키워드 있는 강의 수
 */
export async function getCoursesWithKeywordsCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("courses")
    .select("*", { count: "exact", head: true })
    .not("keywords", "eq", "{}");
  return count || 0;
}

/**
 * 모든 고유 키워드 풀 추출
 */
export async function getKeywordPool(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("courses")
    .select("keywords")
    .not("keywords", "eq", "{}");

  if (error || !data) {
    console.error("키워드 풀 조회 실패:", error);
    return [];
  }

  // 모든 키워드를 flatten하고 고유값만 추출
  const allKeywords = data.flatMap((row) => row.keywords || []);
  const uniqueKeywords = [...new Set(allKeywords)].sort();

  return uniqueKeywords;
}

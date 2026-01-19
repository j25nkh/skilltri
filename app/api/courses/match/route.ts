import { NextRequest, NextResponse } from "next/server";
import { findCoursesByKeywords } from "@/lib/course-db";

/**
 * 키워드로 매칭되는 강의 검색 API
 * POST /api/courses/match
 * Body: { keywords: ["react", "typescript", ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keywords = body.keywords;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: "keywords 배열이 필요합니다" },
        { status: 400 }
      );
    }

    console.log("Searching courses by keywords:", keywords);

    const courses = await findCoursesByKeywords(keywords);

    return NextResponse.json({
      success: true,
      count: courses.length,
      keywords,
      courses,
    });
  } catch (error) {
    console.error("Match API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET 요청도 지원 (쿼리 파라미터로 키워드 전달)
 * GET /api/courses/match?keywords=react,typescript
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keywordsParam = searchParams.get("keywords");

    if (!keywordsParam) {
      return NextResponse.json(
        { success: false, error: "keywords 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    const keywords = keywordsParam.split(",").map((k) => k.trim()).filter(Boolean);

    if (keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: "유효한 키워드가 없습니다" },
        { status: 400 }
      );
    }

    const courses = await findCoursesByKeywords(keywords);

    return NextResponse.json({
      success: true,
      count: courses.length,
      keywords,
      courses,
    });
  } catch (error) {
    console.error("Match API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

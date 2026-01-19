import { NextRequest, NextResponse } from "next/server";
import { fetchCoursesFromSitemap } from "@/lib/fastcampus";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit") || "10";
    const category = searchParams.get("category");
    const includeMeta = searchParams.get("meta") === "true";

    // limit=all이면 모든 강의 반환
    const limit = limitParam === "all" ? Infinity : parseInt(limitParam);

    console.log("=== Courses API ===");
    console.log("Limit:", limitParam);
    console.log("Category:", category);
    console.log("Include Meta:", includeMeta);

    let courses = await fetchCoursesFromSitemap(includeMeta);

    // 전체 카테고리 목록 (필터링 전에 추출)
    const categories = ["전체", ...Array.from(new Set(courses.map(c => c.category)))];

    // 카테고리 필터링
    if (category && category !== "전체") {
      courses = courses.filter(c => c.category === category);
    }

    // limit 적용
    const limitedCourses = limit === Infinity ? courses : courses.slice(0, limit);

    return NextResponse.json({
      success: true,
      count: limitedCourses.length,
      total: courses.length,
      categories,
      courses: limitedCourses,
    });
  } catch (error) {
    console.error("Courses API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "강의 목록을 가져오는 중 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

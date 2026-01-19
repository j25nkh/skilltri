import { NextRequest, NextResponse } from "next/server";
import { fetchCoursesFromSitemap } from "@/lib/fastcampus";
import {
  upsertCoursesBatch,
  getCoursesWithoutKeywords,
  processAndSaveCourse,
  getCourseCount,
  getCoursesWithKeywordsCount,
} from "@/lib/course-db";

/**
 * 강의 동기화 API
 * GET: 현재 상태 조회
 * POST: 동기화 실행
 */
export async function GET() {
  try {
    const totalCount = await getCourseCount();
    const withKeywordsCount = await getCoursesWithKeywordsCount();

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        withKeywords: withKeywordsCount,
        pendingKeywords: totalCount - withKeywordsCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "sync") {
      // 1. sitemap에서 강의 목록 가져오기
      console.log("Fetching courses from sitemap...");
      const courses = await fetchCoursesFromSitemap(true);
      console.log(`Found ${courses.length} courses`);

      // 2. DB에 배치 저장 (키워드 없이)
      const savedCount = await upsertCoursesBatch(courses);
      console.log(`Saved ${savedCount} courses to DB`);

      return NextResponse.json({
        success: true,
        action: "sync",
        fetched: courses.length,
        saved: savedCount,
      });
    }

    if (action === "extract-keywords") {
      // 키워드가 없는 강의들에 대해 키워드 추출
      const limit = body.limit || 10;
      const courses = await getCoursesWithoutKeywords(limit);

      console.log(`Processing ${courses.length} courses for keyword extraction`);

      const results = [];
      for (const course of courses) {
        const result = await processAndSaveCourse({
          slug: course.slug,
          title: course.title,
          url: course.url,
          category: course.category,
          thumbnail: course.thumbnail || "",
        });

        results.push({
          slug: course.slug,
          success: !!result,
          keywords: result?.keywords || [],
        });
      }

      return NextResponse.json({
        success: true,
        action: "extract-keywords",
        processed: results.length,
        results,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

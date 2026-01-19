import { NextRequest, NextResponse } from "next/server";
import { fetchCourseDetail } from "@/lib/fastcampus";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    console.log("=== Course Detail API ===");
    console.log("Slug:", slug);

    const detail = await fetchCourseDetail(slug);

    if (!detail) {
      return NextResponse.json(
        { success: false, error: "강의 정보를 가져올 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        title: detail.title,
        content: detail.content,
        url: detail.url,
      },
    });
  } catch (error) {
    console.error("Course Detail API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "강의 상세 정보를 가져오는 중 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}

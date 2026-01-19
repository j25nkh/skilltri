import { NextRequest, NextResponse } from "next/server";
import { getJobDetail, getExternalJobDetail } from "@/lib/saramin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const title = searchParams.get("title");
  const isExternal = searchParams.get("isExternal") === "true";

  if (!url) {
    return NextResponse.json(
      { success: false, error: "URL이 필요합니다" },
      { status: 400 }
    );
  }

  let detail;

  if (isExternal) {
    // 외부 공고 URL 직접 분석
    detail = await getExternalJobDetail(url);
  } else {
    // 사람인 공고 분석 (기존 로직)
    detail = await getJobDetail(url, title || undefined);
  }

  if (!detail) {
    return NextResponse.json(
      { success: false, error: "상세 정보를 가져올 수 없습니다" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: detail,
  });
}

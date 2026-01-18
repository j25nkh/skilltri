import { NextRequest, NextResponse } from "next/server";
import { getJobDetail } from "@/lib/saramin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { success: false, error: "URL이 필요합니다" },
      { status: 400 }
    );
  }

  const detail = await getJobDetail(url);

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

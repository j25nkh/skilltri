import { NextRequest, NextResponse } from "next/server";
import { searchCompanyJobs } from "@/lib/saramin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get("company");

  if (!company) {
    return NextResponse.json(
      { success: false, error: "회사명을 입력해주세요" },
      { status: 400 }
    );
  }

  const result = await searchCompanyJobs(company);

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

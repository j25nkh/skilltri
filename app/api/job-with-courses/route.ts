import { NextRequest, NextResponse } from "next/server";
import { getJobDetail, getExternalJobDetail } from "@/lib/saramin";
import { findCoursesByKeywords } from "@/lib/course-db";
import { CourseWithMatchCount } from "@/lib/supabase";

interface SkillCourses {
  [skill: string]: CourseWithMatchCount[];
}

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

  try {
    // 1. 공고 상세 정보 가져오기
    const jobDetail = isExternal
      ? await getExternalJobDetail(url)
      : await getJobDetail(url, title || undefined);

    if (!jobDetail) {
      return NextResponse.json(
        { success: false, error: "공고 정보를 가져올 수 없습니다" },
        { status: 404 }
      );
    }

    // 2. 스킬별 강의 매칭 (병렬 처리)
    const requiredSkills = jobDetail.skills || [];
    const preferredSkills = jobDetail.preferredSkills || [];

    // 각 스킬별로 강의 검색
    const [requiredCourses, preferredCourses] = await Promise.all([
      matchCoursesForSkills(requiredSkills),
      matchCoursesForSkills(preferredSkills),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        jobDetail: {
          skills: requiredSkills,
          preferredSkills: preferredSkills,
          rawContent: jobDetail.rawContent,
          isExternal: jobDetail.isExternal,
          externalUrl: jobDetail.externalUrl,
        },
        matchedCourses: {
          required: requiredCourses,
          preferred: preferredCourses,
        },
      },
    });
  } catch (error) {
    console.error("Job with courses API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

async function matchCoursesForSkills(skills: string[]): Promise<SkillCourses> {
  if (skills.length === 0) return {};

  const result: SkillCourses = {};

  // 모든 스킬을 한 번에 검색해서 효율성 높이기
  const allCourses = await findCoursesByKeywords(skills);

  // 각 스킬별로 매칭되는 강의 분류
  for (const skill of skills) {
    const normalizedSkill = skill.toLowerCase().trim();
    const matchingCourses = allCourses.filter((course) =>
      course.keywords.some(
        (keyword) => keyword.toLowerCase() === normalizedSkill
      )
    );
    result[skill] = matchingCourses.slice(0, 5); // 스킬당 최대 5개 강의
  }

  return result;
}

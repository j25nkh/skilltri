import { NextRequest } from "next/server";
import { getJobDetail, getExternalJobDetail } from "@/lib/saramin";
import { findCoursesByKeywords, getKeywordPool } from "@/lib/course-db";
import { CourseWithMatchCount } from "@/lib/supabase";
import { SkillItem } from "@/lib/openai";

interface SkillCourses {
  [skillDisplay: string]: CourseWithMatchCount[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const title = searchParams.get("title");
  const isExternal = searchParams.get("isExternal") === "true";

  // SSE 스트림 설정
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 이벤트 전송 헬퍼 (controller 닫힌 경우 무시)
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller already closed, ignore
        }
      };

      if (!url) {
        sendEvent("error", { message: "URL이 필요합니다" });
        controller.close();
        return;
      }

      try {
        // 1단계: 공고 페이지 연결 및 키워드 풀 로드
        sendEvent("progress", { step: 0, message: "공고 페이지 연결 중..." });

        // 키워드 풀 로드 (GPT가 이 목록에서만 선택하도록)
        const keywordPool = await getKeywordPool();
        console.log(`[API] 키워드 풀 로드: ${keywordPool.length}개`);

        // 2단계: 공고 내용 가져오기
        sendEvent("progress", { step: 1, message: "공고 내용 가져오는 중..." });

        const jobDetail = isExternal
          ? await getExternalJobDetail(url, keywordPool)
          : await getJobDetail(url, title || undefined, keywordPool);

        if (!jobDetail) {
          sendEvent("error", { message: "공고 정보를 가져올 수 없습니다" });
          controller.close();
          return;
        }

        // 3단계: AI 분석 완료 알림
        sendEvent("progress", { step: 2, message: "AI가 공고 분석 완료!" });

        // 4단계: 필수 스킬 추출
        sendEvent("progress", { step: 3, message: "필수 스킬 추출 중..." });
        const requiredSkills = jobDetail.skills || [];

        // 5단계: 우대 스킬 분석
        sendEvent("progress", { step: 4, message: "우대 스킬 분석 중..." });
        const preferredSkills = jobDetail.preferredSkills || [];

        // 6단계: 강의 매칭 (중복 제거)
        sendEvent("progress", { step: 5, message: "추천 강의 매칭 중..." });
        const usedCourseIds = new Set<number>();
        const requiredCourses = await matchCoursesForSkills(requiredSkills, usedCourseIds);
        const preferredCourses = await matchCoursesForSkills(preferredSkills, usedCourseIds);

        // 7단계: 결과 정리
        sendEvent("progress", { step: 6, message: "결과 정리 중..." });

        // 최종 데이터 전송
        sendEvent("complete", {
          success: true,
          data: {
            jobDetail: {
              skills: requiredSkills,
              preferredSkills: preferredSkills,
              summary: jobDetail.summary,
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
        sendEvent("error", { message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 스킬별 강의 매칭 (relevance 기반 배치 + 중복 제거)
 * - GPT가 키워드 풀에서만 선택하므로 100% 매칭 보장
 * - 각 강의는 relevance가 가장 높은 스킬에만 배치되어 중복 제거
 */
async function matchCoursesForSkills(
  skills: SkillItem[],
  usedCourseIds: Set<number>
): Promise<SkillCourses> {
  if (skills.length === 0) return {};

  const result: SkillCourses = {};

  // 모든 스킬의 keyword를 추출해서 한 번에 검색
  const keywords = skills.map((s) => s.keyword);
  const allCourses = await findCoursesByKeywords(keywords);

  // 1단계: 각 강의를 relevance가 가장 높은 스킬에 배치
  // 강의 → { skillKeyword, relevance } 매핑
  const courseToSkillMap = new Map<number, { keyword: string; relevance: number }>();

  for (const course of allCourses) {
    // 이 강의가 매칭되는 모든 스킬 찾기
    const matchingSkills = skills.filter((skill) =>
      course.keywords.some((kw) => kw.toLowerCase() === skill.keyword)
    );

    if (matchingSkills.length === 0) continue;

    // relevance가 가장 높은 스킬 선택
    const bestSkill = matchingSkills.reduce((best, current) =>
      (current.relevance || 0) > (best.relevance || 0) ? current : best
    );

    courseToSkillMap.set(course.id, {
      keyword: bestSkill.keyword,
      relevance: bestSkill.relevance || 0,
    });
  }

  // 2단계: 각 스킬별로 강의 분류 (중복 제거)
  for (const skill of skills) {
    const matchingCourses = allCourses
      .filter((course) => {
        const assigned = courseToSkillMap.get(course.id);
        return assigned?.keyword === skill.keyword;
      })
      .filter((course) => !usedCourseIds.has(course.id));

    const selectedCourses = matchingCourses.slice(0, 5);
    selectedCourses.forEach((course) => usedCourseIds.add(course.id));

    result[skill.display] = selectedCourses;
  }

  return result;
}

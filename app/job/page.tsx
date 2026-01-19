"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface CourseMatch {
  id: number;
  slug: string;
  title: string;
  url: string;
  category: string;
  thumbnail: string | null;
  keywords: string[];
  match_count: number;
}

interface SkillItem {
  display: string;
  keyword: string;
  relevance: number;
}

interface SkillCourses {
  [skillDisplay: string]: CourseMatch[];
}

interface JobData {
  jobDetail: {
    skills: SkillItem[];
    preferredSkills: SkillItem[];
    summary?: string;
    rawContent?: string;
    isExternal?: boolean;
    externalUrl?: string;
  };
  matchedCourses: {
    required: SkillCourses;
    preferred: SkillCourses;
  };
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={<JobDetailLoading />}>
      <JobDetailContent />
    </Suspense>
  );
}

function JobDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">페이지 로딩 중...</p>
      </div>
    </div>
  );
}

function JobDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const url = searchParams.get("url");
  const title = searchParams.get("title") || "채용 공고";
  const simplifiedTitle = searchParams.get("simplifiedTitle") || title;
  const isExternal = searchParams.get("isExternal") === "true";

  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobData | null>(null);

  const [loadingMessage, setLoadingMessage] = useState("공고 페이지 연결 중...");

  const loadingSteps = [
    "공고 페이지 연결 중...",
    "공고 내용 가져오는 중...",
    "AI가 공고 분석 중...",
    "필수 스킬 추출 중...",
    "우대 스킬 분석 중...",
    "추천 강의 매칭 중...",
    "결과 정리 중...",
  ];

  // 인라인 마크다운 처리 (**bold** → <strong>)
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
    );
  };

  // SSE로 실제 진행 상황 받기
  useEffect(() => {
    if (!url) {
      setError("공고 URL이 없습니다");
      setLoading(false);
      return;
    }

    const apiUrl = `/api/job-with-courses?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&isExternal=${isExternal}`;
    const eventSource = new EventSource(apiUrl);

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data);
      setLoadingStep(data.step);
      setLoadingMessage(data.message);
    });

    eventSource.addEventListener("complete", (event) => {
      const result = JSON.parse(event.data);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "데이터를 불러올 수 없습니다");
      }
      setLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener("error", (event) => {
      // SSE 자체 에러 vs 서버에서 보낸 에러 구분
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data);
        setError(data.message || "오류가 발생했습니다");
      } else {
        setError("서버 연결에 실패했습니다");
      }
      setLoading(false);
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [url, title, isExternal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium mb-3">{loadingMessage}</p>

          {/* 진행 단계 표시 */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {loadingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index <= loadingStep
                    ? "w-8 bg-blue-600"
                    : "w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {isExternal && (
            <p className="text-gray-400 text-sm">
              외부 페이지 분석에 시간이 걸릴 수 있습니다
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 p-2 -ml-2"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {simplifiedTitle}
                </h1>
                <p className="text-sm text-gray-500">{title}</p>
              </div>
            </div>
            <a
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isExternal
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isExternal ? "채용 사이트에서 지원" : "사람인에서 지원"}
            </a>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 좌측: 공고 상세 정보 */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              공고 상세 정보
            </h2>
            {data?.jobDetail.summary ? (
              <div className="prose prose-sm max-w-none overflow-auto max-h-[70vh]">
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {data.jobDetail.summary.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">{renderInlineMarkdown(line.replace('## ', ''))}</h3>;
                    }
                    if (line.startsWith('### ')) {
                      return <h4 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{renderInlineMarkdown(line.replace('### ', ''))}</h4>;
                    }
                    if (line.startsWith('- ')) {
                      return <li key={i} className="ml-4 mb-1">{renderInlineMarkdown(line.replace('- ', ''))}</li>;
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    return <p key={i} className="mb-1">{renderInlineMarkdown(line)}</p>;
                  })}
                </div>
              </div>
            ) : data?.jobDetail.rawContent ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-gray-50 p-4 rounded-lg overflow-auto max-h-[70vh]">
                  {data.jobDetail.rawContent}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500">공고 내용을 불러올 수 없습니다.</p>
            )}
          </div>

          {/* 우측: 스킬 및 강의 매칭 */}
          <div className="space-y-6">
            {/* 필수 스킬 */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                필수 스킬
                <span className="text-sm font-normal text-gray-400">
                  배워야 할 기술
                </span>
              </h2>

              {data?.jobDetail.skills && data.jobDetail.skills.length > 0 ? (
                <div className="space-y-4">
                  {data.jobDetail.skills.map((skill) => (
                    <SkillWithCourses
                      key={skill.display}
                      skill={skill.display}
                      relevance={skill.relevance}
                      courses={data.matchedCourses.required[skill.display] || []}
                      colorClass="blue"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  필수 스킬 정보가 없습니다
                </p>
              )}
            </div>

            {/* 우대 스킬 */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                우대 스킬
                <span className="text-sm font-normal text-gray-400">
                  알면 좋은 기술
                </span>
              </h2>

              {data?.jobDetail.preferredSkills &&
              data.jobDetail.preferredSkills.length > 0 ? (
                <div className="space-y-4">
                  {data.jobDetail.preferredSkills.map((skill) => (
                    <SkillWithCourses
                      key={skill.display}
                      skill={skill.display}
                      relevance={skill.relevance}
                      courses={data.matchedCourses.preferred[skill.display] || []}
                      colorClass="green"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  우대 스킬 정보가 없습니다
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SkillWithCourses({
  skill,
  relevance,
  courses,
  colorClass,
}: {
  skill: string;
  relevance: number;
  courses: CourseMatch[];
  colorClass: "blue" | "green";
}) {
  const bgColor = colorClass === "blue" ? "bg-blue-100" : "bg-green-100";
  const textColor = colorClass === "blue" ? "text-blue-800" : "text-green-800";
  const barColor = colorClass === "blue" ? "bg-blue-500" : "bg-green-500";

  return (
    <div className="border-l-2 border-gray-200 pl-4">
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`inline-block ${bgColor} ${textColor} text-sm font-medium px-3 py-1 rounded-full`}
        >
          {skill}
        </span>
        <div
          className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px] cursor-help"
          title={`공고 연관도 ${relevance}%`}
        >
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-300`}
            style={{ width: `${relevance}%` }}
          />
        </div>
      </div>

      {courses.length > 0 ? (
        <div className="space-y-2 mt-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-start gap-3">
                {course.thumbnail && (
                  <img
                    src={course.thumbnail}
                    alt=""
                    className="w-16 h-10 object-cover rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 line-clamp-2">
                    {course.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {course.category}
                  </p>
                </div>
                <svg
                  className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-1">매칭되는 강의가 없습니다</p>
      )}
    </div>
  );
}

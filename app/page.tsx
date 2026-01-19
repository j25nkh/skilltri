"use client";

import { useState, useRef } from "react";
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

interface FilteredJob {
  originalTitle: string;
  simplifiedTitle: string;
  link: string;
  isRelevant: boolean;
  isExperienceOnly: boolean;
  deadline?: string;
  techStack?: string[];
  requirements?: string[];
}

interface SearchResult {
  success: boolean;
  isExternal: boolean;
  externalUrl?: string;
  jobs: FilteredJob[];
  error?: string;
}

export default function Home() {
  const [company, setCompany] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("채용 페이지 검색 중...");

  // 공고 상세 관련 상태
  const [selectedJob, setSelectedJob] = useState<FilteredJob | null>(null);
  const [jobDetail, setJobDetail] = useState<JobData | null>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [jobDetailStep, setJobDetailStep] = useState(0);
  const [jobDetailMessage, setJobDetailMessage] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadingSteps = [
    "채용 페이지 검색 중...",
    "회사 정보 확인 중...",
    "채용 공고 수집 중...",
    "공고 목록 정리 중...",
  ];

  const jobDetailSteps = [
    "공고 페이지 연결 중...",
    "공고 내용 가져오는 중...",
    "AI가 공고 분석 중...",
    "필수 스킬 추출 중...",
    "우대 스킬 분석 중...",
    "추천 강의 매칭 중...",
    "결과 정리 중...",
  ];

  // 공고 클릭 핸들러 - 인라인으로 상세 정보 표시
  const handleJobClick = (job: FilteredJob) => {
    // 같은 공고 다시 클릭 시 접기
    if (selectedJob?.link === job.link) {
      setSelectedJob(null);
      setJobDetail(null);
      return;
    }

    // 이전 요청 취소
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setSelectedJob(job);
    setJobDetail(null);
    setJobDetailLoading(true);
    setJobDetailStep(0);
    setJobDetailMessage("공고 페이지 연결 중...");

    const isExternal = searchResult?.isExternal || false;
    const apiUrl = `/api/job-with-courses?url=${encodeURIComponent(job.link)}&title=${encodeURIComponent(job.originalTitle)}&isExternal=${isExternal}`;
    const eventSource = new EventSource(apiUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data);
      setJobDetailStep(data.step);
      setJobDetailMessage(data.message);
    });

    eventSource.addEventListener("complete", (event) => {
      const result = JSON.parse(event.data);
      if (result.success) {
        setJobDetail(result.data);
      }
      setJobDetailLoading(false);
      eventSource.close();
      // 상세 정보로 스크롤
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });

    eventSource.addEventListener("error", () => {
      setJobDetailLoading(false);
      eventSource.close();
    });
  };

  // 회사명 별칭 매핑 (브랜드명 → 법인명)
  const companyAliases: Record<string, string> = {
    "토스": "비바리퍼블리카",
  };

  const handleSearch = (searchCompany?: string) => {
    const inputCompany = searchCompany || company;
    if (!inputCompany.trim()) {
      setError("회사명을 입력해주세요");
      return;
    }

    // 별칭이 있으면 실제 회사명으로 변환
    const targetCompany = companyAliases[inputCompany] || inputCompany;

    if (searchCompany) {
      setCompany(searchCompany); // UI에는 입력한 이름 표시
    }

    setLoading(true);
    setLoadingStep(0);
    setLoadingMessage("채용 페이지 검색 중...");
    setError(null);
    setSearched(true);
    setSearchResult(null);
    setSelectedJob(null);
    setJobDetail(null);

    const apiUrl = `/api/crawl?company=${encodeURIComponent(targetCompany)}`;
    const eventSource = new EventSource(apiUrl);

    eventSource.addEventListener("progress", (event) => {
      const data = JSON.parse(event.data);
      setLoadingStep(data.step);
      setLoadingMessage(data.message);
    });

    eventSource.addEventListener("complete", (event) => {
      const result = JSON.parse(event.data);
      if (result.success) {
        setSearchResult(result.data);
      } else {
        setError(result.error || "검색 중 오류가 발생했습니다");
      }
      setLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) {
        const data = JSON.parse(event.data);
        setError(data.message || "오류가 발생했습니다");
      } else {
        setError("서버 연결에 실패했습니다");
      }
      setLoading(false);
      eventSource.close();
    });
  };

  return (
    <div className={`min-h-screen transition-colors duration-700 ${searched ? "bg-gray-50" : "bg-black"}`}>
      {/* 배경 이미지 - 검색 후 페이드아웃 */}
      <div
        className={`fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
          searched ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ backgroundImage: "url('/Gemini_Generated_Image_pwoawnpwoawnpwoa.png')" }}
      />

      {/* 검색 전: 우측 배치 */}
      {!searched && (
        <div className="fixed inset-0 z-10 grid grid-cols-[60%_40%]">
          <div></div>
          <div className="flex flex-col items-center justify-center px-8">
            <h1 className="text-5xl font-bold text-white mb-4 animate-fade-in-up">
              Skill<span className="text-blue-400">Tri</span>
            </h1>
            <p className="text-gray-200 text-lg mb-12 text-center max-w-md animate-fade-in-up animation-delay-100">
              원하는 회사의 채용 공고를 분석하여
              <br />
              지금 필요한 역량을 파악하세요
            </p>

            <div className="w-full max-w-xl animate-fade-in-up animation-delay-200">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="회사명을 입력하세요 (예: 데이원컴퍼니)"
                  className="flex-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-5 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-8 py-4 rounded-xl transition-colors shadow-lg"
                >
                  검색
                </button>
              </div>
              {error && (
                <div className="text-red-400 text-sm text-center mt-3">{error}</div>
              )}

              {/* 자주 검색하는 회사 */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {["데이원컴퍼니", "네이버", "카카오", "토스", "쿠팡", "라인"].map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSearch(name)}
                    className="px-3 py-1.5 text-sm text-white/80 hover:text-white border border-white/30 hover:border-white/60 rounded-full transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검색 후: 상단 고정 헤더 */}
      {searched && (
        <header className="sticky top-0 z-20 bg-white shadow-md py-4 animate-fade-in">
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex gap-3 items-center">
              <h1
                onClick={() => {
                  setSearched(false);
                  setSearchResult(null);
                  setCompany("");
                  setError(null);
                }}
                className="text-2xl font-bold text-gray-900 mr-4 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
              >
                Skill<span className="text-blue-500">Tri</span>
              </h1>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="회사명을 입력하세요 (예: 데이원컴퍼니)"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-6 py-3 rounded-xl transition-colors"
              >
                {loading ? "검색 중..." : "검색"}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 결과 영역 */}
      {searched && (
        <main className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-700 font-medium mb-3">{loadingMessage}</p>

              {/* 진행 단계 표시 */}
              <div className="flex items-center justify-center gap-2">
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
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200">
              <p className="text-gray-500">
                {error}
                <br />
                <span className="text-sm">회사명을 다시 확인해보세요.</span>
              </p>
            </div>
          ) : searchResult ? (
            <div>
              {/* 채용 페이지 안내 배너 */}
              {searchResult.externalUrl && (
                <a
                  href={searchResult.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between hover:bg-blue-100 transition-colors block"
                >
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-blue-600">{company}</span> 채용 페이지에서 더 많은 공고 보기
                  </p>
                  <span className="text-blue-600 text-sm font-medium">→</span>
                </a>
              )}

              {/* 검색 결과 */}
              {searchResult.jobs.length > 0 ? (
                <div>
                  {/* 공고 목록 - 선택된 공고가 없을 때만 표시 */}
                  {!selectedJob ? (
                    <>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        채용 공고{" "}
                        <span className="text-blue-600">
                          {searchResult.jobs.length}건
                        </span>
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        공고를 선택해 {company} 입사에 필요한 스킬을 확인하세요
                      </p>

                      <div className="space-y-3">
                        {searchResult.jobs.map((job, index) => (
                          <div
                            key={index}
                            onClick={() => handleJobClick(job)}
                            className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <h3 className="font-medium text-gray-900">
                                {job.originalTitle}
                              </h3>
                              {job.deadline && (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {job.deadline}
                                </span>
                              )}
                            </div>
                            {job.techStack && job.techStack.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {job.techStack.map((tech, i) => (
                                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* 공고 상세 정보 */
                    <div ref={detailRef}>
                      {/* 목록으로 돌아가기 버튼 */}
                      <button
                        onClick={() => {
                          setSelectedJob(null);
                          setJobDetail(null);
                        }}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm group-hover:underline">공고 목록으로</span>
                      </button>

                      <h2 className="text-xl font-semibold text-gray-900 mb-6">
                        {selectedJob.originalTitle}
                      </h2>

                      {jobDetailLoading ? (
                        <div className="flex flex-col items-center py-16">
                          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                          <p className="text-gray-700 font-medium mb-3">{jobDetailMessage}</p>
                          <div className="flex items-center justify-center gap-1.5">
                            {jobDetailSteps.map((_, index) => (
                              <div
                                key={index}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  index <= jobDetailStep
                                    ? "w-6 bg-blue-600"
                                    : "w-1.5 bg-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : jobDetail ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* 좌측: 공고 상세 정보 */}
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <h3 className="text-base font-semibold text-gray-900 mb-4">
                              공고 상세 정보
                            </h3>
                            {jobDetail.jobDetail.summary ? (
                              <div className="prose prose-sm max-w-none overflow-auto max-h-[60vh]">
                                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {jobDetail.jobDetail.summary.split('\n').map((line, i) => {
                                    if (line.startsWith('## ')) {
                                      return <h4 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">{line.replace('## ', '')}</h4>;
                                    }
                                    if (line.startsWith('### ')) {
                                      return <h5 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{line.replace('### ', '')}</h5>;
                                    }
                                    if (line.startsWith('- ')) {
                                      return <li key={i} className="ml-4 mb-1">{line.replace('- ', '')}</li>;
                                    }
                                    if (line.trim() === '') {
                                      return <br key={i} />;
                                    }
                                    return <p key={i} className="mb-1">{line}</p>;
                                  })}
                                </div>
                              </div>
                            ) : jobDetail.jobDetail.rawContent ? (
                              <div className="prose prose-sm max-w-none">
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-gray-50 p-4 rounded-lg overflow-auto max-h-[60vh]">
                                  {jobDetail.jobDetail.rawContent}
                                </pre>
                              </div>
                            ) : (
                              <p className="text-gray-500">공고 내용을 불러올 수 없습니다.</p>
                            )}
                          </div>

                          {/* 우측: 스킬 및 강의 */}
                          <div className="space-y-6">
                            {/* 필수 스킬 */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                필수 스킬
                                <span className="text-sm font-normal text-gray-400">배워야 할 기술</span>
                              </h3>
                              {jobDetail.jobDetail.skills.length > 0 ? (
                                <div className="space-y-6">
                                  {jobDetail.jobDetail.skills.map((skill) => (
                                    <SkillWithCourses
                                      key={skill.display}
                                      skill={skill.display}
                                      relevance={skill.relevance}
                                      courses={jobDetail.matchedCourses.required[skill.display] || []}
                                      colorClass="blue"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm">필수 스킬 정보가 없습니다</p>
                              )}
                            </div>

                            {/* 우대 스킬 */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                                우대 스킬
                                <span className="text-sm font-normal text-gray-400">알면 좋은 기술</span>
                              </h3>
                              {jobDetail.jobDetail.preferredSkills.length > 0 ? (
                                <div className="space-y-6">
                                  {jobDetail.jobDetail.preferredSkills.map((skill) => (
                                    <SkillWithCourses
                                      key={skill.display}
                                      skill={skill.display}
                                      relevance={skill.relevance}
                                      courses={jobDetail.matchedCourses.preferred[skill.display] || []}
                                      colorClass="green"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm">우대 스킬 정보가 없습니다</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200">
                  <p className="text-gray-500">
                    &apos;{company}&apos;의 채용 공고를 찾을 수 없습니다.
                    <br />
                    <span className="text-sm">회사명을 확인해보세요.</span>
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </main>
      )}
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">직무연관도</span>
          <div className="flex items-center gap-1.5">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden w-16">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-300`}
                style={{ width: `${relevance}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${textColor}`}>{relevance}%</span>
          </div>
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
                  <p className="text-xs text-gray-500 mt-1">{course.category}</p>
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

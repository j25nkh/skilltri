"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState("채용 페이지 검색 중...");

  const loadingSteps = [
    "채용 페이지 검색 중...",
    "회사 정보 확인 중...",
    "채용 공고 수집 중...",
    "공고 목록 정리 중...",
  ];

  // 공고 클릭 핸들러 - 상세 페이지로 이동
  const handleJobClick = (job: FilteredJob) => {
    const isExternal = searchResult?.isExternal || false;
    const params = new URLSearchParams({
      url: job.link,
      title: job.originalTitle,
      simplifiedTitle: job.simplifiedTitle,
      isExternal: String(isExternal),
    });
    router.push(`/job?${params.toString()}`);
  };

  const handleSearch = (searchCompany?: string) => {
    const targetCompany = searchCompany || company;
    if (!targetCompany.trim()) {
      setError("회사명을 입력해주세요");
      return;
    }

    if (searchCompany) {
      setCompany(searchCompany);
    }

    setLoading(true);
    setLoadingStep(0);
    setLoadingMessage("채용 페이지 검색 중...");
    setError(null);
    setSearched(true);
    setSearchResult(null);

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
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    채용 공고{" "}
                    <span className="text-blue-600">
                      {searchResult.jobs.length}건
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    공고를 선택해 {company} 입사에 필요한 스킬을 확인하세요
                    <span className="block text-xs text-gray-400 mt-1">신입/인턴 지원 가능한 공고만 표시됩니다</span>
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
                          <h3 className="text-gray-900 font-medium">
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

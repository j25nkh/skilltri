"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FilteredJob {
  originalTitle: string;
  simplifiedTitle: string;
  link: string;
  isRelevant: boolean;
  isExperienceOnly: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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

  const handleSearch = async () => {
    if (!company.trim()) {
      setError("회사명을 입력해주세요");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setSearchResult(null);

    try {
      const res = await fetch(
        `/api/crawl?company=${encodeURIComponent(company)}`
      );
      const data: SearchResult = await res.json();

      if (data.success) {
        setSearchResult(data);
      } else {
        setError(data.error || "검색 중 오류가 발생했습니다");
      }
    } catch {
      setError("서버 연결에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-8 py-4 rounded-xl transition-colors shadow-lg"
                >
                  검색
                </button>
              </div>
              {error && (
                <div className="text-red-400 text-sm text-center mt-3">{error}</div>
              )}
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
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-6 py-3 rounded-xl transition-colors"
              >
                {loading ? "검색 중..." : "검색"}
              </button>
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center mt-3">{error}</div>
            )}
          </div>
        </header>
      )}

      {/* 결과 영역 */}
      {searched && (
        <main className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">공고를 분석하고 있습니다...</p>
            </div>
          ) : searchResult ? (
            <div>
              {/* 외부 회사 안내 */}
              {searchResult.isExternal && searchResult.externalUrl && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-600 font-semibold">외부 채용 사이트</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                      자체 채용 페이지 운영
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    이 회사는 자체 채용 사이트에서 직접 채용을 진행합니다.
                  </p>
                  <a
                    href={searchResult.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-600 hover:text-orange-700 underline"
                  >
                    채용 사이트 바로가기 →
                  </a>
                </div>
              )}

              {/* 검색 결과 */}
              {searchResult.jobs.length > 0 ? (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    채용 공고{" "}
                    <span className={searchResult.isExternal ? "text-orange-600" : "text-blue-600"}>
                      {searchResult.jobs.length}건
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    신입/인턴 지원 가능한 공고만 표시됩니다
                  </p>

                  <div className="space-y-3">
                    {searchResult.jobs.map((job, index) => (
                      <div
                        key={index}
                        onClick={() => handleJobClick(job)}
                        className={`block bg-white rounded-xl p-5 shadow-md border hover:shadow-lg transition-all cursor-pointer ${
                          searchResult.isExternal
                            ? "border-orange-200 hover:border-orange-400"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {job.simplifiedTitle}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {job.originalTitle}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-3 py-1 rounded-full ${
                              searchResult.isExternal
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {searchResult.isExternal ? "외부" : "사람인"}
                          </span>
                        </div>
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

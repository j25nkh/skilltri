"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type JobCategory = "개발" | "AI" | "디자인" | "마케팅";

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
  const [category, setCategory] = useState<JobCategory>("개발");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // 결과 섹션 ref
  const resultsRef = useRef<HTMLDivElement>(null);

  // 검색 완료 시 결과 섹션으로 스크롤
  useEffect(() => {
    if (searched && !loading && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [searched, loading]);

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
        `/api/crawl?company=${encodeURIComponent(company)}&category=${encodeURIComponent(category)}`
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Skill<span className="text-blue-600">Tri</span>
        </h1>
        <p className="text-gray-600 text-lg mb-12 text-center max-w-md">
          원하는 회사의 채용 공고를 분석하여
          <br />
          지금 필요한 역량을 파악하세요
        </p>

        {/* Search Form */}
        <div className="w-full max-w-2xl bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-3">
              직군 선택
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["개발", "AI", "디자인", "마케팅"] as JobCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      category === cat
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Company Search */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-3">
              회사명
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="예: 네이버, 카카오, 토스"
                className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-8 py-3 rounded-lg transition-colors shadow-md"
              >
                {loading ? "검색 중..." : "검색"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {searched && (
        <div ref={resultsRef} className="min-h-screen max-w-4xl mx-auto px-4 py-20">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">공고를 분석하고 있습니다...</p>
            </div>
          ) : searchResult ? (
            <>
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
                    {category} 관련 공고{" "}
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
                          <span className={`text-xs px-3 py-1 rounded-full ${
                            searchResult.isExternal
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
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
                    &apos;{company}&apos;의 {category} 관련 채용 공고를 찾을 수 없습니다.
                    <br />
                    <span className="text-sm">다른 직군을 선택하거나 회사명을 확인해보세요.</span>
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

    </div>
  );
}

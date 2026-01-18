"use client";

import { useState } from "react";
import { JobPosting } from "@/lib/saramin";

type JobCategory = "개발" | "AI" | "디자인" | "마케팅";

export default function Home() {
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState<JobCategory>("개발");
  const [results, setResults] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!company.trim()) {
      setError("회사명을 입력해주세요");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/crawl?company=${encodeURIComponent(company)}&category=${encodeURIComponent(category)}`
      );
      const data = await res.json();

      if (data.success) {
        setResults(data.data);
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
      <div className="flex flex-col items-center justify-center px-4 pt-20 pb-12">
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
        <div className="max-w-4xl mx-auto px-4 pb-20">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : results.length > 0 ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                검색 결과{" "}
                <span className="text-blue-600">{results.length}건</span>
              </h2>
              <div className="space-y-4">
                {results.map((job, index) => (
                  <a
                    key={index}
                    href={job.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {job.title}
                        </h3>
                        <p className="text-blue-600 text-sm font-medium">{job.company}</p>
                      </div>
                      {job.deadline && (
                        <span className="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full">
                          {job.deadline}
                        </span>
                      )}
                    </div>

                    {job.requirements.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {job.requirements.map((req, i) => (
                          <span
                            key={i}
                            className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    )}

                    {job.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.techStack.map((tech, i) => (
                          <span
                            key={i}
                            className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full border border-blue-200"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200">
              <p className="text-gray-500">
                &apos;{company}&apos;의 채용 공고를 찾을 수 없습니다.
                <br />
                <span className="text-sm">정확한 회사명으로 다시 검색해보세요.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

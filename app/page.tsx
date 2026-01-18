"use client";

import { useState } from "react";
import { JobPosting } from "@/lib/saramin";

type JobCategory = "개발" | "AI" | "디자인" | "마케팅";

interface JobDetail {
  skills: string[];           // 필수 스킬 키워드
  preferredSkills: string[];  // 우대 스킬 키워드
}

export default function Home() {
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState<JobCategory>("개발");
  const [results, setResults] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // 모달 관련 상태
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleJobClick = async (job: JobPosting) => {
    setSelectedJob(job);
    setJobDetail(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/job-detail?url=${encodeURIComponent(job.link)}`);
      const data = await res.json();

      if (data.success) {
        setJobDetail(data.data);
      }
    } catch {
      // 상세 정보 로딩 실패 시 무시
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedJob(null);
    setJobDetail(null);
  };

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
                  <div
                    key={index}
                    onClick={() => handleJobClick(job)}
                    className="block bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
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
                  </div>
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

      {/* 상세 정보 모달 */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start rounded-t-2xl">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedJob.title}
                </h2>
                <p className="text-blue-600 font-medium">{selectedJob.company}</p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="px-6 py-4">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  {selectedJob.deadline && (
                    <div>
                      <span className="text-gray-500 text-sm">마감일: </span>
                      <span className="text-gray-900">{selectedJob.deadline}</span>
                    </div>
                  )}

                  {/* 필수 스킬 */}
                  {jobDetail?.skills && jobDetail.skills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        필수 스킬
                        <span className="text-gray-400 font-normal ml-2">배워야 할 기술</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {jobDetail.skills.map((skill, i) => (
                          <span
                            key={i}
                            className="bg-blue-100 text-blue-800 text-sm font-medium px-4 py-2 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 우대 스킬 */}
                  {jobDetail?.preferredSkills && jobDetail.preferredSkills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        우대 스킬
                        <span className="text-gray-400 font-normal ml-2">알면 좋은 기술</span>
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {jobDetail.preferredSkills.map((skill, i) => (
                          <span
                            key={i}
                            className="bg-green-100 text-green-800 text-sm font-medium px-4 py-2 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 상세 정보 없을 때 */}
                  {!detailLoading && !jobDetail?.skills?.length && !jobDetail?.preferredSkills?.length && (
                    <p className="text-gray-500 text-center py-4">
                      스킬 정보를 추출할 수 없습니다.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl">
              <a
                href={selectedJob.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg text-center transition-colors"
              >
                사람인에서 보기
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

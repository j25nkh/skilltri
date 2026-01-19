"use client";

import { useState } from "react";
import Link from "next/link";

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

interface JobDetail {
  skills: string[];
  preferredSkills: string[];
  isExternal?: boolean;
  externalUrl?: string;
  rawContent?: string;
}

interface Course {
  slug: string;
  title: string;
  url: string;
  category: string;
}

export default function Home() {
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState<JobCategory>("개발");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // 모달 관련 상태
  const [selectedJob, setSelectedJob] = useState<FilteredJob | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 강의 목록 상태
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [courseCategory, setCourseCategory] = useState<string>("전체");
  const [courseCategories, setCourseCategories] = useState<string[]>(["전체"]);
  const [totalCourses, setTotalCourses] = useState(0);

  // 공고 클릭 핸들러
  const handleJobClick = async (job: FilteredJob) => {
    setSelectedJob(job);
    setJobDetail(null);
    setDetailLoading(true);

    try {
      const isExternal = searchResult?.isExternal || false;
      const apiUrl = isExternal
        ? `/api/job-detail?url=${encodeURIComponent(job.link)}&isExternal=true`
        : `/api/job-detail?url=${encodeURIComponent(job.link)}&title=${encodeURIComponent(job.originalTitle)}`;

      const res = await fetch(apiUrl);
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

  // 강의 목록 가져오기
  const handleFetchCourses = async () => {
    setShowCourses(true);
    if (courses.length > 0) return; // 이미 로딩된 경우

    setCoursesLoading(true);
    try {
      const res = await fetch("/api/courses?limit=10");
      const data = await res.json();
      if (data.success) {
        setCourses(data.courses);
        setCourseCategories(data.categories || ["전체"]);
        setTotalCourses(data.total || data.courses.length);
      }
    } catch {
      console.error("Failed to fetch courses");
    } finally {
      setCoursesLoading(false);
    }
  };

  // 카테고리별 필터링된 강의
  const filteredCourses = courseCategory === "전체"
    ? courses
    : courses.filter(c => c.category === courseCategory);

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
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {selectedJob.simplifiedTitle}
                </h2>
                <p className="text-sm text-gray-500">{selectedJob.originalTitle}</p>
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
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500 text-sm">공고 분석 중...</p>
                  {searchResult?.isExternal && (
                    <p className="text-gray-400 text-xs mt-2">외부 페이지 로딩에 시간이 걸릴 수 있습니다</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
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

                  {/* 공고 전문 */}
                  {jobDetail?.rawContent && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        공고 전문
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {jobDetail.rawContent}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 상세 정보 없을 때 */}
                  {!detailLoading && !jobDetail?.skills?.length && !jobDetail?.preferredSkills?.length && (
                    <div className="text-center py-6">
                      <div className="mb-4">
                        <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 mb-2">
                        이 공고의 스킬 정보를 자동으로 분석할 수 없습니다.
                      </p>
                      <p className="text-sm text-gray-400">
                        아래 버튼을 눌러 채용 사이트에서 직접 확인해주세요.
                      </p>
                    </div>
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
                className={`block w-full ${
                  searchResult?.isExternal
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white font-medium py-3 rounded-lg text-center transition-colors`}
              >
                {searchResult?.isExternal ? "채용 사이트에서 지원하기" : "사람인에서 지원하기"}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 패스트캠퍼스 강의 섹션 */}
      <div className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              스킬 학습하기
            </h2>
            <p className="text-gray-600">
              필요한 기술을 패스트캠퍼스에서 배워보세요
            </p>
          </div>

          {!showCourses ? (
            <div className="text-center">
              <button
                onClick={handleFetchCourses}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-4 rounded-xl transition-colors shadow-lg"
              >
                패스트캠퍼스 강의 보기
              </button>
            </div>
          ) : (
            <div>
              {coursesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-gray-500">강의 목록을 불러오는 중...</p>
                  <p className="text-gray-400 text-sm mt-2">여러 카테고리를 크롤링하고 있어 시간이 걸릴 수 있습니다</p>
                </div>
              ) : (
                <>
                  {/* 카테고리 필터 */}
                  <div className="flex flex-wrap gap-2 mb-6 justify-center">
                    {courseCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCourseCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          courseCategory === cat
                            ? "bg-purple-600 text-white"
                            : "bg-white text-gray-700 hover:bg-purple-100"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* 강의 개수 및 전체 보기 */}
                  <div className="text-center mb-6">
                    <p className="text-gray-500 mb-3">
                      <span className="text-purple-600 font-semibold">{filteredCourses.length}</span>개 표시 중
                      {totalCourses > 0 && (
                        <span className="text-gray-400"> (전체 {totalCourses}개)</span>
                      )}
                    </p>
                    <Link
                      href="/courses"
                      className="inline-block text-sm text-purple-600 hover:text-purple-700 underline"
                    >
                      전체 강의 목록 보기 →
                    </Link>
                  </div>

                  {/* 강의 목록 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCourses.map((course) => (
                      <Link
                        key={course.slug}
                        href={`/course/${course.slug}`}
                        className="bg-white rounded-xl p-5 shadow-md border border-gray-200 hover:shadow-lg hover:border-purple-300 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="text-gray-900 font-medium line-clamp-2 flex-1">
                            {course.title}
                          </h3>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full ml-2 whitespace-nowrap">
                            {course.category}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {filteredCourses.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      해당 카테고리의 강의가 없습니다.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

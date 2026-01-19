import axios from "axios";
import * as cheerio from "cheerio";
import { parseJobWithAI, JobDetailParsed, FilteredJob } from "./openai";
import { fetchExternalJobDetail, fetchExternalJobList, fetchExternalJobContent, ExternalJob } from "./jina";
import { fetchJobsFromSitemap } from "./sitemap";

export interface JobPosting {
  title: string;
  company: string;
  link: string;
  requirements: string[];
  preferredQualifications: string[];
  techStack: string[];
  deadline: string;
  isExternal?: boolean;  // 외부 공고 여부
}

export interface CrawlResult {
  success: boolean;
  data: JobPosting[];
  error?: string;
  // 외부 회사 정보
  isExternalCompany?: boolean;
  externalUrl?: string;
  externalJobs?: ExternalJob[];
}

// 새로운 검색 결과 인터페이스 (GPT 필터링 적용)
export interface FilteredSearchResult {
  success: boolean;
  isExternal: boolean;
  externalUrl?: string;
  jobs: FilteredJob[];
  error?: string;
}

const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * Step 1: 회사명으로 검색하여 회사 코드(csn) 찾기
 */
async function findCompanyCode(companyName: string): Promise<string | null> {
  const startTime = performance.now();
  console.log(`[Step 1] 회사 코드 검색 시작: "${companyName}"`);

  try {
    const searchQuery = encodeURIComponent(companyName);
    const searchUrl = `https://www.saramin.co.kr/zf_user/search/company?searchword=${searchQuery}`;

    const response = await axios.get(searchUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // 회사명 정규화 함수
    const normalize = (name: string) =>
      name.toLowerCase().replace(/[()주식회사㈜\s]/g, "");

    const normalizedSearchName = normalize(companyName);
    let foundCsn: string | null = null;

    // 회사 검색 결과에서 csn 파라미터 추출
    $("a[href*='company-info/view']").each((_, element) => {
      const href = $(element).attr("href") || "";
      const companyText = $(element).text().trim();
      const normalizedCompanyText = normalize(companyText);

      // 회사명 매칭 확인
      if (normalizedCompanyText.includes(normalizedSearchName) ||
          normalizedSearchName.includes(normalizedCompanyText)) {
        const csnMatch = href.match(/csn=([^&]+)/);
        if (csnMatch) {
          foundCsn = csnMatch[1];
          return false; // 첫 번째 매칭 후 중단
        }
      }
    });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[Step 1] 회사 코드 검색 완료: ${foundCsn ? `CSN=${foundCsn}` : '찾지 못함'} (${elapsed}초)`);

    return foundCsn;
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[Step 1] 회사 코드 검색 실패 (${elapsed}초):`, error);
    return null;
  }
}

/**
 * 한 페이지의 채용공고 파싱
 */
function parseJobsFromHtml(html: string, companyName: string): JobPosting[] {
  const $ = cheerio.load(html);
  const jobPostings: JobPosting[] = [];

  // AJAX 응답의 list_item 구조 파싱
  $(".list_item").each((_, element) => {
    const $el = $(element);

    // 제목과 링크 추출 (str_tit 클래스 사용)
    const $titleLink = $el.find("a.str_tit");
    const title = $titleLink.find("span").text().trim() || $titleLink.text().trim();
    const linkPath = $titleLink.attr("href") || "";

    const link = linkPath.startsWith("http")
      ? linkPath
      : `https://www.saramin.co.kr${linkPath}`;

    // 마감일 (support_detail에서 추출)
    const deadlineText = $el.find(".support_detail .date").text().trim();
    const deadline = deadlineText || "";

    // 기술 스택 (job_sector에서 추출)
    const techStack: string[] = [];
    $el.find(".job_sector span, .job_meta .job_sector span").each((_, tag) => {
      const text = $(tag).text().trim();
      if (text) techStack.push(text);
    });

    // 조건 정보 (경력, 학력 등)
    const conditions: string[] = [];
    $el.find(".support_detail .txt").each((_, span) => {
      const text = $(span).text().trim();
      if (text) conditions.push(text);
    });

    // 경력 조건 확인 - 경력만 요구하는 공고 제외
    const experienceText = conditions.join(" ");
    const isExperienceOnly =
      (experienceText.includes("경력") &&
       !experienceText.includes("신입") &&
       !experienceText.includes("무관") &&
       !experienceText.includes("인턴"));

    if (title && !isExperienceOnly) {
      jobPostings.push({
        title,
        company: companyName,
        link,
        requirements: conditions,
        preferredQualifications: [],
        techStack,
        deadline,
      });
    }
  });

  return jobPostings;
}

/**
 * Step 2: AJAX 엔드포인트를 사용하여 전체 공고 크롤링 (페이지네이션 포함)
 */
async function crawlCompanyJobs(
  csn: string,
  companyName: string
): Promise<JobPosting[]> {
  const startTime = performance.now();
  console.log(`[Step 2] 공고 목록 크롤링 시작: CSN=${csn}`);

  const allJobs: JobPosting[] = [];
  const maxPages = 20; // 최대 페이지 수 제한 (100개 공고)
  let pagesProcessed = 0;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const recruitUrl = `https://www.saramin.co.kr/zf_user/company-info/get-recruit-list?csn=${csn}&opening=y&page=${page}`;

      const response = await axios.get(recruitUrl, {
        headers: HTTP_HEADERS,
        timeout: 10000,
      });

      const jobs = parseJobsFromHtml(response.data, companyName);
      pagesProcessed = page;

      if (jobs.length === 0) {
        // 더 이상 공고가 없으면 종료
        break;
      }

      allJobs.push(...jobs);

      // 5개 미만이면 마지막 페이지
      if (jobs.length < 5) {
        break;
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[Step 2] 공고 목록 크롤링 완료: ${allJobs.length}개 공고, ${pagesProcessed}페이지 (${elapsed}초)`);

    return allJobs;
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[Step 2] 공고 목록 크롤링 실패 (${elapsed}초):`, error);
    return allJobs; // 에러 발생 전까지 수집된 결과 반환
  }
}

/**
 * Step 2: 샘플 공고 1개만 가져오기 (외부/내부 판별용)
 * 첫 페이지에서 첫 번째 공고만 반환
 */
async function getSampleJob(
  csn: string,
  companyName: string
): Promise<JobPosting | null> {
  const startTime = performance.now();
  console.log(`[Step 2] 샘플 공고 확인 시작`);

  try {
    const recruitUrl = `https://www.saramin.co.kr/zf_user/company-info/get-recruit-list?csn=${csn}&opening=y&page=1`;

    const response = await axios.get(recruitUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const jobs = parseJobsFromHtml(response.data, companyName);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

    if (jobs.length === 0) {
      console.log(`[Step 2] 샘플 공고 없음 (${elapsed}초)`);
      return null;
    }

    console.log(`[Step 2] 샘플 공고 확인 완료: "${jobs[0].title.slice(0, 30)}..." (${elapsed}초)`);
    return jobs[0];
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[Step 2] 샘플 공고 확인 실패 (${elapsed}초):`, error);
    return null;
  }
}

/**
 * 첫 번째 공고로 외부 회사 여부 확인
 * 외부 회사면 외부 URL 반환
 */
async function checkIfExternalCompany(firstJobUrl: string): Promise<{ isExternal: boolean; externalUrl: string | null }> {
  const startTime = performance.now();
  console.log(`[Step 3] 외부 회사 여부 확인 시작`);

  try {
    const directUrl = convertToDirectViewUrl(firstJobUrl);
    console.log("Checking if external company:", directUrl);

    const response = await axios.get(directUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const html = response.data;

    // 홈페이지 지원 (외부 공고) 감지
    const isExternal = html.includes('title="홈페이지 지원"') ||
                       html.includes('Saramin.btnJob("homepage"') ||
                       html.includes("Saramin.btnJob('homepage'");

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

    if (isExternal) {
      const externalUrl = extractExternalUrl(html);
      console.log(`[Step 3] 외부 회사 확인 완료: 외부 회사 (${elapsed}초)`);
      console.log("External URL:", externalUrl);
      return { isExternal: true, externalUrl };
    }

    console.log(`[Step 3] 외부 회사 확인 완료: 내부 회사 (${elapsed}초)`);
    return { isExternal: false, externalUrl: null };
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[Step 3] 외부 회사 확인 실패 (${elapsed}초):`, error);
    return { isExternal: false, externalUrl: null };
  }
}

/**
 * 메인 검색 함수: 2단계 크롤링
 * 1. 회사명으로 csn 코드 찾기
 * 2. 회사 채용 페이지에서 전체 공고 크롤링
 * 3. 외부 회사인 경우 외부 사이트 공고 목록도 가져오기
 */
export async function searchSaramin(companyName: string): Promise<CrawlResult> {
  try {
    // Step 1: 회사 코드 찾기
    const csn = await findCompanyCode(companyName);

    if (!csn) {
      // csn을 못 찾으면 기존 키워드 검색 방식으로 폴백
      return await searchSaraminFallback(companyName);
    }

    // Step 2: 회사 채용 페이지에서 공고 크롤링
    const jobPostings = await crawlCompanyJobs(csn, companyName);

    // Step 3: 첫 번째 공고로 외부 회사 여부 확인
    if (jobPostings.length > 0) {
      const { isExternal, externalUrl } = await checkIfExternalCompany(jobPostings[0].link);

      if (isExternal && externalUrl) {
        console.log("Fetching external job listings...");

        // 외부 사이트에서 공고 목록 가져오기
        const externalJobs = await fetchExternalJobList(externalUrl);

        return {
          success: true,
          data: jobPostings.map(job => ({ ...job, isExternal: true })),
          isExternalCompany: true,
          externalUrl,
          externalJobs,
        };
      }
    }

    return {
      success: true,
      data: jobPostings,
      isExternalCompany: false,
    };
  } catch (error) {
    console.error("Saramin crawling error:", error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "크롤링 중 오류가 발생했습니다",
    };
  }
}

/**
 * 폴백: 기존 키워드 검색 방식
 */
async function searchSaraminFallback(companyName: string): Promise<CrawlResult> {
  try {
    const searchQuery = encodeURIComponent(companyName);
    const searchUrl = `https://www.saramin.co.kr/zf_user/search/recruit?searchType=search&searchword=${searchQuery}&recruitPage=1&recruitSort=relation&recruitPageCount=100`;

    const response = await axios.get(searchUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const jobPostings: JobPosting[] = [];

    // 회사명 정규화 함수
    const normalize = (name: string) =>
      name.toLowerCase().replace(/[()주식회사㈜\s]/g, "");
    const normalizedCompanyName = normalize(companyName);

    // 검색 결과에서 채용 공고 목록 파싱
    $(".item_recruit").each((_, element) => {
      const $el = $(element);

      const title = $el.find(".job_tit a").text().trim();
      const company = $el.find(".corp_name a").text().trim();
      const linkPath = $el.find(".job_tit a").attr("href") || "";
      const link = linkPath.startsWith("http")
        ? linkPath
        : `https://www.saramin.co.kr${linkPath}`;

      // 조건 정보 파싱
      const conditions: string[] = [];
      $el.find(".job_condition span").each((_, span) => {
        conditions.push($(span).text().trim());
      });

      // 마감일
      const deadline = $el.find(".job_date .date").text().trim();

      // 기술 스택 (job_sector에서 추출)
      const techStack: string[] = [];
      $el.find(".job_sector a").each((_, tag) => {
        techStack.push($(tag).text().trim());
      });

      // 회사명 필터링
      const normalizedJobCompany = normalize(company);
      const isMatchingCompany =
        normalizedJobCompany.includes(normalizedCompanyName) ||
        normalizedCompanyName.includes(normalizedJobCompany);

      if (title && company && isMatchingCompany) {
        jobPostings.push({
          title,
          company,
          link,
          requirements: conditions,
          preferredQualifications: [],
          techStack,
          deadline,
        });
      }
    });

    return {
      success: true,
      data: jobPostings,
    };
  } catch (error) {
    console.error("Saramin fallback crawling error:", error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "크롤링 중 오류가 발생했습니다",
    };
  }
}

/**
 * relay URL을 직접 view URL로 변환
 * /jobs/relay/view?rec_idx=123 -> /jobs/view?rec_idx=123
 */
function convertToDirectViewUrl(url: string): string {
  // rec_idx 추출
  const recIdxMatch = url.match(/rec_idx=(\d+)/);
  if (recIdxMatch) {
    return `https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=${recIdxMatch[1]}`;
  }
  return url;
}

/**
 * 외부 채용 URL 추출
 * 사람인 페이지 HTML에서 외부 채용사이트 URL 찾기
 */
function extractExternalUrl(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. .jv_howto 영역의 a 태그에서 data-href 추출 (가장 정확)
  const howtoLink = $('.jv_howto a[data-href]').attr('data-href');
  if (howtoLink && howtoLink.startsWith('http')) {
    console.log("Found external URL from .jv_howto:", howtoLink);
    return howtoLink;
  }

  // 2. 외부 링크 패턴으로 추출 (data-href 속성에서)
  const externalLinkMatch = html.match(/data-href="(https?:\/\/[^"]+)"/);
  if (externalLinkMatch) {
    console.log("Found external URL from data-href pattern:", externalLinkMatch[1]);
    return externalLinkMatch[1];
  }

  return null;
}

/**
 * 채용공고 상세 정보 가져오기
 * 내부 공고: 사람인 HTML → OpenAI 분석
 * 외부 공고: Jina Reader로 SPA 렌더링 → OpenAI 분석
 * @param jobUrl - 채용공고 URL
 * @param jobTitle - 채용공고 제목 (외부 공고 분석 시 사용)
 * @param keywordPool - 사용 가능한 키워드 목록 (DB에서 가져온 것)
 * @param onProgress - 진행 상황 콜백
 */
export async function getJobDetail(
  jobUrl: string,
  jobTitle?: string,
  keywordPool?: string[],
  onProgress?: (step: number, message: string) => void
): Promise<JobDetailParsed | null> {
  const progress = (step: number, message: string) => {
    if (onProgress) onProgress(step, message);
  };

  try {
    // relay URL을 직접 view URL로 변환 (JavaScript 로딩 방지)
    const directUrl = convertToDirectViewUrl(jobUrl);
    console.log("Fetching direct URL:", directUrl);

    progress(1, "사람인에서 공고 정보를 가져오고 있습니다...");
    const response = await axios.get(directUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const html = response.data;

    // 홈페이지 지원 (외부 공고) 감지
    const isExternal = html.includes('title="홈페이지 지원"') ||
                       html.includes('Saramin.btnJob("homepage"') ||
                       html.includes("Saramin.btnJob('homepage'");

    console.log("Is external job posting:", isExternal);

    if (isExternal) {
      // 외부 URL 추출
      const externalUrl = extractExternalUrl(html);
      console.log("External URL:", externalUrl);

      if (externalUrl && jobTitle) {
        try {
          // Jina Reader로 외부 SPA 페이지 렌더링 후 상세 내용 가져오기
          console.log("Fetching external page with Jina Reader...");
          progress(1, "외부 채용 페이지에서 공고를 가져오고 있습니다...");
          const externalContent = await fetchExternalJobDetail(externalUrl, jobTitle, (message) => {
            // 재시도 메시지만 전달
            if (message.includes("재시도")) {
              progress(1, message);
            }
          });

          if (externalContent && externalContent.length > 500) {
            console.log("Successfully fetched external page via Jina Reader, length:", externalContent.length);

            // 마크다운 텍스트를 OpenAI로 분석
            progress(2, "AI가 공고 내용을 분석하고 있습니다...");
            const externalResult = await parseJobWithAI(externalContent, keywordPool);

            if (externalResult.skills.length > 0 || externalResult.preferredSkills.length > 0) {
              progress(3, "필요한 스킬을 추출했습니다!");
              return { ...externalResult, isExternal: true, externalUrl };
            }
          }

          // Jina Reader 실패 시 사람인 페이지로 폴백
          console.log("Jina Reader returned insufficient content, falling back to Saramin page");
          progress(2, "AI가 공고 내용을 분석하고 있습니다...");
          const fallbackResult = await parseJobWithAI(html, keywordPool);
          progress(3, "필요한 스킬을 추출했습니다!");
          return { ...fallbackResult, isExternal: true, externalUrl };
        } catch (externalError) {
          console.error("Failed to fetch via Jina Reader:", externalError);
          // 폴백: 사람인 페이지로
          progress(2, "AI가 공고 내용을 분석하고 있습니다...");
          const fallbackResult = await parseJobWithAI(html, keywordPool);
          progress(3, "필요한 스킬을 추출했습니다!");
          return { ...fallbackResult, isExternal: true, externalUrl };
        }
      } else if (externalUrl) {
        // jobTitle이 없는 경우 기존 로직 (사람인 페이지 폴백)
        progress(2, "AI가 공고 내용을 분석하고 있습니다...");
        const fallbackResult = await parseJobWithAI(html, keywordPool);
        progress(3, "필요한 스킬을 추출했습니다!");
        return { ...fallbackResult, isExternal: true, externalUrl };
      }
    }

    // 내부 공고: 사람인 HTML을 OpenAI로 분석
    progress(2, "AI가 공고 내용을 분석하고 있습니다...");
    const result = await parseJobWithAI(html, keywordPool);
    progress(3, "필요한 스킬을 추출했습니다!");
    return { ...result, isExternal: false };
  } catch (error) {
    console.error("Job detail crawling error:", error);
    return null;
  }
}

/**
 * 외부 공고 URL을 직접 분석
 * 외부 채용 사이트의 상세 페이지 URL을 직접 Jina Reader로 가져와서 분석
 * @param externalJobUrl - 외부 채용공고 URL
 * @param keywordPool - 사용 가능한 키워드 목록 (DB에서 가져온 것)
 * @param onProgress - 진행 상황 콜백
 */
export async function getExternalJobDetail(
  externalJobUrl: string,
  keywordPool?: string[],
  onProgress?: (step: number, message: string) => void
): Promise<JobDetailParsed | null> {
  const progress = (step: number, message: string) => {
    if (onProgress) onProgress(step, message);
  };

  try {
    console.log("Fetching external job directly:", externalJobUrl);

    // Jina Reader로 외부 페이지 가져오기
    progress(1, "외부 채용 페이지에서 공고를 가져오고 있습니다...");
    const content = await fetchExternalJobContent(externalJobUrl, (message) => {
      // 재시도 메시지만 전달
      if (message.includes("재시도")) {
        progress(1, message);
      }
    });

    if (!content || content.length < 100) {
      console.log("Failed to fetch external job content");
      return null;
    }

    console.log("External job content fetched, length:", content.length);

    // OpenAI로 분석
    progress(2, "AI가 공고 내용을 분석하고 있습니다...");
    const result = await parseJobWithAI(content, keywordPool);

    progress(3, "필요한 스킬을 추출했습니다!");

    return {
      ...result,
      isExternal: true,
      externalUrl: externalJobUrl,
    };
  } catch (error) {
    console.error("External job detail error:", error);
    return null;
  }
}

/**
 * 최적화된 메인 검색 함수
 * 1. 회사 코드 찾기
 * 2. 샘플 공고 1개로 외부/내부 판별 (먼저!)
 * 3. 내부면 사람인 크롤링, 외부면 외부 사이트 크롤링
 * 4. 바로 결과 반환 (GPT 필터링 없음)
 */
export async function searchCompanyJobs(
  companyName: string,
  onProgress?: (step: number, message: string) => void
): Promise<FilteredSearchResult> {
  const totalStartTime = performance.now();
  console.log("\n========================================");
  console.log(`🔍 검색 시작: "${companyName}"`);
  console.log("========================================\n");

  const progress = (step: number, message: string) => {
    if (onProgress) onProgress(step, message);
  };

  try {
    // Step 1: 회사 코드 찾기
    progress(0, "사람인에서 회사 정보를 검색하고 있습니다...");
    const csn = await findCompanyCode(companyName);

    if (!csn) {
      const totalElapsed = ((performance.now() - totalStartTime) / 1000).toFixed(2);
      console.log(`\n❌ 검색 실패: 회사를 찾을 수 없습니다 (총 ${totalElapsed}초)`);
      return {
        success: false,
        isExternal: false,
        jobs: [],
        error: "회사를 찾을 수 없습니다",
      };
    }

    // Step 2: 샘플 공고 1개만 가져오기 (외부/내부 판별용)
    progress(1, "채용 공고 유형을 확인하고 있습니다...");
    const sampleJob = await getSampleJob(csn, companyName);

    if (!sampleJob) {
      const totalElapsed = ((performance.now() - totalStartTime) / 1000).toFixed(2);
      console.log(`\n⚠️ 검색 완료: 공고 없음 (총 ${totalElapsed}초)`);
      return {
        success: true,
        isExternal: false,
        jobs: [],
      };
    }

    // Step 3: 샘플 공고로 외부/내부 판별
    const { isExternal, externalUrl } = await checkIfExternalCompany(sampleJob.link);

    let jobs: FilteredJob[] = [];

    if (isExternal && externalUrl) {
      // Step 4-a: 외부 회사 → Sitemap 시도 후 Jina 폴백
      progress(2, "자체 채용 사이트가 감지되었습니다...");
      const step4StartTime = performance.now();
      console.log(`[Step 4] 외부 공고 목록 크롤링 시작 (Sitemap 시도)`);

      // 1차: Sitemap 시도 (빠름)
      const sitemapJobs = await fetchJobsFromSitemap(externalUrl);

      if (sitemapJobs.length > 0) {
        const step4Elapsed = ((performance.now() - step4StartTime) / 1000).toFixed(2);
        console.log(`[Step 4] Sitemap 크롤링 완료: ${sitemapJobs.length}개 (${step4Elapsed}초)`);
        // Sitemap 공고 → FilteredJob 형태로 변환
        jobs = sitemapJobs.map(job => ({
          originalTitle: job.title,
          simplifiedTitle: job.title,
          link: job.link,
          isRelevant: true,
          isExperienceOnly: false,
        }));
      } else {
        // 2차: Sitemap 실패 → Jina Reader 폴백
        console.log(`[Step 4] Sitemap에 개별 공고 없음, Jina Reader로 폴백...`);
        progress(2, "외부 채용 사이트에서 공고를 조회하고 있습니다...");

        const jinaJobs = await fetchExternalJobList(externalUrl, (message) => {
          // Jina 재시도 메시지만 전달
          if (message.includes("재시도")) {
            progress(2, message);
          }
        });
        const step4Elapsed = ((performance.now() - step4StartTime) / 1000).toFixed(2);

        if (jinaJobs.length > 0) {
          console.log(`[Step 4] Jina 크롤링 완료: ${jinaJobs.length}개 (${step4Elapsed}초)`);
          jobs = jinaJobs.map(job => ({
            originalTitle: job.title,
            simplifiedTitle: job.title,
            link: job.link,
            isRelevant: true,
            isExperienceOnly: false,
          }));
        } else {
          // 3차: Jina도 실패 → 사람인 공고 목록 폴백
          console.log(`[Step 4] Jina에서도 공고를 찾지 못함, 사람인 폴백...`);
          progress(2, "사람인에서 공고 목록을 가져오고 있습니다...");
          const saraminJobs = await crawlCompanyJobs(csn, companyName);
          const fallbackElapsed = ((performance.now() - step4StartTime) / 1000).toFixed(2);
          console.log(`[Step 4] 사람인 폴백 완료: ${saraminJobs.length}개 (${fallbackElapsed}초)`);
          jobs = saraminJobs.map(job => ({
            originalTitle: job.title,
            simplifiedTitle: job.title,
            link: job.link,
            isRelevant: true,
            isExperienceOnly: false,
            deadline: job.deadline,
            techStack: job.techStack,
            requirements: job.requirements,
          }));
        }
      }
    } else {
      // Step 4-b: 내부 회사 → 사람인 전체 크롤링
      progress(2, "사람인에서 공고 목록을 가져오고 있습니다...");
      console.log(`[Step 4] 내부 회사 → 사람인 전체 크롤링 시작`);
      const saraminJobs = await crawlCompanyJobs(csn, companyName);
      console.log(`[Step 4] 사람인 크롤링 완료: ${saraminJobs.length}개`);

      jobs = saraminJobs.map(job => ({
        originalTitle: job.title,
        simplifiedTitle: job.title,
        link: job.link,
        isRelevant: true,
        isExperienceOnly: false,
        deadline: job.deadline,
        techStack: job.techStack,
        requirements: job.requirements,
      }));
    }

    progress(3, "공고 목록을 정리하고 있습니다...");

    const totalElapsed = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`\n========================================`);
    console.log(`✅ 검색 완료: ${jobs.length}개 공고 (총 ${totalElapsed}초)`);
    console.log(`========================================\n`);

    return {
      success: true,
      isExternal: isExternal,
      externalUrl: externalUrl || undefined,
      jobs: jobs,
    };
  } catch (error) {
    const totalElapsed = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.error(`\n❌ 검색 실패 (총 ${totalElapsed}초):`, error);
    return {
      success: false,
      isExternal: false,
      jobs: [],
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다",
    };
  }
}

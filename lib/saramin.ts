import axios from "axios";
import * as cheerio from "cheerio";

export interface JobPosting {
  title: string;
  company: string;
  link: string;
  requirements: string[];
  preferredQualifications: string[];
  techStack: string[];
  deadline: string;
}

export interface CrawlResult {
  success: boolean;
  data: JobPosting[];
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

    return foundCsn;
  } catch (error) {
    console.error("Company code search error:", error);
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

    if (title) {
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
  const allJobs: JobPosting[] = [];
  const maxPages = 20; // 최대 페이지 수 제한 (100개 공고)

  try {
    for (let page = 1; page <= maxPages; page++) {
      const recruitUrl = `https://www.saramin.co.kr/zf_user/company-info/get-recruit-list?csn=${csn}&opening=y&page=${page}`;

      const response = await axios.get(recruitUrl, {
        headers: HTTP_HEADERS,
        timeout: 10000,
      });

      const jobs = parseJobsFromHtml(response.data, companyName);

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

    return allJobs;
  } catch (error) {
    console.error("Company jobs crawling error:", error);
    return allJobs; // 에러 발생 전까지 수집된 결과 반환
  }
}

/**
 * 메인 검색 함수: 2단계 크롤링
 * 1. 회사명으로 csn 코드 찾기
 * 2. 회사 채용 페이지에서 전체 공고 크롤링
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

    return {
      success: true,
      data: jobPostings,
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

export async function getJobDetail(jobUrl: string): Promise<{
  requirements: string[];
  preferredQualifications: string[];
  techStack: string[];
} | null> {
  try {
    const response = await axios.get(jobUrl, {
      headers: HTTP_HEADERS,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const requirements: string[] = [];
    const preferredQualifications: string[] = [];
    const techStack: string[] = [];

    // 자격요건 파싱 (jv_cont 섹션에서)
    $(".jv_cont").each((_, section) => {
      const $section = $(section);
      const sectionTitle = $section.find(".tit_job").text().trim();

      if (sectionTitle.includes("자격요건") || sectionTitle.includes("필수")) {
        $section.find("li, p").each((_, item) => {
          const text = $(item).text().trim();
          if (text) requirements.push(text);
        });
      }

      if (sectionTitle.includes("우대") || sectionTitle.includes("선호")) {
        $section.find("li, p").each((_, item) => {
          const text = $(item).text().trim();
          if (text) preferredQualifications.push(text);
        });
      }
    });

    // 기술 스택 태그 추출
    $(".col_skill .skill_stack, .stack_list span").each((_, tag) => {
      techStack.push($(tag).text().trim());
    });

    return {
      requirements,
      preferredQualifications,
      techStack,
    };
  } catch (error) {
    console.error("Job detail crawling error:", error);
    return null;
  }
}

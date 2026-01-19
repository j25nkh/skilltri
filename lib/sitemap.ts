import axios from "axios";

export interface SitemapJob {
  title: string;
  link: string;
}

/**
 * 채용사이트 sitemap.xml에서 공고 URL 추출
 */
export async function fetchJobsFromSitemap(baseUrl: string): Promise<SitemapJob[]> {
  const startTime = performance.now();

  // baseUrl에서 origin 추출 (예: https://toss.im/career/jobs → https://toss.im)
  const url = new URL(baseUrl);
  const origin = url.origin;

  console.log(`[Sitemap] 시작: ${origin}`);

  // sitemap URL 추론 (여러 패턴 시도)
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap-jobs.xml`,
    `${origin}/career/sitemap.xml`,
    `${origin}/careers/sitemap.xml`,
    `${origin}/jobs/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`  [Sitemap] 시도: ${sitemapUrl}`);

      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/xml, text/xml, */*",
        },
      });

      const jobs = parseSitemapXml(response.data);

      if (jobs.length > 0) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`[Sitemap] 완료: ${jobs.length}개 공고 발견 (${elapsed}초)`);
        return jobs;
      }
    } catch (error) {
      // 다음 URL 시도 (에러 로깅 생략)
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`[Sitemap] 실패: sitemap을 찾지 못함 (${elapsed}초)`);
  return [];
}

/**
 * sitemap XML 파싱
 * 중첩된 sitemap index도 처리
 */
function parseSitemapXml(xml: string): SitemapJob[] {
  const jobs: SitemapJob[] = [];

  // sitemap index인지 확인 (sitemapindex 태그가 있으면 중첩 sitemap)
  if (xml.includes("<sitemapindex") || xml.includes("<sitemap>")) {
    console.log("  [Sitemap] sitemap index 감지, 중첩 sitemap은 지원하지 않음");
    // 중첩 sitemap은 일단 스킵 (추후 필요시 구현)
  }

  // <loc> 태그에서 URL 추출
  const locPattern = /<loc>([^<]+)<\/loc>/g;
  let match;

  while ((match = locPattern.exec(xml)) !== null) {
    const url = match[1].trim();

    // 채용 공고 URL 필터링
    if (isJobUrl(url)) {
      const title = extractTitleFromUrl(url);
      jobs.push({ title, link: url });
    }
  }

  return jobs;
}

/**
 * URL이 개별 채용 공고인지 판별
 * 회사 카테고리 페이지는 제외하고 개별 공고 URL만 허용
 */
function isJobUrl(url: string): boolean {
  // 개별 공고 URL 패턴 (ID나 slug가 포함된 구체적인 경로)
  const jobPatterns = [
    /\/jobs?\/[\w-]+\/?$/i,           // /job/frontend-123, /jobs/backend-456
    /\/position\/[\w-]+\/?$/i,        // /position/12345
    /\/job-detail\/[\w-]+\/?$/i,      // /job-detail/67890
    /\/opening\/[\w-]+\/?$/i,         // /opening/12345
    /\/vacancy\/[\w-]+\/?$/i,         // /vacancy/12345
    /\/careers?\/jobs?\/[\w-]+\/?$/i, // /career/jobs/frontend, /careers/job/123
    /\/recruit\/[\w-]+\/?$/i,         // /recruit/12345
  ];

  // 제외 패턴 (카테고리/목록/일반 페이지)
  const excludePatterns = [
    /\/career\/[a-z]+\/?$/i,          // /career/toss, /career/tosssecurities (회사 카테고리)
    /\/careers?\/?$/i,                // /career, /careers (메인 페이지)
    /\/jobs?\/?$/i,                   // /job, /jobs (목록 페이지)
    /\/positions?\/?$/i,              // /position, /positions (목록 페이지)
    /\?/,                             // 쿼리 파라미터 포함 URL
    /\/blog\//i,
    /\/news\//i,
    /\/about/i,
    /\/contact/i,
    /\/faq/i,
    /\/privacy/i,
    /\/terms/i,
    /sitemap/i,
  ];

  const isJob = jobPatterns.some(pattern => pattern.test(url));
  const isExcluded = excludePatterns.some(pattern => pattern.test(url));

  return isJob && !isExcluded;
}

/**
 * URL에서 공고 제목 추출
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // 경로의 마지막 부분 추출
    const parts = pathname.split("/").filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1] || "";

    // slug를 읽기 좋은 형태로 변환
    // frontend-developer-123 → "Frontend Developer 123"
    const title = decodeURIComponent(lastPart)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    return title || url;
  } catch {
    return url;
  }
}

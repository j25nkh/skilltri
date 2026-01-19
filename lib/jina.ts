import axios from "axios";

const JINA_READER_BASE = "https://r.jina.ai";

// Jina 요청 중 5초마다 돌아가며 표시할 문구
const LOADING_MESSAGES = [
  "외부 채용 페이지에서 공고를 가져오고 있습니다...",
  "페이지 로딩에 시간이 걸릴 수 있습니다...",
  "동적 콘텐츠를 불러오는 중입니다...",
  "조금만 기다려주세요...",
  "거의 다 가져왔습니다...",
];

/**
 * Jina AI Reader로 SPA 페이지 렌더링 후 텍스트 추출
 * 재시도 로직 포함, 5초마다 문구 변경
 * @param onProgress - 진행 상황 콜백 (메시지만 전달, step은 상위에서 관리)
 */
export async function fetchWithJina(
  url: string,
  maxRetries: number = 2,
  timeout: number = 30000,  // 30초로 단축
  onProgress?: (message: string) => void
): Promise<string> {
  const jinaUrl = `${JINA_READER_BASE}/${url}`;
  const startTime = performance.now();
  const timeoutSeconds = timeout / 1000;

  const progress = (message: string) => {
    if (onProgress) onProgress(message);
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = performance.now();
    let messageIndex = 0;
    let messageInterval: NodeJS.Timeout | null = null;

    try {
      console.log(`  [Jina] 요청 ${attempt}/${maxRetries}: ${url.slice(0, 50)}...`);

      // 초기 메시지
      progress(LOADING_MESSAGES[0]);

      // 5초마다 문구 변경
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
        progress(LOADING_MESSAGES[messageIndex]);
      }, 5000);

      const response = await axios.get(jinaUrl, {
        timeout,
        headers: {
          "Accept": "text/plain",
          "X-Wait-For": "networkidle",  // 네트워크 요청 완료 대기 (동적 콘텐츠)
          "X-Timeout": String(timeoutSeconds),
        },
      });

      if (messageInterval) clearInterval(messageInterval);

      if (response.data && response.data.length > 100) {
        const attemptElapsed = ((performance.now() - attemptStartTime) / 1000).toFixed(2);
        const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`  [Jina] 성공: ${response.data.length}자 (이번 시도: ${attemptElapsed}초, 총: ${totalElapsed}초)`);
        return response.data;
      }
    } catch (error) {
      if (messageInterval) clearInterval(messageInterval);

      const attemptElapsed = ((performance.now() - attemptStartTime) / 1000).toFixed(2);
      console.error(`  [Jina] 실패 ${attempt}/${maxRetries} (${attemptElapsed}초):`, error instanceof Error ? error.message : error);

      if (attempt < maxRetries) {
        console.log(`  [Jina] 2초 후 재시도...`);
        progress(`연결이 불안정합니다. 재시도 중... (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`  [Jina] 모든 시도 실패 (총: ${totalElapsed}초)`);
  return "";
}

/**
 * 두 문자열의 유사도 점수 계산 (0~1)
 * - 정확히 일치하면 1
 * - 키워드가 모두 포함되고 길이가 비슷하면 높은 점수
 */
function calculateSimilarity(searchTitle: string, linkTitle: string): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/\([^)]*\)/g, "") // 괄호 내용 제거
      .replace(/[^\w\s가-힣]/g, "")
      .trim();

  const normalizedSearch = normalize(searchTitle);
  const normalizedLink = normalize(linkTitle);

  // 정확히 일치하면 최고 점수
  if (normalizedSearch === normalizedLink) {
    return 1.0;
  }

  // 키워드 추출
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
  const linkWords = normalizedLink.split(/\s+/).filter(w => w.length > 1);

  // 모든 검색 키워드가 포함되어 있는지 확인
  const allKeywordsMatch = searchWords.every(keyword =>
    linkWords.some(word => word.includes(keyword) || keyword.includes(word))
  );

  if (!allKeywordsMatch) {
    return 0;
  }

  // 키워드가 모두 매칭되면, 단어 수 차이로 점수 계산
  // 단어 수가 비슷할수록 높은 점수
  const wordCountDiff = Math.abs(searchWords.length - linkWords.length);
  const similarity = 0.9 - (wordCountDiff * 0.15);

  return Math.max(0.1, similarity);
}

/**
 * 외부 채용 목록 페이지에서 공고 제목으로 상세 URL 찾기
 * 가장 유사한 제목의 공고를 선택
 */
export function findJobDetailUrl(
  listPageContent: string,
  jobTitle: string
): string | null {
  console.log("Searching for job:", jobTitle);

  // 마크다운에서 링크 추출: [* Title ...](URL)
  const linkPattern = /\[\*\s*([^\]]+)\]\(([^)]+)\)/g;
  let match;

  const candidates: { title: string; url: string; score: number }[] = [];

  while ((match = linkPattern.exec(listPageContent)) !== null) {
    const linkTitle = match[1];
    const linkUrl = match[2];

    const score = calculateSimilarity(jobTitle, linkTitle);

    if (score > 0) {
      candidates.push({ title: linkTitle, url: linkUrl, score });
      console.log(`  - "${linkTitle}" → score: ${score.toFixed(2)}`);
    }
  }

  // 점수가 높은 순으로 정렬
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0];
    console.log(`Best match: "${best.title}" (score: ${best.score.toFixed(2)})`);
    return best.url;
  }

  // 대안: URL 패턴으로 직접 검색
  const urlPattern = /https:\/\/[^\s"']+job-detail[^\s"')]+/g;
  const urls = listPageContent.match(urlPattern);

  if (urls && urls.length > 0) {
    console.log("Fallback: returning first job detail URL:", urls[0]);
    return urls[0];
  }

  return null;
}

/**
 * 외부 채용 페이지에서 특정 공고 상세 내용 가져오기
 * @param onProgress - 진행 상황 콜백
 */
export async function fetchExternalJobDetail(
  externalUrl: string,
  jobTitle: string,
  onProgress?: (message: string) => void
): Promise<string> {
  const progress = (message: string) => {
    if (onProgress) onProgress(message);
  };

  // 1. 외부 채용 목록 페이지 가져오기 (1회 시도, 30초 타임아웃)
  console.log("Step 1: Fetching external list page...");
  const listContent = await fetchWithJina(externalUrl, 1, 30000, progress);

  if (!listContent || listContent.length < 100) {
    console.log("Failed to fetch external list page");
    return "";
  }

  // 2. 공고 제목으로 상세 URL 찾기
  console.log("Step 2: Finding job detail URL...");
  const detailUrl = findJobDetailUrl(listContent, jobTitle);

  if (!detailUrl) {
    console.log("Could not find job detail URL");
    return "";
  }

  // 3. 상세 페이지 가져오기 (3회 재시도, 30초 타임아웃)
  console.log("Step 3: Fetching job detail page...");
  const detailContent = await fetchWithJina(detailUrl, 3, 30000, progress);

  if (!detailContent || detailContent.length < 100) {
    console.log("Failed to fetch job detail page after retries");
    return "";
  }

  console.log("Successfully fetched job detail page!");
  return detailContent;
}

/**
 * 외부 공고 정보
 */
export interface ExternalJob {
  title: string;
  link: string;
  tags: string[];  // 직군, 기술스택 등
}

/**
 * 외부 채용 페이지에서 모든 공고 목록 파싱
 */
export function parseExternalJobList(markdownContent: string): ExternalJob[] {
  const jobs: ExternalJob[] = [];

  // 마크다운에서 링크 추출: [* Title 태그1 · 태그2 ...](URL)
  const linkPattern = /\[\*\s*([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(markdownContent)) !== null) {
    const fullText = match[1].trim();
    const url = match[2];

    // job-detail URL만 처리
    if (!url.includes("job-detail") && !url.includes("career")) {
      continue;
    }

    // 제목과 태그 분리 (· 또는 ・ 구분자 사용)
    const parts = fullText.split(/\s*[·・]\s*/);
    const title = parts[0].trim();
    const tags = parts.slice(1).map(t => t.trim()).filter(t => t.length > 0);

    if (title) {
      jobs.push({ title, link: url, tags });
    }
  }

  console.log(`Parsed ${jobs.length} external jobs`);
  return jobs;
}

/**
 * 외부 채용 사이트에서 전체 공고 목록 가져오기
 * @param onProgress - 진행 상황 콜백
 */
export async function fetchExternalJobList(
  externalUrl: string,
  onProgress?: (message: string) => void
): Promise<ExternalJob[]> {
  console.log("Fetching external job list from:", externalUrl);

  const content = await fetchWithJina(externalUrl, 2, 30000, onProgress);

  if (!content || content.length < 100) {
    console.log("Failed to fetch external job list");
    return [];
  }

  return parseExternalJobList(content);
}

/**
 * 외부 공고 상세 페이지 URL로 직접 내용 가져오기
 * 타임아웃: 30초, 재시도: 3회
 * @param onProgress - 진행 상황 콜백
 */
export async function fetchExternalJobContent(
  jobDetailUrl: string,
  onProgress?: (message: string) => void
): Promise<string> {
  console.log("Fetching external job content from:", jobDetailUrl);

  const content = await fetchWithJina(jobDetailUrl, 3, 30000, onProgress);

  if (!content || content.length < 100) {
    console.log("Failed to fetch external job content");
    return "";
  }

  console.log(`Successfully fetched job content, length: ${content.length}`);
  return content;
}

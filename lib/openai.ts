import OpenAI from "openai";
import * as cheerio from "cheerio";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface SkillItem {
  display: string;    // 표시용 (한글/원래 형태)
  keyword: string;    // 매칭용 (영문 소문자, 공백 제거)
  relevance: number;  // 연관성 점수 (0-100)
}

export interface JobDetailParsed {
  skills: SkillItem[];           // 필수 스킬
  preferredSkills: SkillItem[];  // 우대 스킬
  summary?: string;              // GPT가 정리한 공고 내용
  isExternal?: boolean;          // 외부 공고 여부
  externalUrl?: string;          // 외부 공고 URL
  rawContent?: string;           // 공고 전문 (디버깅용)
}

export interface FilteredJob {
  originalTitle: string;      // 원본 제목
  simplifiedTitle: string;    // 정리된 직무명
  link: string;
  isRelevant: boolean;        // 선택한 직군과 관련 있는지
  isExperienceOnly: boolean;  // 경력직만 요구하는지
  deadline?: string;          // 마감일
  techStack?: string[];       // 기술 스택
  requirements?: string[];    // 조건 (경력, 학력 등)
}

/**
 * HTML에서 주요 텍스트만 추출 (불필요한 태그 제거)
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // 스크립트, 스타일, 네비게이션 등 불필요한 요소 제거
  $("script, style, nav, header, footer, aside, iframe, noscript").remove();

  // 본문 텍스트 추출
  const text = $("body").text();

  // 공백 정리
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .slice(0, 8000); // 토큰 제한을 위해 텍스트 길이 제한
}

/**
 * OpenAI를 사용하여 채용공고 내용 파싱
 * @param html - 채용공고 HTML
 * @param keywordPool - 사용 가능한 키워드 목록 (DB에서 가져온 것)
 */
export async function parseJobWithAI(html: string, keywordPool?: string[]): Promise<JobDetailParsed> {
  const startTime = performance.now();
  const text = extractTextFromHtml(html);

  console.log(`[OpenAI] 공고 분석 시작: ${text.length}자, 키워드풀: ${keywordPool?.length || 0}개`);

  if (!text || text.length < 100) {
    console.log("[OpenAI] 텍스트 부족, 스킵");
    return {
      skills: [] as SkillItem[],
      preferredSkills: [] as SkillItem[],
      rawContent: text,
    };
  }

  // 키워드 풀이 있으면 프롬프트에 포함
  const keywordPoolText = keywordPool && keywordPool.length > 0
    ? `\n\n**중요: 반드시 아래 키워드 목록에서만 선택하세요:**\n[${keywordPool.join(", ")}]\n\n위 목록에 없는 키워드는 절대 사용하지 마세요.`
    : "";

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 채용공고 분석 전문가입니다. 채용공고를 분석하여 JSON으로 응답하세요.

출력 형식:
{
  "skills": [
    {"keyword": "figma", "display": "Figma", "relevance": 95},
    {"keyword": "react", "display": "React", "relevance": 80}
  ],
  "preferredSkills": [
    {"keyword": "typescript", "display": "TypeScript", "relevance": 70}
  ],
  "summary": "정리된 공고 내용"
}

각 필드 설명:
1. skills: 필수 자격요건에서 추출한 기술/도구
2. preferredSkills: 우대사항에서 추출한 기술/도구
3. summary: 채용공고 핵심 내용을 마크다운으로 정리

skills/preferredSkills 규칙:
- keyword: 기술 키워드 (영문 소문자)
- display: 표시할 이름 (가독성 좋게)
- relevance: 이 공고에서 해당 기술의 중요도/연관성 (0-100)
  - 90-100: 핵심 필수 기술
  - 70-89: 중요한 기술
  - 50-69: 언급된 기술
  - 50 미만: 사용하지 않음
- 소프트스킬 제외 (협업, 커뮤니케이션 등)
- relevance가 높은 순으로 정렬${keywordPoolText}

summary 규칙:
- 주요 업무, 자격 요건, 우대 사항, 복리후생 등 핵심만 포함
- 네비게이션, 푸터, 회사 소개 제외
- 한국어로 깔끔하게 정리
- 마크다운 헤딩(##)과 리스트(-) 사용`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[OpenAI] 응답 없음 (${elapsed}초)`);
      return {
        skills: [] as SkillItem[],
        preferredSkills: [] as SkillItem[],
      };
    }

    const parsed = JSON.parse(content);
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[OpenAI] 공고 분석 완료: 필수 ${parsed.skills?.length || 0}개, 우대 ${parsed.preferredSkills?.length || 0}개 (${elapsed}초)`);

    // SkillItem 배열로 변환
    const normalizeSkills = (skills: unknown[]): SkillItem[] => {
      if (!Array.isArray(skills)) return [];
      return skills
        .map((s) => {
          if (typeof s === 'string') {
            return { display: s, keyword: s.toLowerCase().replace(/[\s.]/g, ''), relevance: 50 };
          }
          const obj = s as { display?: string; keyword?: string; relevance?: number };
          return {
            display: obj.display || obj.keyword || '',
            keyword: (obj.keyword || obj.display || '').toLowerCase().replace(/[\s.]/g, ''),
            relevance: obj.relevance || 50,
          };
        })
        .filter((s) => s.keyword && s.relevance >= 50) // relevance 50 이상만
        .filter((s) => !keywordPool || keywordPool.includes(s.keyword)) // 키워드 풀에 있는 것만
        .sort((a, b) => b.relevance - a.relevance); // 연관성 높은 순 정렬
    };

    return {
      skills: normalizeSkills(parsed.skills),
      preferredSkills: normalizeSkills(parsed.preferredSkills),
      summary: parsed.summary || undefined,
      rawContent: text,
    };
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[OpenAI] 공고 분석 실패 (${elapsed}초):`, error instanceof Error ? error.message : error);
    return {
      skills: [] as SkillItem[],
      preferredSkills: [] as SkillItem[],
      rawContent: text,
    };
  }
}

/**
 * 배치 단위로 GPT 필터링 수행
 */
async function filterBatch(
  jobs: { title: string; link: string }[],
  category: string,
  startIndex: number,
  batchNumber: number,
  totalBatches: number
): Promise<FilteredJob[]> {
  const titles = jobs.map((job, idx) => `${idx}. ${job.title}`).join("\n");
  const startTime = performance.now();

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `채용공고 제목을 분석하여 필터링하세요.

선택된 직군: "${category}"

직군별 관련 키워드:
- 개발: developer, engineer, backend, frontend, fullstack, 서버, iOS, Android, DevOps, SRE, Node.js, DBA
- AI: AI, ML, 머신러닝, 딥러닝, data scientist, NLP, MLOps, Data Engineer, Data Analyst
- 디자인: 디자이너, designer, UX, UI, 프로덕트 디자인, BX, 브랜드
- 마케팅: 마케팅, 마케터, marketing, 그로스, growth, CRM, 콘텐츠

경력직 키워드: 시니어, senior, lead, manager, 팀장, head, director, CRO, Team Leader

각 공고에 대해 JSON 배열로 응답:
{"results":[{"i":0,"t":"간결한 직무명","r":true/false,"e":true/false},...]}
- i: 인덱스
- t: 간결한 직무명 (예: "Frontend Developer")
- r: 직군 관련 여부
- e: 경력직만 요구 여부`,
        },
        {
          role: "user",
          content: titles,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response");
    }

    const parsed = JSON.parse(content);
    const results = parsed.results || parsed.jobs || parsed;

    if (!Array.isArray(results)) {
      throw new Error("Invalid format");
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`  [GPT] 배치 ${batchNumber}/${totalBatches} 완료: ${jobs.length}개 (${elapsed}초)`);

    return jobs.map((job, idx) => {
      const filtered = results.find((r: { i: number }) => r.i === idx) || results[idx];
      return {
        originalTitle: job.title,
        simplifiedTitle: filtered?.t || job.title,
        link: job.link,
        isRelevant: filtered?.r ?? true,
        isExperienceOnly: filtered?.e ?? false,
      };
    });
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`  [GPT] 배치 ${batchNumber}/${totalBatches} 실패 (${elapsed}초):`, error);
    return jobs.map(job => ({
      originalTitle: job.title,
      simplifiedTitle: job.title,
      link: job.link,
      isRelevant: true,
      isExperienceOnly: false,
    }));
  }
}

/**
 * GPT를 사용하여 공고 목록을 직군별로 필터링하고 직무명 정리
 * 배치 처리로 토큰 제한 회피
 */
export async function filterJobsByCategory(
  jobs: { title: string; link: string }[],
  category: string
): Promise<FilteredJob[]> {
  if (jobs.length === 0) {
    return [];
  }

  const startTime = performance.now();
  const BATCH_SIZE = 15;
  const totalBatches = Math.ceil(jobs.length / BATCH_SIZE);
  const allResults: FilteredJob[] = [];

  console.log(`  [GPT] 필터링 시작: ${jobs.length}개 공고, ${totalBatches}개 배치`);

  // 배치로 나눠서 처리
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const batchResults = await filterBatch(batch, category, i, batchNumber, totalBatches);
    allResults.push(...batchResults);
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`  [GPT] 필터링 완료: ${allResults.length}개 처리 (총 ${elapsed}초)`);

  return allResults;
}

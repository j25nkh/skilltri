import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface JobDetailParsed {
  skills: string[];           // 필수 스킬 키워드
  preferredSkills: string[];  // 우대 스킬 키워드
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
 */
export async function parseJobWithAI(html: string): Promise<JobDetailParsed> {
  const text = extractTextFromHtml(html);

  console.log("=== OpenAI Parsing Debug ===");
  console.log("Text length:", text.length);
  console.log("Text preview:", text.slice(0, 500));

  if (!text || text.length < 100) {
    console.log("Text too short, returning empty");
    return {
      skills: [],
      preferredSkills: [],
    };
  }

  try {
    console.log("Calling OpenAI API...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 채용공고 분석 전문가입니다. 취업 준비생이 학습해야 할 기술 키워드를 추출하세요.

다음 두 카테고리로 분류해서 JSON으로 응답하세요:
1. skills: 필수로 알아야 할 기술 (자격요건에서 추출)
2. preferredSkills: 알면 좋은 기술 (우대사항에서 추출)

규칙:
- 기술명/도구명만 추출 (예: "React", "Python", "Docker", "AWS", "Git", "Figma")
- 일반적인 표현 제외 (예: "협업 능력", "커뮤니케이션", "문제 해결 능력", "책임감")
- 중복 제거
- 빈 배열도 허용

예시 응답:
{"skills": ["React", "TypeScript", "Node.js"], "preferredSkills": ["Docker", "AWS", "GraphQL"]}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    console.log("OpenAI response content:", content);

    if (!content) {
      console.log("No content in response");
      return {
        skills: [],
        preferredSkills: [],
      };
    }

    const parsed = JSON.parse(content);
    console.log("Parsed result:", parsed);

    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
    };
  } catch (error) {
    console.error("=== OpenAI API Error ===");
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    return {
      skills: [],
      preferredSkills: [],
    };
  }
}

import axios from "axios";

export interface Course {
  slug: string;
  title: string;
  url: string;
  category: string;
  thumbnail: string;
}

interface CourseMeta {
  title: string;
  thumbnail: string;
}

// 카테고리 매핑 (URL prefix → 한글 카테고리명)
const CATEGORY_MAP: Record<string, string> = {
  dev: "개발",
  data: "데이터/AI",
  dgn: "디자인",
  biz: "비즈니스",
  fin: "금융",
  mktg: "마케팅",
  ent: "엔터테인먼트",
  seminar: "세미나",
  event: "이벤트",
  b2g: "B2G",
};

// 메타 정보 캐시 (메모리)
const metaCache: Map<string, CourseMeta> = new Map();

/**
 * 단일 강의 페이지에서 제목과 썸네일 추출
 */
async function fetchCourseMeta(url: string): Promise<CourseMeta> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 5000,
    });
    const html = response.data as string;

    // 제목 추출
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
      || html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| 패스트캠퍼스$/, "").trim() : "";

    // 썸네일 추출 (og:image)
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const thumbnail = imageMatch ? imageMatch[1] : "";

    return { title, thumbnail };
  } catch {
    return { title: "", thumbnail: "" };
  }
}

/**
 * 배치로 메타 정보 가져오기 (동시 요청 제한)
 */
async function fetchMetaInBatches(courses: Course[], batchSize: number = 10): Promise<void> {
  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);
    const promises = batch.map(async (course) => {
      // 캐시 확인
      if (metaCache.has(course.slug)) {
        const cached = metaCache.get(course.slug)!;
        course.title = cached.title || course.title;
        course.thumbnail = cached.thumbnail;
        return;
      }

      const meta = await fetchCourseMeta(course.url);
      if (meta.title) {
        course.title = meta.title;
      }
      course.thumbnail = meta.thumbnail;
      metaCache.set(course.slug, meta);
    });

    await Promise.all(promises);
    console.log(`Fetched meta: ${Math.min(i + batchSize, courses.length)}/${courses.length}`);
  }
}

/**
 * sitemap.xml에서 모든 강의 URL 가져오기
 */
export async function fetchCoursesFromSitemap(includeMeta: boolean = false): Promise<Course[]> {
  console.log("=== Fetching courses from sitemap.xml ===");

  try {
    const response = await axios.get("https://fastcampus.co.kr/sitemap.xml", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const xml = response.data as string;

    // 강의 URL 패턴 매칭 (online, zero, camp 포함)
    const urlPattern = /https:\/\/fastcampus\.co\.kr\/((\w+)_(?:online|zero|camp)_(\w+))/g;
    const courses: Course[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = urlPattern.exec(xml)) !== null) {
      const slug = match[1];
      const categoryPrefix = match[2];
      const code = match[3];
      const fullUrl = match[0];

      // 중복 제거
      if (seen.has(slug)) continue;
      seen.add(slug);

      const category = CATEGORY_MAP[categoryPrefix] || categoryPrefix;

      // 캐시된 메타 정보 확인
      const cachedMeta = metaCache.get(slug);

      courses.push({
        slug,
        title: cachedMeta?.title || code.replace(/_/g, " ").toUpperCase(),
        url: fullUrl,
        category,
        thumbnail: cachedMeta?.thumbnail || "",
      });
    }

    console.log(`Found ${courses.length} courses from sitemap`);

    // 메타 정보도 함께 가져오기
    if (includeMeta) {
      console.log("Fetching course meta (title + thumbnail)...");
      await fetchMetaInBatches(courses, 15);
    }

    return courses;
  } catch (error) {
    console.error("Error fetching sitemap:", error);
    return [];
  }
}

/**
 * 강의 상세 페이지에서 정보 추출 (Jina AI Reader 사용)
 * 타임아웃 60초, 최대 3회 재시도
 */
export async function fetchCourseDetail(slug: string): Promise<{
  title: string;
  content: string;
  url: string;
} | null> {
  const pageUrl = `https://fastcampus.co.kr/${slug}`;
  const jinaUrl = `https://r.jina.ai/${pageUrl}`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching course detail via Jina (attempt ${attempt}/${maxRetries}): ${slug}`);

      const response = await axios.get(jinaUrl, {
        headers: {
          "Accept": "text/plain",
          "X-Return-Format": "markdown",
        },
        timeout: 60000,
      });

      const markdown = response.data as string;

      if (!markdown || markdown.length < 100) {
        console.error("Jina returned empty or too short content");
        if (attempt < maxRetries) continue;
        return null;
      }

      // 마크다운에서 제목 추출 (첫 번째 # 헤더)
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : slug;

      // 불필요한 부분 제거 (네비게이션, 푸터 등)
      let content = markdown;

      // "Title:" 라인 이후부터 시작
      const titleLineIndex = content.indexOf("Title:");
      if (titleLineIndex > -1) {
        const nextLineIndex = content.indexOf("\n", titleLineIndex);
        if (nextLineIndex > -1) {
          content = content.substring(nextLineIndex + 1);
        }
      }

      // URL Source 라인 제거
      content = content.replace(/^URL Source:.*$/m, "");

      // Markdown Content 라인 제거
      content = content.replace(/^Markdown Content:.*$/m, "");

      // 앞뒤 공백 정리
      content = content.trim();

      console.log(`Successfully fetched course detail, content length: ${content.length}`);

      return {
        title,
        content,
        url: pageUrl,
      };
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${slug}:`, error instanceof Error ? error.message : error);
      if (attempt < maxRetries) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error(`All ${maxRetries} attempts failed for ${slug}`);
  return null;
}

/**
 * 스킬 키워드로 강의 필터링
 */
export function filterCoursesBySkills(courses: Course[], skills: string[]): Course[] {
  if (!skills || skills.length === 0) return courses;

  const normalizedSkills = skills.map(s => s.toLowerCase());

  return courses.filter(course => {
    const titleLower = course.title.toLowerCase();
    return normalizedSkills.some(skill => titleLower.includes(skill));
  });
}

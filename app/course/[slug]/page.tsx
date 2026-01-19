"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface CourseDetail {
  title: string;
  content: string;
  url: string;
}

// 간단한 마크다운 → HTML 변환
function parseMarkdown(markdown: string): string {
  let html = markdown
    // 코드 블록 (```...```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
    // 인라인 코드 (`...`)
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    // 헤더
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-gray-900 mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
    // 굵은 글씨
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // 이탤릭
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-purple-600 hover:underline" target="_blank" rel="noopener">$1</a>')
    // 가로선
    .replace(/^---$/gm, '<hr class="my-6 border-gray-200" />')
    // 리스트 아이템
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // 줄바꿈
    .replace(/\n\n/g, '</p><p class="my-3">')
    .replace(/\n/g, '<br />');

  return `<p class="my-3">${html}</p>`;
}

export default function CoursePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/course-detail?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (data.success) {
          setDetail(data.data);
        } else {
          setError(data.error || "강의 정보를 가져올 수 없습니다");
        }
      } catch {
        setError("서버 연결에 실패했습니다");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchDetail();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">강의 정보를 불러오는 중...</p>
          <p className="text-gray-400 text-sm mt-2">페이지 로딩에 시간이 걸릴 수 있습니다</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "강의를 찾을 수 없습니다"}</p>
          <Link
            href="/"
            className="text-purple-600 hover:text-purple-700 underline"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 강의 제목 */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {detail.title}
          </h1>

          {/* 본문 콘텐츠 */}
          <div
            className="text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(detail.content) }}
          />
        </div>

        {/* 패스트캠퍼스에서 보기 버튼 */}
        <div className="text-center">
          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-4 rounded-xl transition-colors shadow-lg"
          >
            패스트캠퍼스에서 자세히 보기
          </a>
        </div>
      </div>
    </div>
  );
}

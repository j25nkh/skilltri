import { NextRequest } from "next/server";
import { searchCompanyJobs } from "@/lib/saramin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get("company");

  // SSE 스트림 설정
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller already closed, ignore
        }
      };

      if (!company) {
        sendEvent("error", { message: "회사명을 입력해주세요" });
        controller.close();
        return;
      }

      try {
        const result = await searchCompanyJobs(company, (step, message) => {
          sendEvent("progress", { step, message });
        });

        if (result.success) {
          sendEvent("complete", { success: true, data: result });
        } else {
          sendEvent("error", { message: result.error || "검색 중 오류가 발생했습니다" });
        }
      } catch (error) {
        console.error("Crawl API error:", error);
        sendEvent("error", { message: "서버 오류가 발생했습니다" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

-- 강의 테이블
CREATE TABLE courses (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  thumbnail TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 검색 최적화 (GIN 인덱스)
CREATE INDEX idx_courses_keywords ON courses USING GIN (keywords);
CREATE INDEX idx_courses_category ON courses(category);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 키워드 매칭 함수
CREATE OR REPLACE FUNCTION find_courses_by_keywords(search_keywords TEXT[])
RETURNS TABLE (
  id BIGINT,
  slug VARCHAR,
  title VARCHAR,
  url TEXT,
  category VARCHAR,
  thumbnail TEXT,
  keywords TEXT[],
  match_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.slug, c.title, c.url, c.category, c.thumbnail, c.keywords,
    (SELECT COUNT(*)::INTEGER FROM UNNEST(c.keywords) k WHERE LOWER(k) = ANY(search_keywords)) as match_count
  FROM courses c
  WHERE c.keywords && search_keywords
  ORDER BY match_count DESC, c.title;
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_read_all" ON courses FOR SELECT USING (true);
CREATE POLICY "courses_write_service" ON courses FOR ALL USING (true);

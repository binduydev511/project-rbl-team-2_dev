-- Tạo bảng mentor_reviews để lưu trữ đánh giá của Mentor
CREATE TABLE IF NOT EXISTS public.mentor_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  technical_score INTEGER,
  communication_score INTEGER,
  problem_solving_score INTEGER,
  strengths TEXT,
  improvements TEXT,
  overall_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Thêm quyền RLS cho mentor_reviews
ALTER TABLE public.mentor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mentor_reviews"
ON public.mentor_reviews FOR SELECT USING (true);

CREATE POLICY "Mentors can insert their own reviews"
ON public.mentor_reviews FOR INSERT 
WITH CHECK (auth.uid() = mentor_id);

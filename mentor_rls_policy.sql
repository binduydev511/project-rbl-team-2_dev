-- Chạy script này trong SQL Editor của Supabase để cấp quyền cho Mentor xem lịch sử phỏng vấn của ứng viên

-- Cho phép user có role là 'mentor' hoặc 'admin' được quyền SELECT (xem) tất cả lịch sử phỏng vấn
CREATE POLICY "Mentors can view all interviews"
ON public.interviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND (profiles.role = 'mentor' OR profiles.role = 'admin' OR profiles.role = 'Admin')
  )
);

-- Tương tự, cấp quyền xem chi tiết câu trả lời phỏng vấn (bảng interview_answers)
CREATE POLICY "Mentors can view all interview answers"
ON public.interview_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND (profiles.role = 'mentor' OR profiles.role = 'admin' OR profiles.role = 'Admin')
  )
);

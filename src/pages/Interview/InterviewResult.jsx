import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Download, RotateCcw, Share2, Star,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Sparkles, BookOpen, Target, Award, Mic, Brain,
  MessageSquare, Shield, Zap, ExternalLink, Clock,
  CheckCircle2, AlertCircle, Info, Loader2, AlertTriangle, Send
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MOCK_RESULT, getScoreColor, getScoreLabel } from '../../constants/interviewConstants';
import { evaluateInterviewAnswers } from '../../utils/interviewAiService';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../utils/AuthContext';
import { resolveResourceUrl } from '../../utils/speechUtils';
import '../../assets/styles/interview-theme.css';
import './InterviewResult.css';
import heroImageSvg from '../../assets/images/Hero-image.svg';

// ── Circular Score Ring ──
const ScoreRing = ({ score, size = 180, strokeWidth = 10 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame;
    let current = 0;
    const step = () => {
      current += 1;
      if (current <= score) {
        setAnimatedScore(current);
        frame = requestAnimationFrame(step);
      }
    };
    const timeout = setTimeout(() => { frame = requestAnimationFrame(step); }, 300);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); };
  }, [score]);

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--iv-bg-elevated)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={getScoreColor(score)} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
      <div className="score-ring__content">
        <span className="score-ring__number" style={{ color: getScoreColor(score) }}>
          {animatedScore}
        </span>
        <span className="score-ring__label">{getScoreLabel(score)}</span>
      </div>
    </div>
  );
};

// ── Radar Chart (SVG) ──
const RadarChart = ({ skills }) => {
  const labels = [
    { key: 'pronunciation', label: 'Trôi chảy' },
    { key: 'vocabulary', label: 'Từ vựng' },
    { key: 'communication', label: 'Giao tiếp' },
    { key: 'confidence', label: 'Tự tin' },
    { key: 'technicalAccuracy', label: 'Kỹ thuật' },
  ];
  const n = labels.length;
  const cx = 140, cy = 140, maxR = 100;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index, value) => {
    const angle = (index * angleStep) - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // Grid lines
  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="radar-chart">
      <svg viewBox="0 0 280 280" width="100%" style={{ maxWidth: 280 }}>
        {/* Grid */}
        {gridLevels.map(level => (
          <polygon key={level}
            points={labels.map((_, i) => {
              const p = getPoint(i, level);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="none" stroke="var(--iv-border)" strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {labels.map((_, i) => {
          const p = getPoint(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--iv-border)" strokeWidth="1" />;
        })}
        {/* Data polygon */}
        <polygon
          points={labels.map((l, i) => {
            const p = getPoint(i, skills[l.key]);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="rgba(249, 115, 22, 0.15)"
          stroke="#f97316"
          strokeWidth="2"
        />
        {/* Data points */}
        {labels.map((l, i) => {
          const p = getPoint(i, skills[l.key]);
          return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#f97316" />;
        })}
        {/* Labels */}
        {labels.map((l, i) => {
          const p = getPoint(i, 120);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fill="var(--iv-text-secondary)" fontSize="11" fontFamily="var(--font-sans)">
              {l.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ── Progress Bar ──
const SkillBar = ({ label, score, icon: Icon }) => (
  <div className="skill-bar">
    <div className="skill-bar__header">
      <div className="skill-bar__label">
        {Icon && <Icon size={14} />}
        <span>{label}</span>
      </div>
      <span className="skill-bar__score" style={{ color: getScoreColor(score) }}>{score}%</span>
    </div>
    <div className="skill-bar__track">
      <div className="skill-bar__fill" style={{ width: `${score}%`, background: getScoreColor(score) }} />
    </div>
  </div>
);

export default function InterviewResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { profile } = useAuth();
  const isMentor = profile?.role === 'mentor' || profile?.role === 'admin';
  const { config, totalQuestions, answeredQuestions, questionAnswerPairs, autoPrint } = location.state || {};

  const [resultData, setResultData] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Mentor Feedback states
  const [mentorReview, setMentorReview] = useState(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const evalAttemptedRef = useRef(false);

  const toggleQuestion = (id) => {
    if (expandedQuestion === 'ALL') return;
    setExpandedQuestion(expandedQuestion === id ? null : id);
  };

  const saveInterviewToSupabase = async (finalizedResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[InterviewResult] User is not authenticated, skipping database storage');
        return;
      }

      // Fetch industry UUID by name
      let dbIndustryId = null;
      if (config?.industry?.name) {
        const { data: indData } = await supabase
          .from('industries')
          .select('id')
          .eq('name', config.industry.name)
          .maybeSingle();
        if (indData) dbIndustryId = indData.id;
      }

      // Prepare extended metadata
      const extendedMeta = {
        difficulty: config?.difficulty?.id || 'medium',
        difficultyName: config?.difficulty?.nameVi || config?.difficulty?.name || 'Trung bình',
        industryId: config?.industry?.id || 'frontend',
        industryName: config?.industry?.nameVi || config?.industry?.name || 'Lập trình Frontend',
        skills: finalizedResult.skills,
        detailedTechnical: finalizedResult.detailedTechnical,
        strengths: finalizedResult.strengths,
        weaknesses: finalizedResult.weaknesses,
        improvements: finalizedResult.improvements,
        careerAdvice: finalizedResult.careerAdvice,
        resources: finalizedResult.resources,
      };

      // Insert interviews record
      const { data: interviewRecord, error: interviewErr } = await supabase
        .from('interviews')
        .insert({
          user_id: user.id,
          industry_id: dbIndustryId,
          status: 'completed',
          overall_score: finalizedResult.overallScore,
          overall_feedback: finalizedResult.aiFeedback + `<!--META:${JSON.stringify(extendedMeta)}-->`,
          completed_at: finalizedResult.completedAt
        })
        .select()
        .single();

      if (interviewErr) throw interviewErr;

      // Insert interview_answers records
      if (interviewRecord && finalizedResult.questionReviews) {
        const answersToInsert = finalizedResult.questionReviews.map((qr, idx) => ({
          interview_id: interviewRecord.id,
          user_answer_text: qr.userAnswer || '',
          score: qr.score || 0,
          ai_evaluation: {
            question: qr.question,
            evaluation: qr.aiEvaluation,
            _metadata: idx === 0 ? {
              difficulty: config?.difficulty?.id || 'medium',
              difficultyName: config?.difficulty?.nameVi || config?.difficulty?.name || 'Trung bình',
              industryId: config?.industry?.id || 'frontend',
              industryName: config?.industry?.nameVi || config?.industry?.name || 'Lập trình Frontend'
            } : undefined
          }
        }));

        const { error: answersErr } = await supabase
          .from('interview_answers')
          .insert(answersToInsert);

        if (answersErr) throw answersErr;
        console.log('[InterviewResult] Saved interview history successfully!');
      }
    } catch (dbErr) {
      console.warn('[InterviewResult] Supabase DB write failed:', dbErr.message);
    }
  };

  const handleSubmitMentorReview = async () => {
    if (!feedbackInput.trim()) return;
    setIsSubmittingReview(true);
    try {
      // Create review record
      const { data: newReview, error } = await supabase
        .from('mentor_reviews')
        .insert({
          mentor_id: profile.id,
          interview_id: id,
          candidate_id: resultData?.userId || null,
          overall_comment: feedbackInput,
          created_at: new Date().toISOString()
        })
        .select('*, mentor:profiles!mentor_id(full_name)')
        .single();
        
      if (error) {
        if (error.code === '42P01') {
          toast.error('Bảng mentor_reviews chưa được tạo đầy đủ các cột.');
        } else {
          throw error;
        }
      } else {
        setMentorReview(newReview);
        
        // Send notification to candidate
        if (resultData?.userId) {
          await supabase.from('notifications').insert([{
            user_id: resultData.userId,
            title: 'Mentor đã gửi đánh giá mới',
            content: `Mentor ${profile?.full_name || 'của bạn'} đã nhận xét bài phỏng vấn của bạn. Nhấn vào đây để xem chi tiết!`,
            type: 'info',
            action_link: `/interview/result/${id}`
          }]);
        }
        toast.success('Đã gửi đánh giá thành công!');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error('Có lỗi xảy ra: ' + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (questionAnswerPairs && questionAnswerPairs.length > 0) {
      if (evalAttemptedRef.current) return;
      evalAttemptedRef.current = true;
      
      const runEvaluation = async () => {
        setIsEvaluating(true);
        setEvalError(null);
        try {
          const evalResult = await evaluateInterviewAnswers({
            questionAnswerPairs,
            industry: config?.industry,
            difficulty: config?.difficulty,
            questionType: config?.questionType,
            language: config?.language
          });

          // Calculate average metrics across all questions
          const count = questionAnswerPairs.length || 1;
          const avgEyeContact = Math.round(questionAnswerPairs.reduce((s, p) => s + (p.metrics?.eyeContactPercent ?? 100), 0) / count);
          const avgHeadPose = Math.round(questionAnswerPairs.reduce((s, p) => s + (p.metrics?.headPosePercent ?? 100), 0) / count);
          const avgVolume = Math.round(questionAnswerPairs.reduce((s, p) => s + (p.metrics?.volumeLevel ?? 80), 0) / count);
          const avgPitchStability = Math.round(questionAnswerPairs.reduce((s, p) => s + (p.metrics?.pitchStability ?? 100), 0) / count);
          
          // Deterministic Confidence Score: 40% Eye Contact + 20% Head Pose + 20% Volume + 20% Pitch Stability
          const finalConfidence = Math.round(
            0.40 * avgEyeContact +
            0.20 * avgHeadPose +
            0.20 * avgVolume +
            0.20 * avgPitchStability
          );
          
          // Calculate Fluency (WPM + hesitations + silence)
          const avgWpm = questionAnswerPairs.reduce((s, p) => s + (p.metrics?.wpm ?? 130), 0) / count;
          const totalHesitations = questionAnswerPairs.reduce((s, p) => s + (p.metrics?.hesitationCount ?? 0), 0);
          const totalSilence = questionAnswerPairs.reduce((s, p) => s + (p.metrics?.silenceDuration ?? 0), 0);
          
          let fluencyScore = 100;
          // Subtraction for WPM deviation from 140 WPM optimal
          const wpmDev = Math.abs(avgWpm - 140);
          if (wpmDev > 20) {
            fluencyScore -= (wpmDev - 20) * 0.8;
          }
          // Subtraction for hesitations
          fluencyScore -= totalHesitations * 2.5;
          // Subtraction for silences
          fluencyScore -= totalSilence * 1.5;
          fluencyScore = Math.round(Math.max(35, Math.min(100, fluencyScore)));

          // Technical average of accuracy, completeness, examples
          const technicalAccuracy = evalResult.technicalAccuracy ?? 80;
          const completeness = evalResult.completeness ?? 80;
          const examples = evalResult.examples ?? 75;
          const avgTechnical = Math.round((technicalAccuracy + completeness + examples) / 3);

          const communication = evalResult.communication ?? 75;

          // Final score formula: 40% Technical + 25% Communication + 20% Confidence + 15% Fluency
          const finalOverallScore = Math.round(
            0.40 * avgTechnical +
            0.25 * communication +
            0.20 * finalConfidence +
            0.15 * fluencyScore
          );

          // Determine Grade
          let finalGrade = 'C+';
          if (finalOverallScore >= 90) finalGrade = 'A+';
          else if (finalOverallScore >= 85) finalGrade = 'A';
          else if (finalOverallScore >= 80) finalGrade = 'B+';
          else if (finalOverallScore >= 75) finalGrade = 'B';
          else if (finalOverallScore >= 70) finalGrade = 'C+';
          else if (finalOverallScore >= 60) finalGrade = 'C';
          else finalGrade = 'D';

          const finalizedResult = {
            ...evalResult,
            overallScore: finalOverallScore,
            grade: finalGrade,
            skills: {
              pronunciation: fluencyScore, // Mapping Fluency to Pronunciation slot
              vocabulary: Math.round((avgTechnical + communication) / 2), // Mapping Vocabulary
              communication,
              confidence: finalConfidence,
              technicalAccuracy: avgTechnical
            },
            detailedTechnical: {
              accuracy: technicalAccuracy,
              completeness,
              examples
            },
            id: `result-${Date.now()}`,
            industry: config?.industry?.nameVi || config?.industry?.name || 'Lập trình Frontend',
            difficulty: config?.difficulty?.name || 'Trung bình',
            questionType: config?.questionType?.name || 'Câu hỏi tổng hợp',
            duration: config?.duration?.label || '20 phút',
            totalQuestions: totalQuestions || questionAnswerPairs.length,
            answeredQuestions: answeredQuestions || questionAnswerPairs.length,
            completedAt: new Date().toISOString()
          };

          setResultData(finalizedResult);
          await saveInterviewToSupabase(finalizedResult);
        } catch (err) {
          console.error('Error evaluating answers:', err);
          setEvalError(err.message || 'Có lỗi xảy ra trong quá trình chấm điểm.');
        } finally {
          setIsEvaluating(false);
        }
      };
      runEvaluation();
    } else if (id) {
      // Fetch result from Supabase if accessing via URL with ID
      const fetchResult = async () => {
        setIsEvaluating(true);
        setEvalError(null);
        try {
          const { data: interview, error: intErr } = await supabase
            .from('interviews')
            .select('*, industries(name)')
            .eq('id', id)
            .single();

          if (intErr) throw intErr;

          const { data: answers, error: ansErr } = await supabase
            .from('interview_answers')
            .select('*')
            .eq('interview_id', id);

          if (ansErr) throw ansErr;

          // Fetch mentor review if exists
          try {
            const { data: mentorRev } = await supabase
              .from('mentor_reviews')
              .select('*, mentor:profiles!mentor_id(full_name)')
              .eq('interview_id', id)
              .maybeSingle();
            if (mentorRev) setMentorReview(mentorRev);
          } catch (e) {
            console.warn('Could not fetch mentor review', e);
          }

          // Reconstruct the resultData
          let grade = 'C+';
          const score = interview.overall_score || 0;
          if (score >= 90) grade = 'A+';
          else if (score >= 85) grade = 'A';
          else if (score >= 80) grade = 'B+';
          else if (score >= 75) grade = 'B';
          else if (score >= 70) grade = 'C+';
          else if (score >= 60) grade = 'C';
          else grade = 'D';

          // Generate realistic fallback metrics based on the score since they aren't in DB
          const isSilent = score < 30;
          const fallbackSkills = {
            pronunciation: Math.min(100, score + 5),
            vocabulary: score,
            communication: score,
            confidence: Math.min(100, score + 10),
            technicalAccuracy: Math.max(0, score - 5)
          };
          
          const fallbackStrengths = isSilent 
            ? ['Ứng viên có tham gia và hoàn thành phiên phỏng vấn']
            : (score >= 70 ? ['Trình bày khá rõ ràng', 'Có hiểu biết về chuyên môn'] : ['Cố gắng hoàn thành bài phỏng vấn']);
            
          const fallbackWeaknesses = isSilent
            ? ['Không có hoặc có rất ít tương tác giọng nói', 'Chưa trả lời được các câu hỏi chuyên môn']
            : ['Cần bổ sung thêm kiến thức chuyên sâu', 'Nên luyện tập trả lời tự tin và mạch lạc hơn'];

          const fallbackImprovements = isSilent
            ? [{ priority: 'high', text: 'Cần kiểm tra lại micro và đảm bảo có tương tác trả lời câu hỏi' }]
            : [{ priority: 'high', text: 'Luyện tập trả lời theo phương pháp STAR' }];

          // Extract metadata from the first answer or overall_feedback
          let meta = {};
          if (answers && answers.length > 0) {
            const firstAns = answers.find(a => a.ai_evaluation?._metadata) || answers[0];
            if (firstAns?.ai_evaluation?._metadata) {
              meta = firstAns.ai_evaluation._metadata;
            }
          }
          
          let cleanFeedback = interview.overall_feedback || '';
          if (cleanFeedback.includes('<!--META:')) {
            try {
              const metaStr = cleanFeedback.split('<!--META:')[1].split('-->')[0];
              const parsedMeta = JSON.parse(metaStr);
              meta = { ...meta, ...parsedMeta };
              cleanFeedback = cleanFeedback.split('<!--META:')[0];
            } catch (e) { console.warn('Failed to parse metadata from feedback', e); }
          }

          const mappedResult = {
            id: interview.id,
            userId: interview.user_id,
            overallScore: score,
            grade: grade,
            aiFeedback: cleanFeedback || (isSilent ? 'Ứng viên không cung cấp đủ thông tin để AI có thể đưa ra đánh giá chuyên sâu.' : 'Cần cố gắng nhiều hơn.'),
            industry: meta.industryName || interview.industries?.name || 'Lập trình',
            completedAt: interview.completed_at,
            questionReviews: (answers || []).map((ans, idx) => ({
              id: ans.id || idx + 1,
              question: ans.ai_evaluation?.question || 'Câu hỏi',
              userAnswer: ans.user_answer_text || '',
              aiEvaluation: ans.ai_evaluation?.evaluation || '',
              score: ans.score || 0,
            })),
            totalQuestions: answers?.length || 0,
            answeredQuestions: answers?.length || 0,
            skills: meta.skills || fallbackSkills,
            detailedTechnical: meta.detailedTechnical || {
              accuracy: fallbackSkills.technicalAccuracy,
              completeness: score,
              examples: Math.max(0, score - 10)
            },
            strengths: meta.strengths || fallbackStrengths,
            weaknesses: meta.weaknesses || fallbackWeaknesses,
            improvements: meta.improvements || fallbackImprovements,
            careerAdvice: meta.careerAdvice || 'Hãy tiếp tục thực hành phỏng vấn để nhận được những lời khuyên chi tiết và cá nhân hóa hơn.',
            resources: meta.resources || [],
            difficulty: meta.difficultyName || 'Đã lưu', // From metadata
            questionType: 'Câu hỏi' // fallback
          };

          setResultData(mappedResult);
        } catch (err) {
          console.error('Error fetching interview result:', err);
          setEvalError('Không thể tải kết quả phỏng vấn. Vui lòng thử lại.');
          // Don't fallback to MOCK_RESULT here, let the error screen show
        } finally {
          setIsEvaluating(false);
        }
      };
      fetchResult();
    } else {
      // Fallback to mock data if accessed directly without session state and no ID
      setResultData(MOCK_RESULT);
    }
  }, [questionAnswerPairs, config, totalQuestions, answeredQuestions, id]);

  const handleDownloadPDF = useCallback(() => {
    if (isDownloading) return;
    setIsDownloading(true);
    
    // Force expand all questions to include them in PDF
    const prevExpanded = expandedQuestion;
    setExpandedQuestion('ALL');
    
    // Wait for React to render all details
    setTimeout(() => {
      const element = document.getElementById('pdf-content');
      if (!element) {
        setIsDownloading(false);
        return;
      }
      
      // Apply export class to force width and background
      element.classList.add('pdf-export-mode');

      html2canvas(element, {
        scale: 2,
        useCORS: true,
        windowWidth: 800,
        backgroundColor: '#0a0f1c',
        logging: false
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = pdfWidth / imgWidth;
        const totalImgHeightInMm = imgHeight * ratio;
        
        let heightLeft = totalImgHeightInMm;
        let position = 0;
        
        // Add first page
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeightInMm);
        heightLeft -= pdfHeight;
        
        // Add subsequent pages if content is taller than 1 page
        while (heightLeft > 0) {
          position = heightLeft - totalImgHeightInMm; 
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeightInMm);
          heightLeft -= pdfHeight;
        }
        
        pdf.save(`Ket-qua-phong-van-${id || 'moi'}.pdf`);
        
        element.classList.remove('pdf-export-mode');
        setExpandedQuestion(prevExpanded);
        setIsDownloading(false);
      }).catch(err => {
        console.error('PDF Generation error:', err);
        element.classList.remove('pdf-export-mode');
        setExpandedQuestion(prevExpanded);
        setIsDownloading(false);
      });
    }, 800);
  }, [isDownloading, expandedQuestion, id]);

  // Handle auto-print if navigated from history
  useEffect(() => {
    if (resultData && autoPrint && !isEvaluating) {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [resultData, autoPrint, isEvaluating, handleDownloadPDF]);

  if (isEvaluating) {
    return (
      <div className="interview-theme room-theme room-loading-screen">
        {/* Background illustration removed */}
        <div className="room-loading-content iv-glass iv-animate-scale">
          <Loader2 className="room-loading-spinner iv-spin" size={48} />
          <h3 className="room-loading-title">AI Đang Đánh Giá Câu Trả Lời</h3>
          <p className="room-loading-desc">
            Vui lòng đợi trong giây lát, chuyên gia AI đang phân tích kỹ năng giao tiếp, vốn từ vựng và độ chính xác kỹ thuật của bạn để lập bảng kết quả...
          </p>
        </div>
      </div>
    );
  }

  if (evalError) {
    return (
      <div className="interview-theme room-theme room-error-screen">
        {/* Background illustration removed */}
        <div className="room-error-content iv-glass iv-animate-scale">
          <div className="room-error-icon-wrapper">
            <AlertTriangle className="room-error-icon" size={44} />
          </div>
          <h3 className="room-error-title">Lỗi chấm điểm phỏng vấn</h3>
          <p className="room-error-desc">{evalError}</p>
          <div className="room-error-actions">
            <button className="iv-btn iv-btn--primary" onClick={() => window.location.reload()}>
              Thử lại
            </button>
            <button className="iv-btn iv-btn--ghost" onClick={() => navigate('/interview/setup')}>
              Quay lại thiết lập
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!resultData) return null;
  const result = resultData;

  return (
    <div className="interview-theme">
      {/* Background illustration removed to fix dotted line bug at bottom of long content */}
      <div className="iv-orb iv-orb--blue" />
      <div className="iv-orb iv-orb--purple" />

      <div className="result-container">
        {/* ── Header ── */}
        <div className="result-header iv-animate-fade">
          <button className="iv-btn iv-btn--ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            Quay lại
          </button>
          <div className="result-header__actions">
            <button className="iv-btn iv-btn--secondary iv-btn--sm" onClick={handleDownloadPDF} disabled={isDownloading}>
              <Download size={14} />
              {isDownloading ? 'Đang tạo PDF...' : 'Tải PDF'}
            </button>

            {!isMentor && (
              <button className="iv-btn result-btn-orange iv-btn--sm" onClick={() => navigate('/interview/setup')}>
                <RotateCcw size={14} />
                Thử lại
              </button>
            )}
          </div>
        </div>

        {/* WRAP CONTENT TO BE PRINTED */}
        <div id="pdf-content" style={{ padding: '10px 0' }}>
          {/* ── Hero Score Section ── */}
          <div className="result-hero iv-animate-slide-up">
          <div className="result-hero__score">
            <ScoreRing score={result.overallScore} />
            <div className="result-hero__grade">
              <span className="result-hero__grade-badge" style={{ color: getScoreColor(result.overallScore) }}>
                {result.grade}
              </span>
            </div>
          </div>
          <div className="result-hero__info">
            <h1 className="result-hero__title">Kết Quả Phỏng Vấn</h1>
            <div className="result-hero__meta">
              <span className="iv-badge iv-badge--info">{result.industry}</span>
              <span className="iv-badge iv-badge--warning">{result.difficulty}</span>
              <span className="iv-badge iv-badge--purple">{result.questionType}</span>
            </div>
            <div className="result-hero__stats">
              <div className="result-hero__stat">
                <Clock size={14} />
                <span>{result.duration}</span>
              </div>
              <div className="result-hero__stat">
                <Target size={14} />
                <span>{result.answeredQuestions}/{result.totalQuestions} câu</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="result-summary-cards iv-animate-slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {/* Card 1: Final Score */}
          <div className="summary-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--iv-border)', padding: '1.25rem', borderRadius: 'var(--iv-radius-lg)', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05, transform: 'scale(1.5)' }}>
              <Award size={64} color="var(--iv-accent-cyan)" />
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--iv-radius-md)', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--iv-accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--iv-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng điểm (Final)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--iv-text-primary)' }}>{result.overallScore}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--iv-text-secondary)' }}>/100</span>
              </div>
            </div>
          </div>

          {/* Card 2: Technical Accuracy */}
          <div className="summary-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--iv-border)', padding: '1.25rem', borderRadius: 'var(--iv-radius-lg)', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05, transform: 'scale(1.5)' }}>
              <Brain size={64} color="var(--iv-accent-blue)" />
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--iv-radius-md)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--iv-accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--iv-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chuyên môn (Technical)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--iv-text-primary)' }}>{result.skills.technicalAccuracy}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--iv-text-secondary)' }}>/100</span>
              </div>
            </div>
          </div>

          {/* Card 3: Confidence Score */}
          <div className="summary-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--iv-border)', padding: '1.25rem', borderRadius: 'var(--iv-radius-lg)', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05, transform: 'scale(1.5)' }}>
              <Shield size={64} color="#10b981" />
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--iv-radius-md)', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--iv-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tự tin (Confidence)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--iv-text-primary)' }}>{result.skills.confidence}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--iv-text-secondary)' }}>/100</span>
              </div>
            </div>
          </div>

          {/* Card 4: Fluency Score */}
          <div className="summary-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--iv-border)', padding: '1.25rem', borderRadius: 'var(--iv-radius-lg)', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05, transform: 'scale(1.5)' }}>
              <Mic size={64} color="#f59e0b" />
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--iv-radius-md)', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--iv-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trôi chảy (Fluency)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--iv-text-primary)' }}>{result.skills.pronunciation}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--iv-text-secondary)' }}>/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Feedback Summary ── */}
        <div className="result-section iv-animate-slide-up iv-delay-1">
          <div className="result-card result-card--feedback">
            <div className="result-card__header">
              <Sparkles size={18} />
              <h2>Nhận xét từ AI</h2>
            </div>
            <p className="result-card__text">{result.aiFeedback}</p>
          </div>
        </div>

        {/* ── Mentor Feedback ── */}
        {(mentorReview || isMentor) && (
          <div className="result-section iv-animate-slide-up iv-delay-1" style={{ marginTop: '1.5rem' }}>
            <div className="result-card" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.03)' }}>
              <div className="result-card__header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="#10b981" />
                <h2 style={{ color: '#10b981', margin: 0 }}>Nhận xét từ Mentor</h2>
              </div>
              
              {mentorReview ? (
                <div style={{ marginTop: '1rem' }}>
                  <p className="result-card__text" style={{ whiteSpace: 'pre-line', color: 'var(--iv-text-primary)' }}>{mentorReview.overall_comment}</p>
                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--iv-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {mentorReview.mentor?.full_name?.charAt(0) || 'M'}
                    </div>
                    Đánh giá bởi: <strong>{mentorReview.mentor?.full_name || 'Mentor'}</strong>
                  </div>
                </div>
              ) : isMentor ? (
                <div style={{ marginTop: '1rem' }}>
                  <textarea
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    style={{ width: '100%', minHeight: '100px', padding: '1rem', borderRadius: '8px', border: '1px solid var(--iv-border)', background: 'var(--iv-bg)', color: 'var(--iv-text-primary)', resize: 'vertical', marginBottom: '1rem', fontFamily: 'inherit' }}
                    placeholder="Nhập đánh giá, nhận xét chi tiết và lời khuyên cho ứng viên tại đây..."
                  />
                  <button 
                    className="iv-btn iv-btn--sm" 
                    style={{ background: '#10b981', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: (!feedbackInput.trim() || isSubmittingReview) ? 0.5 : 1, cursor: (!feedbackInput.trim() || isSubmittingReview) ? 'not-allowed' : 'pointer' }}
                    onClick={handleSubmitMentorReview}
                    disabled={isSubmittingReview || !feedbackInput.trim()}
                  >
                    {isSubmittingReview ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    {isSubmittingReview ? 'Đang gửi...' : 'Gửi nhận xét'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Skills Grid ── */}
        <div className="result-skills-grid iv-animate-slide-up iv-delay-2">
          {/* Radar Chart */}
          <div className="result-card">
            <div className="result-card__header">
              <Target size={18} />
              <h2>Phân tích kỹ năng</h2>
            </div>
            <RadarChart skills={result.skills} />
          </div>

          {/* Skill Bars */}
          <div className="result-card">
            <div className="result-card__header">
              <TrendingUp size={18} />
              <h2>Điểm chi tiết</h2>
            </div>
            <div className="result-skill-bars">
              <SkillBar label="Trôi chảy" score={result.skills.pronunciation} icon={Mic} />
              <SkillBar label="Từ vựng" score={result.skills.vocabulary} icon={BookOpen} />
              <SkillBar label="Giao tiếp" score={result.skills.communication} icon={MessageSquare} />
              <SkillBar label="Tự tin" score={result.skills.confidence} icon={Shield} />
              <SkillBar label="Kỹ thuật tổng hợp" score={result.skills.technicalAccuracy} icon={Brain} />

              {result.detailedTechnical && (
                <div className="technical-breakdown" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--iv-border)' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--iv-text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} /> Chi tiết điểm kỹ thuật:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--iv-text-secondary)' }}>• Độ chính xác (Accuracy):</span>
                      <span style={{ fontWeight: 600 }}>{result.detailedTechnical.accuracy}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--iv-text-secondary)' }}>• Độ đầy đủ (Completeness):</span>
                      <span style={{ fontWeight: 600 }}>{result.detailedTechnical.completeness}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--iv-text-secondary)' }}>• Ví dụ thực tế (Examples):</span>
                      <span style={{ fontWeight: 600 }}>{result.detailedTechnical.examples}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Strengths & Weaknesses ── */}
        <div className="result-sw-grid iv-animate-slide-up iv-delay-3">
          <div className="result-card result-card--strengths">
            <div className="result-card__header">
              <CheckCircle2 size={18} style={{ color: 'var(--iv-success)' }} />
              <h2>Điểm mạnh</h2>
            </div>
            <ul className="result-list result-list--success">
              {result.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="result-card result-card--weaknesses">
            <div className="result-card__header">
              <AlertCircle size={18} style={{ color: 'var(--iv-warning)' }} />
              <h2>Cần cải thiện</h2>
            </div>
            <ul className="result-list result-list--warning">
              {result.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Improvements ── */}
        <div className="result-section iv-animate-slide-up iv-delay-4">
          <div className="result-card">
            <div className="result-card__header">
              <Zap size={18} style={{ color: 'var(--iv-accent-cyan)' }} />
              <h2>Đề xuất cải thiện</h2>
            </div>
            <div className="result-improvements">
              {result.improvements.map((imp, i) => (
                <div key={i} className="improvement-item">
                  <span className={`improvement-priority improvement-priority--${imp.priority}`}>
                    {imp.priority === 'high' ? 'Quan trọng' : imp.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                  </span>
                  <span className="improvement-text">{imp.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Career Advice ── */}
        <div className="result-section iv-animate-slide-up iv-delay-5">
          <div className="result-card result-card--career">
            <div className="result-card__header">
              <Award size={18} style={{ color: 'var(--iv-accent-purple)' }} />
              <h2>Lời khuyên nghề nghiệp từ AI</h2>
            </div>
            <p className="result-card__text">{result.careerAdvice}</p>
          </div>
        </div>

        {/* ── Question by Question Review ── */}
        <div className="result-section iv-animate-slide-up iv-delay-6">
          <div className="result-card">
            <div className="result-card__header">
              <MessageSquare size={18} />
              <h2>Chi tiết từng câu hỏi</h2>
            </div>
            <div className="result-qa-list">
              {result.questionReviews.map((qr, index) => (
                <div key={qr.id} className={`qa-item ${expandedQuestion === qr.id ? 'qa-item--expanded' : ''}`}>
                  <button className="qa-item__header" onClick={() => toggleQuestion(qr.id)}>
                    <div className="qa-item__left">
                      <span className="qa-item__number">#{index + 1}</span>
                      <span className="qa-item__question">{qr.question}</span>
                    </div>
                    <div className="qa-item__right">
                      <span className="qa-item__score" style={{ color: getScoreColor(qr.score) }}>
                        {qr.score}%
                      </span>
                      {expandedQuestion === qr.id || expandedQuestion === 'ALL' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {(() => {
                    const pair = questionAnswerPairs && questionAnswerPairs[qr.id - 1];
                    const m = pair?.metrics;
                    return (
                      <div className={`qa-item__details ${expandedQuestion === qr.id || expandedQuestion === 'ALL' ? '' : 'qa-item__details--collapsed'}`}>
                        <div className="qa-detail">
                          <h4><MessageSquare size={14} /> Câu trả lời của bạn</h4>
                          <p>
                            {(!qr.userAnswer || qr.userAnswer.trim() === '' || qr.userAnswer === '[No Answer / Silent]') ? (
                              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>
                                (Chưa trả lời / Không phát hiện giọng nói)
                              </span>
                            ) : (
                              qr.userAnswer
                            )}
                          </p>
                        </div>

                        {m && (
                          <div className="qa-detail qa-detail-metrics" style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--iv-border)', borderRadius: 'var(--iv-radius-md)' }}>
                            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--iv-accent-cyan)' }}>
                              📊 Chỉ số phong thái & giọng nói:
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.75rem', color: 'var(--iv-text-secondary)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>👁️ Giao tiếp mắt:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.eyeContactPercent}%</strong>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${m.eyeContactPercent}%`, height: '100%', background: getScoreColor(m.eyeContactPercent), borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>👤 Tư thế đầu thẳng:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.headPosePercent}%</strong>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${m.headPosePercent}%`, height: '100%', background: getScoreColor(m.headPosePercent), borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>🎙️ Độ ổn định giọng:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.pitchStability}%</strong>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${m.pitchStability}%`, height: '100%', background: getScoreColor(m.pitchStability), borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>🔊 Âm lượng nói:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.volumeLevel}%</strong>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${m.volumeLevel}%`, height: '100%', background: getScoreColor(m.volumeLevel), borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>⚡ Tốc độ nói:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.wpm} WPM</strong>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '1rem', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>⏱️ Thời gian im lặng:</span>
                                  <strong style={{ color: 'var(--iv-text-primary)' }}>{m.silenceDuration}s</strong>
                                </div>
                              </div>
                            </div>
                            {m.hesitations && m.hesitations.length > 0 && (
                              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#fbbf24', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span>⚠️ Từ ngập ngừng:</span>
                                <span style={{ fontStyle: 'italic' }}>{m.hesitations.join(', ')}</span>
                                <span>({m.hesitationCount} lần)</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="qa-detail qa-detail--ai" style={{ marginTop: '0.75rem' }}>
                          <h4><Sparkles size={14} /> Đánh giá AI</h4>
                          <p>{qr.aiEvaluation}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Resources ── */}
        <div className="result-section iv-animate-slide-up iv-delay-7">
          <div className="result-card">
            <div className="result-card__header">
              <BookOpen size={18} style={{ color: 'var(--iv-accent-blue)' }} />
              <h2>Tài liệu đề xuất</h2>
            </div>
            <div className="result-resources">
              {result.resources.map((res, i) => {
                const finalUrl = resolveResourceUrl(res.title, res.type, res.url);

                return (
                  <a key={i} href={finalUrl} className="resource-item" target="_blank" rel="noopener noreferrer">
                    <div className="resource-item__info">
                      <span className="resource-item__title">{res.title}</span>
                      <span className="resource-item__type">{res.type}</span>
                    </div>
                    <ExternalLink size={14} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        </div>
        {/* END WRAP CONTENT TO BE PRINTED */}

        {/* ── Bottom Actions ── */}
        <div className="result-bottom iv-animate-fade iv-delay-8">
          <button className="iv-btn iv-btn--secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          {!isMentor && (
            <button className="iv-btn result-btn-orange iv-btn--lg" onClick={() => navigate('/interview/setup')}>
              <RotateCcw size={16} />
              Phỏng vấn lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

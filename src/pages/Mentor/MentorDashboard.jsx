import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Calendar, BookOpen, PenTool, Video, Settings, Play, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'CHÀO BUỔI SÁNG';
  if (hour < 18) return 'CHÀO BUỔI CHIỀU';
  return 'CHÀO BUỔI TỐI';
};

const MentorDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    pendingReviews: 0,
    upcomingSessions: 0,
    publishedBlogs: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user?.id) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { count: blogCount } = await supabase
        .from('blogs')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id)
        .eq('status', 'published');

      let pendingCount = 0;
      try {
        const { count: totalInterviews } = await supabase
          .from('interview_history')
          .select('*', { count: 'exact', head: true });

        const { count: reviewedCount } = await supabase
          .from('mentor_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('mentor_id', user.id);

        pendingCount = Math.max(0, (totalInterviews || 0) - (reviewedCount || 0));
      } catch {
        pendingCount = 0;
      }

      let sessionCount = 0;
      try {
        const { count } = await supabase
          .from('mentor_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('mentor_id', user.id)
          .eq('status', 'accepted');
        sessionCount = count || 0;
      } catch {
        sessionCount = 0;
      }

      setStats({
        pendingReviews: pendingCount,
        upcomingSessions: sessionCount,
        publishedBlogs: blogCount || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
    setLoadingStats(false);
  };

  return (
    <div className="container animate-fade" style={{ paddingTop: '8rem', paddingBottom: 'var(--spacing-xl)', minHeight: '100vh' }}>
      <header style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-xs)', textTransform: 'uppercase' }}
            >
              {getGreeting()}, <span style={{ color: '#EA580C' }}>{profile?.full_name || user?.email?.split('@')[0] || 'Mentor'}</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ color: 'var(--text-secondary)' }}
            >
              Quản lý đánh giá phỏng vấn, lịch hẹn mentoring và chia sẻ kiến thức.
            </motion.p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid-auto" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {/* Pending Reviews */}
        <div style={{ 
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
          borderRadius: '24px', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
          minHeight: '160px', boxShadow: '0 8px 24px rgba(225, 29, 72, 0.25)'
        }}>
          <h3 style={{ fontSize: '4rem', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1, letterSpacing: '-2px', zIndex: 2 }}>
            {loadingStats ? '...' : stats.pendingReviews}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.95)', margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, zIndex: 2 }}>
            Yêu cầu đánh giá chờ
          </p>
          <div style={{ position: 'absolute', bottom: '-20px', right: '-15px', transform: 'rotate(10deg)', opacity: 0.2, zIndex: 1 }}>
            <Eye size={130} color="#ffffff" strokeWidth={1.5} />
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div style={{ 
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '24px', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
          minHeight: '160px', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)'
        }}>
          <h3 style={{ fontSize: '4rem', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1, letterSpacing: '-2px', zIndex: 2 }}>
            {loadingStats ? '...' : stats.upcomingSessions}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.95)', margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, zIndex: 2 }}>
            Buổi hẹn sắp tới
          </p>
          <div style={{ position: 'absolute', bottom: '-20px', right: '-15px', transform: 'rotate(-10deg)', opacity: 0.2, zIndex: 1 }}>
            <Calendar size={130} color="#ffffff" strokeWidth={1.5} />
          </div>
        </div>

        {/* Published Blogs */}
        <div style={{ 
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          borderRadius: '24px', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
          minHeight: '160px', boxShadow: '0 8px 24px rgba(109, 40, 217, 0.25)'
        }}>
          <h3 style={{ fontSize: '4rem', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1, letterSpacing: '-2px', zIndex: 2 }}>
            {loadingStats ? '...' : stats.publishedBlogs}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.95)', margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, zIndex: 2 }}>
            Bài blog đã xuất bản
          </p>
          <div style={{ position: 'absolute', bottom: '-20px', right: '-15px', transform: 'rotate(10deg)', opacity: 0.2, zIndex: 1 }}>
            <BookOpen size={130} color="#ffffff" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-lg)' }}>
        
        {/* Feature: Blog Management */}
        <div className="solid-card" style={{ background: '#fff', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '1.2rem', background: 'rgba(234, 88, 12, 0.05)', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(234, 88, 12, 0.1)', width: 'fit-content', margin: '0 auto 1.5rem' }}>
            <PenTool size={36} color="#EA580C" strokeWidth={2} />
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quản lý Blog</h2>
          <p style={{ marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6, textAlign: 'center', color: '#6b7280', flex: 1 }}>
            Tạo bài viết mới, chỉnh sửa và xuất bản nội dung chia sẻ kiến thức, kinh nghiệm.
          </p>
          <button 
            style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)', transition: 'all 0.3s ease', width: '100%' }} 
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'; }}
            onClick={() => navigate('/mentor/blogs')}
          >
            Vào ngay
          </button>
        </div>

        {/* Feature: Reviews */}
        <div className="solid-card" style={{ background: '#fff', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '1.2rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.1)', width: 'fit-content', margin: '0 auto 1.5rem' }}>
            <Video size={36} color="#3b82f6" strokeWidth={2} />
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Đánh giá Phỏng vấn</h2>
          <p style={{ marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6, textAlign: 'center', color: '#6b7280', flex: 1 }}>
            Xem video và lịch sử phỏng vấn của các ứng viên đã đặt lịch mentoring với bạn.
          </p>
          <button 
            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', transition: 'all 0.3s ease', width: '100%' }} 
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'; }}
            onClick={() => navigate('/mentor/reviews')}
          >
            Vào ngay
          </button>
        </div>

        {/* Feature: Schedule */}
        <div className="solid-card" style={{ background: '#fff', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '1.2rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)', width: 'fit-content', margin: '0 auto 1.5rem' }}>
            <Calendar size={36} color="#10b981" strokeWidth={2} />
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quản lý Lịch hẹn</h2>
          <p style={{ marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6, textAlign: 'center', color: '#6b7280', flex: 1 }}>
            Chấp nhận hoặc từ chối lịch hẹn, tham gia phiên mentoring trực tuyến 1-on-1.
          </p>
          <button 
            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', transition: 'all 0.3s ease', width: '100%' }} 
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'; }}
            onClick={() => navigate('/mentor/schedule')}
          >
            Vào ngay
          </button>
        </div>

        {/* Feature: Profile Settings */}
        <div className="solid-card" style={{ background: '#fff', borderRadius: '24px', padding: '2.5rem 2rem', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '1.2rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.1)', width: 'fit-content', margin: '0 auto 1.5rem' }}>
            <Settings size={36} color="#8b5cf6" strokeWidth={2} />
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cài đặt Hồ sơ</h2>
          <p style={{ marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6, textAlign: 'center', color: '#6b7280', flex: 1 }}>
            Cập nhật thông tin cá nhân, chuyên môn, kinh nghiệm để ứng viên tin tưởng.
          </p>
          <button 
            style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', transition: 'all 0.3s ease', width: '100%' }} 
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'; }}
            onClick={() => navigate('/mentor/profile')}
          >
            Vào ngay
          </button>
        </div>

      </div>
    </div>
  );
};

export default MentorDashboard;

import React, { useState, useEffect } from 'react';
import { Users, Activity, Target, Crown } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { motion } from 'framer-motion';

const StatisticsView = () => {
  // Dữ liệu trống, sẽ được fetch từ backend sau
  const [stats, setStats] = useState({
    totalInterviews: 0,
    avgScore: 0,
    activeUsers: 0,
    premiumSubscribers: 0,
    interviewsPastWeek: [0, 0, 0, 0, 0, 0, 0]
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 1. Tổng phỏng vấn
      const { count: totalInterviews } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true });

      // 2. Điểm trung bình (lấy overall_score của các bài phỏng vấn đã chấm)
      const { data: interviewsWithScore } = await supabase
        .from('interviews')
        .select('overall_score')
        .not('overall_score', 'is', null);
      
      let avgScore = 0;
      if (interviewsWithScore && interviewsWithScore.length > 0) {
        const sum = interviewsWithScore.reduce((acc, curr) => acc + curr.overall_score, 0);
        avgScore = Math.round(sum / interviewsWithScore.length);
      }

      // 3. Người dùng Active (đếm role là user/candidate/recruiter có status active)
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'Active']);

      // 4. Subscribers (Pro, Premium)
      const { count: premiumSubscribers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('plan', ['Pro', 'Premium']);

      // 5. Phỏng vấn 7 ngày qua
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentInterviews } = await supabase
        .from('interviews')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const interviewsPastWeek = [0, 0, 0, 0, 0, 0, 0];
      
      if (recentInterviews) {
        recentInterviews.forEach(interview => {
          const date = new Date(interview.created_at);
          // getDay(): 0 = Sunday, 1 = Monday ... 6 = Saturday
          // Đổi thành 0 = Monday ... 6 = Sunday
          let dayIndex = date.getDay() - 1;
          if (dayIndex === -1) dayIndex = 6; 
          interviewsPastWeek[dayIndex]++;
        });
      }

      setStats({
        totalInterviews: totalInterviews || 0,
        avgScore,
        activeUsers: activeUsers || 0,
        premiumSubscribers: premiumSubscribers || 0,
        interviewsPastWeek
      });

    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const maxInterviews = Math.max(...stats.interviewsPastWeek, 10);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 3vw, 2.5rem)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-charcoal)', letterSpacing: '-1px', margin: 0, fontFamily: 'var(--font-heading)' }}>Báo cáo Thống kê</h2>
      </motion.div>

      <div style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <StatCard variants={itemVariants} title="Tổng Phỏng vấn" value={stats.totalInterviews} icon={<Activity size={28} color="#EA580C" />} />
        <StatCard variants={itemVariants} title="Điểm Trung bình" value={`${stats.avgScore}/100`} icon={<Target size={28} color="#32c864" />} />
        <StatCard variants={itemVariants} title="Người dùng Active" value={stats.activeUsers} icon={<Users size={28} color="#2196F3" />} />
        <StatCard variants={itemVariants} title="Subscribers" value={stats.premiumSubscribers} icon={<Crown size={28} color="#ff9632" />} />
      </div>

      <motion.div variants={itemVariants} className="glass-card" style={{ padding: '2.5rem', borderRadius: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
        <h3 style={{ marginBottom: '2rem', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-charcoal)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>Phỏng vấn trong 7 ngày qua</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '250px', padding: '1rem 0' }}>
          {stats.interviewsPastWeek.map((count, index) => {
            const heightPercentage = Math.max((count / maxInterviews) * 100, 2);
            const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

            return (
              <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '0.8rem', height: '100%' }}>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>{count}</div>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 + (index * 0.05) }}
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    background: 'linear-gradient(to top, rgba(234, 88, 12, 0.7), #EA580C)',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 4px 10px rgba(234, 88, 12, 0.2)'
                  }} 
                />
                <div style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{days[index]}</div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatCard = ({ title, value, icon, variants }) => (
  <motion.div variants={variants} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'default' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.06)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.03)'; }}>
    <div style={{ padding: '1.2rem', background: 'var(--color-cream)', borderRadius: '16px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
      {icon}
    </div>
    <div>
      <h3 style={{ fontSize: '2.2rem', margin: '0 0 0.2rem 0', fontWeight: 800, color: 'var(--color-charcoal)', fontFamily: 'var(--font-heading)' }}>{value}</h3>
      <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{title}</p>
    </div>
  </motion.div>
);

export default StatisticsView;

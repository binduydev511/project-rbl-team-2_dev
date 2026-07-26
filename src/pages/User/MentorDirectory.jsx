import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../utils/AuthContext';
import { Search, User, Briefcase, Award, Clock, Star, Phone, Link as LinkIcon, Mail, Calendar } from 'lucide-react';
import { useConfirm } from '../../utils/ConfirmContext';
import { motion } from 'framer-motion';

const MentorDirectory = () => {
  const confirm = useConfirm();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Lấy plan từ local state, nếu null thì gán mặc định là Free
  const currentPlan = profile?.plan || 'Free';
  const isPremiumOrPro = (profile?.planLimits?.max_mentor_bookings || 0) > 0;

  useEffect(() => {
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      // 1. Lấy danh sách Mentor từ bảng mentors (không giới hạn status hoặc lọc status != 'rejected')
      const { data: mentorsData, error: mentorsError } = await supabase
        .from('mentors')
        .select('id, mentor_id, full_name, expertise, avatar_url, bio, phone, email, linkedin_url, status')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      // 2. Lấy danh sách người dùng có role = 'mentor' từ bảng profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, role, status')
        .ilike('role', 'mentor');

      const mentorMap = new Map();

      // Thêm dữ liệu từ bảng mentors trước
      if (mentorsData) {
        mentorsData.forEach(m => {
          const key = m.mentor_id || m.id;
          mentorMap.set(key, {
            id: m.id,
            mentor_id: key,
            full_name: m.full_name || 'Mentor Chuyên gia',
            expertise: m.expertise || 'Chuyên gia Phỏng vấn / Career Mentor',
            avatar_url: m.avatar_url || null,
            bio: m.bio || 'Chuyên gia tư vấn định hướng nghề nghiệp và hỗ trợ luyện tập phỏng vấn.',
            phone: m.phone || '',
            email: m.email || '',
            linkedin_url: m.linkedin_url || ''
          });
        });
      }

      // Thêm các user có role = 'mentor' từ bảng profiles nếu chưa có trong mentorMap
      if (profilesData) {
        profilesData.forEach(p => {
          if (!mentorMap.has(p.id)) {
            mentorMap.set(p.id, {
              id: p.id,
              mentor_id: p.id,
              full_name: p.full_name || p.email?.split('@')[0] || 'Mentor Chuyên gia',
              expertise: 'Chuyên gia Phỏng vấn / Career Mentor',
              avatar_url: p.avatar_url || null,
              bio: 'Chuyên gia tư vấn định hướng nghề nghiệp và hỗ trợ mock interview.',
              phone: p.phone || '',
              email: p.email || '',
              linkedin_url: ''
            });
          }
        });
      }

      setMentors(Array.from(mentorMap.values()));
    } catch (err) {
      console.error('Lỗi khi tải danh sách Mentor:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentors = mentors.filter(mentor => 
    mentor.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mentor.expertise?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="section" style={{ 
      backgroundColor: '#fdfbf7', 
      minHeight: '100vh', 
      paddingTop: '120px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ textAlign: 'center', marginBottom: '1.5rem' }}
        >
          <h1 style={{ marginBottom: '1rem', fontSize: '2.5rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-charcoal)', letterSpacing: '-0.5px' }}>Đội ngũ Mentor Chuyên gia</h1>
          <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Kết nối với các chuyên gia hàng đầu để nhận lời khuyên định hướng nghề nghiệp, giải đáp thắc mắc và mock interview thực tế.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          style={{ maxWidth: '600px', margin: '0 auto var(--spacing-xl) auto', position: 'relative' }}
        >
          <Search size={20} color="var(--color-text-muted)" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm Mentor theo tên hoặc lĩnh vực..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '50px',
              border: '1px solid var(--border-color)', background: 'white',
              fontSize: '1rem', outline: 'none', boxShadow: 'var(--shadow-sm)'
            }}
          />
        </motion.div>

        {/* Mentors Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
            Đang tải danh sách Mentor...
          </div>
        ) : filteredMentors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
            <User size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <p>Không tìm thấy Mentor nào phù hợp.</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              gap: '2rem' 
            }}
          >
            {filteredMentors.map((mentor, index) => (
              <motion.div 
                key={mentor.id || index} 
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                className="glass-card"
                style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flex: '1 1 350px', maxWidth: '450px' }}
              >
                {/* Mentor Header (Avatar & Name) */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden',
                    background: 'var(--color-surface-alt)', flexShrink: 0,
                    border: '3px solid white', boxShadow: 'var(--shadow-sm)'
                  }}>
                    {mentor.avatar_url ? (
                      <img src={mentor.avatar_url} alt={mentor.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                        <User size={32} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: 'var(--color-charcoal)', fontWeight: 700, letterSpacing: '0.2px' }}>{mentor.full_name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#EA580C', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Briefcase size={14} /> {mentor.expertise}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    "{mentor.bio ? (mentor.bio.length > 150 ? mentor.bio.substring(0, 150) + '...' : mentor.bio) : 'Mentor chuyên nghiệp'}"
                  </p>
                </div>

                {/* Contact Info (Gated) */}
                <div style={{ 
                  background: isPremiumOrPro ? 'var(--color-surface-alt)' : 'rgba(0,0,0,0.02)',
                  borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {!isPremiumOrPro && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      zIndex: 10, padding: '1rem', textAlign: 'center'
                    }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '0.5rem' }}>
                        Khóa đối với thành viên Free
                      </p>
                      <Link to="/pricing" className="btn btn--outline" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
                        Nâng cấp để xem liên hệ
                      </Link>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: isPremiumOrPro ? 1 : 0.3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      <Phone size={14} /> 
                      {mentor.phone ? (
                        <a href={`https://zalo.me/${mentor.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                          Zalo: {mentor.phone}
                        </a>
                      ) : 'Chưa cập nhật'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      <Mail size={14} /> 
                      <a href={`mailto:${mentor.email}`} style={{ color: 'var(--color-text)', textDecoration: 'none' }}>{mentor.email}</a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      <LinkIcon size={14} /> 
                      {mentor.linkedin_url ? (
                        <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2', textDecoration: 'none', fontWeight: 500 }}>
                          Hồ sơ LinkedIn
                        </a>
                      ) : 'Chưa cập nhật'}
                    </div>
                  </div>
                </div>

                {/* Booking Button */}
                <button 
                  onClick={async () => {
                    if (!isPremiumOrPro) {
                      const isConfirmed = await new Promise(resolve => confirm({ message: 'Tính năng này chỉ dành cho gói Pro hoặc Premium. Bạn có muốn nâng cấp ngay?', isDanger: true, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));
    if (isConfirmed) {
                        navigate('/pricing');
                      }
                    } else {
                      navigate(`/mentors/book/${mentor.id || mentor.mentor_id}`);
                    }
                  }}
                  className={`btn ${isPremiumOrPro ? 'btn--primary' : 'btn--outline'}`}
                  style={{ 
                    width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                    background: isPremiumOrPro ? '#EA580C' : 'transparent',
                    borderColor: isPremiumOrPro ? '#EA580C' : 'var(--border-color)',
                    boxShadow: isPremiumOrPro ? '0 4px 12px rgba(234, 88, 12, 0.3)' : 'none',
                    color: isPremiumOrPro ? '#fff' : 'var(--color-charcoal)',
                    transition: 'all 0.3s ease',
                    border: isPremiumOrPro ? 'none' : '1px solid var(--border-color)'
                  }}
                  onMouseOver={(e) => { 
                    e.currentTarget.style.transform = 'translateY(-2px)'; 
                    if(isPremiumOrPro) e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)'; 
                  }}
                  onMouseOut={(e) => { 
                    e.currentTarget.style.transform = 'translateY(0)'; 
                    if(isPremiumOrPro) e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'; 
                  }}
                >
                  <Calendar size={18} />
                  Đặt Lịch Mentoring
                </button>

              </motion.div>
            ))}
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default MentorDirectory;

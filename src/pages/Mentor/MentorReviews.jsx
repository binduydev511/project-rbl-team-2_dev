import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Clock, CheckCircle, Video, Play, ExternalLink } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const MentorReviews = () => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchCandidates();
  }, [user]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // Fetch mentor bookings to get the candidates
      const { data, error } = await supabase
        .from('mentor_bookings')
        .select('*, candidate:candidate_id(*)')
        .eq('mentor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching candidates:', error.message);
        setCandidates([]);
      } else {
        // Group by candidate to avoid duplicates, keeping the most recent booking status
        const uniqueCandidates = [];
        const seenIds = new Set();
        
        (data || []).forEach(booking => {
          if (!seenIds.has(booking.candidate_id)) {
            seenIds.add(booking.candidate_id);
            uniqueCandidates.push({
              id: booking.candidate_id,
              candidateName: booking.candidate?.full_name || 'Ứng viên chưa cập nhật tên',
              email: booking.candidate?.email || 'N/A',
              industry: booking.candidate?.industry || 'Chưa rõ ngành nghề',
              status: booking.status,
              date: new Date(booking.created_at).toLocaleDateString('vi-VN')
            });
          }
        });

        setCandidates(uniqueCandidates);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setCandidates([]);
    }
    setLoading(false);
  };

  return (
    <div className="container animate-fade" style={{ paddingTop: '8rem', paddingBottom: 'var(--spacing-xl)', minHeight: '100vh' }}>
      <header style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link to="/mentor" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none', marginBottom: '1rem' }}>
              ← Quay lại Mentor Dashboard
            </Link>
            <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-xs)', textTransform: 'uppercase' }}>
              Lịch sử phỏng vấn của ứng viên
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Xem danh sách các ứng viên đã đặt lịch với bạn và đánh giá các bài phỏng vấn AI trước đây của họ.
            </p>
          </div>
        </div>
      </header>

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Đang tải danh sách ứng viên...
          </div>
        ) : (
          /* Review List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {candidates.map((candidate, idx) => (
              <div
                key={candidate.id}
                className={`solid-card reveal is-visible ${idx > 0 ? `reveal--delay-${Math.min(idx, 3)}` : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1.5rem',
                  flexWrap: 'wrap', background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}
              >
                {/* Avatar / Icon Thumbnail */}
                <div style={{
                  width: '60px', height: '60px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                }}>
                  <Users size={28} color="rgba(255,255,255,0.7)" />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.3rem 0', color: 'var(--color-charcoal)' }}>
                    {candidate.candidateName}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {candidate.email} · {candidate.industry}
                  </p>
                </div>

                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {candidate.status === 'pending' ? (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.4rem 0.85rem', borderRadius: '50px',
                      background: 'rgba(196, 149, 106, 0.12)',
                      color: 'var(--color-accent)',
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      <Clock size={14} /> Chờ xác nhận lịch
                    </span>
                  ) : (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.4rem 0.85rem', borderRadius: '50px',
                      background: 'rgba(107, 127, 92, 0.12)',
                      color: 'var(--color-moss)',
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>
                      <CheckCircle size={14} /> Đã xếp lịch hẹn
                    </span>
                  )}
                  
                  {/* Link to History */}
                  <Link
                    to={`/mentor/candidate-history/${candidate.id}`}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease' }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)'; }}
                  >
                    <Video size={16} />
                    Xem Lịch sử Phỏng vấn
                  </Link>
                </div>
              </div>
            ))}

            {candidates.length === 0 && (
              <div className="solid-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)', background: '#fff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                  Chưa có ứng viên nào đặt lịch với bạn.
                </p>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
                  Danh sách ứng viên sẽ xuất hiện tại đây khi có người đặt lịch hẹn mentoring.
                </p>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default MentorReviews;

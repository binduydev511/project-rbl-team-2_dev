import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, XCircle, Video, MessageSquare } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import toast from 'react-hot-toast';
import { useConfirm } from '../../utils/ConfirmContext';

const MentorSchedule = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (user?.id) fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('mentor_bookings')
        .select('*, candidate:candidate_id(*)')
        .eq('mentor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error.message);
        setErrorMsg('Lỗi khi tải lịch hẹn: ' + error.message + '. (Có thể bảng mentor_bookings chưa thiết lập khóa ngoại Foreign Key tới bảng profiles)');
        setBookings([]);
      } else {
        const mapped = (data || []).map(item => ({
          id: item.id,
          candidateName: item.candidate?.full_name || item.candidate_name || 'Ứng viên',
          candidateEmail: item.candidate?.email || '',
          candidatePhone: item.candidate?.phone || '',
          candidateCvUrl: item.candidate?.cv_url || null,
          date: item.booking_date || (item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : ''),
          time: item.booking_time || '--:--',
          topic: item.topic || 'Mentoring session',
          status: item.status || 'pending',
          candidate_id: item.candidate_id,
        }));
        setBookings(mapped);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setBookings([]);
    }
    setLoading(false);
  };

  const filteredBookings = filter === 'all'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const handleAccept = async (id) => {
    const { error } = await supabase
      .from('mentor_bookings')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (error) {
      toast.error('Lỗi khi chấp nhận lịch hẹn: ' + error.message);
    } else {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'accepted' } : b));
      toast.success('Đã chấp nhận lịch hẹn');
      
      // Notify candidate
      const booking = bookings.find(b => b.id === id);
      if (booking && booking.candidate_id) {
        await supabase.from('notifications').insert([{
          user_id: booking.candidate_id,
          title: 'Lịch hẹn đã được chấp nhận',
          content: `Mentor đã chấp nhận lịch hẹn của bạn vào ${booking.time} ngày ${booking.date}.`,
          type: 'success',
          action_link: '/my-bookings'
        }]);
      }
    }
  };

  const handleReject = async (id) => {
    const isConfirmed = await new Promise(resolve => confirm({ message: 'Bạn có chắc chắn muốn từ chối lịch hẹn này?', isDanger: true, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));
    if (!isConfirmed) return;
    const { error } = await supabase
      .from('mentor_bookings')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (error) {
      toast.error('Lỗi khi từ chối lịch hẹn: ' + error.message);
    } else {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' } : b));
      toast.success('Đã từ chối lịch hẹn');
      
      // Notify candidate
      const booking = bookings.find(b => b.id === id);
      if (booking && booking.candidate_id) {
        await supabase.from('notifications').insert([{
          user_id: booking.candidate_id,
          title: 'Lịch hẹn bị từ chối',
          content: `Rất tiếc, Mentor không thể nhận lịch hẹn của bạn vào ${booking.time} ngày ${booking.date}.`,
          type: 'warning',
          action_link: '/my-bookings'
        }]);
      }
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return { bg: 'rgba(196, 149, 106, 0.1)', color: 'var(--color-accent)', label: 'Chờ xác nhận', icon: <Clock size={14} /> };
      case 'accepted':
        return { bg: 'rgba(107, 127, 92, 0.1)', color: 'var(--color-moss)', label: 'Đã chấp nhận', icon: <CheckCircle size={14} /> };
      case 'rejected':
        return { bg: 'rgba(192, 57, 43, 0.08)', color: '#c0392b', label: 'Đã từ chối', icon: <XCircle size={14} /> };
      case 'completed':
        return { bg: 'rgba(139, 115, 85, 0.1)', color: 'var(--color-earth)', label: 'Đã hoàn thành', icon: <CheckCircle size={14} /> };
      default:
        return { bg: 'var(--border-color)', color: 'var(--color-text-secondary)', label: status, icon: null };
    }
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
              Quản lý Lịch hẹn
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Xem và quản lý các yêu cầu đặt lịch mentoring 1-on-1 từ ứng viên.
            </p>
          </div>
        </div>
      </header>

        {/* Filter Tabs */}
        <div className="reveal is-visible" style={{
          display: 'flex', gap: '0.5rem', marginBottom: 'var(--spacing-lg)',
          flexWrap: 'wrap',
        }}>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xác nhận' },
            { key: 'accepted', label: 'Đã chấp nhận' },
            { key: 'completed', label: 'Đã hoàn thành' },
            { key: 'rejected', label: 'Đã từ chối' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '50px',
                border: filter === tab.key ? '1px solid var(--color-charcoal)' : '1px solid var(--border-color)',
                background: filter === tab.key ? 'var(--color-charcoal)' : 'rgba(255,255,255,0.6)',
                color: filter === tab.key ? 'var(--color-cream)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.3s var(--ease-out-expo)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Đang tải lịch hẹn...
          </div>
        ) : (
          /* Bookings List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredBookings.map((booking, idx) => {
              const statusInfo = getStatusStyle(booking.status);
              return (
                <div
                  key={booking.id}
                  className={`solid-card reveal is-visible ${idx > 0 ? `reveal--delay-${Math.min(idx, 3)}` : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '50px', height: '50px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '1.1rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                  }}>
                    {booking.candidateName.charAt(0)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.25rem 0', color: 'var(--color-charcoal)' }}>
                      {booking.candidateName}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={14} /> {booking.date}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={14} /> {booking.time}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MessageSquare size={14} /> {booking.topic}
                      </span>
                    </div>

                    {booking.status !== 'pending' && (
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-charcoal)' }}>Thông tin Ứng viên:</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div><strong>Email:</strong> <a href={`mailto:${booking.candidateEmail}`} style={{ color: 'var(--color-primary)' }}>{booking.candidateEmail || 'N/A'}</a></div>
                          <div><strong>SĐT (Zalo):</strong> {booking.candidatePhone ? <a href={`https://zalo.me/${booking.candidatePhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{booking.candidatePhone}</a> : 'N/A'}</div>
                          <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {booking.candidateCvUrl && (
                              <a href={booking.candidateCvUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}>
                                Xem CV Ứng viên
                              </a>
                            )}
                            <Link to={`/mentor/candidate-history/${booking.candidate_id}`} style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}>
                              Xem Lịch sử Phỏng vấn AI
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.4rem 0.85rem', borderRadius: '50px',
                    background: statusInfo.bg, color: statusInfo.color,
                    fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {statusInfo.icon} {statusInfo.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleAccept(booking.id)}
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.3s ease' }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'; }}
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleReject(booking.id)}
                          style={{ background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.5rem 1.2rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; }}
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                    {booking.status === 'accepted' && (
                      <Link
                        to={`/mentor/schedule/session/${booking.id}`}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.3s ease' }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'; }}
                      >
                        <Video size={14} /> Tham gia phiên
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}

            {errorMsg && (
              <div style={{ padding: '1rem', background: 'rgba(255,0,0,0.1)', color: 'red', borderRadius: '8px', marginBottom: '1rem' }}>
                {errorMsg}
              </div>
            )}

            {!errorMsg && filteredBookings.length === 0 && (
              <div className="solid-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)', background: '#fff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <Calendar size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                  Không có lịch hẹn nào{filter !== 'all' ? ' trong mục này' : ''}.
                </p>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
                  Lịch hẹn sẽ xuất hiện tại đây khi ứng viên đặt lịch mentoring 1-on-1 với bạn.
                </p>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default MentorSchedule;

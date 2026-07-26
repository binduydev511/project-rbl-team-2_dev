import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../utils/AuthContext';
import { Calendar, Clock, MessageSquare, AlertCircle, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import emailjs from '@emailjs/browser';
import toast from 'react-hot-toast';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { vi } from 'date-fns/locale';
import './BookMentor.css';

registerLocale('vi', vi);

const BookMentor = () => {
  const { id } = useParams(); // mentor_id
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Quota enforcement
  const [quotaStatus, setQuotaStatus] = useState({ allowed: false, used: 0, limit: 0, loading: true });

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    topic: ''
  });
  const [bookedTimes, setBookedTimes] = useState([]);

  const currentPlan = profile?.plan || 'Free';

  // Helper function to get correct local date string (YYYY-MM-DD)
  const getLocalDateString = () => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  };

  // Generate available time slots based on selected date
  const getAvailableTimeSlots = () => {
    const allSlots = ['08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '19:00 - 20:00', '20:00 - 21:00'];
    if (!formData.date) return allSlots;

    if (formData.date === getLocalDateString()) {
      const currentHour = new Date().getHours();
      return allSlots.filter(slot => {
        const startHour = parseInt(slot.split(':')[0], 10);
        return startHour > currentHour; // Hide past slots
      });
    }
    return allSlots;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (user && id) {
      fetchMentorAndQuota();
    }
  }, [user, id]);

  useEffect(() => {
    if (formData.date && mentor) {
      fetchBookedTimes(formData.date);
    }
  }, [formData.date, mentor]);

  const fetchBookedTimes = async (selectedDate) => {
    const realMentorId = mentor.mentor_id || mentor.id;
    const { data } = await supabase
      .from('mentor_bookings')
      .select('booking_time')
      .eq('mentor_id', realMentorId)
      .eq('booking_date', selectedDate)
      .neq('status', 'rejected');

    if (data) {
      setBookedTimes(data.map(b => b.booking_time));
    }
  };

  const fetchMentorAndQuota = async () => {
    setLoading(true);
    try {
      // 1. Fetch Mentor Details
      let mentorData = null;
      const { data: mData } = await supabase
        .from('mentors')
        .select('id, mentor_id, full_name, email, expertise, avatar_url')
        .or(`id.eq.${id},mentor_id.eq.${id}`)
        .maybeSingle();

      if (mData) {
        mentorData = mData;
      } else {
        // Fallback: Lấy từ bảng profiles nếu chưa có dòng dữ liệu trong mentors
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url')
          .eq('id', id)
          .maybeSingle();

        if (pData) {
          mentorData = {
            id: pData.id,
            mentor_id: pData.id,
            full_name: pData.full_name || pData.email?.split('@')[0] || 'Mentor Chuyên gia',
            email: pData.email,
            expertise: 'Chuyên gia Phỏng vấn / Career Mentor',
            avatar_url: pData.avatar_url
          };
        }
      }

      if (mentorData) {
        setMentor(mentorData);
      }

      // 2. Check Quota limit
      let limit = profile?.planLimits?.max_mentor_bookings || 0;

      if (limit === 0) {
        setQuotaStatus({ allowed: false, used: 0, limit: 0, loading: false });
        setLoading(false);
        return;
      }

      // Fetch user's bookings within current billing cycle (simplified: last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count } = await supabase
        .from('mentor_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const used = count || 0;
      setQuotaStatus({
        allowed: used < limit,
        used,
        limit,
        loading: false
      });

    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quotaStatus.allowed) return;

    setSubmitting(true);
    try {
      const realMentorId = mentor.mentor_id || mentor.id; // Tùy cột nào là UUID thật của mentor

      const { error } = await supabase
        .from('mentor_bookings')
        .insert([{
          mentor_id: realMentorId,
          candidate_id: user.id,
          candidate_name: profile?.full_name || user.user_metadata?.full_name || 'Ứng viên',
          booking_date: formData.date,
          booking_time: formData.time,
          topic: formData.topic,
          status: 'pending'
        }]);

      if (error) throw error;

      // --- GỬI EMAIL THÔNG BÁO CHO MENTOR BẰNG EMAILJS ---
      // LƯU Ý: Bạn cần thay thế các thông số bên dưới bằng cấu hình từ tài khoản EmailJS của bạn!
      try {
        await emailjs.send(
          'service_gez0q8c',   // Thay bằng Service ID của bạn (VD: service_xyz)
          'template_5pfbfv9',  // Thay bằng Template ID của bạn (VD: template_abc)
          {
            to_email: mentor.email,
            to_name: mentor.full_name,
            from_name: profile?.full_name || user.email,
            candidate_email: user.email,
            candidate_phone: profile?.phone || 'Chưa cập nhật',
            candidate_cv: profile?.cv_url || 'Chưa cập nhật',
            booking_date: formData.date,
            booking_time: formData.time,
            topic: formData.topic,
          },
          're2APjqzHgowc4gPV'    // Thay bằng Public Key của bạn
        );
        console.log("Đã gửi email thành công!");
      } catch (emailError) {
        console.error("Lỗi khi gửi email:", emailError);
        const errorDetail = emailError.text || emailError.message || JSON.stringify(emailError);
        toast.error(`Lịch đã được đặt nhưng có lỗi khi gửi email thông báo tự động. Chi tiết lỗi EmailJS: ${errorDetail}`);
      }

      // 1. Gửi thông báo cho Mentor
      await supabase.from('notifications').insert([{
        user_id: realMentorId,
        title: 'Có lịch hẹn mới!',
        content: `Ứng viên ${profile?.full_name || user.email} vừa đặt lịch hẹn với bạn vào ${formData.time} ngày ${formData.date}.`,
        type: 'info',
        action_link: '/mentor/schedule'
      }]);

      // 2. Gửi thông báo cho Ứng viên
      await supabase.from('notifications').insert([{
        user_id: user.id,
        title: 'Đặt lịch thành công',
        content: `Bạn đã đặt lịch hẹn thành công với Mentor ${mentor.full_name} vào ${formData.time} ngày ${formData.date}.`,
        type: 'success',
        action_link: '/my-bookings'
      }]);

      toast.success('Đặt lịch thành công! Đã gửi thông báo đến Mentor.');
      navigate('/my-bookings');

    } catch (err) {
      console.error('Lỗi khi đặt lịch:', err);
      toast.error('Đã xảy ra lỗi khi đặt lịch: ' + (err.message || 'Vui lòng kiểm tra lại SQL schema'));
    } finally {
      setSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  if (loading) {
    return <div style={{ paddingTop: '150px', textAlign: 'center', minHeight: '100vh' }}>Đang tải thông tin...</div>;
  }

  if (!mentor) {
    return (
      <div className="container" style={{ paddingTop: '150px', textAlign: 'center' }}>
        <h2>Không tìm thấy Mentor</h2>
        <Link to="/mentors" className="btn btn--primary" style={{ marginTop: '1rem' }}>Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="section animate-fade" style={{ background: 'var(--color-cream)', minHeight: '100vh', paddingTop: '120px' }}>
      <motion.div 
        className="container" 
        style={{ maxWidth: '800px' }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div variants={itemVariants}>
          <Link 
            to="/mentors" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: 'var(--color-charcoal)', 
            textDecoration: 'none', 
            marginBottom: '2.5rem', 
            fontWeight: 700, 
            fontSize: '1rem',
            padding: '0.6rem 1.25rem',
            background: 'var(--color-surface)',
            borderRadius: '50px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
            border: '1px solid var(--border-color)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          }} 
          onMouseOver={e => {
            e.currentTarget.style.color = '#EA580C';
            e.currentTarget.style.borderColor = 'rgba(234, 88, 12, 0.3)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(234, 88, 12, 0.1)';
            e.currentTarget.querySelector('svg').style.transform = 'translateX(-4px)';
          }} 
          onMouseOut={e => {
            e.currentTarget.style.color = 'var(--color-charcoal)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)';
            e.currentTarget.querySelector('svg').style.transform = 'translateX(0)';
          }}
        >
          <ArrowLeft size={18} style={{ transition: 'transform 0.3s ease' }} /> Quay lại danh sách Mentor
        </Link>
        </motion.div>

        <motion.div className="glass-card" style={{ padding: '0', overflow: 'hidden' }} variants={itemVariants}>

          {/* Mentor Summary Header */}
          <div style={{ padding: '2rem', background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'white', overflow: 'hidden', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
              {mentor.avatar_url ? (
                <img src={mentor.avatar_url} alt={mentor.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  <User size={32} />
                </div>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem', color: 'var(--color-charcoal)', letterSpacing: '-0.5px' }}>Đặt Lịch Với {mentor.full_name}</h1>
              <p style={{ color: '#EA580C', fontWeight: 600, margin: 0 }}>{mentor.expertise}</p>
            </div>
          </div>

          <div style={{ padding: '2rem' }}>

            {/* Quota Notice */}
            {!quotaStatus.loading && (
              <motion.div variants={itemVariants} style={{
                padding: '1.5rem', 
                borderRadius: '16px', 
                marginBottom: '2.5rem', 
                display: 'flex', 
                gap: '1.25rem', 
                alignItems: 'center',
                background: currentPlan === 'Free' 
                  ? 'linear-gradient(145deg, #fef2f2, #fee2e2)' 
                  : (quotaStatus.allowed ? 'linear-gradient(145deg, #f0fdf4, #dcfce7)' : 'linear-gradient(145deg, #fffbeb, #fef3c7)'),
                border: `1px solid ${currentPlan === 'Free' ? '#fca5a5' : (quotaStatus.allowed ? '#bbf7d0' : '#fde68a')}`,
                boxShadow: '0 10px 25px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: currentPlan === 'Free' ? '#fecaca' : (quotaStatus.allowed ? '#bbf7d0' : '#fde68a'),
                  color: currentPlan === 'Free' ? '#dc2626' : (quotaStatus.allowed ? '#16a34a' : '#d97706')
                }}>
                  {currentPlan === 'Free' ? (
                    <AlertCircle size={24} />
                  ) : quotaStatus.allowed ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <AlertCircle size={24} />
                  )}
                </div>

                <div>
                  <h4 style={{ 
                    margin: '0 0 0.35rem 0', 
                    color: currentPlan === 'Free' ? '#991b1b' : (quotaStatus.allowed ? '#166534' : '#92400e'),
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {currentPlan === 'Free' ? 'Bạn cần nâng cấp gói' : `Gói hiện tại: ${currentPlan}`}
                  </h4>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.95rem', 
                    color: currentPlan === 'Free' ? '#b91c1c' : (quotaStatus.allowed ? '#15803d' : '#b45309'),
                    lineHeight: 1.5,
                    fontWeight: 500
                  }}>
                    {currentPlan === 'Free'
                      ? 'Tính năng đặt lịch hẹn 1-on-1 với Mentor chỉ dành cho thành viên có lượt đặt lịch trong gói.'
                      : `Bạn đã sử dụng ${quotaStatus.used}/${quotaStatus.limit} lượt đặt lịch trong chu kỳ này.`
                    }
                  </p>

                  {currentPlan === 'Free' && (
                    <Link to="/pricing" style={{ 
                      display: 'inline-block',
                      marginTop: '1rem', 
                      fontSize: '0.9rem', 
                      padding: '0.6rem 1.25rem',
                      background: '#dc2626',
                      color: 'white',
                      borderRadius: '50px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 10px rgba(220, 38, 38, 0.3)'
                    }}
                    onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={e => e.target.style.transform = 'translateY(0)'}
                    >
                      Xem các gói dịch vụ
                    </Link>
                  )}
                </div>
              </motion.div>
            )}

            {/* Booking Form */}
            {currentPlan !== 'Free' && quotaStatus.allowed && (
              <motion.form variants={itemVariants} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>

                  <div className="auth-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-charcoal)' }}><Calendar size={18} color="#EA580C" /> Ngày muốn hẹn *</label>
                    <DatePicker
                      locale="vi"
                      selected={formData.date ? new Date(formData.date) : null}
                      onChange={date => {
                        if (date) {
                          const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
                          setFormData({ ...formData, date: dateStr, time: '' });
                        } else {
                          setFormData({ ...formData, date: '', time: '' });
                        }
                      }}
                      minDate={new Date()}
                      dateFormat="dd/MM/yyyy"
                      className="custom-date-input"
                      placeholderText="Chọn ngày"
                      required
                    />
                  </div>

                  <div className="auth-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-charcoal)' }}><Clock size={18} color="#EA580C" /> Giờ muốn hẹn *</label>
                    
                    {!formData.date ? (
                      <div style={{ padding: '0.9rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                        Vui lòng chọn ngày trước
                      </div>
                    ) : getAvailableTimeSlots().length === 0 ? (
                      <div style={{ padding: '0.9rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                        Đã hết khung giờ trống
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
                          {getAvailableTimeSlots().map(timeSlot => {
                            const isBooked = bookedTimes.includes(timeSlot);
                            const isSelected = formData.time === timeSlot;
                            return (
                              <div
                                key={timeSlot}
                                onClick={() => !isBooked && setFormData({ ...formData, time: timeSlot })}
                                style={{
                                  padding: '0.6rem 0.25rem',
                                  textAlign: 'center',
                                  borderRadius: '8px',
                                  border: isSelected ? '2px solid #EA580C' : '1px solid var(--border-color)',
                                  background: isSelected ? 'rgba(234, 88, 12, 0.1)' : (isBooked ? 'rgba(0,0,0,0.03)' : 'var(--color-surface)'),
                                  color: isSelected ? '#EA580C' : (isBooked ? 'var(--color-text-muted)' : 'var(--color-charcoal)'),
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: isBooked ? 'not-allowed' : 'pointer',
                                  fontSize: '0.85rem',
                                  transition: 'all 0.2s',
                                  opacity: isBooked ? 0.6 : 1
                                }}
                                onMouseOver={(e) => { if(!isBooked && !isSelected) e.currentTarget.style.borderColor = '#EA580C'; }}
                                onMouseOut={(e) => { if(!isBooked && !isSelected) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                              >
                                {timeSlot}
                              </div>
                            )
                          })}
                        </div>
                        {/* Hidden input to keep HTML5 form validation working */}
                        <input type="text" style={{ opacity: 0, position: 'absolute', height: 0, width: 0, pointerEvents: 'none' }} value={formData.time} required onChange={() => {}} />
                      </>
                    )}
                  </div>
                </div>

                <div className="auth-form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-charcoal)' }}><MessageSquare size={18} color="#EA580C" /> Chủ đề muốn trao đổi *</label>
                  <textarea
                    style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--color-surface)', fontSize: '1rem', outline: 'none', color: 'var(--color-text)', minHeight: '120px', resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                    placeholder=""
                    required
                    value={formData.topic}
                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                  />
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.75rem', lineHeight: 1.5 }}>
                    Mentor sẽ nhận được email chứa thông tin liên hệ và link CV của bạn. Hãy ghi rõ mong muốn để Mentor chuẩn bị tốt nhất.
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ 
                    padding: '1rem', fontSize: '1.1rem', marginTop: '1rem', borderRadius: '50px',
                    background: '#EA580C', color: '#fff', border: 'none', fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)', transition: 'all 0.3s ease',
                    opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                  }}
                  onMouseOver={(e) => { if(!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)'; } }}
                  onMouseOut={(e) => { if(!submitting) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'; } }}
                  disabled={submitting}
                >
                  {submitting ? 'Đang gửi yêu cầu...' : 'Xác Nhận Đặt Lịch'}
                </button>
              </motion.form>
            )}

          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BookMentor;

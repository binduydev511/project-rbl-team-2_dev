import React, { useState } from 'react';
import { CheckCircle, Zap, Shield, Crown, Star, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import PaymentModal from '../../components/PaymentModal';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useConfirm } from '../../utils/ConfirmContext';

const PricingPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [currentPlan, setCurrentPlan] = useState(profile?.plan || 'Free');
  const [usageCount, setUsageCount] = useState(profile?.question_bank_usage_count || 0);
  const [planDaysLeft, setPlanDaysLeft] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [orderCode, setOrderCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbPlans, setDbPlans] = useState([]);
  const confirm = useConfirm();

  const location = useLocation();
  const navigate = useNavigate();
  const isExchangeMode = new URLSearchParams(location.search).get('mode') === 'exchange';
  const currentPoints = profile?.points || 0;

  React.useEffect(() => {
    if (user && profile) {
      let dbPlan = profile.plan || 'Free';
      let daysLeft = null;
      
      // Check expiration from DB
      if (profile.plan_expires_at && dbPlan !== 'Free') {
        const expires = new Date(profile.plan_expires_at);
        const now = new Date();
        const diffTime = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
        if (expires <= now) {
          dbPlan = 'Free';
        } else {
          daysLeft = diffTime;
        }
      }
      setCurrentPlan(dbPlan);
      setPlanDaysLeft(daysLeft);

      const fetchLatestUsage = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('question_bank_usage_count')
            .eq('id', user.id)
            .single();
          if (!error && data) {
            setUsageCount(data.question_bank_usage_count || 0);
          }
        } catch (err) {}
      };
      fetchLatestUsage();
    }

    const fetchPlans = async () => {
      const { data } = await supabase.from('subscription_plans').select('*');
      if (data) setDbPlans(data);
    };
    fetchPlans();
  }, [user, profile]);

  const getPlanLimits = (planName) => {
    const p = dbPlans.find(plan => plan.name.toLowerCase() === planName.toLowerCase());
    return {
      price: p?.price ?? (planName === 'Free' ? 0 : (planName === 'Pro' ? 5000 : 10000)),
      duration_days: p?.duration_days ?? (planName === 'Free' ? 0 : (planName === 'Pro' ? 14 : 30)),
      max_ai_interviews: p?.max_ai_interviews || (planName === 'Free' ? 1 : (planName === 'Pro' ? 5 : 30)),
      max_questions: p?.max_questions || (planName === 'Free' ? 5 : (planName === 'Pro' ? 10 : 999)),
      max_mentor_bookings: p?.max_mentor_bookings || (planName === 'Free' ? 0 : (planName === 'Pro' ? 1 : 5))
    };
  };

  // CẤU HÌNH THÔNG TIN NGÂN HÀNG CỦA BẠN TẠI ĐÂY
  const BANK_ID = 'TPBank'; // Tên viết tắt hoặc BIN của ngân hàng (VD: MB, VCB, TCB)
  const BANK_ACCOUNT = '00004335607'; // Số tài khoản của bạn
  const ACCOUNT_NAME = 'NGUYEN QUANG MINH'; // Tên chủ tài khoản

  const handleUpgrade = async (planName) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để nâng cấp gói dịch vụ!');
      return;
    }

    setIsProcessing(true);
    const code = 'RBL' + Math.floor(100000 + Math.random() * 900000); // Sinh mã dạng RBL123456
    const planLimits = getPlanLimits(planName);
    const price = planLimits.price;

    // Lưu vào CSDL
    const { error } = await supabase.from('orders').insert([{
      user_id: user.id,
      plan_name: planName,
      price: price,
      order_code: code,
      status: 'pending'
    }]);

    setIsProcessing(false);

    if (error) {
      toast.error('Lỗi khi tạo đơn hàng: ' + error.message);
    } else {
      setSelectedPlan({ name: planName, price: price });
      setOrderCode(code);
      setShowPayment(true);
    }
  };

  const handleExchange = async (planName) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập!');
      return;
    }
    
    const cost = planName === 'Pro' ? 300 : 500;
    if (currentPoints < cost) {
      toast.error(`Bạn không đủ điểm! Cần ${cost} điểm, bạn đang có ${currentPoints} điểm.`);
      return;
    }
    
    confirm({
      title: 'Xác nhận đổi gói',
      message: `Bạn có chắc chắn muốn dùng <strong style="color: #f59e0b; font-size: 1.1rem">${cost} điểm</strong> để đổi lấy gói <strong style="color: var(--primary)">${planName}</strong> không?`,
      confirmText: 'Xác nhận đổi',
      onConfirm: async () => {
        setIsProcessing(true);
        const planLimits = getPlanLimits(planName);
        const durationDays = planLimits.duration_days;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        
        try {
          const { error } = await supabase.from('profiles').update({
            plan: planName,
            plan_expires_at: expiresAt.toISOString(),
            points: Math.max(0, currentPoints - cost)
          }).eq('id', user.id);
          
          if (error) throw error;
          
          const storageKey = `ita_user_data_${user.id}`;
          let savedData = JSON.parse(localStorage.getItem(storageKey));
          if (savedData) {
            savedData.points = Math.max(0, savedData.points - cost);
            localStorage.setItem(storageKey, JSON.stringify(savedData));
          }
          
          await supabase.from('notifications').insert([{
            user_id: user.id,
            title: 'Nâng cấp thành công 🎉',
            content: `Chúc mừng bạn đã dùng điểm đổi thành công gói ${planName}. Cảm ơn bạn đã tin tưởng dịch vụ!`,
            type: 'system',
            is_read: false,
            action_link: '/profile?tab=payment'
          }]);
          
          toast.success(`Đổi gói thành công! Bạn đã được cấp gói ${planName}.`);
          await refreshProfile();
          navigate('/dashboard');
        } catch (err) {
          console.error('Lỗi khi đổi gói:', err);
          toast.error('Có lỗi xảy ra: ' + err.message);
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      className="container animate-fade" 
      style={{ paddingTop: '120px', paddingBottom: 'var(--spacing-xl)', textAlign: 'center' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header variants={itemVariants} style={{ marginBottom: '3rem' }}>
        <h1 style={{ 
          fontSize: '2.8rem', 
          fontWeight: 800, 
          textTransform: 'uppercase', 
          color: 'var(--color-charcoal)', 
          letterSpacing: '-1px',
          marginBottom: '1rem',
          lineHeight: 1.2
        }}>
          {isExchangeMode ? <><span style={{ color: '#EA580C' }}>Đổi Điểm</span> Nhận Gói Dịch Vụ</> : <>Nâng cấp <span style={{ color: '#EA580C' }}>Trải nghiệm</span> của bạn</>}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto', fontWeight: 500 }}>
          {isExchangeMode 
            ? `Sử dụng điểm tích lũy của bạn để đổi lấy các gói đặc quyền. Bạn đang có ${currentPoints} điểm.` 
            : `Chọn gói phù hợp để mở khóa toàn bộ tính năng phỏng vấn AI và bộ câu hỏi chuyên sâu.`}
        </p>
        {user && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ padding: '0.5rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: '50px', fontSize: '0.95rem', color: 'var(--color-charcoal)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              {['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase()) 
                ? 'Tài khoản đặc quyền (Không giới hạn)'
                : `Gói hiện tại: ${currentPlan} ${planDaysLeft !== null ? `(Còn ${planDaysLeft} ngày)` : ''}`
              }
            </div>
          </div>
        )}
      </motion.header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'center' }}>
        {/* Free Plan */}
        <motion.div variants={itemVariants} className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--color-charcoal)', fontWeight: 800, textTransform: 'uppercase' }}>Gói Free</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-charcoal)' }}>{getPlanLimits('Free').price === 0 ? '0đ' : `${getPlanLimits('Free').price.toLocaleString('vi-VN')}đ`} <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{getPlanLimits('Free').duration_days === 0 ? '/ Vĩnh viễn' : `/${getPlanLimits('Free').duration_days} ngày`}</span></div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            <FeatureItem text={`${getPlanLimits('Free').max_ai_interviews} lượt luyện tập với AI`} />
            <FeatureItem text={`${getPlanLimits('Free').max_questions > 900 ? 'Không giới hạn' : getPlanLimits('Free').max_questions} lượt luyện tập question`} />
          </ul>
          <button style={{
            width: '100%', padding: '1rem', borderRadius: '50px', border: '1px solid var(--border-color)',
            background: 'var(--color-surface)', color: 'var(--color-charcoal)', fontWeight: 700, cursor: 'default',
            transition: 'all 0.3s ease', marginTop: 'auto', fontSize: '1.05rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}
          disabled={currentPlan === 'Free' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())}
          >
            {['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase()) ? 'Không giới hạn' : (currentPlan === 'Free' ? 'Gói hiện tại' : 'Đang sử dụng gói cao hơn')}
          </button>
        </motion.div>

        {/* Pro Plan */}
        <motion.div variants={itemVariants} className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'left', border: '2px solid #EA580C', scale: 1.05, position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', zIndex: 10, borderRadius: '24px', boxShadow: '0 20px 40px rgba(234, 88, 12, 0.15)' }}>
          <div style={{ 
            position: 'absolute', 
            top: '-30px', 
            right: '1rem', 
            width: '135px', 
            height: '75px', 
            background: 'url(/cloud02.svg) center/contain no-repeat', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '0.95rem', 
            fontWeight: 900, 
            fontFamily: "'Nunito', 'Quicksand', system-ui, sans-serif",
            textTransform: 'uppercase', 
            letterSpacing: '1.5px', 
            zIndex: 20, 
            textShadow: '1px 2px 4px rgba(194, 65, 12, 0.6)',
            transform: 'rotate(6deg)'
          }}>
            Phổ Biến
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Zap color="#EA580C" size={24} />
              <h3 style={{ fontSize: '1.8rem', margin: 0, color: '#EA580C', fontWeight: 800, textTransform: 'uppercase' }}>Pro</h3>
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-charcoal)', lineHeight: 1 }}>
              {isExchangeMode ? '300 điểm' : `${getPlanLimits('Pro').price.toLocaleString('vi-VN')}đ`} <span style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{getPlanLimits('Pro').duration_days === 0 ? '/ Vĩnh viễn' : `/${getPlanLimits('Pro').duration_days} ngày`}</span>
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            <FeatureItem text={`${getPlanLimits('Pro').max_ai_interviews} lượt luyện tập với AI`} />
            <FeatureItem text={`${getPlanLimits('Pro').max_questions > 900 ? 'Không giới hạn' : getPlanLimits('Pro').max_questions} lượt luyện tập question`} />
            <FeatureItem text={`Đặt lịch mentor ${getPlanLimits('Pro').max_mentor_bookings} lần`} />
          </ul>
          <button style={{
            width: '100%', padding: '1rem', borderRadius: '50px', border: 'none',
            background: 'linear-gradient(135deg, #EA580C, #c2410c)', color: 'white', fontWeight: 700, fontSize: '1.05rem',
            cursor: (currentPlan === 'Pro' || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 'default' : 'pointer', marginTop: 'auto',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', opacity: (currentPlan === 'Pro' || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 0.7 : 1,
            boxShadow: (currentPlan === 'Pro' || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 'none' : '0 10px 25px rgba(234, 88, 12, 0.3)'
          }}
          onMouseOver={(e) => { if(currentPlan !== 'Pro' && currentPlan !== 'Premium' && !['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) e.target.style.transform = 'translateY(-3px)'; }}
          onMouseOut={(e) => { if(currentPlan !== 'Pro' && currentPlan !== 'Premium' && !['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) e.target.style.transform = 'translateY(0)'; }}
          onClick={() => {
            if (currentPlan === 'Pro' || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) return;
            if (isExchangeMode) handleExchange('Pro');
            else handleUpgrade('Pro');
          }} disabled={isProcessing || currentPlan === 'Pro' || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())}
          >
            {['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase()) ? 'Không giới hạn' : (isProcessing ? 'Đang xử lý...' : (currentPlan === 'Premium' ? 'Đang sử dụng gói cao hơn' : (currentPlan === 'Pro' ? 'Đang sử dụng' : (isExchangeMode ? 'Đổi 300 điểm' : 'Nâng cấp Pro'))))}
          </button>
        </motion.div>

        {/* Premium Plan */}
        <motion.div variants={itemVariants} className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Crown color="#d97706" size={24} />
              <h3 style={{ fontSize: '1.5rem', margin: 0, color: '#d97706', fontWeight: 800, textTransform: 'uppercase' }}>Premium</h3>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-charcoal)' }}>
              {isExchangeMode ? '500 điểm' : `${getPlanLimits('Premium').price.toLocaleString('vi-VN')}đ`} <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{getPlanLimits('Premium').duration_days === 0 ? '/ Vĩnh viễn' : `/${getPlanLimits('Premium').duration_days} ngày`}</span>
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            <FeatureItem text={`${getPlanLimits('Premium').max_ai_interviews} lượt luyện tập với AI`} />
            <FeatureItem text={`${getPlanLimits('Premium').max_questions > 900 ? 'Không giới hạn' : getPlanLimits('Premium').max_questions} lượt luyện tập question`} />
            <FeatureItem text={`Đặt lịch mentor ${getPlanLimits('Premium').max_mentor_bookings} lần`} />
          </ul>
          <button style={{
            width: '100%', padding: '1rem', borderRadius: '50px', border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 700, fontSize: '1.05rem',
            cursor: (currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 'default' : 'pointer', marginTop: 'auto',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', opacity: (currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 0.7 : 1,
            boxShadow: (currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) ? 'none' : '0 10px 25px rgba(245, 158, 11, 0.3)'
          }}
          onMouseOver={(e) => { if(currentPlan !== 'Premium' && !['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) e.target.style.transform = 'translateY(-3px)'; }}
          onMouseOut={(e) => { if(currentPlan !== 'Premium' && !['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) e.target.style.transform = 'translateY(0)'; }}
          onClick={() => {
            if (currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())) return;
            if (isExchangeMode) handleExchange('Premium');
            else handleUpgrade('Premium');
          }}
          disabled={isProcessing || currentPlan === 'Premium' || ['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase())}
          >
            {['admin', 'company', 'recruiter', 'mentor'].includes(profile?.role?.toLowerCase()) ? 'Không giới hạn' : (isProcessing ? 'Đang xử lý...' : (currentPlan === 'Premium' ? 'Đang sử dụng' : (isExchangeMode ? 'Đổi 500 điểm' : 'Nâng cấp Premium')))}
          </button>
        </motion.div>
      </div>

      {showPayment && selectedPlan && (
        <PaymentModal
          planName={selectedPlan.name}
          price={selectedPlan.price}
          orderCode={orderCode}
          bankId={BANK_ID}
          bankAccount={BANK_ACCOUNT}
          accountName={ACCOUNT_NAME}
          onClose={() => setShowPayment(false)}
          onSuccess={async () => {
            const planLimits = getPlanLimits(selectedPlan.name);
            const durationDays = planLimits.duration_days;
            const expiresAt = new Date();
            if (durationDays > 0) {
              expiresAt.setDate(expiresAt.getDate() + durationDays);
            }
            
            try {
              await supabase.from('profiles').update({
                plan: selectedPlan.name,
                plan_expires_at: durationDays > 0 ? expiresAt.toISOString() : null
              }).eq('id', user.id);

              // Tạo thông báo thanh toán thành công
              await supabase.from('notifications').insert([{
                user_id: user.id,
                title: 'Thanh toán thành công 🎉',
                content: `Chúc mừng bạn đã nâng cấp thành công lên gói ${selectedPlan.name}. Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi!`,
                type: 'success',
                is_read: false,
                action_link: '/profile?tab=payment'
              }]);
            } catch (err) {
              console.error('Lỗi khi nâng cấp DB:', err);
            }

            toast.success(`Thanh toán thành công! Hạng thành viên của bạn đã được nâng cấp lên ${selectedPlan.name}.`);
            await refreshProfile();
            setShowPayment(false);
            navigate('/dashboard');
          }}
        />
      )}
    </motion.div>
  );
};

const FeatureItem = ({ text }) => (
  <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-charcoal)', fontWeight: 500, fontSize: '1.05rem' }}>
    <CheckCircle size={20} color="#EA580C" />
    <span>{text}</span>
  </li>
);

export default PricingPage;

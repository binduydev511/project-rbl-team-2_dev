import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, CheckCircle, Loader, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

const PaymentModal = ({ planName, price, orderCode, bankAccount, bankId, accountName, onClose, onSuccess }) => {
  const [status, setStatus] = useState('pending'); // pending, success, failed, expired
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes

  useEffect(() => {
    if (status !== 'pending') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const handleExpire = async () => {
    setStatus('expired');
    try {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('order_code', orderCode);
    } catch (err) {
      console.error('Error cancelling order', err);
    }
  };

  useEffect(() => {
    // Đăng ký lắng nghe Realtime từ bảng orders
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `order_code=eq.${orderCode}`
        },
        (payload) => {
          if (payload.new.status === 'paid') {
            setStatus('success');
            setTimeout(() => {
              onSuccess();
            }, 3000); // Đóng modal sau 3s
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderCode, onSuccess]);

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${price}&addInfo=${orderCode}&accountName=${encodeURIComponent(accountName)}`;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={modalOverlayStyle}>
      <div className="animate-fade" style={modalContentStyle}>
        <button onClick={onClose} style={closeBtnStyle}><X size={24} /></button>
        
        {status === 'pending' ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', color: '#4f46e5', padding: '0.5rem 1rem', borderRadius: '9999px', fontWeight: 'bold', fontSize: '0.85rem', gap: '0.5rem' }}>
                  <ShieldCheck size={16} /> Thanh toán An toàn
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '9999px', fontWeight: 'bold', fontSize: '0.85rem', gap: '0.5rem' }}>
                  <Clock size={16} /> Hết hạn sau {formatTime(timeLeft)}
                </div>
              </div>
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.75rem', fontWeight: '800' }}>Nâng cấp {planName}</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>Quét mã QR bằng ứng dụng ngân hàng của bạn</p>
            </div>
            
            <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '16px', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', border: '1px solid #f1f5f9' }}>
              <img src={qrUrl} alt="Payment QR Code" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }} />
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <DetailRow label="Ngân hàng" value={<span style={{ fontWeight: '700', color: '#334155' }}>{bankId}</span>} />
              <DetailRow label="Số tài khoản" value={<span style={{ fontWeight: '700', color: '#334155' }}>{bankAccount}</span>} />
              <DetailRow label="Chủ tài khoản" value={<span style={{ fontWeight: '700', color: '#334155' }}>{accountName}</span>} />
              <div style={{ height: '1px', background: '#cbd5e1', margin: '0.75rem 0' }} />
              <DetailRow label="Số tiền" value={<span style={{ color: '#4f46e5', fontWeight: '800', fontSize: '1.1rem' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)}</span>} />
              <DetailRow label="Nội dung chuyển khoản" value={<span style={{ background: '#fef3c7', color: '#d97706', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '800', letterSpacing: '1px', fontFamily: 'monospace', fontSize: '1rem' }}>{orderCode}</span>} />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#64748b', fontSize: '0.9rem', background: '#f1f5f9', padding: '0.85rem', borderRadius: '8px' }}>
              <Loader size={18} className="animate-spin" color="#4f46e5" />
              <span style={{ fontWeight: '500' }}>Hệ thống đang chờ nhận thanh toán...</span>
            </div>
          </div>
        ) : status === 'expired' ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ display: 'inline-flex', background: '#fef2f2', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <AlertTriangle size={64} color="#ef4444" />
            </div>
            <h2 style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '800' }}>Mã Thanh toán Hết hạn</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              Phiên giao dịch này đã quá 15 phút và đã bị hủy.<br/>Vui lòng đóng hộp thoại và thử tạo lại một giao dịch mới.
            </p>
            <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', padding: '0.75rem 2rem', borderRadius: '50px', border: 'none', fontWeight: '600', fontSize: '1rem', cursor: 'pointer' }}>Đóng lại</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ display: 'inline-flex', background: '#dcfce7', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <CheckCircle size={64} color="#16a34a" />
            </div>
            <h2 style={{ color: '#16a34a', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '800' }}>Thanh toán Thành công!</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5' }}>
              Gói dịch vụ <strong>{planName}</strong> của bạn đã được kích hoạt.<br/>Hệ thống đang tự động chuyển hướng...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
    <span style={{ color: '#64748b' }}>{label}</span>
    <span style={{ textAlign: 'right' }}>{value}</span>
  </div>
);

const closeBtnStyle = { position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#f1f5f9', border: 'none', color: '#64748b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
};
const modalContentStyle = { 
  position: 'relative', width: '90%', maxWidth: '480px', 
  padding: '2.5rem 2rem', textAlign: 'left',
  background: '#ffffff', borderRadius: '24px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  maxHeight: '95vh', overflowY: 'auto'
};

export default PaymentModal;

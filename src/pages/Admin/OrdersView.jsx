import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { RefreshCw, Search, CheckCircle, Clock, XCircle, DollarSign, Filter, TrendingUp, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
};

const OrdersView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const selectedYear = new Date().getFullYear();

  const fetchOrders = async () => {
    setLoading(true);
    // Lấy danh sách giao dịch, sắp xếp mới nhất lên đầu
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        id, user_id, plan_name, price, order_code, status, created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Lỗi khi tải lịch sử thanh toán: ' + error.message);
    } else {
      const ordersList = ordersData || [];
      const userIds = [...new Set(ordersList.map(order => order.user_id).filter(Boolean))];
      
      let profilesMap = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
          
        if (!profilesError && profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
        }
      }

      const mergedOrders = ordersList.map(order => ({
        ...order,
        profiles: profilesMap[order.user_id] || null
      }));

      setOrders(mergedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchSearch = (order.order_code && order.order_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.user_id && order.user_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.profiles?.full_name && order.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.profiles?.email && order.profiles.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.plan_name && order.plan_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchMonth = selectedMonth ? order.created_at?.startsWith(selectedMonth) : true;
    return matchSearch && matchMonth;
  });

  const stats = {
    totalRevenue: filteredOrders.reduce((sum, order) => order.status === 'paid' ? sum + order.price : sum, 0),
    totalOrders: filteredOrders.length,
    successfulOrders: filteredOrders.filter(o => o.status === 'paid').length
  };
  const successRate = stats.totalOrders > 0 ? Math.round((stats.successfulOrders / stats.totalOrders) * 100) : 0;

  const getStatusBadge = (status) => {
    switch(status) {
      case 'paid':
        return <span style={{ ...badgeStyle, background: 'rgba(50, 200, 100, 0.2)', color: '#32c864' }}><CheckCircle size={14} /> Đã thanh toán</span>;
      case 'pending':
        return <span style={{ ...badgeStyle, background: 'rgba(255, 150, 50, 0.2)', color: '#ff9632' }}><Clock size={14} /> Chờ thanh toán</span>;
      case 'cancelled':
        return <span style={{ ...badgeStyle, background: 'rgba(255, 50, 50, 0.2)', color: '#ff3232' }}><XCircle size={14} /> Đã hủy</span>;
      default:
        return <span style={{ ...badgeStyle, background: 'rgba(150, 150, 150, 0.2)', color: '#999' }}>{status}</span>;
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ position: 'relative' }}>
      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-charcoal)', letterSpacing: '-0.5px', margin: 0, fontFamily: 'var(--font-heading)' }}>
          Lịch sử thanh toán ({filteredOrders.length})
        </h2>
        <button 
          onClick={fetchOrders} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            background: 'linear-gradient(135deg, #EA580C, #C2410C)',
            color: '#ffffff',
            fontWeight: '600',
            padding: '0.7rem 1.4rem',
            borderRadius: '12px',
            border: 'none', 
            boxShadow: '0 4px 15px rgba(234, 88, 12, 0.2)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.3)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(234, 88, 12, 0.2)'; }}
          title="Làm mới"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Làm mới
        </button>
      </motion.div>

      <motion.div variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={statCardStyle}>
          <div style={statIconStyle('rgba(34, 197, 94, 0.15)', '#22c55e')}><TrendingUp size={24} /></div>
          <div>
            <div style={statLabelStyle}>Tổng doanh thu</div>
            <div style={statValueStyle}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.totalRevenue)}</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle('rgba(59, 130, 246, 0.15)', '#3b82f6')}><ShoppingBag size={24} /></div>
          <div>
            <div style={statLabelStyle}>Tổng đơn hàng</div>
            <div style={statValueStyle}>{stats.totalOrders} đơn</div>
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconStyle('rgba(234, 88, 12, 0.15)', '#ea580c')}><CheckCircle size={24} /></div>
          <div>
            <div style={statLabelStyle}>Tỷ lệ thành công</div>
            <div style={statValueStyle}>{successRate}% ({stats.successfulOrders} đơn)</div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card" style={{ padding: '2rem', borderRadius: '24px', boxShadow: '0 15px 35px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo mã đơn, gói hoặc ID người dùng..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '3rem', paddingRight: '3rem' }}
            />
            <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedMonth ? '#EA580C' : '#94a3b8', transition: 'color 0.2s' }} 
                title="Lọc theo tháng"
              >
                <Filter size={20} />
              </button>
            </div>
            
            {showDatePicker && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', zIndex: 10, boxShadow: '0 10px 35px rgba(0,0,0,0.1)', width: '300px' }}>
                <div style={{ fontWeight: '700', marginBottom: '1rem', textAlign: 'center', color: '#1e293b', fontSize: '1.05rem' }}>Chọn tháng (Năm {selectedYear})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthStr = (i + 1).toString().padStart(2, '0');
                    const val = `${selectedYear}-${monthStr}`;
                    const isSelected = selectedMonth === val;
                    return (
                      <button 
                        key={val}
                        onClick={() => { setSelectedMonth(isSelected ? '' : val); setShowDatePicker(false); }}
                        style={{
                          padding: '0.6rem 0',
                          borderRadius: '10px',
                          border: isSelected ? 'none' : '1px solid #f1f5f9',
                          background: isSelected ? 'linear-gradient(135deg, #EA580C, #C2410C)' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 'bold' : '600',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? '0 4px 10px rgba(234, 88, 12, 0.2)' : 'none'
                        }}
                        onMouseOver={e => { if (!isSelected) e.target.style.background = '#e2e8f0'; }}
                        onMouseOut={e => { if (!isSelected) e.target.style.background = '#f8fafc'; }}
                      >
                        T{i + 1}
                      </button>
                    );
                  })}
                </div>
                {selectedMonth && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', textAlign: 'center' }}>
                     <button 
                        onClick={() => { setSelectedMonth(''); setShowDatePicker(false); }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem 1.25rem', borderRadius: '99px', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                        onMouseOver={e => e.target.style.background = 'rgba(239, 68, 68, 0.15)'}
                        onMouseOut={e => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                     >
                       <XCircle size={16} /> Bỏ lọc
                     </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(90deg, rgba(234, 88, 12, 0.03), transparent)' }}>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Mã Đơn</th>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Người dùng</th>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Gói dịch vụ</th>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Số tiền</th>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Trạng thái</th>
                  <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: 'bold', color: '#EA580C', letterSpacing: '0.5px' }}>{order.order_code}</td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem' }} title={order.user_id}>
                      {order.profiles?.full_name ? (
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>{order.profiles.full_name}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{order.profiles.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {order.user_id ? order.user_id.substring(0, 8) + '...' : 'N/A'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: '600', color: '#334155' }}>{order.plan_name}</td>
                    <td style={{ padding: '1.25rem 1rem', fontWeight: '600', color: '#1e293b' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.price)}</td>
                    <td style={{ padding: '1.25rem 1rem' }}>{getStatusBadge(order.status)}</td>
                    <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Không tìm thấy giao dịch nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};
const badgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' };

const statCardStyle = { flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: '#ffffff', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const statIconStyle = (bg, color) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: bg, color: color });
const statLabelStyle = { fontSize: '0.95rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600 };
const statValueStyle = { fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' };

export default OrdersView;

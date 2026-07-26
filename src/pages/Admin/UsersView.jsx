import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../utils/supabaseClient';
import { Edit2, Trash2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../utils/ConfirmContext';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
};

const UsersView = () => {
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isEditing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isEditing]);

  const [currentUser, setCurrentUser] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [page, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    
    let query = supabase.from('profiles').select('*', { count: 'exact' });
    
    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
    
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
      
    if (error) {
      toast.error('Lỗi khi tải users: ' + error.message);
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage) || 1);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    confirm({
      title: 'Xóa người dùng',
      message: 'Bạn có chắc chắn muốn xóa người dùng này?',
      isDanger: true,
      confirmText: 'Xóa',
      onConfirm: async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) {
          toast.error('Lỗi khi xóa: ' + error.message);
        } else {
          toast.success('Xóa người dùng thành công');
          if (users.length === 1 && page > 1) {
            setPage(page - 1);
          } else {
            fetchUsers();
          }
        }
      }
    });
  };

  const handleEdit = (u) => {
    // Tự động sửa lỗi dữ liệu cũ nếu role là mentor/recruiter nhưng plan không phải Premium
    let currentPlan = u.plan;
    if (u.role === 'mentor' || u.role === 'recruiter' || u.role === 'Admin' || u.role === 'admin') {
      currentPlan = 'Premium';
    }
    setCurrentUser({ ...u, plan: currentPlan });
    setIsEditing(true);
  };

  const handleAdd = () => {
    setCurrentUser({
      full_name: '',
      email: '',
      role: 'candidate',
      plan: 'Free',
      status: 'Active'
    });
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    const payload = {
      full_name: currentUser.full_name,
      email: currentUser.email,
      role: currentUser.role,
      plan: (currentUser.role === 'mentor' || currentUser.role === 'recruiter' || currentUser.role === 'admin' || currentUser.role === 'Admin') ? 'Premium' : currentUser.plan,
      status: currentUser.status,
      points: Math.max(0, parseInt(currentUser.points || 0, 10))
    };

    if (currentUser.id) {
      // Update
      const originalUser = users.find(u => u.id === currentUser.id);
      if (originalUser && originalUser.plan !== currentUser.plan) {
        if (currentUser.plan === 'Pro') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 14);
          payload.plan_expires_at = expiresAt.toISOString();
        } else if (currentUser.plan === 'Premium') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          payload.plan_expires_at = expiresAt.toISOString();
        } else {
          payload.plan_expires_at = null;
        }
      }

      const { error } = await supabase.from('profiles').update(payload).eq('id', currentUser.id);
      if (error) return toast.error('Lỗi cập nhật: ' + error.message);
      
      // Đồng bộ trạng thái duyệt sang bảng mentors/companies và gửi thông báo nếu Admin thay đổi role
      if (originalUser && originalUser.role !== currentUser.role) {
        const oldRole = originalUser.role.toLowerCase();
        const newRole = currentUser.role.toLowerCase();
        
        let notifTitle = '';
        let notifContent = '';
        let notifType = 'info';

        if (newRole === 'mentor') {
          const { data: existingMentor } = await supabase.from('mentors').select('id').eq('mentor_id', currentUser.id).maybeSingle();
          if (existingMentor) {
            await supabase.from('mentors').update({ status: 'approved' }).eq('mentor_id', currentUser.id);
          } else {
            await supabase.from('mentors').insert({
              mentor_id: currentUser.id,
              full_name: currentUser.full_name,
              email: currentUser.email,
              phone: currentUser.phone || null,
              expertise: 'Chuyên gia Phỏng vấn / Career Mentor',
              bio: 'Chuyên gia tư vấn định hướng nghề nghiệp và hỗ trợ phỏng vấn thử.',
              status: 'approved',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          notifTitle = 'Hồ sơ Mentor đã được duyệt!';
          notifContent = 'Admin đã nâng cấp tài khoản của bạn lên Mentor. Bây giờ bạn có thể truy cập trang quản lý Mentor.';
          notifType = 'success';
        } else if (newRole === 'recruiter') {
          await supabase.from('companies').update({ status: 'approved' }).eq('recruiter_id', currentUser.id);
          notifTitle = 'Hồ sơ Nhà tuyển dụng đã được duyệt!';
          notifContent = 'Admin đã nâng cấp tài khoản của bạn lên Nhà tuyển dụng. Hãy vào cập nhật công ty ngay!';
          notifType = 'success';
        } else if (newRole === 'candidate') {
          if (oldRole === 'mentor') {
            await supabase.from('mentors').update({ status: 'rejected' }).eq('mentor_id', currentUser.id);
            notifTitle = 'Thay đổi quyền truy cập';
            notifContent = 'Tài khoản của bạn đã bị chuyển về Ứng viên. Bạn không còn quyền truy cập chức năng Mentor.';
            notifType = 'warning';
          } else if (oldRole === 'recruiter') {
            await supabase.from('companies').update({ status: 'rejected' }).eq('recruiter_id', currentUser.id);
            notifTitle = 'Thay đổi quyền truy cập';
            notifContent = 'Tài khoản của bạn đã bị chuyển về Ứng viên. Bạn không còn quyền Nhà tuyển dụng.';
            notifType = 'warning';
          }
        }
        
        if (notifContent) {
          await supabase.from('notifications').insert([{
            user_id: currentUser.id,
            title: notifTitle,
            content: notifContent,
            type: notifType,
            action_link: '/profile'
          }]);
        }
      }

      toast.success('Cập nhật người dùng thành công');
    } else {
      // Insert
      const { error } = await supabase.from('profiles').insert([payload]);
      if (error) return toast.error('Lỗi thêm mới: ' + error.message);
      toast.success('Thêm người dùng mới thành công');
    }
    
    setIsEditing(false);
    setCurrentUser(null);
    fetchUsers();
  };

  const filteredUsers = users.filter(user =>
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ position: 'relative' }}>
      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-charcoal)', letterSpacing: '-0.5px', margin: 0, fontFamily: 'var(--font-heading)' }}>Quản lý Người dùng ({users.length})</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.85rem 1.5rem',
              borderRadius: '9999px',
              border: '1px solid rgba(44, 40, 36, 0.1)',
              background: 'rgba(255,255,255,0.9)',
              color: 'var(--color-charcoal)',
              width: '320px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
            onFocus={e => { e.target.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.1)'; e.target.style.borderColor = '#EA580C'; }}
            onBlur={e => { e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)'; e.target.style.borderColor = 'rgba(44, 40, 36, 0.1)'; }}
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card" style={{ overflowX: 'auto', padding: 0, borderRadius: '24px', boxShadow: '0 15px 35px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(90deg, rgba(234, 88, 12, 0.03), transparent)' }}>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>ID</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Họ Tên</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Email</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Vai trò</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Gói</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)' }}>Trạng thái</th>
              <th style={{ padding: '1.25rem 1rem', fontWeight: '600', color: 'var(--color-charcoal)', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>#{user.id ? user.id.toString().substring(0, 8) : ''}...</td>
                <td style={{ padding: '1rem', fontWeight: '600', color: '#1e293b' }}>{user.full_name || 'Người dùng ẩn danh'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    background: (user.role === 'admin' || user.role === 'Admin') ? 'rgba(255, 150, 50, 0.1)' : 'rgba(100, 108, 255, 0.1)',
                    color: (user.role === 'admin' || user.role === 'Admin') ? '#ea580c' : '#4f46e5',
                    padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {user.role || 'user'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    color: user.plan === 'Premium' ? '#ea580c' : (user.plan === 'Pro' ? '#059669' : 'var(--text-secondary)'),
                    fontWeight: 'bold',
                    background: user.plan === 'Premium' ? 'rgba(255, 150, 50, 0.1)' : (user.plan === 'Pro' ? 'rgba(50, 200, 100, 0.1)' : 'transparent'),
                    padding: user.plan !== 'Free' ? '0.25rem 0.5rem' : '0',
                    borderRadius: '6px'
                  }}>
                    {user.plan || 'Free'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    color: user.status === 'active' ? '#059669' : (user.status === 'pending' ? '#d97706' : 'var(--text-secondary)'),
                    fontWeight: '500', fontSize: '0.9rem', textTransform: 'capitalize'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: user.status === 'active' ? '#10b981' : (user.status === 'pending' ? '#f59e0b' : 'var(--text-secondary)') }} />
                    {user.status || 'active'}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <button onClick={() => handleEdit(user)} style={{...iconBtnStyle, background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5'}} title="Sửa thông tin"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(user.id)} style={{...iconBtnStyle, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444'}} title="Xóa tài khoản"><Trash2 size={16} /></button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {loading ? 'Đang tải dữ liệu...' : 'Không tìm thấy người dùng nào'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
        <button
          disabled={page === 1}
          onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{ ...pageBtnStyle, opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          onMouseOver={e => { if(page !== 1) e.currentTarget.style.transform = 'translateY(-2px)'}}
          onMouseOut={e => { if(page !== 1) e.currentTarget.style.transform = 'translateY(0)'}}
        >
          &larr; Prev
        </button>
        <span style={{ padding: '0.6rem 1.25rem', background: '#ffffff', borderRadius: '12px', fontWeight: '700', color: 'var(--color-charcoal)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages || totalPages === 0}
          onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{ ...pageBtnStyle, opacity: (page === totalPages || totalPages === 0) ? 0.5 : 1, cursor: (page === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
          onMouseOver={e => { if(page !== totalPages && totalPages !== 0) e.currentTarget.style.transform = 'translateY(-2px)'}}
          onMouseOut={e => { if(page !== totalPages && totalPages !== 0) e.currentTarget.style.transform = 'translateY(0)'}}
        >
          Next &rarr;
        </button>
      </motion.div>

      {isEditing && createPortal(
        <div style={modalOverlayStyle}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={modalContentStyle}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: 'var(--color-charcoal)', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Chỉnh sửa Người dùng</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Cập nhật vai trò, trạng thái và thông tin tài khoản.</p>
              </div>
              <button onClick={() => setIsEditing(false)} style={closeBtnStyle}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Họ và Tên</label>
                <input
                  type="text"
                  required
                  value={currentUser.full_name || ''}
                  onChange={e => setCurrentUser({ ...currentUser, full_name: e.target.value })}
                  style={inputStyle}
                  placeholder="Nhập họ và tên..."
                />
              </div>
              <div>
                <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="email"
                  required
                  value={currentUser.email || ''}
                  onChange={e => setCurrentUser({ ...currentUser, email: e.target.value })}
                  style={inputStyle}
                  disabled
                  title="Không thể thay đổi email của người dùng"
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>Email được quản lý bởi Supabase Auth, không thể sửa tại đây.</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Vai trò</label>
                  <select
                    value={currentUser.role || 'candidate'}
                    onChange={e => {
                      const newRole = e.target.value;
                      let newPlan = currentUser.plan;
                      if (newRole === 'mentor' || newRole === 'recruiter') {
                        newPlan = 'Premium';
                      } else if (newRole === 'candidate' && currentUser.id) {
                        const originalUser = users.find(u => u.id === currentUser.id);
                        newPlan = originalUser ? originalUser.plan : 'Free';
                      }
                      setCurrentUser({ ...currentUser, role: newRole, plan: newPlan });
                    }}
                    style={inputStyle}
                  >
                    <option value="candidate">Candidate (Ứng viên)</option>
                    <option value="recruiter">Recruiter (Nhà tuyển dụng)</option>
                    <option value="mentor">Mentor (Cố vấn)</option>
                    <option value="admin">Admin (Quản trị viên)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Gói (Plan)</label>
                  <select
                    value={currentUser.plan || 'Free'}
                    onChange={e => setCurrentUser({ ...currentUser, plan: e.target.value })}
                    style={{
                      ...inputStyle,
                      backgroundColor: (currentUser.role === 'mentor' || currentUser.role === 'recruiter') ? '#f1f5f9' : '#ffffff',
                      cursor: (currentUser.role === 'mentor' || currentUser.role === 'recruiter') ? 'not-allowed' : 'auto'
                    }}
                    disabled={currentUser.role === 'mentor' || currentUser.role === 'recruiter'}
                    title={(currentUser.role === 'mentor' || currentUser.role === 'recruiter') ? 'Tài khoản Mentor và Recruiter mặc định sử dụng gói Premium' : ''}
                  >
                    <option value="Free">Gói Free</option>
                    <option value="Pro">Gói Pro</option>
                    <option value="Premium">Gói Premium</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Trạng thái tài khoản</label>
                  <select
                    value={currentUser.status || 'active'}
                    onChange={e => setCurrentUser({ ...currentUser, status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="active">Hoạt động bình thường (Active)</option>
                    <option value="pending">Chờ duyệt / Tạm khóa (Pending)</option>
                    <option value="banned">Cấm vĩnh viễn (Banned)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Điểm tích lũy (Points)</label>
                  <input
                    type="number"
                    min="0"
                    value={currentUser.points ?? 0}
                    onChange={e => setCurrentUser({ ...currentUser, points: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '0.85rem', background: '#f1f5f9', border: 'none', color: '#475569', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background = '#e2e8f0'} onMouseOut={e => e.target.style.background = '#f1f5f9'}>Hủy bỏ</button>
                <button type="submit" style={{ flex: 1, padding: '0.85rem', background: '#4f46e5', border: 'none', color: '#ffffff', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)', transition: 'transform 0.2s' }} onMouseOver={e => e.target.style.transform = 'translateY(-2px)'} onMouseOut={e => e.target.style.transform = 'translateY(0)'}>Lưu thay đổi</button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}
    </motion.div>
  );
};

const labelStyle = { display: 'block', marginBottom: '0.4rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600' };

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

const iconBtnStyle = {
  border: 'none',
  cursor: 'pointer',
  padding: '0.5rem',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};

const closeBtnStyle = { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.2s' };
const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999,
  padding: '5rem 1rem 2rem', overflowY: 'auto'
};
const modalContentStyle = { 
  width: '100%', maxWidth: '550px', margin: 'auto', 
  padding: '2.5rem', background: '#ffffff', borderRadius: '24px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

const pageBtnStyle = {
  padding: '0.6rem 1.25rem',
  background: 'linear-gradient(135deg, #EA580C, #C2410C)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontWeight: 'bold',
  boxShadow: '0 4px 15px rgba(234, 88, 12, 0.2)',
  transition: 'transform 0.2s, box-shadow 0.2s'
};

export default UsersView;

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import { useConfirm } from '../../utils/ConfirmContext';
import { 
  User, 
  Mail, 
  Calendar, 
  Phone, 
  MapPin, 
  Lock, 
  ShieldCheck, 
  FileText, 
  History, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle2,
  Clock,
  Sparkles,
  CreditCard,
  DollarSign,
  XCircle
} from 'lucide-react';
import './Auth.css';

const Profile = () => {
  const confirm = useConfirm();
  const { user, profile, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('personal'); // personal, cv, history, payment

  // Đọc query param ?tab= để chuyển tab tự động (VD: từ thông báo thanh toán)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['personal', 'cv', 'history', 'payment'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Personal Info States
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // Security States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Dynamic Data States
  const [cvs, setCvs] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      setFullName(user.user_metadata.full_name || '');
      setDob(user.user_metadata.dob || '');
      setPhone(user.user_metadata.phone || '');
      setAddress(user.user_metadata.address || '');
    }

    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    setLoadingData(true);
    try {
      const { data: cvData, error: cvError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (!cvError && cvData) {
        setCvs(cvData);
      }

      const { data: historyData, error: historyError } = await supabase
        .from('interview_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (!historyError && historyData) {
        setHistory(historyData);
      }

      // Fetch payment/order history
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, user_id, plan_name, price, order_code, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (!ordersError && ordersData) {
        setPaymentHistory(ordersData);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteCV = async (cv) => {
    const isConfirmed = await new Promise(resolve => confirm({ 
      message: 'Bạn có chắc chắn muốn xóa CV này?', 
      isDanger: true, 
      onConfirm: () => resolve(true), 
      onCancel: () => resolve(false) 
    }));
    if (!isConfirmed) return;
    
    try {
      const { error } = await supabase.rpc('drop_cv_record', { cv_id: cv.id });
      
      if (error) {
        if (error.message === 'TypeError: Failed to fetch') {
          const { data: checkData } = await supabase.from('cvs').select('id').eq('id', cv.id).maybeSingle();
          if (checkData) {
            throw error;
          } else {
            console.warn("Bỏ qua lỗi Failed to fetch ảo.");
          }
        } else {
          throw error;
        }
      }
      
      if (cv.file_url) {
        try {
          const urlParts = cv.file_url.split('/cv-bucket/');
          if (urlParts.length > 1) await supabase.storage.from('cv-bucket').remove([urlParts[1]]);
        } catch(e){}
      }
      
      setCvs(prevCvs => prevCvs.filter(item => item.id !== cv.id));
      alert('Đã xóa CV thành công!');
    } catch (err) {
      console.error("Lỗi xóa CV:", err);
      alert('Không thể xóa CV: ' + err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });

    // === VALIDATION 1: Số điện thoại tuân theo UC-05 (Regex 10-11 chữ số Việt Nam: 03,05,07,08,09 hoặc +84) ===
    if (phone && phone.trim() !== '') {
      const phoneTrimmed = phone.trim();
      const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        return setProfileMessage({
          type: 'error',
          text: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (VD: 0987654321 hoặc +84987654321).'
        });
      }
    }

    // === VALIDATION 2: Ngày sinh & Độ tuổi tuân theo UC-07 (Tuổi >= 15 cho Candidate, >= 18 cho Recruiter, DOB < CURRENT_DATE) ===
    if (dob && dob.trim() !== '') {
      const birthDate = new Date(dob);
      const today = new Date();
      if (isNaN(birthDate.getTime()) || birthDate >= today) {
        return setProfileMessage({
          type: 'error',
          text: 'Ngày sinh không thể là ngày hôm nay hoặc ở tương lai.'
        });
      }

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      const userRole = profile?.role || 'candidate';
      const minAge = userRole === 'recruiter' ? 18 : 15;
      if (age < minAge) {
        return setProfileMessage({
          type: 'error',
          text: `Bạn phải từ ${minAge} tuổi trở lên (${userRole === 'recruiter' ? 'Nhà tuyển dụng' : 'Ứng viên'}).`
        });
      }
    }

    setLoading(true);

    try {
      // 1. Cập nhật user_metadata trong Supabase Auth
      const { error: authError } = await updateProfile({ 
        full_name: fullName,
        dob: dob,
        phone: phone,
        address: address
      });
      if (authError) throw authError;

      // 2. Đồng bộ trực tiếp dữ liệu vào bảng public.profiles trong CSDL PostgreSQL
      const { error: profileDbError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          dob: dob || null,
          phone: phone || null,
          address: address || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileDbError) {
        console.warn('Cảnh báo đồng bộ public.profiles:', profileDbError.message);
      }

      setProfileMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.message || 'Lỗi khi cập nhật thông tin.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      return setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
    }
    if (password.length < 6) {
      return setPasswordMessage({ type: 'error', text: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Cập nhật mật khẩu thành công!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message || 'Lỗi khi cập nhật mật khẩu.' });
    } finally {
      setLoading(false);
    }
  };

  const userInitial = (fullName || user?.email || 'U').charAt(0).toUpperCase();

  const renderPersonalInfoTab = () => (
    <div className="profile-grid animate-fade">
      {/* General Info Form */}
      <div className="profile-section-card">
        <div className="profile-card-header">
          <div className="profile-card-icon">
            <User size={20} />
          </div>
          <div>
            <h3>Thông tin cá nhân</h3>
            <p>Cập nhật họ tên, liên hệ và thông tin cơ bản của bạn</p>
          </div>
        </div>
        
        <form onSubmit={handleUpdateProfile} className="profile-form">
          <div className="auth-form-group">
            <label>Email (Tài khoản)</label>
            <div className="input-with-icon-wrapper disabled">
              <div className="input-icon-left">
                <Mail size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="email"
                className="auth-input-no-border"
                value={user?.email || ''}
                disabled
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="fullName">Họ và tên</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <User size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="text"
                id="fullName"
                className="auth-input-no-border"
                placeholder="Nhập họ và tên của bạn"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="profile-form-row">
            <div className="auth-form-group">
              <label htmlFor="dob">Ngày sinh</label>
              <div className="input-with-icon-wrapper">
                <div className="input-icon-left">
                  <Calendar size={18} />
                </div>
                <div className="input-divider"></div>
                <input
                  type="date"
                  id="dob"
                  className="auth-input-no-border"
                  value={dob}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label htmlFor="phone">Số điện thoại</label>
              <div className="input-with-icon-wrapper">
                <div className="input-icon-left">
                  <Phone size={18} />
                </div>
                <div className="input-divider"></div>
                <input
                  type="tel"
                  id="phone"
                  className="auth-input-no-border"
                  placeholder="Nhập số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="address">Địa chỉ</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <MapPin size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="text"
                id="address"
                className="auth-input-no-border"
                placeholder="Nhập địa chỉ của bạn"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          {profileMessage.text && (
            <div className={profileMessage.type === 'error' ? 'auth-error-msg' : 'auth-success-msg'}>
              {profileMessage.text}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-profile-save"
            disabled={loading}
          >
            <Save size={18} />
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>

      {/* Security Form */}
      <div className="profile-section-card">
        <div className="profile-card-header">
          <div className="profile-card-icon security">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3>Bảo mật tài khoản</h3>
            <p>Thay đổi mật khẩu đăng nhập để bảo vệ tài khoản</p>
          </div>
        </div>
        
        <form onSubmit={handleUpdatePassword} className="profile-form">
          <div className="auth-form-group">
            <label htmlFor="newPassword">Mật khẩu mới</label>
            <div className="input-with-icon-wrapper">
              <button
                type="button"
                className="input-icon-left password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <div className="input-divider"></div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                className="auth-input-no-border"
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</label>
            <div className="input-with-icon-wrapper">
              <button
                type="button"
                className="input-icon-left password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <div className="input-divider"></div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmNewPassword"
                className="auth-input-no-border"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>
          </div>

          {passwordMessage.text && (
            <div className={passwordMessage.type === 'error' ? 'auth-error-msg' : 'auth-success-msg'}>
              {passwordMessage.text}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-profile-secondary"
            disabled={loading}
          >
            <Lock size={18} />
            {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderCVTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="profile-card-icon">
            <FileText size={20} />
          </div>
          <div>
            <h3>Danh sách CV của bạn</h3>
            <p>Quản lý các hồ sơ CV đã tải lên hệ thống ITA</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/cv-analysis')}
          className="btn-profile-action" 
        >
          <Plus size={16} /> Tải CV mới
        </button>
      </div>

      <div className="profile-data-list">
        {loadingData ? (
          <div className="profile-loading-box">
            <Sparkles className="spinning-icon" size={24} />
            <p>Đang tải danh sách CV...</p>
          </div>
        ) : cvs.length > 0 ? (
          cvs.map(cv => (
            <div key={cv.id} className="profile-data-item">
              <div className="profile-item-main">
                <div className="profile-item-icon-box">
                  <FileText size={24} color="#f97316" />
                </div>
                <div>
                  <h4 className="profile-item-title">{cv.file_name || 'Hồ sơ CV chưa đặt tên'}</h4>
                  <p className="profile-item-sub">
                    Tải lên: {new Date(cv.created_at).toLocaleDateString('vi-VN')} {cv.file_size ? `• ${cv.file_size}` : ''}
                  </p>
                </div>
              </div>
              
              <div className="profile-item-right">
                <span className={`profile-badge ${cv.status === 'Đã phân tích' ? 'success' : 'pending'}`}>
                  {cv.status === 'Đã phân tích' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {cv.status || 'Đang xử lý'}
                </span>
                <button 
                  onClick={() => navigate('/cv-analysis')}
                  className="btn-item-view"
                >
                  <ExternalLink size={14} />
                  {cv.status === 'Đã phân tích' ? 'Xem phân tích' : 'Phân tích'}
                </button>
                <button
                  onClick={() => handleDeleteCV(cv)}
                  className="btn-item-delete"
                  title="Xóa CV này"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="profile-empty-box">
            <FileText size={48} className="empty-icon" />
            <h4>Chưa có dữ liệu CV</h4>
            <p>Hãy tải lên CV của bạn để nhận phân tích chuyên sâu từ AI.</p>
            <button onClick={() => navigate('/cv-analysis')} className="btn-profile-action" style={{ marginTop: '0.75rem' }}>
              <Sparkles size={16} /> Phân tích CV đầu tiên
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="profile-card-icon history">
            <History size={20} />
          </div>
          <div>
            <h3>Lịch sử phỏng vấn AI</h3>
            <p>Xem lại các phiên thực hành và kết quả đánh giá</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/interview')}
          className="btn-profile-action" 
        >
          <Plus size={16} /> Luyện tập tiếp
        </button>
      </div>

      <div className="profile-data-list">
        {loadingData ? (
          <div className="profile-loading-box">
            <Sparkles className="spinning-icon" size={24} />
            <p>Đang tải lịch sử thực hành...</p>
          </div>
        ) : history.length > 0 ? (
          history.map(item => (
            <div key={item.id} className="profile-data-item">
              <div className="profile-item-main">
                <div className="profile-item-icon-box history">
                  <History size={24} color="#3b82f6" />
                </div>
                <div>
                  <h4 className="profile-item-title">Phỏng vấn {item.role_title || 'Thực hành tổng hợp'}</h4>
                  <p className="profile-item-sub">
                    Ngày thi: {new Date(item.created_at).toLocaleDateString('vi-VN')} {item.duration ? `• Thời lượng: ${item.duration}` : ''}
                  </p>
                </div>
              </div>
              
              <div className="profile-item-right">
                <span className={`profile-badge ${item.score >= 80 ? 'success' : 'pending'}`}>
                  Điểm: {item.score || 0}/100
                </span>
                <button 
                  onClick={() => navigate(`/interview/result/${item.id}`)}
                  className="btn-item-view"
                >
                  <ExternalLink size={14} /> Xem báo cáo
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="profile-empty-box">
            <History size={48} className="empty-icon" />
            <h4>Chưa có lịch sử phỏng vấn</h4>
            <p>Hãy bắt đầu phiên phỏng vấn giả lập đầu tiên với AI để rèn luyện kỹ năng.</p>
            <button onClick={() => navigate('/interview')} className="btn-profile-action" style={{ marginTop: '0.75rem' }}>
              <Sparkles size={16} /> Bắt đầu ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return { label: 'Đã thanh toán', className: 'success', icon: <CheckCircle2 size={13} /> };
      case 'pending':
        return { label: 'Chờ thanh toán', className: 'pending', icon: <Clock size={13} /> };
      case 'cancelled':
        return { label: 'Đã hủy', className: 'cancelled', icon: <XCircle size={13} /> };
      default:
        return { label: status || 'Không xác định', className: 'pending', icon: <Clock size={13} /> };
    }
  };

  const renderPaymentTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="profile-card-icon payment">
            <CreditCard size={20} />
          </div>
          <div>
            <h3>Lịch sử thanh toán</h3>
            <p>Xem lại các giao dịch nâng cấp gói dịch vụ của bạn</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/pricing')}
          className="btn-profile-action" 
        >
          <Plus size={16} /> Nâng cấp gói
        </button>
      </div>

      <div className="profile-data-list">
        {loadingData ? (
          <div className="profile-loading-box">
            <Sparkles className="spinning-icon" size={24} />
            <p>Đang tải lịch sử thanh toán...</p>
          </div>
        ) : paymentHistory.length > 0 ? (
          paymentHistory.map(order => {
            const statusInfo = getPaymentStatusBadge(order.status);
            return (
              <div key={order.id} className="profile-data-item">
                <div className="profile-item-main">
                  <div className="profile-item-icon-box payment">
                    <DollarSign size={24} color="#8b5cf6" />
                  </div>
                  <div>
                    <h4 className="profile-item-title">Gói {order.plan_name}</h4>
                    <p className="profile-item-sub">
                      Mã đơn: {order.order_code} • {new Date(order.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
                
                <div className="profile-item-right">
                  <span className="profile-badge payment-amount">
                    <DollarSign size={13} />
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.price)}
                  </span>
                  <span className={`profile-badge ${statusInfo.className}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="profile-empty-box">
            <CreditCard size={48} className="empty-icon" />
            <h4>Chưa có lịch sử thanh toán</h4>
            <p>Nâng cấp gói dịch vụ để mở khóa các tính năng cao cấp.</p>
            <button onClick={() => navigate('/pricing')} className="btn-profile-action" style={{ marginTop: '0.75rem' }}>
              <Sparkles size={16} /> Xem gói dịch vụ
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="profile-page-wrapper animate-fade">
      <div className="profile-main-container">
        
        {/* User Hero Header Banner */}
        <div className="profile-hero-card">
          <div className="profile-hero-content">
            <div className="profile-avatar-circle">
              {userInitial}
            </div>
            <div className="profile-hero-text">
              <div className="profile-name-row">
                <h2>{fullName || 'Người dùng ITA'}</h2>
                <span className="profile-role-badge">
                  {profile?.role === 'admin' ? 'Quản trị viên' : profile?.role === 'mentor' ? 'Mentor' : profile?.role === 'company' ? 'Nhà tuyển dụng' : 'Ứng viên'}
                </span>
              </div>
              <p className="profile-email">
                <Mail size={14} /> {user?.email}
              </p>
            </div>
          </div>
        </div>

        <div className="profile-layout-grid">
          {/* Sidebar Navigation */}
          <div className="profile-sidebar-v2">
            <button 
              className={`profile-nav-item ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <User size={18} />
              <span>Hồ sơ cá nhân</span>
            </button>
            
            {profile?.role !== 'company' && profile?.role !== 'recruiter' && (
              <>
                <button 
                  className={`profile-nav-item ${activeTab === 'cv' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cv')}
                >
                  <FileText size={18} />
                  <span>Quản lý CV</span>
                </button>

                <button 
                  className={`profile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <History size={18} />
                  <span>Lịch sử thực hành</span>
                </button>

                <button 
                  className={`profile-nav-item ${activeTab === 'payment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('payment')}
                >
                  <CreditCard size={18} />
                  <span>Lịch sử thanh toán</span>
                </button>
              </>
            )}
          </div>

          {/* Tab Content Area */}
          <div className="profile-content-area">
            {activeTab === 'personal' && renderPersonalInfoTab()}
            {activeTab === 'cv' && renderCVTab()}
            {activeTab === 'history' && renderHistoryTab()}
            {activeTab === 'payment' && renderPaymentTab()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import {
  User,
  ShieldCheck,
  FileText,
  Upload,
  Link as LinkIcon,
  Phone,
  Mail,
  Award,
  BookOpen,
  Clock,
  Save,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import '../Auth/Auth.css';

const MentorProfile = () => {
  const { user, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('personal'); // personal, certificate, security

  // Personal Info & Professional States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  // Document State
  const [documentUrl, setDocumentUrl] = useState(null);
  const [newFile, setNewFile] = useState(null);

  // Security States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Messages & Loading
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [certMessage, setCertMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const parseExpertise = (expStr) => {
    if (!expStr) return { expertise: '', yearsOfExperience: '' };
    const regex = /^(.*?)\s*\((\d+)\s*năm kinh nghiệm\)$/;
    const match = expStr.match(regex);
    if (match) {
      return {
        expertise: match[1].trim(),
        yearsOfExperience: match[2].trim()
      };
    }
    const numRegex = /(\d+)/;
    const numMatch = expStr.match(numRegex);
    return {
      expertise: expStr.replace(/\(\d+.*?\)/, '').trim(),
      yearsOfExperience: numMatch ? numMatch[1] : ''
    };
  };

  useEffect(() => {
    if (user) {
      fetchMentorData();
    }
  }, [user]);

  const fetchMentorData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('mentor_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Lỗi tải dữ liệu Mentor:', error);
      }

      if (data) {
        setFullName(data.full_name || '');
        setEmail(data.email || user.email || '');
        setPhone(data.phone || '');
        setLinkedinUrl(data.linkedin_url || '');
        setBio(data.bio || '');
        setDocumentUrl(data.document_url || null);

        const parsed = parseExpertise(data.expertise);
        setExpertise(parsed.expertise);
        setYearsOfExperience(parsed.yearsOfExperience);
      } else {
        setFullName(user.user_metadata?.full_name || '');
        setEmail(user.email || '');
        setPhone(user.user_metadata?.phone || '');
      }
    } catch (err) {
      console.error('Không thể tải hồ sơ Mentor:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: '', text: '' });

    if (phone && phone.trim() !== '') {
      const phoneTrimmed = phone.trim();
      const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        return setProfileMessage({
          type: 'error',
          text: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 chữ số (VD: 0987654321 hoặc +84987654321).'
        });
      }
    }

    setLoading(true);

    try {
      const combinedExpertise = `${expertise} (${yearsOfExperience} năm kinh nghiệm)`;

      // 1. Kiểm tra xem người dùng đã có bản ghi trong bảng 'mentors' chưa
      const { data: existingMentor } = await supabase
        .from('mentors')
        .select('id')
        .or(`mentor_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (existingMentor) {
        // Cập nhật bản ghi mentor hiện có
        const { error: mentorError } = await supabase
          .from('mentors')
          .update({
            full_name: fullName,
            phone: phone,
            expertise: combinedExpertise,
            linkedin_url: linkedinUrl,
            bio: bio,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMentor.id);

        if (mentorError) throw mentorError;
      } else {
        // Tạo mới bản ghi mentor với trạng thái approved nếu chưa tồn tại
        const { error: insertError } = await supabase
          .from('mentors')
          .insert({
            mentor_id: user.id,
            full_name: fullName,
            email: user.email,
            phone: phone,
            expertise: combinedExpertise,
            linkedin_url: linkedinUrl,
            bio: bio,
            avatar_url: user.user_metadata?.avatar_url || null,
            status: 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      }

      // 2. Cập nhật thông tin tương ứng trong bảng profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.warn('Cảnh báo cập nhật profiles:', profileError.message);
      }

      // 3. Cập nhật Auth User Metadata
      const { error: authError } = await updateProfile({
        full_name: fullName,
        phone: phone
      });

      if (authError) {
        console.warn('Cảnh báo cập nhật auth metadata:', authError.message);
      }

      setProfileMessage({ type: 'success', text: 'Cập nhật thông tin Mentor thành công!' });
      fetchMentorData();
    } catch (err) {
      console.error('Lỗi khi cập nhật thông tin Mentor:', err);
      setProfileMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra khi lưu thông tin.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setNewFile(e.target.files[0]);
    setCertMessage({ type: '', text: '' });
  };

  const handleUploadCertificate = async (e) => {
    e.preventDefault();
    if (!newFile) {
      setCertMessage({ type: 'error', text: 'Vui lòng chọn một file trước khi tải lên.' });
      return;
    }

    setUploadProgress(true);
    setCertMessage({ type: '', text: '' });

    try {
      const fileExt = newFile.name.split('.').pop();
      const fileName = `mentor-${user.id}-${Date.now()}.${fileExt}`;
      let uploadedUrl = null;

      const { data: fileData, error: uploadError } = await supabase.storage
        .from('mentor-documents')
        .upload(fileName, newFile);

      if (uploadError) {
        console.warn("Lỗi upload bucket mentor-documents, thử fallback...", uploadError);
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('company-documents')
          .upload(fileName, newFile);

        if (fallbackError) throw fallbackError;

        if (fallbackData) {
          const { data: urlData } = supabase.storage
            .from('company-documents')
            .getPublicUrl(fileName);
          uploadedUrl = urlData.publicUrl;
        }
      } else if (fileData) {
        const { data: urlData } = supabase.storage
          .from('mentor-documents')
          .getPublicUrl(fileName);
        uploadedUrl = urlData.publicUrl;
      }

      if (!uploadedUrl) throw new Error("Không lấy được public URL của file.");

      const { error: dbError } = await supabase
        .from('mentors')
        .update({
          document_url: uploadedUrl,
          updated_at: new Date().toISOString()
        })
        .eq('mentor_id', user.id);

      if (dbError) throw dbError;

      setDocumentUrl(uploadedUrl);
      setNewFile(null);
      setCertMessage({ type: 'success', text: 'Tải lên chứng chỉ/CV mới thành công!' });
    } catch (err) {
      console.error(err);
      setCertMessage({ type: 'error', text: err.message || 'Lỗi khi tải lên file.' });
    } finally {
      setUploadProgress(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      return setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
    }
    if (password.length < 8) {
      return setPasswordMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Cập nhật mật khẩu thành công!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message || 'Lỗi khi đổi mật khẩu.' });
    } finally {
      setLoading(false);
    }
  };

  const userInitial = (fullName || user?.email || 'M').charAt(0).toUpperCase();

  const renderPersonalInfoTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header">
        <div className="profile-card-icon">
          <User size={20} />
        </div>
        <div>
          <h3>Thông tin cá nhân & Chuyên môn</h3>
          <p>Cập nhật lĩnh vực giảng dạy, kinh nghiệm và thông tin liên hệ</p>
        </div>
      </div>

      <form onSubmit={handleUpdateProfile} className="profile-form">
        <div className="profile-form-row">
          <div className="auth-form-group">
            <label htmlFor="fullName">Họ và tên *</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <User size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="text"
                id="fullName"
                className="auth-input-no-border"
                placeholder="Nhập họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label>Email liên hệ (Không thể thay đổi)</label>
            <div className="input-with-icon-wrapper disabled">
              <div className="input-icon-left">
                <Mail size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="email"
                className="auth-input-no-border"
                value={email}
                disabled
              />
            </div>
          </div>
        </div>

        <div className="profile-form-row">
          <div className="auth-form-group">
            <label htmlFor="phone">Số điện thoại *</label>
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
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="linkedinUrl">LinkedIn Profile URL</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <LinkIcon size={18} />
              </div>
              <div className="input-divider"></div>
              <input
                type="url"
                id="linkedinUrl"
                className="auth-input-no-border"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>
        </div>

        <div className="profile-form-row">
          <div className="auth-form-group">
            <label htmlFor="expertise">Lĩnh vực chuyên môn (Major) *</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <BookOpen size={18} />
              </div>
              <div className="input-divider"></div>
              <select
                id="expertise"
                className="auth-input-no-border"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                required
                style={{ appearance: 'auto', background: 'transparent' }}
              >
                <option value="">Chọn lĩnh vực chuyên môn...</option>
                <option value="Frontend Development">Frontend Development</option>
                <option value="Backend Development">Backend Development</option>
                <option value="Fullstack Development">Fullstack Development</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Data Science / AI">Data Science / AI</option>
                <option value="DevOps / Cloud">DevOps / Cloud</option>
                <option value="UI/UX Design">UI/UX Design</option>
                <option value="Project Management">Project Management</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="yearsOfExperience">Số năm kinh nghiệm *</label>
            <div className="input-with-icon-wrapper">
              <div className="input-icon-left">
                <Clock size={18} />
              </div>
              <div className="input-divider"></div>
              <select
                id="yearsOfExperience"
                className="auth-input-no-border"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                required
                style={{ appearance: 'auto', background: 'transparent' }}
              >
                <option value="">Chọn số năm kinh nghiệm...</option>
                <option value="1">1 - 2 năm</option>
                <option value="3">3 - 5 năm</option>
                <option value="5">5 - 10 năm</option>
                <option value="10">Trên 10 năm</option>
              </select>
            </div>
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="bio">Giới thiệu bản thân & Động lực hướng dẫn *</label>
          <textarea
            id="bio"
            className="auth-input-no-border"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{
              minHeight: '120px',
              resize: 'vertical',
              lineHeight: '1.6',
              padding: '0.75rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              width: '100%',
              fontFamily: 'inherit'
            }}
            placeholder="Chia sẻ ngắn gọn về quá trình làm việc và lý do bạn muốn đồng hành cùng các ứng viên..."
            required
          />
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
          {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
        </button>
      </form>
    </div>
  );

  const renderCertificateTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header">
        <div className="profile-card-icon">
          <FileText size={20} />
        </div>
        <div>
          <h3>Hồ sơ & Chứng chỉ đính kèm</h3>
          <p>Tải lên chứng chỉ hoặc CV để tăng độ tin cậy với ứng viên</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Tài liệu hiện tại</h4>
          {documentUrl ? (
            <div className="profile-data-item">
              <div className="profile-item-main">
                <div className="profile-item-icon-box">
                  <Award size={22} color="#f97316" />
                </div>
                <div>
                  <h4 className="profile-item-title">Chứng chỉ / CV Mentor đã xác minh</h4>
                  <p className="profile-item-sub">Đã được duyệt và lưu trữ an toàn trên hệ thống ITA</p>
                </div>
              </div>
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-item-view"
              >
                <ExternalLink size={14} /> Xem tài liệu
              </a>
            </div>
          ) : (
            <div className="profile-empty-box">
              <Award size={36} className="empty-icon" />
              <h4>Chưa có tài liệu đính kèm</h4>
              <p>Hãy tải lên chứng chỉ chuyên môn để ứng viên dễ dàng lựa chọn bạn làm Mentor.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleUploadCertificate} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Tải lên tài liệu mới</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                position: 'relative',
                border: '2px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <input
                type="file"
                id="newFile"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={32} color="#f97316" />
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b' }}>
                  {newFile ? newFile.name : 'Nhấp vào đây hoặc kéo thả file chứng chỉ vào'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Hỗ trợ định dạng PDF, Word, PNG, JPG (Dung lượng tối đa 5MB)
                </span>
              </div>
            </div>

            {certMessage.text && (
              <div className={certMessage.type === 'error' ? 'auth-error-msg' : 'auth-success-msg'}>
                {certMessage.text}
              </div>
            )}

            <button
              type="submit"
              className="btn-profile-action"
              style={{ padding: '0.85rem', width: '100%', justifyContent: 'center' }}
              disabled={uploadProgress || !newFile}
            >
              <Upload size={18} />
              {uploadProgress ? 'Đang tải lên...' : 'Tải tài liệu mới lên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="profile-section-card animate-fade">
      <div className="profile-card-header">
        <div className="profile-card-icon security">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3>Bảo mật tài khoản</h3>
          <p>Cập nhật mật khẩu đăng nhập portal của bạn</p>
        </div>
      </div>

      <form onSubmit={handleUpdatePassword} className="profile-form">
        <div className="auth-form-group">
          <label htmlFor="newPassword">Mật khẩu mới *</label>
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
              placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="8"
            />
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới *</label>
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
              minLength="8"
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
  );

  return (
    <div className="profile-page-wrapper animate-fade">
      <div className="profile-main-container">

        {/* User Hero Banner Header */}
        <div className="profile-hero-card">
          <div className="profile-hero-content">
            <div className="profile-avatar-circle">
              {userInitial}
            </div>
            <div className="profile-hero-text">
              <div className="profile-name-row">
                <h2>{fullName || 'Mentor ITA'}</h2>
                <span className="profile-role-badge">
                  Mentor Chuyên Nghiệp
                </span>
              </div>
              <p className="profile-email">
                <Mail size={14} /> {email}
                {expertise && (
                  <span style={{ marginLeft: '1rem', color: '#f97316', fontWeight: 600 }}>
                    • {expertise} {yearsOfExperience ? `(${yearsOfExperience} năm exp)` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="profile-section-card profile-loading-box">
            <Sparkles className="spinning-icon" size={28} />
            <p>Đang tải dữ liệu hồ sơ Mentor...</p>
          </div>
        ) : (
          <div className="profile-layout-grid">
            {/* Sidebar Navigation */}
            <div className="profile-sidebar-v2">
              <button
                className={`profile-nav-item ${activeTab === 'personal' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('personal');
                  setProfileMessage({ type: '', text: '' });
                }}
              >
                <User size={18} />
                <span>Thông tin chuyên môn</span>
              </button>
              <button
                className={`profile-nav-item ${activeTab === 'certificate' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('certificate');
                  setCertMessage({ type: '', text: '' });
                }}
              >
                <FileText size={18} />
                <span>Chứng chỉ & Hồ sơ</span>
              </button>
              <button
                className={`profile-nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('security');
                  setPasswordMessage({ type: '', text: '' });
                }}
              >
                <ShieldCheck size={18} />
                <span>Bảo mật tài khoản</span>
              </button>

              <button
                className="profile-nav-item"
                onClick={() => navigate('/mentor')}
                style={{ marginTop: '1rem', color: '#ea580c', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}
              >
                <ArrowLeft size={18} />
                <span>Quay về Portal Mentor</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="profile-content-area">
              {activeTab === 'personal' && renderPersonalInfoTab()}
              {activeTab === 'certificate' && renderCertificateTab()}
              {activeTab === 'security' && renderSecurityTab()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MentorProfile;

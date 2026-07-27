import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertCircle, Briefcase, Calendar } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificationDropdown = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch dữ liệu ban đầu
  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Lỗi khi tải thông báo:', error);
    } else {
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Đăng ký nhận realtime từ Supabase
      const channel = supabase.channel(`public:notifications:user_id=eq.${user.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${user.id}` 
        }, payload => {
          // Khi có thông báo mới
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
          // Hiển thị toast popup thay cho alert
          if (payload.new.type === 'success') {
            toast.success(payload.new.title);
          } else if (payload.new.type === 'warning') {
            toast.error(payload.new.title);
          } else {
            toast(payload.new.title, { icon: '🔔' });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleMarkAsRead = async (notification) => {
    if (!notification.is_read) {
      // Cập nhật state nội bộ cho nhanh
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Gọi API cập nhật DB
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
    }

    // Xác định link chuyển hướng: ưu tiên action_link, fallback theo title
    let targetLink = notification.action_link;
    if (!targetLink) {
      const title = (notification.title || '').toLowerCase();
      if (title.includes('thanh toán') || title.includes('nâng cấp')) {
        targetLink = '/profile?tab=payment';
      }
    }

    if (targetLink) {
      setIsOpen(false);
      navigate(targetLink);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <Check size={16} color="#10b981" />;
      case 'warning': return <AlertCircle size={16} color="#f59e0b" />;
      case 'job': return <Briefcase size={16} color="#3b82f6" />;
      case 'booking': return <Calendar size={16} color="#8b5cf6" />;
      default: return <Info size={16} color="#64748b" />;
    }
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-charcoal)',
          transition: 'transform 0.2s',
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            borderRadius: '10px',
            padding: '2px 5px',
            minWidth: '16px',
            textAlign: 'center',
            border: '2px solid var(--color-cream)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: '-10px',
          width: '350px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          border: '1px solid rgba(0,0,0,0.05)',
          overflow: 'hidden',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '400px'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Thông báo</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500' }}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    background: notif.is_read ? 'white' : '#eff6ff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = notif.is_read ? '#f8fafc' : '#dbeafe'}
                  onMouseOut={e => e.currentTarget.style.background = notif.is_read ? 'white' : '#eff6ff'}
                >
                  <div style={{ marginTop: '4px', width: '32px', height: '32px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: notif.is_read ? '500' : '600', color: '#0f172a', marginBottom: '2px' }}>
                      {notif.title}
                    </div>
                    {notif.content && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: '1.4', marginBottom: '4px' }}>
                        {notif.content}
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {new Date(notif.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', marginTop: '6px', flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>
          
          <div style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <Link to="/notifications" style={{ textDecoration: 'none', color: '#64748b', fontSize: '0.85rem' }}>
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Eye, Trash2, FileText, Play, ExternalLink } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import { useConfirm } from '../../utils/ConfirmContext';

// Helper: extract YouTube embed URL
const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

// Helper: extract video URL from content if stored inline
const extractVideoFromContent = (content) => {
  if (!content) return null;
  const match = content.match(/\[VIDEO:\s*(https?:\/\/[^\]]+)\]/);
  return match ? match[1] : null;
};

const MentorBlogManagement = () => {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchBlogs();
  }, [user]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('author_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching blogs:', error.message);
        setBlogs([]);
      } else {
        setBlogs(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setBlogs([]);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    const isConfirmed = await new Promise(resolve => confirm({ message: 'Bạn có chắc chắn muốn xóa bài viết này?', isDanger: true, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));
    if (!isConfirmed) return;
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    if (error) {
      alert('Lỗi khi xóa bài viết: ' + error.message);
    } else {
      setBlogs(prev => prev.filter(b => b.id !== id));
    }
  };

  const handlePublish = async (id) => {
    const { error } = await supabase
      .from('blogs')
      .update({ status: 'published' })
      .eq('id', id);
    if (error) {
      alert('Lỗi khi xuất bản: ' + error.message);
    } else {
      setBlogs(prev => prev.map(b => b.id === id ? { ...b, status: 'published' } : b));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Vừa tạo';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return date.toLocaleDateString('vi-VN');
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
              Quản lý Blog
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Tạo và chia sẻ bài viết, kinh nghiệm phỏng vấn cho ứng viên.
            </p>
          </div>
          <Link to="/mentor/blogs/new" style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'; }}>
            <Plus size={18} /> Tạo bài viết mới
          </Link>
        </div>
      </header>

        {/* Blog Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Đang tải bài viết...
          </div>
        ) : (
          <div className="grid-auto">
            {blogs.map((blog, idx) => {
              // Check for video URL (from dedicated column or embedded in content)
              const rawVideoUrl = blog.video_url || extractVideoFromContent(blog.content);
              const embedUrl = getYouTubeEmbedUrl(rawVideoUrl);
              const hasVideo = !!rawVideoUrl;

              return (
                <div key={blog.id} className={`solid-card reveal is-visible ${idx > 0 ? `reveal--delay-${Math.min(idx, 3)}` : ''}`} style={{ display: 'flex', flexDirection: 'column', background: '#fff', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  {/* Video Embed */}
                  {embedUrl && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{
                        margin: '-1.5rem -1.5rem 0 -1.5rem',
                        borderRadius: '16px 16px 0 0',
                        overflow: 'hidden',
                        aspectRatio: '16/9',
                      }}>
                        <iframe
                          width="100%"
                          height="100%"
                          src={embedUrl}
                          title={blog.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ display: 'block' }}
                        />
                      </div>
                      <a 
                        href={rawVideoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          padding: '0.5rem',
                          background: 'rgba(255,0,0,0.05)',
                          color: '#CC0000',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                          borderBottom: '1px solid rgba(255,0,0,0.1)'
                        }}
                      >
                        <ExternalLink size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        Mở trên YouTube (nếu lỗi)
                      </a>
                    </div>
                  )}

                  {/* Cover Image (if no video) */}
                  {!embedUrl && blog.cover_image_url && (
                    <div style={{
                      margin: '-1.5rem -1.5rem 1rem -1.5rem',
                      borderRadius: '16px 16px 0 0',
                      overflow: 'hidden',
                      maxHeight: '180px',
                    }}>
                      <img
                        src={blog.cover_image_url}
                        alt={blog.title}
                        style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Type & Status Tags */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                      color: hasVideo ? '#FF0000' : 'var(--color-moss)',
                      background: hasVideo ? 'rgba(255, 0, 0, 0.08)' : 'rgba(107, 127, 92, 0.1)',
                      padding: '0.25rem 0.7rem',
                      borderRadius: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}>
                      {hasVideo ? <><Play size={12} /> Video</> : '📄 Bài viết'}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.7rem',
                      borderRadius: '50px',
                      fontWeight: 500,
                      background: blog.status === 'published' ? 'rgba(107, 127, 92, 0.15)' : 'rgba(155, 147, 133, 0.15)',
                      color: blog.status === 'published' ? 'var(--color-moss)' : 'var(--color-stone)'
                    }}>
                      {blog.status === 'published' ? '✓ Đã xuất bản' : '◷ Bản nháp'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', flex: 1, color: 'var(--color-charcoal)' }}>
                    {blog.title}
                  </h3>

                  {/* Video Link (clickable) */}
                  {hasVideo && !embedUrl && (
                    <a
                      href={rawVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255, 0, 0, 0.06)',
                        border: '1px solid rgba(255, 0, 0, 0.15)',
                        borderRadius: '10px',
                        color: '#CC0000',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        textDecoration: 'none',
                        marginBottom: '0.75rem',
                        transition: 'all 0.3s',
                      }}
                    >
                      <ExternalLink size={14} /> Xem video
                    </a>
                  )}

                  {/* Meta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    <span>{formatDate(blog.created_at)}</span>
                    <span>{blog.views || 0} lượt xem</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <Link
                      to={`/mentor/blogs/edit/${blog.id}`}
                      className="btn btn--outline"
                      style={{ flex: 1, padding: '0.5rem', textAlign: 'center', justifyContent: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit2 size={14} /> Chỉnh sửa
                    </Link>
                    {blog.status === 'draft' && (
                      <button
                        onClick={() => handlePublish(blog.id)}
                        className="btn btn--primary"
                        style={{ flex: 1, padding: '0.5rem', justifyContent: 'center', fontSize: '0.85rem' }}
                      >
                        Xuất bản
                      </button>
                    )}
                    {blog.status === 'published' && (
                      <Link
                        to={`/blog/${blog.id}`}
                        className="btn btn--outline"
                        style={{ flex: 1, padding: '0.5rem', textAlign: 'center', justifyContent: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Eye size={14} /> Xem
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(blog.id)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid rgba(192, 57, 43, 0.2)',
                        background: 'rgba(192, 57, 43, 0.05)',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        color: '#c0392b',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.3s'
                      }}
                      title="Xóa bài viết"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {blogs.length === 0 && (
              <div className="solid-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)', background: '#fff', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Bạn chưa có bài viết nào.</p>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                  Hãy tạo bài viết đầu tiên để chia sẻ kinh nghiệm phỏng vấn và kiến thức chuyên môn với ứng viên.
                </p>
                <Link to="/mentor/blogs/new" style={{ background: '#EA580C', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.4)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234, 88, 12, 0.3)'; }}>
                  <Plus size={18} /> Tạo bài viết đầu tiên
                </Link>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default MentorBlogManagement;

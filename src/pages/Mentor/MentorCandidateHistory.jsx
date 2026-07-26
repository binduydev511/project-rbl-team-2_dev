import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter,
  Target, BarChart3, TrendingUp, Award,
  Calendar, Eye, Play,
  X, ChevronLeft, ChevronRight, Loader2, Layers
} from 'lucide-react';
import {
  INDUSTRIES, DIFFICULTIES, getScoreColor,
  getDifficultyColor, formatDate, formatDuration
} from '../../constants/interviewConstants';
import { supabase } from '../../utils/supabaseClient';
import '../../assets/styles/interview-theme.css';
import '../Interview/InterviewHistory.css';
import heroImageSvg from '../../assets/images/Hero-image.svg';

// ── Stat Widget ──
const StatWidget = ({ icon: Icon, label, value, sub, color }) => (
  <div className="stat-widget">
    <div className="stat-widget__icon" style={{ background: color ? `${color}15` : 'var(--iv-bg-elevated)', color: color || 'var(--iv-accent-blue)' }}>
      <Icon size={20} />
    </div>
    <div className="stat-widget__info">
      <span className="stat-widget__value">{value}</span>
      <span className="stat-widget__label">{label}</span>
      {sub && <span className="stat-widget__sub">{sub}</span>}
    </div>
  </div>
);

// ── Mini sparkline chart ──
const MiniTrend = ({ data }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="mini-trend">
      <polyline points={points} fill="none" stroke="var(--iv-accent-blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default function MentorCandidateHistory() {
  const navigate = useNavigate();
  const { id: candidateId } = useParams();
  
  const [candidateName, setCandidateName] = useState('Ứng viên');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, highest, lowest
  const [showFilters, setShowFilters] = useState(false);

  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!candidateId) {
          setIsLoading(false);
          return;
        }

        // Fetch candidate info
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', candidateId)
          .single();
          
        if (profile?.full_name) {
          setCandidateName(profile.full_name);
        }

        // Fetch interviews
        const { data: interviews, error } = await supabase
          .from('interviews')
          .select(`
            id,
            completed_at,
            status,
            overall_score,
            overall_feedback,
            industry_id,
            industries ( id, name ),
            interview_answers ( ai_evaluation )
          `)
          .eq('user_id', candidateId)
          .order('completed_at', { ascending: false });

        if (error) throw error;

        const mappedHistory = (interviews || []).map(item => {
          let meta = {};
          if (item.interview_answers && item.interview_answers.length > 0) {
            const firstAns = item.interview_answers.find(a => a.ai_evaluation?._metadata) || item.interview_answers[0];
            if (firstAns?.ai_evaluation?._metadata) {
              meta = firstAns.ai_evaluation._metadata;
            }
          }
          
          if (item.overall_feedback && item.overall_feedback.includes('<!--META:')) {
            try {
              const metaStr = item.overall_feedback.split('<!--META:')[1].split('-->')[0];
              const parsedMeta = JSON.parse(metaStr);
              meta = { ...meta, ...parsedMeta };
            } catch (e) { console.warn('Failed to parse metadata from feedback in history', e); }
          }

          const matchedIndustry = INDUSTRIES.find(
            ind => ind.id === (meta.industryId || item.industry_id) || ind.name === (meta.industryName || item.industries?.name)
          );

          const finalDifficultyId = meta.difficulty || 'medium';
          const difficultyInfo = DIFFICULTIES.find(d => d.id === finalDifficultyId);

          return {
            id: item.id,
            date: item.completed_at,
            industry: matchedIndustry ? matchedIndustry.nameVi : (meta.industryName || item.industries?.name || 'Unknown Industry'),
            industryId: meta.industryId || item.industry_id || matchedIndustry?.id || 'unknown',
            difficulty: finalDifficultyId,
            difficultyVi: difficultyInfo ? difficultyInfo.name : (meta.difficultyName || 'Trung bình'),
            score: item.overall_score || 0,
            duration: 20,
            status: item.status || 'completed',
            questionType: 'mixed'
          };
        });

        setHistory(mappedHistory);
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [candidateId]);

  // ── Computed Stats ──
  const stats = useMemo(() => {
    const completed = history.filter(h => h.status === 'completed');
    const scores = completed.map(h => h.score);
    return {
      total: history.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      bestScore: scores.length ? Math.max(...scores) : 0,
      trendData: scores.slice().reverse(),
    };
  }, [history]);

  // ── Filtered & Sorted ──
  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(h => h.industry.toLowerCase().includes(q));
    }

    if (filterIndustry !== 'all') {
      result = result.filter(h => h.industryId === filterIndustry);
    }

    if (filterDifficulty !== 'all') {
      result = result.filter(h => h.difficulty === filterDifficulty);
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'highest':
        result.sort((a, b) => b.score - a.score);
        break;
      case 'lowest':
        result.sort((a, b) => a.score - b.score);
        break;
    }

    return result;
  }, [history, searchQuery, filterIndustry, filterDifficulty, sortBy]);

  const activeFiltersCount = [filterIndustry !== 'all', filterDifficulty !== 'all'].filter(Boolean).length;

  const clearFilters = () => {
    setFilterIndustry('all');
    setFilterDifficulty('all');
    setSearchQuery('');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterIndustry, filterDifficulty, sortBy]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="interview-theme">
      <img src={heroImageSvg} alt="" className="iv-bg-illustration" />
      <div className="iv-orb iv-orb--blue" />
      <div className="iv-orb iv-orb--purple" />

      <div className="history-container">
        {/* ── Header ── */}
        <div className="history-header iv-animate-fade">
          <div className="history-header__left">
            <button className="iv-btn iv-btn--ghost" onClick={() => navigate('/mentor/schedule')}>
              <ArrowLeft size={18} />
              Quay lại lịch hẹn
            </button>
          </div>
        </div>

        <div className="history-title iv-animate-fade iv-delay-1">
          <h1>Lịch sử phỏng vấn của {candidateName}</h1>
          <p>Xem đánh giá và tiến trình rèn luyện phỏng vấn AI của ứng viên này</p>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <div className="iv-spin" style={{ width: '40px', height: '40px', border: '3px solid var(--iv-border)', borderTopColor: 'var(--iv-accent-blue)', borderRadius: '50%' }} />
          </div>
        ) : (
          <>
            {/* ── Stats Dashboard ── */}
            <div className="history-stats iv-animate-slide-up iv-delay-2">
              <StatWidget icon={Layers} label="Tổng phỏng vấn" value={stats.total} color="#3B82F6" />
              <StatWidget icon={Target} label="Điểm trung bình" value={`${stats.avgScore}%`} color="#8B5CF6" />
              <StatWidget icon={Award} label="Điểm cao nhất" value={`${stats.bestScore}%`} color="#22C55E" />
              <div className="stat-widget stat-widget--trend">
                <div className="stat-widget__icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06B6D4' }}>
                  <TrendingUp size={20} />
                </div>
                <div className="stat-widget__info">
                  <span className="stat-widget__label">Xu hướng</span>
                  <MiniTrend data={stats.trendData} />
                </div>
              </div>
            </div>

            {/* ── Filter Bar ── */}
            <div className="history-filters iv-animate-fade iv-delay-3">
              <div className="history-search">
                <Search size={16} className="history-search__icon" />
                <input
                  type="text"
                  className="iv-input history-search__input"
                  placeholder="Tìm kiếm theo ngành nghề..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="history-filter-actions">
                <button
                  className={`iv-btn iv-btn--secondary iv-btn--sm ${showFilters ? 'iv-btn--active' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={14} />
                  Bộ lọc
                  {activeFiltersCount > 0 && <span className="filter-count">{activeFiltersCount}</span>}
                </button>

                <select
                  className="history-sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="highest">Điểm cao nhất</option>
                  <option value="lowest">Điểm thấp nhất</option>
                </select>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="history-filter-panel iv-animate-fade">
                <div className="filter-group">
                  <label className="filter-group__label">Ngành nghề</label>
                  <select className="history-sort-select" value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}>
                    <option value="all">Tất cả</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind.id} value={ind.id}>{ind.nameVi}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-group__label">Độ khó</label>
                  <select className="history-sort-select" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
                    <option value="all">Tất cả</option>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
                {activeFiltersCount > 0 && (
                  <button className="iv-btn iv-btn--ghost iv-btn--sm" onClick={clearFilters}>
                    <X size={14} />
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}

            {/* ── Interview List ── */}
            <div className="history-list iv-animate-slide-up iv-delay-4">
              {paginatedHistory.length === 0 ? (
                <div className="history-empty">
                  <BarChart3 size={40} />
                  <h3>Không tìm thấy dữ liệu</h3>
                  <p>Ứng viên này chưa có bài phỏng vấn nào phù hợp với bộ lọc.</p>
                </div>
              ) : (
                paginatedHistory.map((item, index) => (
                  <div key={item.id} className={`history-card iv-animate-slide-up iv-delay-${Math.min(index + 1, 8)}`}>
                    <div className="history-card__main">
                      <div className="history-card__score-ring">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--iv-bg-elevated)" strokeWidth="3" />
                          <circle cx="24" cy="24" r="20" fill="none"
                            stroke={getScoreColor(item.score)} strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${(item.score / 100) * 125.6} 125.6`}
                            transform="rotate(-90 24 24)"
                          />
                        </svg>
                        <span className="history-card__score-num" style={{ color: getScoreColor(item.score) }}>
                          {item.score}
                        </span>
                      </div>

                      <div className="history-card__info">
                        <h3 className="history-card__industry">{item.industry}</h3>
                        <div className="history-card__meta">
                          <span className="history-card__date">
                            <Calendar size={12} />
                            {formatDate(item.date)}
                          </span>
                        </div>
                      </div>

                      <div className="history-card__badges">
                        <span className="iv-badge" style={{
                          background: `${getDifficultyColor(item.difficulty)}15`,
                          color: getDifficultyColor(item.difficulty)
                        }}>
                          {item.difficultyVi}
                        </span>
                        <span className={`iv-badge ${item.status === 'completed' ? 'iv-badge--success' : 'iv-badge--warning'}`}>
                          {item.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                        </span>
                      </div>
                    </div>

                    <div className="history-card__actions">
                      {/* Navigate to result page for this specific interview */}
                      <button className="iv-btn iv-btn--primary iv-btn--sm"
                        onClick={() => navigate(`/interview/result/${item.id}`)}>
                        <Eye size={14} />
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="history-pagination iv-animate-fade" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                <button 
                  className="iv-btn iv-btn--secondary iv-btn--sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  <ChevronLeft size={16} /> Trước
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--iv-text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: 'var(--iv-radius-full)' }}>
                  Trang <strong style={{ color: 'var(--iv-text-primary)' }}>{currentPage}</strong> / {totalPages}
                </span>
                <button 
                  className="iv-btn iv-btn--secondary iv-btn--sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Sau <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

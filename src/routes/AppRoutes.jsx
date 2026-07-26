import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import LandingPage from '../pages/Landing/LandingPage';
import CVManager from '../pages/CV/CVManager';
import Login from '../pages/Auth/Login';
import ResetPassword from '../pages/Auth/ResetPassword';
import Profile from '../pages/Auth/Profile';
import ProtectedRoute from '../ProtectedRoute';
import AdminRoute from '../AdminRoute';
import MentorRoute from '../MentorRoute';
import Dashboard from '../pages/Dashboard/Dashboard';
import DailyQuestions from '../pages/Dashboard/DailyQuestions';
import QuestionBank from '../pages/Dashboard/QuestionBank';
import QuestionPractice from '../pages/Dashboard/QuestionPractice';
import PricingPage from '../pages/Subscriptions/PricingPage';
import AdminPanel from '../pages/Admin/AdminPanel';
import UsersView from '../pages/Admin/UsersView';
import StatisticsView from '../pages/Admin/StatisticsView';
import QuestionBankView from '../pages/Admin/QuestionBankView';
import BlogsView from '../pages/Admin/BlogsView';
import PracticeHistory from '../pages/Dashboard/PracticeHistory';
import ChallengesView from '../pages/Admin/ChallengesView';
import SubscriptionPlansView from '../pages/Admin/SubscriptionPlansView';
import OrdersView from '../pages/Admin/OrdersView';
import EmployersView from '../pages/Admin/EmployersView';
import MentorsView from '../pages/Admin/MentorsView';

// Recruiter Components
import RecruiterDashboard from '../pages/Recruiter/RecruiterDashboard';
import JobManagement from '../pages/Recruiter/JobManagement';
import PostJob from '../pages/Recruiter/PostJob';
import BlogManagement from '../pages/Recruiter/BlogManagement';
import PostBlog from '../pages/Recruiter/PostBlog';
import CompanyProfile from '../pages/Recruiter/CompanyProfile';
import ApplicationManagement from '../pages/Recruiter/ApplicationManagement';
import RecruiterRegistration from '../pages/Recruiter/RecruiterRegistration';

// Mentor Components
import MentorDashboard from '../pages/Mentor/MentorDashboard';
import MentorBlogManagement from '../pages/Mentor/MentorBlogManagement';
import MentorPostBlog from '../pages/Mentor/MentorPostBlog';
import MentorReviews from '../pages/Mentor/MentorReviews';
import MentorReviewDetail from '../pages/Mentor/MentorReviewDetail';
import MentorSchedule from '../pages/Mentor/MentorSchedule';
import MentorSession from '../pages/Mentor/MentorSession';
import MentorRegistration from '../pages/Mentor/MentorRegistration';
import MentorProfile from '../pages/Mentor/MentorProfile';
import MentorCandidateHistory from '../pages/Mentor/MentorCandidateHistory';

// Public Views
import CompanyView from '../pages/Public/CompanyView';
import BlogList from '../pages/Public/BlogList';
import BlogPost from '../pages/Public/BlogPost';
import JobView from '../pages/Public/JobView';
import JobList from '../pages/Public/JobList';
import TermsOfService from '../pages/Public/TermsOfService';
import PrivacyPolicy from '../pages/Public/PrivacyPolicy';

// User Booking Components
import MentorDirectory from '../pages/User/MentorDirectory';
import BookMentor from '../pages/User/BookMentor';
import MyBookings from '../pages/User/MyBookings';
import MyApplications from '../pages/User/MyApplications';

// Interview Pages
import InterviewLanding from '../pages/Interview/InterviewLanding';
import InterviewSetup from '../pages/Interview/InterviewSetup';
import InterviewRoom from '../pages/Interview/InterviewRoom';
import InterviewResult from '../pages/Interview/InterviewResult';
import InterviewHistory from '../pages/Interview/InterviewHistory';

const AppRoutes = () => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition-wrapper">
      <Routes location={location}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login initialView="register" />} />
      <Route path="/forgot-password" element={<Login initialView="forgot-password" />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pricing" element={<PricingPage />} />
      
      {/* Public Recruiter/Company views */}
      <Route path="/company/:id" element={<CompanyView />} />
      <Route path="/company/:companyId/job/:jobId" element={<JobView />} />
      <Route path="/jobs" element={<JobList />} />
      <Route path="/blogs" element={<BlogList />} />
      <Route path="/blog/:id" element={<BlogPost />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      
      {/* Protected User Routes */}
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/challenge/questions" element={<ProtectedRoute><DailyQuestions /></ProtectedRoute>} />
      <Route path="/question-bank" element={<ProtectedRoute><QuestionBank /></ProtectedRoute>} />
      <Route path="/question-bank/history" element={<ProtectedRoute><PracticeHistory /></ProtectedRoute>} />
      <Route path="/question-bank/practice/:id" element={<ProtectedRoute><QuestionPractice /></ProtectedRoute>} />
      <Route path="/cv-analysis" element={<ProtectedRoute><CVManager /></ProtectedRoute>} />
      
      <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>}>
        <Route index element={<Navigate to="statistics" replace />} />
        <Route path="statistics" element={<StatisticsView />} />
        <Route path="users" element={<UsersView />} />
        <Route path="questions" element={<QuestionBankView />} />
        <Route path="blogs" element={<BlogsView />} />
        <Route path="challenges" element={<ChallengesView />} />
        <Route path="subscriptions" element={<SubscriptionPlansView />} />
        <Route path="orders" element={<OrdersView />} />
        <Route path="employers" element={<EmployersView />} />
        <Route path="mentors" element={<MentorsView />} />
      </Route>
      
      {/* Interview Routes (Protected) */}
      <Route path="/interview" element={<ProtectedRoute><InterviewLanding /></ProtectedRoute>} />
      <Route path="/interview/setup" element={<ProtectedRoute><InterviewSetup /></ProtectedRoute>} />
      <Route path="/interview/room" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
      <Route path="/interview/result/:id" element={<ProtectedRoute><InterviewResult /></ProtectedRoute>} />
      <Route path="/interview/history" element={<ProtectedRoute><InterviewHistory /></ProtectedRoute>} />

      {/* Protected User Booking Routes */}
      <Route path="/mentors" element={<ProtectedRoute><MentorDirectory /></ProtectedRoute>} />
      <Route path="/mentors/book/:id" element={<ProtectedRoute><BookMentor /></ProtectedRoute>} />
      <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
      <Route path="/my-applications" element={<ProtectedRoute><MyApplications /></ProtectedRoute>} />

      {/* Protected Recruiter Routes */}
      <Route path="/recruiter-register" element={<RecruiterRegistration />} />
      <Route path="/recruiter" element={<ProtectedRoute><RecruiterDashboard /></ProtectedRoute>} />
      <Route path="/recruiter/company" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
      <Route path="/recruiter/jobs" element={<ProtectedRoute><JobManagement /></ProtectedRoute>} />
      <Route path="/recruiter/jobs/new" element={<ProtectedRoute><PostJob /></ProtectedRoute>} />
      <Route path="/recruiter/jobs/edit/:id" element={<ProtectedRoute><PostJob /></ProtectedRoute>} />
      <Route path="/recruiter/blogs" element={<ProtectedRoute><BlogManagement /></ProtectedRoute>} />
      <Route path="/recruiter/blogs/new" element={<ProtectedRoute><PostBlog /></ProtectedRoute>} />
      <Route path="/recruiter/blogs/edit/:id" element={<ProtectedRoute><PostBlog /></ProtectedRoute>} />
      <Route path="/recruiter/applications" element={<ProtectedRoute><ApplicationManagement /></ProtectedRoute>} />

      {/* Mentor Registration (public, requires login) */}
      <Route path="/mentor-register" element={<MentorRegistration />} />

      {/* Protected Mentor Routes */}
      <Route path="/mentor" element={<MentorRoute><MentorDashboard /></MentorRoute>} />
      <Route path="/mentor/profile" element={<MentorRoute><MentorProfile /></MentorRoute>} />
      <Route path="/mentor/blogs" element={<MentorRoute><MentorBlogManagement /></MentorRoute>} />
      <Route path="/mentor/blogs/new" element={<MentorRoute><MentorPostBlog /></MentorRoute>} />
      <Route path="/mentor/blogs/edit/:id" element={<MentorRoute><MentorPostBlog /></MentorRoute>} />
      <Route path="/mentor/reviews" element={<MentorRoute><MentorReviews /></MentorRoute>} />
      <Route path="/mentor/reviews/:id" element={<MentorRoute><MentorReviewDetail /></MentorRoute>} />
      <Route path="/mentor/schedule" element={<MentorRoute><MentorSchedule /></MentorRoute>} />
      <Route path="/mentor/schedule/session/:id" element={<MentorRoute><MentorSession /></MentorRoute>} />
      <Route path="/mentor/candidate-history/:id" element={<MentorRoute><MentorCandidateHistory /></MentorRoute>} />
    </Routes>
    </div>
  );
};

export default AppRoutes;

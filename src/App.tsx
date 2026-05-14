import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Monitor, 
  User, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Plus, 
  LogOut, 
  History,
  LayoutDashboard,
  Bell,
  ArrowRight,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type Role = 'admin' | 'lecturer' | 'student';

interface UserInfo {
  id: number;
  username: string;
  role: Role;
}

interface Resource {
  id: number;
  name: string;
  type: 'lab' | 'class' | 'projector';
}

interface Booking {
  id: number;
  user_id: number;
  username?: string;
  resource_id: number;
  resource_name?: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  purpose: string;
  created_at: string;
}

interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

// --- API Helpers ---

const API_BASE = '/api';

const fetchWithAuth = async (url: string, options: any = {}) => {
  const token = localStorage.getItem('dept_booking_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    if (localStorage.getItem('dept_booking_token')) {
        localStorage.removeItem('dept_booking_token');
        window.location.reload();
    }
  }
  return response.json();
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePortal, setActivePortal] = useState<'users' | 'admin' | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('dept_booking_token');
    if (token) {
      try {
        const data = await fetchWithAuth('/auth/me');
        if (data && data.id) setUser(data);
      } catch (e) {
        localStorage.removeItem('dept_booking_token');
      }
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const endpoint = authView === 'login' ? '/auth/login' : '/auth/register';
    const body = authView === 'login' 
      ? { username, password } 
      : { username, password, email, role };

    try {
      const data = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (data.token) {
        localStorage.setItem('dept_booking_token', data.token);
        setUser(data.user);
      } else if (data.message && authView === 'register') {
        alert('Registration successful! Use the login form to continue.');
        setAuthView('login');
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dept_booking_token');
    setUser(null);
    setActivePortal(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold text-slate-500">Initializing School Portal...</p>
    </div>
  );

  // Landing Page: Portal Selection
  if (!user && !activePortal) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-center p-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex p-4 rounded-3xl bg-white shadow-xl shadow-blue-100 text-blue-800 mb-6">
            <LayoutDashboard size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-extrabold text-[#0f172a] tracking-tight">University Resource Center</h1>
          <p className="text-slate-500 mt-4 text-xl font-medium max-w-2xl mx-auto">
            Centralized management for laboratories, lecture halls, and multimedia equipment scheduling.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          <PortalCard 
            title="Student & Lecturer" 
            desc="Access personal dashboard, check availability, and request facility usage."
            icon={<User size={36} />}
            colors="bg-blue-600 shadow-blue-100"
            onClick={() => setActivePortal('users')}
          />
          <PortalCard 
            title="Master Administration" 
            desc="Control system configuration, approve requests, and manage schedule overrides."
            icon={<ShieldCheck size={36} />}
            colors="bg-[#064e3b] shadow-emerald-100"
            onClick={() => {
                setActivePortal('admin');
                setAuthView('login');
                setRole('admin');
            }}
          />
        </div>
        
        <footer className="mt-20 text-slate-400 text-sm font-medium">
            &copy; 2026 Departmental Resource Management System
        </footer>
      </div>
    );
  }

  // Authentication Forms (Login/Register)
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        {/* Sidebar Background */}
        <div className={`hidden lg:flex lg:w-1/2 flex-col justify-center p-24 ${activePortal === 'admin' ? 'bg-[#064e3b]' : 'bg-[#1e3a8a]'} text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative z-10">
            <h2 className="text-6xl font-bold mb-8 leading-[1.1]">
              {activePortal === 'admin' ? 'Strategic Oversight' : 'Effortless Academic Planning'}
            </h2>
            <p className="text-2xl text-blue-100 opacity-80 max-w-lg font-medium leading-relaxed">
              Standardizing the way departments manage high-value assets and instructional spaces.
            </p>
          </motion.div>
          <div className="mt-16 space-y-8 relative z-10">
            <FeatureItem icon={<CheckCircle2 className="text-blue-400" />} text="Conflict-free scheduling algorithm" />
            <FeatureItem icon={<CheckCircle2 className="text-blue-400" />} text="Instant Lecturer confirmations" />
            <FeatureItem icon={<CheckCircle2 className="text-blue-400" />} text="Automated approval workflows" />
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-12 bg-slate-50/50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100"
          >
            <button 
              onClick={() => setActivePortal(null)}
              className="mb-10 flex items-center text-slate-400 hover:text-slate-900 transition-all font-bold group"
            >
              <ArrowRight className="rotate-180 mr-2 group-hover:-translate-x-1 transition-transform" size={20} /> Exit Portal
            </button>

            <header className="mb-12">
              <h1 className="text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
                {activePortal === 'admin' ? 'Admin Login' : (authView === 'login' ? 'Sign In' : 'Join System')}
              </h1>
              <p className="text-slate-400 font-medium text-lg">
                Access the {activePortal === 'admin' ? 'Master Administration' : 'User'} portal.
              </p>
            </header>

            <form onSubmit={handleAuth} className="space-y-6">
              {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm font-bold mb-6 animate-pulse">{error}</div>}
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">Username</label>
                <input 
                  type="text" required value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-lg font-medium"
                  placeholder="e.g. adams_admin"
                />
              </div>

              {authView === 'register' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">Email</label>
                    <input 
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-lg font-medium"
                        placeholder="staff@university.edu"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">Choose Role</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            type="button" onClick={() => setRole('student')}
                            className={`px-5 py-3 rounded-2xl border-2 font-bold transition-all text-sm ${role === 'student' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                        >
                            Student
                        </button>
                        <button 
                            type="button" onClick={() => setRole('lecturer')}
                            className={`px-5 py-3 rounded-2xl border-2 font-bold transition-all text-sm ${role === 'lecturer' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                        >
                            Lecturer
                        </button>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-widest ml-1">Password</label>
                <input 
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-lg font-medium"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                className={`w-full py-5 rounded-2xl text-white font-extrabold text-lg transition-all shadow-xl active:scale-[0.98] ${activePortal === 'admin' ? 'bg-[#064e3b] hover:bg-[#065f46] shadow-emerald-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
              >
                {authView === 'login' ? 'Proceed to Workspace' : 'Initialize Account'}
              </button>
            </form>

            {activePortal !== 'admin' && (
              <p className="text-center mt-10 text-slate-400 font-bold">
                {authView === 'login' ? "New member?" : "Already configured?"}{' '}
                <button 
                  onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')}
                  className="text-blue-600 hover:underline"
                >
                  {authView === 'login' ? 'Register Now' : 'Sign In Instead'}
                </button>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // Dashboard Logic
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      <Dashboard user={user} onLogout={handleLogout} />
    </div>
  );
}

// --- Dashboard Component ---

function Dashboard({ user, onLogout }: { user: UserInfo, onLogout: () => void }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'facilities' | 'notifications' | 'audit'>('facilities');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'cancelled' | 'pending'>('all');
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  // New Booking State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
        const [resData, bookData, notifData] = await Promise.all([
            fetchWithAuth('/resources'),
            fetchWithAuth('/bookings'),
            fetchWithAuth('/notifications')
        ]);
        setResources(resData);
        setBookings(bookData);
        setNotifications(notifData);
    } catch (e) {
        console.error("Data fetch error", e);
    }
  };

  const markAsRead = async (id: number) => {
    await fetchWithAuth(`/notifications/${id}/read`, { method: 'PATCH' });
    fetchData();
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    
    if (!selectedResource || !startTime || !endTime) return;

    if (new Date(startTime) >= new Date(endTime)) {
        setBookingError('End time must be after start time');
        return;
    }

    const data = await fetchWithAuth('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        resource_id: selectedResource,
        start_time: startTime.replace('T', ' '),
        end_time: endTime.replace('T', ' '),
        purpose
      })
    });

    if (data.bookingId) {
      alert(data.message);
      setShowBookingModal(false);
      fetchData();
      // Reset
      setStartTime(''); setEndTime(''); setPurpose('');
    } else {
      setBookingError(data.message || 'Overlap detected or server error');
    }
  };

  const updateBookingStatus = async (id: number, status: string, options: any = {}) => {
    const data = await fetchWithAuth(`/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...options })
    });
    if (data.message) fetchData();
  };

  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'audit') return true; // Show all in audit
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  return (
    <>
      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-80 ${user.role === 'admin' ? 'bg-[#042f2e]' : 'bg-[#0f172a]'} text-white flex flex-col shrink-0 transition-colors duration-500`}>
        <div className="p-10">
          <div className="flex items-center gap-4 mb-14">
            <div className={`p-3 rounded-2xl ${user.role === 'admin' ? 'bg-[#059669]' : 'bg-blue-600'} shadow-lg`}>
                <LayoutDashboard size={28} />
            </div>
            <div>
                <h2 className="font-extrabold text-2xl tracking-tighter leading-none">Dept<span className="text-blue-500">Center</span></h2>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-40">School System</span>
            </div>
          </div>

          <nav className="space-y-2">
            <SidebarItem 
                icon={<Calendar size={22} />} 
                text="Facility Board" 
                active={activeTab === 'facilities'} 
                onClick={() => { setActiveTab('facilities'); setStatusFilter('all'); }}
            />
            <SidebarItem 
                icon={<Bell size={22} />} 
                text="Notifications" 
                active={activeTab === 'notifications'}
                onClick={() => setActiveTab('notifications')}
                badge={notifications.filter(n => !n.is_read).length || undefined} 
            />
            <SidebarItem 
                icon={<History size={22} />} 
                text={user.role === 'admin' ? 'Audit Logs' : 'Booking History'} 
                active={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
            />
          </nav>
        </div>

        <div className="mt-auto p-10 border-t border-white/5 space-y-8 text-white/90">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black text-blue-400">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-extrabold text-lg truncate max-w-[140px] tracking-tight">{user.username}</p>
              <div className="flex items-center gap-1.5 opacity-50">
                  <div className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                  <p className="text-[10px] uppercase font-black tracking-widest">{user.role}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all font-bold text-sm tracking-wide border border-white/5"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Board */}
      <main className="flex-1 p-8 md:p-14 overflow-y-auto bg-[#f8fafc]">
        {activeTab === 'notifications' ? (
            <section className="max-w-4xl mx-auto">
                <header className="mb-14 text-center">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Notification Center</h1>
                    <p className="text-slate-400 font-medium text-lg">Stay updated with your facility requests and status changes.</p>
                </header>
                <div className="space-y-4">
                    {notifications.length === 0 ? (
                        <div className="py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                            <Bell size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-lg">No notifications yet.</p>
                        </div>
                    ) : (
                        notifications.map(notif => (
                            <motion.div 
                                key={notif.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-8 rounded-[2.5rem] border ${notif.is_read ? 'bg-white border-slate-100 opacity-60' : 'bg-white border-blue-100 shadow-xl shadow-blue-50'} transition-all`}
                            >
                                <div className="flex items-start justify-between gap-6">
                                    <div className="flex gap-6">
                                        <div className={`mt-1 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${notif.type === 'booking_request' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {notif.type === 'booking_request' ? <Plus size={20} /> : <CheckCircle2 size={20} />}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-1">{notif.title}</h4>
                                            <p className="text-slate-500 font-bold mb-4">{notif.message}</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    {!notif.is_read && (
                                        <button 
                                            onClick={() => markAsRead(notif.id)}
                                            className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Mark as Read
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
        ) : (
            <>
                <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-14">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                {activeTab === 'audit' ? (user.role === 'admin' ? 'Audit Records' : 'My History') : (user.role === 'admin' ? 'Administrative Control' : `Dashboard Overview`)}
            </h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
                {activeTab === 'audit' 
                    ? 'Total log of system participation and allocations within the department.'
                    : (user.role === 'admin' 
                        ? `System maintenance and verification. You have ${pendingCount} incoming requests from users.` 
                        : `Manage resource allocations and track your departmental requests across multiple facilities.`)}
            </p>
          </div>
          {user.role !== 'admin' && activeTab !== 'audit' && (
            <button 
                onClick={() => setShowBookingModal(true)}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-[1.75rem] font-black shadow-[0_20px_50px_rgba(37,99,235,0.2)] hover:-translate-y-1 transition-all"
            >
              <Plus size={24} strokeWidth={3} /> New Reservation
            </button>
          )}
        </header>

        {user.role === 'admin' && pendingCount > 0 && activeTab === 'facilities' && (
            <section className="mb-16">
                <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Pending Approvals</h3>
                    <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {bookings.filter(b => b.status === 'pending').map(booking => (
                        <BookingCard 
                            key={booking.id} 
                            booking={booking} 
                            isAdmin={true} 
                            onAction={(status) => updateBookingStatus(booking.id, status)}
                        />
                    ))}
                </div>
            </section>
        )}

        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
                    {activeTab === 'audit' ? 'Full Archive' : (user.role === 'admin' ? 'Master History' : 'Recent Activities')}
                </h3>
                <div className="h-px w-20 bg-slate-200"></div>
            </div>
            {activeTab !== 'audit' && (
                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                    <StatusFilter label="All View" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
                    <StatusFilter label="Confirmed" active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} />
                    <StatusFilter label="Cancelled" active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
                </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredBookings.filter(b => (activeTab === 'audit' ? true : (user.role === 'admin' ? b.status !== 'pending' : true))).length === 0 ? (
                <div className="col-span-full py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <Calendar size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">No records found yet.</p>
                </div>
            ) : (
                filteredBookings.filter(b => (activeTab === 'audit' ? true : (user.role === 'admin' ? b.status !== 'pending' : true))).map(booking => (
                    <BookingCard 
                        key={booking.id} 
                        booking={booking} 
                        isAdmin={user.role === 'admin'}
                        onAction={(status) => updateBookingStatus(booking.id, status)}
                    />
                ))
            )}
          </div>
        </section>
      </>
        )}
      </main>

      {/* Booking Form Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowBookingModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              <div className="p-12 border-b border-slate-50 bg-[#f8fafc]/50">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Facility Request</h2>
                <p className="text-slate-400 font-medium text-lg mt-1">Specify your resource needs and time duration.</p>
              </div>

              <form onSubmit={handleBooking} className="p-12 space-y-8">
                {bookingError && <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-bold border-l-4 border-red-500">{bookingError}</div>}
                
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Select Facility / Hardware</label>
                  <select 
                    required value={selectedResource || ''} onChange={e => setSelectedResource(Number(e.target.value))}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                  >
                    <option value="">Select Resource Type...</option>
                    {resources.map(r => (
                      <option key={r.id} value={r.id}>{r.name.toUpperCase()} (Type: {r.type})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Booking From</label>
                    <input 
                      type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Expected Finish</label>
                    <input 
                      type="datetime-local" required value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Nature of Use</label>
                  <textarea 
                    value={purpose} onChange={e => setPurpose(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 h-32 resize-none"
                    placeholder="e.g. Lab session for CSC412 Data Structures"
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button" onClick={() => setShowBookingModal(false)}
                    className="flex-1 py-5 rounded-2xl bg-white border border-slate-200 text-slate-400 font-bold hover:bg-slate-50 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-100 transition-all uppercase tracking-[0.2em] text-sm"
                  >
                    Confirm Request
                  </button>
                </div>
                {user.role === 'student' && <p className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest opacity-60 italic">※ Student requests are pending admin verification</p>}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// --- Component Helpers ---

function PortalCard({ title, desc, icon, onClick, colors }: any) {
  return (
    <button 
      onClick={onClick}
      className={`group relative p-12 rounded-[3.5rem] bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.06)] transition-all duration-500 text-left`}
    >
      <div className={`mb-10 p-6 rounded-[2rem] w-fit ${colors} text-white transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-xl`}>
        {icon}
      </div>
      <h3 className="text-3xl font-black text-slate-900 mb-4 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{title}</h3>
      <p className="text-slate-400 leading-relaxed font-bold text-lg mb-10 opacity-70">
        {desc}
      </p>
      <div className="flex items-center font-black text-slate-900 group-hover:translate-x-2 transition-transform uppercase tracking-[0.2em] text-[10px]">
        Access Section <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" size={18} strokeWidth={3} />
      </div>
    </button>
  );
}

function FeatureItem({ icon, text }: any) {
  return (
    <div className="flex items-center gap-5 text-white/80 font-bold text-lg">
      <div className="bg-white/10 p-2 rounded-xl border border-white/5">{icon}</div>
      <span>{text}</span>
    </div>
  );
}

function SidebarItem({ icon, text, active, badge, onClick }: any) {
  return (
    <div 
        onClick={onClick}
        className={`flex items-center justify-between px-6 py-4 rounded-2xl transition-all cursor-pointer group ${active ? 'bg-white/10 text-white shadow-xl' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-4">
        <span className={`${active ? 'text-blue-400' : 'group-hover:text-white transition-colors'}`}>{icon}</span>
        <span className="text-[13px] font-black uppercase tracking-widest">{text}</span>
      </div>
      {badge && (
        <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full ring-4 ring-white/5">
          {badge}
        </span>
      )}
    </div>
  );
}

function StatusFilter({ label, active, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}
        >
            {label}
        </button>
    );
}

function BookingCard({ booking, isAdmin, onAction }: any) {
  const statusColors: any = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200'
  };

  const resourceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('projector')) return <Monitor size={24} />;
    if (n.includes('lab')) return <MapPin size={24} />;
    return <Calendar size={24} />;
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr.replace(' ', 'T')).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <motion.div 
      layout
      className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="flex gap-6">
            <div className={`h-16 w-16 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-inner ${booking.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                {resourceIcon(booking.resource_name || '')}
            </div>
            <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{booking.resource_name}</h4>
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0 ${statusColors[booking.status]}`}>
                        {booking.status}
                    </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2"><Clock size={16} className="opacity-30" /> {formatTime(booking.start_time)} — {formatTime(booking.end_time)}</div>
                    {isAdmin && <div className="flex items-center gap-2"><User size={16} className="opacity-30" /> REF: {booking.username?.toUpperCase()}</div>}
                </div>
                {booking.purpose && <p className="mt-4 text-xs text-slate-400 font-bold bg-slate-50 px-4 py-2 rounded-xl inline-block border border-slate-100">“{booking.purpose}”</p>}
            </div>
        </div>

        <div className="flex items-center gap-3">
            {isAdmin && booking.status === 'pending' && (
                <>
                    <button 
                        onClick={() => onAction('approved')}
                        className="flex-1 xl:flex-none px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-lg shadow-emerald-100 transition-all uppercase tracking-widest"
                    >
                        Approve
                    </button>
                    <button 
                        onClick={() => onAction('rejected')}
                        className="flex-1 xl:flex-none px-6 py-3.5 rounded-2xl bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 text-[11px] font-black transition-all uppercase tracking-widest"
                    >
                        Deny
                    </button>
                </>
            )}
            {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                <button 
                    onClick={() => onAction('cancelled')}
                    className="flex-1 xl:flex-none px-6 py-3.5 rounded-2xl bg-transparent text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all text-[11px] font-black uppercase tracking-widest border border-transparent hover:border-red-100"
                >
                    {isAdmin ? 'Revoke Allocation' : 'Cancel Request'}
                </button>
            )}
        </div>
      </div>
    </motion.div>
  );
}


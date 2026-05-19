import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import supabase from './src/db';
import { hashPassword, comparePassword, generateToken, verifyToken } from './src/auth';

type Role = 'admin' | 'lecturer' | 'student';

interface AuthRequest extends Request {
    user?: { id: number; username: string; role: Role };
}

type UserRow = {
    id: number;
    username: string;
    password: string;
    email: string;
    role: Role;
};

type ResourceRow = {
    id: number;
    name: string;
    type: string;
};

type BookingRow = {
    id: number;
    user_id: number;
    resource_id: number;
    start_time: string;
    end_time: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    purpose: string | null;
    created_at: string;
};

type NotificationRow = {
    id: number;
    user_id: number;
    title: string;
    message: string;
    type: string;
    is_read: number;
    created_at: string;
};

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token required' });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(403).json({ message: 'Invalid or expired token' });

    req.user = decoded;
    next();
};

const safeSingle = async <T>(query: PromiseLike<{ data: T | null; error: any }>) => {
    const result = await query;
    if (result.error) throw result.error;
    return result.data;
};

const loadResources = async () => {
    const { data, error } = await supabase
        .from('resources')
        .select('id, name, type')
        .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ResourceRow[];
};

const loadUsersByIds = async (ids: number[]) => {
    if (ids.length === 0) return [] as Pick<UserRow, 'id' | 'username' | 'role'>[];

    const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .in('id', ids);

    if (error) throw error;
    return (data ?? []) as Pick<UserRow, 'id' | 'username' | 'role'>[];
};

const loadResourcesByIds = async (ids: number[]) => {
    if (ids.length === 0) return [] as ResourceRow[];

    const { data, error } = await supabase
        .from('resources')
        .select('id, name, type')
        .in('id', ids);

    if (error) throw error;
    return (data ?? []) as ResourceRow[];
};

const formatBookings = async (bookings: BookingRow[]) => {
    const userIds = [...new Set(bookings.map((booking) => booking.user_id))];
    const resourceIds = [...new Set(bookings.map((booking) => booking.resource_id))];
    const [users, resources] = await Promise.all([
        loadUsersByIds(userIds),
        loadResourcesByIds(resourceIds),
    ]);

    const userMap = new Map(users.map((user) => [user.id, user.username]));
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource.name]));

    return bookings.map((booking) => ({
        ...booking,
        username: userMap.get(booking.user_id),
        resource_name: resourceMap.get(booking.resource_id),
    }));
};

const seedSupabaseData = async () => {
    const resources = [
        { name: 'hwlab', type: 'lab' },
        { name: 'swlab', type: 'lab' },
        { name: 'cmplh', type: 'class' },
        { name: 'clr1', type: 'class' },
        { name: 'clr2', type: 'class' },
        { name: 'clr3', type: 'class' },
        { name: 'clr4', type: 'class' },
        { name: 'clr5', type: 'class' },
        { name: 'projector 1', type: 'projector' },
        { name: 'projector 2', type: 'projector' },
        { name: 'projector 3', type: 'projector' },
        { name: 'projector 4', type: 'projector' },
        { name: 'projector 5', type: 'projector' },
    ];

    const { error: resourcesError } = await supabase.from('resources').upsert(resources, {
        onConflict: 'name',
    });

    if (resourcesError) {
        throw resourcesError;
    }

    const { data: adminExists, error: adminLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

    if (adminLookupError) {
        throw adminLookupError;
    }

    if (!adminExists) {
        const hashedPassword = await hashPassword('admin123');
        const { error: adminInsertError } = await supabase.from('users').insert({
            username: 'admin',
            password: hashedPassword,
            email: 'admin@school.edu',
            role: 'admin',
        });

        if (adminInsertError) {
            throw adminInsertError;
        }

        console.log('Seeded default admin user: admin / admin123');
    }
};

type AppOptions = {
    enableVite?: boolean;
    serveStatic?: boolean;
};

export async function createApp(options: AppOptions = {}) {
    const app = express();

    await seedSupabaseData();

    app.use(cors());
    app.use(helmet({
        contentSecurityPolicy: false,
    }));
    app.use(express.json());

    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', database: 'supabase' });
    });

    app.post('/api/auth/register', async (req, res) => {
        const { username, password, email, role } = req.body;

        if (!['lecturer', 'student'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role for registration' });
        }

        try {
            const hashedPassword = await hashPassword(password);
            const { data, error } = await supabase
                .from('users')
                .insert({ username, password: hashedPassword, email, role })
                .select('id')
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(400).json({ message: 'Username or email already exists' });
                }

                throw error;
            }

            res.status(201).json({ message: 'User registered successfully', userId: data.id });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('id, username, password, role')
                .eq('username', username)
                .maybeSingle();

            if (error) throw error;
            if (!user) return res.status(400).json({ message: 'User not found' });

            const validPassword = await comparePassword(password, user.password);
            if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

            const token = generateToken({ id: user.id, username: user.username, role: user.role });

            res.json({
                token,
                user: { id: user.id, username: user.username, role: user.role },
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res) => {
        res.json(req.user);
    });

    app.get('/api/resources', authenticateToken, async (req, res) => {
        try {
            const resources = await loadResources();
            res.json(resources);
        } catch (error) {
            console.error('Resource fetch error:', error);
            res.status(500).json({ message: 'Error fetching resources' });
        }
    });

    app.get('/api/notifications', authenticateToken, async (req: AuthRequest, res) => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', req.user?.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            res.json((data ?? []) as NotificationRow[]);
        } catch (error) {
            console.error('Notification fetch error:', error);
            res.status(500).json({ message: 'Error fetching notifications' });
        }
    });

    app.patch('/api/notifications/:id/read', authenticateToken, async (req: AuthRequest, res) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: 1 })
                .eq('id', Number(req.params.id))
                .eq('user_id', req.user?.id);

            if (error) throw error;

            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            console.error('Notification update error:', error);
            res.status(500).json({ message: 'Error updating notification' });
        }
    });

    app.get('/api/bookings', authenticateToken, async (req: AuthRequest, res) => {
        try {
            let query = supabase.from('bookings').select('*').order('start_time', { ascending: false });

            if (req.user?.role !== 'admin') {
                query = query.eq('user_id', req.user?.id);
            }

            const { data, error } = await query;
            if (error) throw error;

            res.json(await formatBookings((data ?? []) as BookingRow[]));
        } catch (error) {
            console.error('Booking fetch error:', error);
            res.status(500).json({ message: 'Error fetching bookings' });
        }
    });

    app.post('/api/bookings', authenticateToken, async (req: AuthRequest, res) => {
        const { resource_id, start_time, end_time, purpose } = req.body;
        const user_id = req.user?.id;
        const role = req.user?.role;

        try {
            const { data: conflict, error: conflictError } = await supabase
                .from('bookings')
                .select('id')
                .eq('resource_id', resource_id)
                .in('status', ['approved', 'pending'])
                .lt('start_time', end_time)
                .gt('end_time', start_time)
                .limit(1)
                .maybeSingle();

            if (conflictError) throw conflictError;

            if (conflict) {
                return res.status(409).json({ message: 'Resource is already booked or requested for this time slot' });
            }

            const status = role === 'lecturer' ? 'approved' : 'pending';
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .insert({ user_id, resource_id, start_time, end_time, status, purpose })
                .select('id')
                .single();

            if (bookingError) throw bookingError;

            if (role === 'student') {
                const [{ data: admins, error: adminsError }, { data: resource, error: resourceError }] = await Promise.all([
                    supabase.from('users').select('id').eq('role', 'admin'),
                    supabase.from('resources').select('name').eq('id', resource_id).single(),
                ]);

                if (adminsError) throw adminsError;
                if (resourceError) throw resourceError;

                const notifications = (admins ?? []).map((admin) => ({
                    user_id: admin.id,
                    title: 'New Booking Request',
                    message: `${req.user?.username} requested ${resource?.name} for ${start_time}.`,
                    type: 'booking_request',
                }));

                if (notifications.length > 0) {
                    const { error: notificationError } = await supabase.from('notifications').insert(notifications);
                    if (notificationError) throw notificationError;
                }
            }

            res.status(201).json({
                message: role === 'lecturer' ? 'Booking confirmed' : 'Request submitted',
                bookingId: booking.id,
            });
        } catch (error) {
            console.error('Booking create error:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    app.patch('/api/bookings/:id', authenticateToken, async (req: AuthRequest, res) => {
        const { status, start_time, end_time, resource_id } = req.body;
        const bookingId = Number(req.params.id);

        try {
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .maybeSingle();

            if (bookingError) throw bookingError;
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            const isAdmin = req.user?.role === 'admin';
            const isOwner = booking.user_id === req.user?.id;

            if (!isAdmin && !isOwner) {
                return res.status(403).json({ message: 'Access denied' });
            }

            if (!isAdmin && status !== 'cancelled') {
                return res.status(403).json({ message: 'You can only cancel your own bookings' });
            }

            if (isAdmin && (start_time || end_time || resource_id)) {
                const effectiveResourceId = resource_id || booking.resource_id;
                const effectiveStartTime = start_time || booking.start_time;
                const effectiveEndTime = end_time || booking.end_time;

                const { data: conflict, error: conflictError } = await supabase
                    .from('bookings')
                    .select('id')
                    .neq('id', bookingId)
                    .eq('resource_id', effectiveResourceId)
                    .in('status', ['approved', 'pending'])
                    .lt('start_time', effectiveEndTime)
                    .gt('end_time', effectiveStartTime)
                    .limit(1)
                    .maybeSingle();

                if (conflictError) throw conflictError;
                if (conflict) {
                    return res.status(409).json({ message: 'Rescheduling conflict detected' });
                }
            }

            const updates: Record<string, any> = {
                status: status || booking.status,
            };

            if (isAdmin && start_time) updates.start_time = start_time;
            if (isAdmin && end_time) updates.end_time = end_time;
            if (isAdmin && resource_id) updates.resource_id = resource_id;

            const { error: updateError } = await supabase
                .from('bookings')
                .update(updates)
                .eq('id', bookingId);

            if (updateError) throw updateError;

            if (status && status !== booking.status) {
                const { data: resource, error: resourceError } = await supabase
                    .from('resources')
                    .select('name')
                    .eq('id', booking.resource_id)
                    .single();

                if (resourceError) throw resourceError;

                const { error: notificationError } = await supabase.from('notifications').insert({
                    user_id: booking.user_id,
                    title: 'Booking Status Updated',
                    message: `Your booking for ${resource.name} is now ${status.toUpperCase()}.`,
                    type: 'status_update',
                });

                if (notificationError) throw notificationError;
            }

            res.json({ message: 'Booking updated successfully' });
        } catch (error) {
            console.error('Booking update error:', error);
            res.status(500).json({ message: 'Error updating booking' });
        }
    });

    if (options.enableVite ?? process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else if (options.serveStatic ?? process.env.NODE_ENV === 'production') {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    return app;
}

async function startServer() {
    const app = await createApp({
        enableVite: process.env.NODE_ENV !== 'production',
        serveStatic: process.env.NODE_ENV === 'production',
    });
    const PORT = Number(process.env.PORT || 3000);

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

if (process.env.VERCEL !== '1') {
    startServer().catch((err) => {
        console.error('Failed to start server:', err);
    });
}

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import db from './src/db';
import { hashPassword, comparePassword, generateToken, verifyToken } from './src/auth';

// Extend Express Request type to include user
interface AuthRequest extends Request {
    user?: { id: number; username: string; role: string };
}

// Middleware to authenticate JWT
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token required' });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(403).json({ message: 'Invalid or expired token' });
    
    req.user = decoded;
    next();
};

// Middleware to check specific roles
const authorizeRoles = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(helmet({
        contentSecurityPolicy: false, // Disable for Vite dev
    }));
    app.use(express.json());

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', database: 'connected' });
    });

    // Auth Routes
    app.post('/api/auth/register', async (req, res) => {
        const { username, password, email, role } = req.body;
        
        // Prevent registering as admin. Admins must be seeded or created by another admin.
        if (!['lecturer', 'student'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role for registration' });
        }

        try {
            const hashedPassword = await hashPassword(password);
            const stmt = db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)');
            stmt.run(username, hashedPassword, email, role);
            res.status(201).json({ message: 'User registered successfully' });
        } catch (error: any) {
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ message: 'Username or email already exists' });
            }
            res.status(500).json({ message: 'Server error' });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
            if (!user) return res.status(400).json({ message: 'User not found' });

            const validPassword = await comparePassword(password, user.password);
            if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

            const token = generateToken({ id: user.id, username: user.username, role: user.role });

            res.json({ 
                token, 
                user: { id: user.id, username: user.username, role: user.role } 
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Get current user (protected)
    app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res) => {
        res.json(req.user);
    });

    // Resource Routes
    app.get('/api/resources', authenticateToken, (req, res) => {
        try {
            const resources = db.prepare('SELECT * FROM resources').all();
            res.json(resources);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching resources' });
        }
    });

    // Notification Routes
    app.get('/api/notifications', authenticateToken, (req: AuthRequest, res) => {
        try {
            const notifications = db.prepare(`
                SELECT * FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 50
            `).all(req.user?.id);
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching notifications' });
        }
    });

    app.patch('/api/notifications/:id/read', authenticateToken, (req: AuthRequest, res) => {
        try {
            db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
                .run(req.params.id, req.user?.id);
            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            res.status(500).json({ message: 'Error updating notification' });
        }
    });

    // Booking Routes
    app.get('/api/bookings', authenticateToken, (req: AuthRequest, res) => {
        try {
            let bookings;
            if (req.user?.role === 'admin') {
                bookings = db.prepare(`
                    SELECT b.*, u.username, r.name as resource_name 
                    FROM bookings b
                    JOIN users u ON b.user_id = u.id
                    JOIN resources r ON b.resource_id = r.id
                    ORDER BY b.start_time DESC
                `).all();
            } else {
                bookings = db.prepare(`
                    SELECT b.*, u.username, r.name as resource_name 
                    FROM bookings b
                    JOIN users u ON b.user_id = u.id
                    JOIN resources r ON b.resource_id = r.id
                    WHERE b.user_id = ?
                    ORDER BY b.start_time DESC
                `).all(req.user?.id);
            }
            res.json(bookings);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching bookings' });
        }
    });

    app.post('/api/bookings', authenticateToken, (req: AuthRequest, res) => {
        const { resource_id, start_time, end_time, purpose } = req.body;
        const user_id = req.user?.id;
        const role = req.user?.role;

        try {
            // Strict Conflict Check: overlap if (start1 < end2) AND (start2 < end1)
            const conflict = db.prepare(`
                SELECT id FROM bookings 
                WHERE resource_id = ? 
                AND status IN ('approved', 'pending')
                AND (? < end_time AND ? > start_time)
            `).get(resource_id, start_time, end_time);

            if (conflict) {
                return res.status(409).json({ message: 'Resource is already booked or requested for this time slot' });
            }

            // Lecturers get instant approval, students stay pending
            const status = role === 'lecturer' ? 'approved' : 'pending';

            const stmt = db.prepare(`
                INSERT INTO bookings (user_id, resource_id, start_time, end_time, status, purpose)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(user_id, resource_id, start_time, end_time, status, purpose);

            // Notify Admins about new requests from students
            if (role === 'student' && status === 'pending') {
                const admins = db.prepare('SELECT id FROM users WHERE role = "admin"').all();
                const notifyAdmins = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');
                const resource: any = db.prepare('SELECT name FROM resources WHERE id = ?').get(resource_id);
                
                admins.forEach((admin: any) => {
                    notifyAdmins.run(
                        admin.id, 
                        'New Booking Request', 
                        `${req.user?.username} requested ${resource.name} for ${start_time}.`, 
                        'booking_request'
                    );
                });
            }

            res.status(201).json({ 
                message: role === 'lecturer' ? 'Booking confirmed' : 'Request submitted',
                bookingId: result.lastInsertRowid 
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });

    // Admin/User status update (cancel/approve/reject/reschedule)
    app.patch('/api/bookings/:id', authenticateToken, (req: AuthRequest, res) => {
        const { status, start_time, end_time, resource_id } = req.body;
        const bookingId = Number(req.params.id);

        try {
            const booking: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            const isAdmin = req.user?.role === 'admin';
            const isOwner = booking.user_id === req.user?.id;

            if (!isAdmin && !isOwner) {
                return res.status(403).json({ message: 'Access denied' });
            }

            // Students/Lecturers can only cancel their own bookings
            if (!isAdmin && status !== 'cancelled') {
                return res.status(403).json({ message: 'You can only cancel your own bookings' });
            }

            // If rescheduling (Admin only or update allowed fields)
            let query = 'UPDATE bookings SET status = ?';
            const params: any[] = [status || booking.status];

            if (isAdmin && (start_time || end_time || resource_id)) {
                // Conflict check for new times/resource
                const checkConflict = db.prepare(`
                    SELECT id FROM bookings 
                    WHERE id != ? 
                    AND resource_id = ? 
                    AND status IN ('approved', 'pending')
                    AND (? < end_time AND ? > start_time)
                `).get(bookingId, resource_id || booking.resource_id, start_time || booking.start_time, end_time || booking.end_time);

                if (checkConflict) {
                    return res.status(409).json({ message: 'Rescheduling conflict detected' });
                }

                if (start_time) { query += ', start_time = ?'; params.push(start_time); }
                if (end_time) { query += ', end_time = ?'; params.push(end_time); }
                if (resource_id) { query += ', resource_id = ?'; params.push(resource_id); }
            }

            query += ' WHERE id = ?';
            params.push(bookingId);

            db.prepare(query).run(...params);

            // Notify User about status update
            if (status && status !== booking.status) {
                const resource: any = db.prepare('SELECT name FROM resources WHERE id = ?').get(booking.resource_id);
                db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)')
                    .run(
                        booking.user_id, 
                        'Booking Status Updated', 
                        `Your booking for ${resource.name} is now ${status.toUpperCase()}.`, 
                        'status_update'
                    );
            }

            res.json({ message: 'Booking updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error updating booking' });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error('Failed to start server:', err);
});

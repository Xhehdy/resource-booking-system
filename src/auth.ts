import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

type Role = 'admin' | 'lecturer' | 'student';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashed: string): Promise<boolean> => {
    return bcrypt.compare(password, hashed);
};

export const generateToken = (user: { id: number; username: string; role: Role }) => {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: Role };
    } catch (err) {
        return null;
    }
};

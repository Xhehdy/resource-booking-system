import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize database with schema
const schema = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8');
db.exec(schema);

// Seed initial resources
const seedResources = () => {
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

    const insert = db.prepare('INSERT OR IGNORE INTO resources (name, type) VALUES (?, ?)');
    const transaction = db.transaction((data) => {
        for (const item of data) {
            insert.run(item.name, item.type);
        }
    });
    transaction(resources);
};

// Seed default admin
const seedUsers = async () => {
    const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)')
            .run('admin', hashedPassword, 'admin@school.edu', 'admin');
        console.log('Seeded default admin user: admin / admin123');
    }
};

seedResources();
seedUsers();

export default db;

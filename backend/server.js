// server.js - مع دعم رفع الصور الكامل
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'supermarket-secret-key-2024';

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// التأكد من وجود مجلد database
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// التأكد من وجود مجلد uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// التأكد من وجود مجلد uploads/products
const productsDir = path.join(uploadsDir, 'products');
if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
}

// تهيئة قاعدة البيانات
const db = new sqlite3.Database('./backend/database/database.db');

// إنشاء الجداول
db.serialize(() => {
    // جدول المستخدمين
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )`);

    // جدول المنتجات
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )`);

    // جدول الطلبات
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        guest_email TEXT,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT NOT NULL,
        is_guest BOOLEAN DEFAULT 0,
        guest_order_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // جدول عناصر الطلبات
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    // جدول عربة التسوق
    db.run(`CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id),
        UNIQUE(user_id, product_id)
    )`);

    // جدول الإشعارات
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // جدول سجلات النسخ الاحتياطي
    db.run(`CREATE TABLE IF NOT EXISTS backup_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        file_name TEXT,
        data_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول سجلات النشاط
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // إضافة المستخدمين الافتراضيين
    const defaultAdminPassword = bcrypt.hashSync('admin123', 10);
    const defaultEmployeePassword = bcrypt.hashSync('employee123', 10);
    const defaultCustomerPassword = bcrypt.hashSync('customer123', 10);
    
    db.run(`INSERT OR IGNORE INTO users (id, name, email, password, phone, role) 
            VALUES (1, ?, ?, ?, ?, ?)`, 
            ['مدير النظام', 'admin@example.com', defaultAdminPassword, '0550000000', 'admin']);
    
    db.run(`INSERT OR IGNORE INTO users (id, name, email, password, phone, role) 
            VALUES (2, ?, ?, ?, ?, ?)`, 
            ['أحمد الموظف', 'employee@example.com', defaultEmployeePassword, '0551111111', 'employee']);
    
    db.run(`INSERT OR IGNORE INTO users (id, name, email, password, phone, role) 
            VALUES (3, ?, ?, ?, ?, ?)`, 
            ['عميل تجريبي', 'customer@example.com', defaultCustomerPassword, '0552222222', 'customer']);

    // إضافة منتجات افتراضية مع صور
    const defaultProducts = [
        [1, 'تفاح أحمر', 'تفاح طازج ومقرمش مستورد', 15.0, 'fruits', 50, '/uploads/products/apple.jpg'],
        [2, 'موز أصفر', 'موز ناضج وحلو من المزارع المحلية', 10.0, 'fruits', 30, '/uploads/products/banana.jpg'],
        [3, 'برتقال', 'برتقال عصيري طازج غني بفيتامين سي', 12.0, 'fruits', 40, '/uploads/products/orange.jpg'],
        [4, 'طماطم', 'طماطم حمراء طازجة من الزراعة العضوية', 8.0, 'vegetables', 60, '/uploads/products/tomato.jpg'],
        [5, 'خيار', 'خيار مقرمش ومنعش من البيوت المحمية', 7.0, 'vegetables', 45, '/uploads/products/cucumber.jpg'],
        [6, 'جزر', 'جزر حلو ومقرمش غني بالفيتامينات', 9.0, 'vegetables', 35, '/uploads/products/carrot.jpg'],
        [7, 'حليب طازج', 'حليب طازج كامل الدسم معبأ حديثاً', 18.0, 'dairy', 25, '/uploads/products/milk.jpg'],
        [8, 'جبن شيدر', 'جبن شيدر لذيذ من أفضل الأنواع', 25.0, 'dairy', 20, '/uploads/products/cheese.jpg'],
        [9, 'زبادي طبيعي', 'زبادي كريمي طبيعي 100%', 6.0, 'dairy', 40, '/uploads/products/yogurt.jpg'],
        [10, 'عصير برتقال', 'عصير برتقال طبيعي 100% بدون إضافات', 12.0, 'beverages', 30, '/uploads/products/juice.jpg']
    ];

    defaultProducts.forEach(product => {
        db.run(`INSERT OR IGNORE INTO products (id, name, description, price, category, stock, image) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, product);
    });

    // إضافة إشعارات افتراضية
    db.run(`INSERT OR IGNORE INTO notifications (user_id, title, message, type) 
            VALUES (1, 'مرحباً بك في النظام', 'تم تثبيت النظام بنجاح. يمكنك الآن البدء في إدارة متجرك.', 'success')`);
});

// تكوين multer لرفع الملفات
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, productsDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const filename = Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middleware للتحقق من التوكن
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'رمز الوصول مطلوب' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'رمز وصول غير صالح' });
        }
        req.user = user;
        next();
    });
};

// Middleware للتحقق من صلاحيات المدير
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'صلاحيات مدير مطلوبة' });
    }
    next();
};

// Middleware للتحقق من صلاحيات المدير أو الموظف
const requireAdminOrEmployee = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'employee') {
        return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }
    next();
};

// Middleware للتحقق من التوكن (اختياري للزوار)
const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                req.user = null;
            } else {
                req.user = user;
            }
            next();
        });
    } else {
        req.user = null;
        next();
    }
};

// Middleware لتسجيل النشاط
const logActivity = (action, details = '') => {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        db.run(
            'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [req.user?.id, action, details, ip],
            (err) => {
                if (err) console.error('Activity log error:', err);
            }
        );
        next();
    };
};

// ===== مسارات المصادقة =====
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (!user) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role, 
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        db.run(
            'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
            [user.id, 'login', `تم تسجيل الدخول من بريد: ${email}`]
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address
            }
        });
    });
});

app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'الاسم، البريد الإلكتروني وكلمة المرور مطلوبة' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (existingUser) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password, phone, address, role) 
             VALUES (?, ?, ?, ?, ?, 'customer')`,
            [name, email, hashedPassword, phone, address],
            function(err) {
                if (err) {
                    console.error('Insert user error:', err);
                    return res.status(500).json({ error: 'خطأ في إنشاء الحساب' });
                }

                const token = jwt.sign(
                    { 
                        id: this.lastID, 
                        email: email, 
                        role: 'customer', 
                        name: name 
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                db.run(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                    [this.lastID, 'مرحباً بك!', 'تم إنشاء حسابك بنجاح. استمتع بتجربة التسوق معنا.', 'success']
                );

                res.status(201).json({
                    token,
                    user: {
                        id: this.lastID,
                        name: name,
                        email: email,
                        role: 'customer',
                        phone: phone,
                        address: address
                    },
                    message: 'تم إنشاء الحساب بنجاح'
                });
            }
        );
    });
});

// ===== مسارات إدارة المستخدمين =====
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT id, name, email, phone, address, role, created_at FROM users WHERE is_active = 1 ORDER BY role, name', (err, users) => {
        if (err) {
            console.error('Get users error:', err);
            return res.status(500).json({ error: 'خطأ في جلب المستخدمين' });
        }
        res.json(users);
    });
});

app.get('/api/users/me', authenticateToken, (req, res) => {
    db.get(
        'SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ? AND is_active = 1',
        [req.user.id],
        (err, user) => {
            if (err) {
                console.error('Get user error:', err);
                return res.status(500).json({ error: 'خطأ في جلب بيانات المستخدم' });
            }

            if (!user) {
                return res.status(404).json({ error: 'المستخدم غير موجود' });
            }

            res.json(user);
        }
    );
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
        return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }

    db.get(
        'SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ? AND is_active = 1',
        [id],
        (err, user) => {
            if (err) {
                console.error('Get user error:', err);
                return res.status(500).json({ error: 'خطأ في جلب بيانات المستخدم' });
            }

            if (!user) {
                return res.status(404).json({ error: 'المستخدم غير موجود' });
            }

            res.json(user);
        }
    );
});

app.post('/api/users', authenticateToken, requireAdmin, logActivity('create_user'), async (req, res) => {
    const { name, email, password, phone, address, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
        if (err) {
            console.error('Check user error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (existingUser) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password, phone, address, role) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, phone, address, role],
            function(err) {
                if (err) {
                    console.error('Create user error:', err);
                    return res.status(500).json({ error: 'خطأ في إنشاء المستخدم' });
                }

                db.run(
                    'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                    [this.lastID, 'حساب جديد', `تم إنشاء حسابك بنجاح. الدور: ${role}`, 'info']
                );

                res.status(201).json({
                    id: this.lastID,
                    message: 'تم إنشاء المستخدم بنجاح'
                });
            }
        );
    });
});

app.put('/api/users/:id', authenticateToken, logActivity('update_user'), async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address, role, password } = req.body;

    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
        return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }

    if (!name || !email) {
        return res.status(400).json({ error: 'الاسم والبريد الإلكتروني مطلوبان' });
    }

    let updateQuery = 'UPDATE users SET name = ?, email = ?, phone = ?, address = ?';
    let queryParams = [name, email, phone, address];

    if (req.user.role === 'admin' && role) {
        updateQuery += ', role = ?';
        queryParams.push(role);
    }

    if (password && password.length > 0) {
        if (password.length < 6) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery += ', password = ?';
        queryParams.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ? AND is_active = 1';
    queryParams.push(id);

    db.run(updateQuery, queryParams, function(err) {
        if (err) {
            console.error('Update user error:', err);
            return res.status(500).json({ error: 'خطأ في تحديث المستخدم' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        res.json({ message: 'تم تحديث المستخدم بنجاح' });
    });
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, logActivity('delete_user'), (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === 1) {
        return res.status(400).json({ error: 'لا يمكن حذف المدير الرئيسي' });
    }

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'لا يمكن حذف حسابك الخاص' });
    }

    db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Delete user error:', err);
            return res.status(500).json({ error: 'خطأ في حذف المستخدم' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        res.json({ message: 'تم حذف المستخدم بنجاح' });
    });
});

// ===== مسارات المنتجات مع دعم الصور =====
app.get('/api/products', (req, res) => {
    const { category, search } = req.query;
    
    let query = 'SELECT * FROM products WHERE is_active = 1';
    let params = [];

    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }

    if (search) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY name';

    db.all(query, params, (err, products) => {
        if (err) {
            console.error('Get products error:', err);
            return res.status(500).json({ error: 'خطأ في جلب المنتجات' });
        }
        
        res.json(products);
    });
});

app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [id], (err, product) => {
        if (err) {
            console.error('Get product error:', err);
            return res.status(500).json({ error: 'خطأ في جلب المنتج' });
        }

        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        res.json(product);
    });
});

app.post('/api/products', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
    const { name, description, price, category, stock, image } = req.body;

    if (!name || !price || !category || stock === undefined) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (price < 0 || stock < 0) {
        return res.status(400).json({ error: 'السعر والكمية يجب أن يكونا قيم موجبة' });
    }

    let finalImagePath = '';
    
    if (req.file) {
        finalImagePath = `/uploads/products/${req.file.filename}`;
    } else if (image) {
        finalImagePath = image;
    } else {
        finalImagePath = '/uploads/products/default.jpg';
    }

    db.run(
        `INSERT INTO products (name, description, price, category, stock, image) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description, parseFloat(price), category, parseInt(stock), finalImagePath],
        function(err) {
            if (err) {
                console.error('Create product error:', err);
                return res.status(500).json({ error: 'خطأ في إنشاء المنتج' });
            }

            db.run(
                `INSERT INTO notifications (user_id, title, message, type) 
                 SELECT id, 'منتج جديد', ?, 'info' FROM users WHERE role IN ('admin', 'employee')`,
                [`تم إضافة منتج جديد: ${name}`]
            );

            res.status(201).json({
                id: this.lastID,
                message: 'تم إنشاء المنتج بنجاح',
                imageUrl: finalImagePath
            });
        }
    );
});

app.put('/api/products/:id', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, stock, image } = req.body;

    if (!name || !price || !category || stock === undefined) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (price < 0 || stock < 0) {
        return res.status(400).json({ error: 'السعر والكمية يجب أن يكونا قيم موجبة' });
    }

    db.get('SELECT image FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('Get product error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        let finalImagePath = product.image || '/uploads/products/default.jpg';
        
        if (req.file) {
            finalImagePath = `/uploads/products/${req.file.filename}`;
        } else if (image) {
            finalImagePath = image;
        }

        db.run(
            `UPDATE products SET name = ?, description = ?, price = ?, category = ?, stock = ?, image = ?
             WHERE id = ? AND is_active = 1`,
            [name, description, parseFloat(price), category, parseInt(stock), finalImagePath, id],
            function(err) {
                if (err) {
                    console.error('Update product error:', err);
                    return res.status(500).json({ error: 'خطأ في تحديث المنتج' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'المنتج غير موجود' });
                }

                res.json({ 
                    message: 'تم تحديث المنتج بنجاح',
                    imageUrl: finalImagePath
                });
            }
        );
    });
});

app.delete('/api/products/:id', authenticateToken, requireAdmin, logActivity('delete_product'), (req, res) => {
    const { id } = req.params;

    db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Delete product error:', err);
            return res.status(500).json({ error: 'خطأ في حذف المنتج' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        res.json({ message: 'تم حذف المنتج بنجاح' });
    });
});

// مسار رفع الصور
app.post('/api/upload/image', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم اختيار صورة للرفع' });
        }

        const imageUrl = `/uploads/products/${req.file.filename}`;
        
        res.json({
            success: true,
            imageUrl: imageUrl,
            filename: req.file.filename,
            message: 'تم رفع الصورة بنجاح'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'خطأ في رفع الصورة' });
    }
});

// مسار خدمة الملفات المحملة
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== مسارات عربة التسوق =====
app.get('/api/cart', authenticateToken, (req, res) => {
    db.all(
        `SELECT ci.*, p.name, p.price, p.image, p.stock 
         FROM cart_items ci 
         JOIN products p ON ci.product_id = p.id 
         WHERE ci.user_id = ? AND p.is_active = 1`,
        [req.user.id],
        (err, items) => {
            if (err) {
                console.error('Get cart error:', err);
                return res.status(500).json({ error: 'خطأ في جلب عربة التسوق' });
            }
            res.json(items);
        }
    );
});

app.post('/api/cart', authenticateToken, logActivity('add_to_cart'), (req, res) => {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity || quantity < 1) {
        return res.status(400).json({ error: 'معرّف المنتج والكمية مطلوبان' });
    }

    db.get('SELECT stock FROM products WHERE id = ? AND is_active = 1', [product_id], (err, product) => {
        if (err) {
            console.error('Check product error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ error: 'الكمية المطلوبة غير متوفرة في المخزون' });
        }

        db.run(
            `INSERT INTO cart_items (user_id, product_id, quantity) 
             VALUES (?, ?, ?) 
             ON CONFLICT(user_id, product_id) 
             DO UPDATE SET quantity = quantity + excluded.quantity`,
            [req.user.id, product_id, quantity],
            function(err) {
                if (err) {
                    console.error('Add to cart error:', err);
                    return res.status(500).json({ error: 'خطأ في إضافة المنتج إلى العربة' });
                }

                res.json({ message: 'تمت إضافة المنتج إلى العربة' });
            }
        );
    });
});

app.put('/api/cart/:product_id', authenticateToken, (req, res) => {
    const { product_id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
        return res.status(400).json({ error: 'الكمية مطلوبة ويجب أن تكون قيمة موجبة' });
    }

    if (quantity === 0) {
        db.run(
            'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
            [req.user.id, product_id],
            function(err) {
                if (err) {
                    console.error('Remove from cart error:', err);
                    return res.status(500).json({ error: 'خطأ في إزالة المنتج من العربة' });
                }

                res.json({ message: 'تم إزالة المنتج من العربة' });
            }
        );
    } else {
        db.run(
            'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [quantity, req.user.id, product_id],
            function(err) {
                if (err) {
                    console.error('Update cart error:', err);
                    return res.status(500).json({ error: 'خطأ في تحديث العربة' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'المنتج غير موجود في العربة' });
                }

                res.json({ message: 'تم تحديث الكمية' });
            }
        );
    }
});

app.delete('/api/cart/:product_id', authenticateToken, (req, res) => {
    const { product_id } = req.params;

    db.run(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.user.id, product_id],
        function(err) {
            if (err) {
                console.error('Delete from cart error:', err);
                return res.status(500).json({ error: 'خطأ في إزالة المنتج من العربة' });
            }

            res.json({ message: 'تم إزالة المنتج من العربة' });
        }
    );
});

app.delete('/api/cart', authenticateToken, (req, res) => {
    db.run('DELETE FROM cart_items WHERE user_id = ?', [req.user.id], function(err) {
        if (err) {
            console.error('Clear cart error:', err);
            return res.status(500).json({ error: 'خطأ في تفريغ العربة' });
        }

        res.json({ message: 'تم تفريغ العربة' });
    });
});

// ===== مسارات الطلبات =====
app.get('/api/orders', authenticateToken, (req, res) => {
    let query = `
        SELECT o.*, 
               u.name as user_name,
               (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        WHERE 1=1
    `;
    
    let params = [];

    if (req.user.role === 'customer') {
        query += ' AND o.user_id = ?';
        params.push(req.user.id);
    }

    query += ' ORDER BY o.created_at DESC';

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('Get orders error:', err);
            return res.status(500).json({ error: 'خطأ في جلب الطلبات' });
        }

        const ordersWithItems = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM order_items WHERE order_id = ?',
                    [order.id],
                    (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ 
                                ...order, 
                                items,
                                customer_name: order.user_name || order.customer_name
                            });
                        }
                    }
                );
            });
        });

        Promise.all(ordersWithItems)
            .then(orders => {
                res.json(orders);
            })
            .catch(err => {
                console.error('Get order items error:', err);
                res.status(500).json({ error: 'خطأ في جلب تفاصيل الطلبات' });
            });
    });
});

app.get('/api/orders/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.get(
        `SELECT o.*, u.name as customer_name 
         FROM orders o 
         LEFT JOIN users u ON o.user_id = u.id 
         WHERE o.id = ?`,
        [id],
        (err, order) => {
            if (err) {
                console.error('Get order error:', err);
                return res.status(500).json({ error: 'خطأ في جلب الطلب' });
            }

            if (!order) {
                return res.status(404).json({ error: 'الطلب غير موجود' });
            }

            if (req.user.role === 'customer' && order.user_id !== req.user.id) {
                return res.status(403).json({ error: 'صلاحيات غير كافية' });
            }

            db.all(
                'SELECT * FROM order_items WHERE order_id = ?',
                [id],
                (err, items) => {
                    if (err) {
                        console.error('Get order items error:', err);
                        return res.status(500).json({ error: 'خطأ في جلب تفاصيل الطلب' });
                    }

                    res.json({ ...order, items });
                }
            );
        }
    );
});

app.post('/api/orders', authenticateTokenOptional, logActivity('create_order'), (req, res) => {
    const { customer_name, customer_phone, customer_address, guest_email, payment_method, cartItems } = req.body;

    if (!customer_name || !customer_phone || !customer_address || !payment_method) {
        return res.status(400).json({ error: 'جميع الحقول المطلوبة' });
    }

    const isGuest = !req.user;
    const userId = req.user ? req.user.id : null;
    
    const guestOrderCode = isGuest ? `G${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase() : null;

    db.serialize(() => {
        let itemsToProcess = [];
        
        if (isGuest) {
            itemsToProcess = cartItems || [];
        } else {
            db.all(
                `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock 
                 FROM cart_items ci 
                 JOIN products p ON ci.product_id = p.id 
                 WHERE ci.user_id = ?`,
                [userId],
                (err, userCartItems) => {
                    if (err) {
                        console.error('Get cart items error:', err);
                        return res.status(500).json({ error: 'خطأ في جلب عربة التسوق' });
                    }
                    itemsToProcess = userCartItems;
                    processOrder();
                }
            );
            return;
        }

        processOrder();

        function processOrder() {
            if (itemsToProcess.length === 0) {
                return res.status(400).json({ error: 'عربة التسوق فارغة' });
            }

            for (const item of itemsToProcess) {
                if (item.stock < item.quantity) {
                    return res.status(400).json({ 
                        error: `الكمية المطلوبة من ${item.name} غير متوفرة في المخزون` 
                    });
                }
            }

            const total_amount = itemsToProcess.reduce((total, item) => total + (item.price * item.quantity), 0);

            db.run(
                `INSERT INTO orders (user_id, customer_name, customer_phone, customer_address, guest_email, total_amount, payment_method, is_guest, guest_order_code) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, customer_name, customer_phone, customer_address, guest_email, total_amount, payment_method, isGuest ? 1 : 0, guestOrderCode],
                function(err) {
                    if (err) {
                        console.error('Create order error:', err);
                        return res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
                    }

                    const orderId = this.lastID;

                    const insertItem = db.prepare(
                        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) 
                         VALUES (?, ?, ?, ?, ?)`
                    );

                    const updateStock = db.prepare(
                        'UPDATE products SET stock = stock - ? WHERE id = ?'
                    );

                    itemsToProcess.forEach(item => {
                        insertItem.run([orderId, item.product_id, item.name, item.price, item.quantity]);
                        updateStock.run([item.quantity, item.product_id]);
                    });

                    insertItem.finalize();
                    updateStock.finalize();

                    db.run(
                        `INSERT INTO notifications (user_id, title, message, type) 
                         SELECT id, 'طلب جديد', ?, 'info' FROM users WHERE role IN ('admin', 'employee')`,
                        [`طلب ${isGuest ? 'زائر' : 'عميل'} #${orderId} من ${customer_name} بقيمة ${total_amount} ريال`]
                    );

                    if (userId) {
                        db.run(
                            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                            [userId, 'طلب جديد', `تم إنشاء طلبك بنجاح برقم #${orderId}`, 'success']
                        );
                    }

                    if (userId) {
                        db.run('DELETE FROM cart_items WHERE user_id = ?', [userId], (err) => {
                            if (err) {
                                console.error('Clear cart error:', err);
                            }
                        });
                    }

                    res.status(201).json({
                        id: orderId,
                        order_number: orderId,
                        guest_order_code: guestOrderCode,
                        is_guest: isGuest,
                        message: 'تم إنشاء الطلب بنجاح'
                    });
                }
            );
        }
    });
});

// مسار لمتابعة طلبات الزوار
app.get('/api/guest/orders/:order_code', (req, res) => {
    const { order_code } = req.params;
    const { phone } = req.query;

    if (!phone) {
        return res.status(400).json({ error: 'رقم الهاتف مطلوب لمتابعة الطلب' });
    }

    db.get(
        `SELECT o.*, 
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
         FROM orders o 
         WHERE o.guest_order_code = ? AND o.customer_phone = ? AND o.is_guest = 1`,
        [order_code, phone],
        (err, order) => {
            if (err) {
                console.error('Get guest order error:', err);
                return res.status(500).json({ error: 'خطأ في جلب بيانات الطلب' });
            }

            if (!order) {
                return res.status(404).json({ error: 'الطلب غير موجود أو رقم الهاتف غير صحيح' });
            }

            db.all(
                'SELECT * FROM order_items WHERE order_id = ?',
                [order.id],
                (err, items) => {
                    if (err) {
                        console.error('Get order items error:', err);
                        return res.status(500).json({ error: 'خطأ في جلب تفاصيل الطلب' });
                    }

                    res.json({ ...order, items });
                }
            );
        }
    );
});

app.put('/api/orders/:id/status', authenticateToken, requireAdminOrEmployee, logActivity('update_order_status'), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'حالة الطلب غير صالحة' });
    }

    db.get('SELECT user_id, customer_name, customer_phone, is_guest, status FROM orders WHERE id = ?', [id], (err, order) => {
        if (err) {
            console.error('Get order error:', err);
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (!order) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        if (order.status === status) {
            return res.json({ 
                message: 'حالة الطلب هي بالفعل المطلوبة',
                old_status: order.status,
                new_status: status 
            });
        }

        db.run(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, id],
            function(err) {
                if (err) {
                    console.error('Update order status error:', err);
                    return res.status(500).json({ error: 'خطأ في تحديث حالة الطلب' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'الطلب غير موجود' });
                }

                const statusMessages = {
                    'pending': 'قيد الانتظار',
                    'processing': 'قيد التنفيذ',
                    'completed': 'مكتمل',
                    'cancelled': 'ملغي'
                };

                if (order.user_id) {
                    db.run(
                        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                        [order.user_id, 'تحديث حالة الطلب', `تم تحديث حالة طلبك #${id} إلى: ${statusMessages[status]}`, 'info']
                    );
                }

                db.run(
                    `INSERT INTO notifications (user_id, title, message, type) 
                     SELECT id, 'تحديث حالة الطلب', ?, 'info' 
                     FROM users 
                     WHERE role IN ('admin', 'employee') AND id != ?`,
                    [`تم تحديث حالة الطلب #${id} إلى: ${statusMessages[status]}`, req.user.id]
                );

                res.json({ 
                    message: 'تم تحديث حالة الطلب بنجاح',
                    old_status: order.status,
                    new_status: status,
                    order_id: id
                });
            }
        );
    });
});

// ===== مسارات التقارير المتقدمة =====
app.get('/api/reports/sales', authenticateToken, requireAdminOrEmployee, (req, res) => {
    const { period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
        case 'day':
            dateFilter = "AND date(created_at) = date('now')";
            break;
        case 'week':
            dateFilter = "AND created_at >= date('now', '-7 days')";
            break;
        case 'month':
            dateFilter = "AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";
            break;
        case 'year':
            dateFilter = "AND strftime('%Y', created_at) = strftime('%Y', 'now')";
            break;
    }

    const reports = {};

    db.get(`SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue FROM orders WHERE status = 'completed' ${dateFilter}`, (err, result) => {
        if (err) {
            console.error('Sales report error:', err);
            return res.status(500).json({ error: 'خطأ في جلب تقرير المبيعات' });
        }

        reports.sales = {
            total_orders: result.total_orders || 0,
            total_revenue: result.total_revenue || 0,
            average_order: result.total_orders ? (result.total_revenue / result.total_orders).toFixed(2) : 0
        };

        db.all(`
            SELECT p.name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * oi.product_price) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'completed' ${dateFilter}
            GROUP BY p.id, p.name
            ORDER BY total_sold DESC
            LIMIT 10
        `, (err, topProducts) => {
            reports.top_products = topProducts || [];

            db.all(`
                SELECT date(created_at) as date, COUNT(*) as orders, SUM(total_amount) as revenue
                FROM orders 
                WHERE status = 'completed' AND created_at >= date('now', '-30 days')
                GROUP BY date(created_at)
                ORDER BY date
            `, (err, dailySales) => {
                reports.daily_sales = dailySales || [];

                db.all(`
                    SELECT u.name, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    WHERE o.status = 'completed' ${dateFilter}
                    GROUP BY u.id, u.name
                    ORDER BY total_spent DESC
                    LIMIT 10
                `, (err, topCustomers) => {
                    reports.top_customers = topCustomers || [];

                    res.json(reports);
                });
            });
        });
    });
});

app.get('/api/reports/inventory', authenticateToken, requireAdminOrEmployee, (req, res) => {
    const reports = {};

    db.all(`
        SELECT name, stock, price
        FROM products 
        WHERE is_active = 1 AND stock < 10
        ORDER BY stock ASC
    `, (err, lowStock) => {
        reports.low_stock = lowStock || [];

        db.all(`
            SELECT p.name, 
                   p.stock as current_stock,
                   (SELECT SUM(oi.quantity) FROM order_items oi 
                    JOIN orders o ON oi.order_id = o.id 
                    WHERE oi.product_id = p.id AND o.status = 'completed' 
                    AND o.created_at >= date('now', '-30 days')) as sold_last_30_days
            FROM products p
            WHERE p.is_active = 1
            ORDER BY sold_last_30_days DESC NULLS LAST
        `, (err, inventoryMovement) => {
            reports.inventory_movement = inventoryMovement || [];

            res.json(reports);
        });
    });
});

app.get('/api/reports/customers', authenticateToken, requireAdminOrEmployee, (req, res) => {
    const reports = {};

    db.all(`
        SELECT 
            COUNT(*) as total_customers,
            COUNT(CASE WHEN created_at >= date('now', '-30 days') THEN 1 END) as new_customers_30_days,
            (SELECT COUNT(DISTINCT user_id) FROM orders WHERE created_at >= date('now', '-30 days')) as active_customers_30_days
        FROM users 
        WHERE role = 'customer' AND is_active = 1
    `, (err, customerStats) => {
        reports.customer_stats = customerStats[0] || {};

        db.all(`
            SELECT u.name, u.email, u.phone,
                   COUNT(o.id) as total_orders,
                   SUM(o.total_amount) as total_spent,
                   MAX(o.created_at) as last_order_date
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.role = 'customer' AND u.is_active = 1
            GROUP BY u.id, u.name, u.email, u.phone
            HAVING total_orders > 0
            ORDER BY total_spent DESC
            LIMIT 20
        `, (err, topCustomers) => {
            reports.top_customers = topCustomers || [];

            res.json(reports);
        });
    });
});

// ===== مسارات الإشعارات =====
app.get('/api/notifications', authenticateToken, (req, res) => {
    const { unread_only } = req.query;

    let query = `SELECT * FROM notifications WHERE (user_id = ? OR user_id IS NULL)`;
    let params = [req.user.id];

    if (unread_only === 'true') {
        query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    db.all(query, params, (err, notifications) => {
        if (err) {
            console.error('Get notifications error:', err);
            return res.status(500).json({ error: 'خطأ في جلب الإشعارات' });
        }
        res.json(notifications);
    });
});

app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
    db.get(
        `SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0`,
        [req.user.id],
        (err, result) => {
            if (err) {
                console.error('Get unread count error:', err);
                return res.status(500).json({ error: 'خطأ في جلب عدد الإشعارات' });
            }
            res.json({ count: result.count });
        }
    );
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
        [id, req.user.id],
        function(err) {
            if (err) {
                console.error('Mark notification read error:', err);
                return res.status(500).json({ error: 'خطأ في تحديث الإشعار' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'الإشعار غير موجود' });
            }

            res.json({ message: 'تم تحديث الإشعار' });
        }
    );
});

app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
    db.run(
        'UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
        [req.user.id],
        function(err) {
            if (err) {
                console.error('Mark all notifications read error:', err);
                return res.status(500).json({ error: 'خطأ في تحديث الإشعارات' });
            }

            res.json({ message: 'تم تحديث جميع الإشعارات', updated: this.changes });
        }
    );
});

// ===== مسارات النسخ الاحتياطي =====
app.get('/api/backup/info', authenticateToken, requireAdmin, (req, res) => {
    const info = {};

    db.all(`
        SELECT 
            (SELECT COUNT(*) FROM users WHERE is_active = 1) as users_count,
            (SELECT COUNT(*) FROM products WHERE is_active = 1) as products_count,
            (SELECT COUNT(*) FROM orders) as orders_count,
            (SELECT COUNT(*) FROM notifications) as notifications_count,
            (SELECT MAX(created_at) FROM backup_logs) as last_backup
    `, (err, result) => {
        if (err) {
            console.error('Backup info error:', err);
            return res.status(500).json({ error: 'خطأ في جلب معلومات النسخ الاحتياطي' });
        }

        info.database_info = result[0] || {};

        db.all('SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 10', (err, logs) => {
            info.backup_logs = logs || [];

            res.json(info);
        });
    });
});

app.post('/api/backup/export', authenticateToken, requireAdmin, logActivity('export_backup'), (req, res) => {
    const backupData = {};

    db.serialize(() => {
        db.all('SELECT * FROM users WHERE is_active = 1', (err, users) => {
            backupData.users = users;

            db.all('SELECT * FROM products WHERE is_active = 1', (err, products) => {
                backupData.products = products;

                db.all('SELECT * FROM orders', (err, orders) => {
                    backupData.orders = orders;

                    db.all('SELECT oi.* FROM order_items oi JOIN orders o ON oi.order_id = o.id', (err, orderItems) => {
                        backupData.order_items = orderItems;

                        db.all('SELECT * FROM notifications', (err, notifications) => {
                            backupData.notifications = notifications;

                            const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
                            const fileName = `backup_${timestamp}.json`;
                            
                            db.run(
                                'INSERT INTO backup_logs (type, file_name, data_size) VALUES (?, ?, ?)',
                                ['export', fileName, JSON.stringify(backupData).length],
                                function(err) {
                                    if (err) {
                                        console.error('Backup log error:', err);
                                    }

                                    res.json({
                                        message: 'تم إنشاء النسخة الاحتياطية',
                                        file_name: fileName,
                                        data: backupData
                                    });
                                }
                            );
                        });
                    });
                });
            });
        });
    });
});

app.post('/api/backup/import', authenticateToken, requireAdmin, logActivity('import_backup'), (req, res) => {
    const { data } = req.body;

    if (!data) {
        return res.status(400).json({ error: 'بيانات النسخة الاحتياطية مطلوبة' });
    }

    db.serialize(() => {
        db.run('DELETE FROM order_items');
        db.run('DELETE FROM orders');
        db.run('DELETE FROM products WHERE id > 10');
        db.run('DELETE FROM notifications');
        db.run('DELETE FROM cart_items');
        db.run('DELETE FROM users WHERE id > 3 AND role != "admin"');

        if (data.products) {
            const stmt = db.prepare('INSERT OR REPLACE INTO products (id, name, description, price, category, stock, image, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            data.products.forEach(product => {
                if (product.id > 10) {
                    stmt.run([product.id, product.name, product.description, product.price, product.category, product.stock, product.image, 1]);
                }
            });
            stmt.finalize();
        }

        if (data.users) {
            const stmt = db.prepare('INSERT OR REPLACE INTO users (id, name, email, password, phone, address, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            data.users.forEach(user => {
                if (user.id > 3 && user.role !== 'admin') {
                    stmt.run([user.id, user.name, user.email, user.password, user.phone, user.address, user.role, 1]);
                }
            });
            stmt.finalize();
        }

        if (data.orders) {
            const stmt = db.prepare('INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_address, total_amount, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            data.orders.forEach(order => {
                stmt.run([order.id, order.user_id, order.customer_name, order.customer_phone, order.customer_address, order.total_amount, order.status, order.payment_method, order.created_at]);
            });
            stmt.finalize();
        }

        if (data.order_items) {
            const stmt = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?, ?)');
            data.order_items.forEach(item => {
                stmt.run([item.id, item.order_id, item.product_id, item.name, item.price, item.quantity]);
            });
            stmt.finalize();
        }

        db.run(
            'INSERT INTO backup_logs (type, file_name, data_size) VALUES (?, ?, ?)',
            ['import', 'manual_import', JSON.stringify(data).length],
            function(err) {
                if (err) {
                    console.error('Import log error:', err);
                }

                res.json({ message: 'تم استيراد النسخة الاحتياطية بنجاح' });
            }
        );
    });
});

// ===== مسارات الإحصائيات =====
app.get('/api/stats', authenticateToken, requireAdminOrEmployee, (req, res) => {
    const stats = {};

    db.get('SELECT COUNT(*) as total FROM orders', (err, result) => {
        if (err) {
            console.error('Stats error:', err);
            return res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
        }
        stats.totalOrders = result.total;

        db.get('SELECT SUM(total_amount) as revenue FROM orders WHERE status = "completed"', (err, result) => {
            stats.totalRevenue = result.revenue || 0;

            db.get('SELECT COUNT(*) as total FROM products WHERE is_active = 1', (err, result) => {
                stats.totalProducts = result.total;

                db.get('SELECT COUNT(*) as total FROM orders WHERE status = "pending"', (err, result) => {
                    stats.pendingOrders = result.total;

                    db.get('SELECT COUNT(*) as total FROM users WHERE role = "customer" AND is_active = 1', (err, result) => {
                        stats.totalCustomers = result.total;

                        db.get('SELECT COUNT(*) as total FROM products WHERE stock < 10 AND is_active = 1', (err, result) => {
                            stats.lowStockProducts = result.total;

                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

// مسار للتحقق من صحة التوكن
app.get('/api/validate-token', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// خدمة الواجهة الأمامية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/css/:file', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/css', req.params.file));
});

app.get('/js/:file', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/js', req.params.file));
});

// معالجة المسارات غير المعرفة
app.use((req, res) => {
    res.status(404).json({ error: 'المسار غير موجود' });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'حجم الملف كبير جداً. الحد الأقصى 10MB' });
        }
        return res.status(400).json({ error: 'خطأ في رفع الملف' });
    }
    
    res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على http://localhost:${PORT}`);
    console.log(`📊 قاعدة البيانات: ./backend/database/database.db`);
    console.log(`📁 مجلد الرفع: ${productsDir}`);
    console.log(`🌐 الواجهة الأمامية: http://localhost:${PORT}`);
    console.log(`🔐 بيانات الدخول:`);
    console.log(`   - المدير: admin@example.com / admin123`);
    console.log(`   - الموظف: employee@example.com / employee123`);
    console.log(`   - العميل: customer@example.com / customer123`);
    console.log(`🖼️  دعم الصور: JPEG, JPG, PNG, GIF, WEBP, BMP (حد أقصى 10MB)`);
    console.log(`🚀 النظام متكامل مع: رفع الصور • التقارير • الإشعارات • النسخ الاحتياطي`);
});

// وظيفة فحص المخزون المنخفض تلقائياً
function checkLowStock() {
    db.all('SELECT name, stock FROM products WHERE stock < 5 AND is_active = 1', (err, products) => {
        if (err) {
            console.error('Low stock check error:', err);
            return;
        }

        if (products.length > 0) {
            products.forEach(product => {
                db.run(
                    `INSERT INTO notifications (user_id, title, message, type) 
                     SELECT id, 'تنبيه مخزون', ?, 'warning' FROM users WHERE role IN ('admin', 'employee')`,
                    [`المنتج ${product.name} كمية المخزون منخفضة: ${product.stock} فقط`]
                );
            });
        }
    });
}

// فحص المخزون كل ساعة
setInterval(checkLowStock, 60 * 60 * 1000);
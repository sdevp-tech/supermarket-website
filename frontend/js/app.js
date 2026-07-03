// app.js - مع دعم رفع الصور الكامل
class SupermarketApp {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('supermarket_token');
        this.cart = [];
        this.products = [];
        this.notifications = [];
        this.unreadNotifications = { count: 0 };
        this.isGuest = false;
        this.guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
        this.categories = [
            { id: 'all', name: 'الكل' },
            { id: 'fruits', name: 'فواكه' },
            { id: 'vegetables', name: 'خضروات' },
            { id: 'dairy', name: 'منتجات ألبان' },
            { id: 'beverages', name: 'مشروبات' },
            { id: 'meat', name: 'لحوم' },
            { id: 'bakery', name: 'مخبوزات' }
        ];
        this.currentUploadCallback = null;
        this.currentFile = null;
        this.init();
    }

    async init() {
        if (this.token) {
            try {
                await this.getCurrentUser();
                await this.loadCart();
                await this.loadNotifications();
                this.showMainApp();
                this.startNotificationPolling();
            } catch (error) {
                console.error('Auth error:', error);
                this.showWelcome();
            }
        } else {
            this.showWelcome();
        }
    }

    async apiCall(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(`/api${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'خطأ في الاتصال بالخادم');
            }

            return data;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    async apiUpload(endpoint, formData) {
        try {
            const response = await fetch(`/api${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'خطأ في رفع الملف');
            }

            return data;
        } catch (error) {
            console.error('API upload error:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        const userData = localStorage.getItem('supermarket_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
            return this.currentUser;
        }
        
        try {
            const data = await this.apiCall('/users/me');
            this.currentUser = data;
            localStorage.setItem('supermarket_user', JSON.stringify(data));
            return data;
        } catch (error) {
            throw new Error('لم يتم تسجيل الدخول');
        }
    }

    async loadCart() {
        try {
            this.cart = await this.apiCall('/cart');
        } catch (error) {
            this.cart = [];
        }
    }

    async loadNotifications() {
        try {
            this.notifications = await this.apiCall('/notifications');
            const unread = await this.apiCall('/notifications/unread-count');
            this.unreadNotifications = unread;
        } catch (error) {
            this.notifications = [];
            this.unreadNotifications = { count: 0 };
        }
    }

    async loadProducts(category = 'all', search = '') {
        try {
            let url = '/products';
            const params = new URLSearchParams();
            
            if (category && category !== 'all') {
                params.append('category', category);
            }
            
            if (search) {
                params.append('search', search);
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            this.products = await this.apiCall(url);
        } catch (error) {
            console.error('Load products error:', error);
            this.products = [];
        }
    }

    startNotificationPolling() {
        setInterval(async () => {
            try {
                await this.loadNotifications();
                this.updateNotificationBadge();
            } catch (error) {
                console.error('Notification polling error:', error);
            }
        }, 30000);
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = this.unreadNotifications.count > 99 ? '99+' : this.unreadNotifications.count;
            badge.style.display = this.unreadNotifications.count > 0 ? 'flex' : 'none';
        }
    }

    showWelcome() {
        document.getElementById('app').innerHTML = `
            <div class="welcome-container">
                <div class="welcome-content">
                    <div class="welcome-header">
                        <h1>🏪 مرحباً بك في سوبر ماركت الحارة</h1>
                        <p class="welcome-subtitle">اختر طريقة استخدام النظام</p>
                    </div>
                    
                    <div class="welcome-options">
                        <div class="option-card">
                            <div class="option-icon">🛒</div>
                            <h3>تسوق كزائر</h3>
                            <p>استعرض المنتجات وأضفها إلى العربة دون إنشاء حساب. يمكنك إنشاء حساب لاحقاً لحفظ طلباتك.</p>
                            <button class="btn btn-primary" onclick="app.startAsGuest()">بدء التسوق كزائر</button>
                        </div>
                        
                        <div class="option-card">
                            <div class="option-icon">👤</div>
                            <h3>تسجيل الدخول</h3>
                            <p>لديك حساب بالفعل؟ سجل الدخول للوصول إلى طلباتك السابقة وتفضيلاتك.</p>
                            <button class="btn btn-outline" onclick="app.showLogin()">تسجيل الدخول</button>
                        </div>
                        
                        <div class="option-card">
                            <div class="option-icon">📝</div>
                            <h3>إنشاء حساب جديد</h3>
                            <p>انضم إلينا واحصل على مميزات حصرية وتتبع لطلباتك.</p>
                            <button class="btn btn-outline" onclick="app.showRegister()">إنشاء حساب</button>
                        </div>
                    </div>
                    
                    <div class="welcome-features">
                        <h3>مميزات النظام</h3>
                        <div class="features-grid">
                            <div class="feature-item">
                                <div class="feature-icon">🚚</div>
                                <span>توصيل سريع</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">💰</div>
                                <span>أسعار تنافسية</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">🛡️</div>
                                <span>دفع آمن</span>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">⭐</div>
                                <span>منتجات عالية الجودة</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    startAsGuest() {
        this.isGuest = true;
        this.showMainApp();
    }

    showLogin() {
        document.getElementById('app').innerHTML = `
            <div class="auth-container">
                <div class="auth-form">
                    <h2>تسجيل الدخول</h2>
                    <form id="loginForm">
                        <div class="form-group">
                            <label for="email">البريد الإلكتروني</label>
                            <input type="email" id="email" required placeholder="ادخل بريدك الإلكتروني">
                        </div>
                        <div class="form-group">
                            <label for="password">كلمة المرور</label>
                            <input type="password" id="password" required placeholder="ادخل كلمة المرور">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">تسجيل الدخول</button>
                    </form>
                    
                    <div class="auth-footer">
                        <p>لا تملك حساب؟</p>
                        <button class="btn btn-outline btn-block" onclick="app.showRegister()">إنشاء حساب جديد</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.login();
        });
    }

    showRegister() {
        document.getElementById('app').innerHTML = `
            <div class="auth-container">
                <div class="auth-form">
                    <h2>إنشاء حساب جديد</h2>
                    <form id="registerForm">
                        <div class="form-group">
                            <label for="regName">الاسم الكامل</label>
                            <input type="text" id="regName" required placeholder="ادخل اسمك الكامل">
                        </div>
                        <div class="form-group">
                            <label for="regEmail">البريد الإلكتروني</label>
                            <input type="email" id="regEmail" required placeholder="ادخل بريدك الإلكتروني">
                        </div>
                        <div class="form-group">
                            <label for="regPhone">رقم الهاتف</label>
                            <input type="tel" id="regPhone" placeholder="ادخل رقم هاتفك">
                        </div>
                        <div class="form-group">
                            <label for="regAddress">العنوان</label>
                            <textarea id="regAddress" rows="3" placeholder="ادخل عنوانك"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="regPassword">كلمة المرور</label>
                            <input type="password" id="regPassword" required placeholder="ادخل كلمة مرور قوية">
                        </div>
                        <div class="form-group">
                            <label for="regConfirmPassword">تأكيد كلمة المرور</label>
                            <input type="password" id="regConfirmPassword" required placeholder="أعد إدخال كلمة المرور">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">إنشاء حساب</button>
                    </form>
                    
                    <div class="auth-footer">
                        <p>لديك حساب بالفعل؟</p>
                        <button class="btn btn-outline btn-block" onclick="app.showLogin()">تسجيل الدخول</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.register();
        });
    }

    async login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');

        if (!email || !password) {
            this.showAlert('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري تسجيل الدخول...';

            const data = await this.apiCall('/login', {
                method: 'POST',
                body: { email, password }
            });

            this.token = data.token;
            this.currentUser = data.user;
            
            localStorage.setItem('supermarket_token', this.token);
            localStorage.setItem('supermarket_user', JSON.stringify(this.currentUser));
            
            await this.loadCart();
            await this.loadNotifications();
            this.showMainApp();
            this.startNotificationPolling();
            
            this.showAlert('تم تسجيل الدخول بنجاح!', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تسجيل الدخول';
        }
    }

    async register() {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const phone = document.getElementById('regPhone').value;
        const address = document.getElementById('regAddress').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const submitBtn = document.querySelector('#registerForm button[type="submit"]');

        if (password !== confirmPassword) {
            this.showAlert('كلمات المرور غير متطابقة', 'error');
            return;
        }

        if (password.length < 6) {
            this.showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showAlert('البريد الإلكتروني غير صحيح', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري إنشاء الحساب...';

            const data = await this.apiCall('/register', {
                method: 'POST',
                body: { name, email, password, phone, address }
            });

            this.token = data.token;
            this.currentUser = data.user;
            
            localStorage.setItem('supermarket_token', this.token);
            localStorage.setItem('supermarket_user', JSON.stringify(this.currentUser));
            
            await this.loadCart();
            await this.loadNotifications();
            this.showMainApp();
            this.startNotificationPolling();
            
            this.showAlert(data.message, 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إنشاء حساب';
        }
    }

    showMainApp() {
        document.getElementById('app').innerHTML = `
            <div class="app-layout">
                <header class="app-header">
                    <div class="header-content">
                        <h1>🏪 سوبر ماركت الحارة</h1>
                        <div class="user-info">
                            ${this.isGuest ? `
                                <span class="user-name">مرحباً، زائر</span>
                                <span class="user-role">زائر</span>
                                <button onclick="app.showWelcome()" class="btn btn-outline btn-sm">تسجيل الدخول</button>
                            ` : `
                                <span class="user-name">مرحباً، ${this.currentUser ? this.currentUser.name : 'مستخدم'}</span>
                                <span class="user-role">${this.currentUser ? this.getRoleName(this.currentUser.role) : 'عميل'}</span>
                                <div class="notification-container">
                                    <button class="btn btn-outline btn-sm" onclick="app.showNotifications()">
                                        🔔 الإشعارات
                                        <span class="notification-badge" style="display: ${this.unreadNotifications.count > 0 ? 'flex' : 'none'}">
                                            ${this.unreadNotifications.count > 99 ? '99+' : this.unreadNotifications.count}
                                        </span>
                                    </button>
                                </div>
                                <button onclick="app.logout()" class="btn btn-outline btn-sm">تسجيل خروج</button>
                            `}
                        </div>
                    </div>
                    <nav class="main-nav">
                        <button class="nav-btn active" onclick="app.showSection('dashboard')">📊 لوحة التحكم</button>
                        <button class="nav-btn" onclick="app.showSection('products')">🛒 المنتجات</button>
                        <button class="nav-btn" onclick="app.showSection('cart')">🛒 عربة التسوق</button>
                        ${!this.isGuest ? `
                            <button class="nav-btn" onclick="app.showSection('orders')">📋 الطلبات</button>
                            ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') ? 
                                `<button class="nav-btn" onclick="app.showSection('reports')">📈 التقارير</button>` : 
                                ''}
                            ${this.currentUser && this.currentUser.role === 'admin' ? 
                                `<button class="nav-btn" onclick="app.showSection('employees')">👥 إدارة الموظفين</button>` : 
                                ''}
                            ${this.currentUser && this.currentUser.role === 'admin' ? 
                                `<button class="nav-btn" onclick="app.showSection('products-management')">📦 إدارة المنتجات</button>` : 
                                ''}
                            ${this.currentUser && this.currentUser.role === 'admin' ? 
                                `<button class="nav-btn" onclick="app.showSection('backup')">💾 النسخ الاحتياطي</button>` : 
                                ''}
                        ` : ''}
                    </nav>
                </header>
                
                <main class="app-main">
                    <div id="main-content">
                        <div class="loading">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </main>
            </div>

            <!-- نافذة تأكيد الطلب -->
            <div id="checkoutModal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>إتمام الطلب</h3>
                        <button class="close-btn" onclick="app.closeCheckoutModal()">×</button>
                    </div>
                    <form id="checkoutForm">
                        <div class="form-group">
                            <label for="checkoutName">الاسم الكامل *</label>
                            <input type="text" id="checkoutName" value="${this.isGuest ? '' : (this.currentUser?.name || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="checkoutPhone">رقم الهاتف *</label>
                            <input type="tel" id="checkoutPhone" value="${this.isGuest ? '' : (this.currentUser?.phone || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="checkoutAddress">عنوان التوصيل *</label>
                            <textarea id="checkoutAddress" rows="3" required>${this.isGuest ? '' : (this.currentUser?.address || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="checkoutEmail">البريد الإلكتروني</label>
                            <input type="email" id="checkoutEmail" value="${this.isGuest ? '' : (this.currentUser?.email || '')}">
                        </div>
                        <div class="form-group">
                            <label>طريقة الدفع</label>
                            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                                <label style="flex: 1; cursor: pointer;">
                                    <input type="radio" name="paymentMethod" value="cash" checked style="margin-left: 0.5rem;">
                                    نقدي عند الاستلام
                                </label>
                                <label style="flex: 1; cursor: pointer;">
                                    <input type="radio" name="paymentMethod" value="wallet" style="margin-left: 0.5rem;">
                                    محفظة إلكترونية
                                </label>
                            </div>
                        </div>
                        ${this.isGuest ? `
                            <div class="guest-notice">
                                <p>💡 <strong>ملاحظة:</strong> كزائر، لن يتم حفظ طلباتك في سجلك الشخصي. ننصحك <a href="#" onclick="app.showRegister(); return false;">بإنشاء حساب</a> لمتابعة طلباتك.</p>
                            </div>
                        ` : ''}
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">تأكيد الطلب</button>
                            <button type="button" class="btn btn-outline" onclick="app.closeCheckoutModal()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- نافذة الإشعارات -->
            <div id="notificationsModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>الإشعارات</h3>
                        <div>
                            <button class="btn btn-outline btn-sm" onclick="app.markAllNotificationsRead()">تحديد الكل كمقروء</button>
                            <button class="close-btn" onclick="app.closeNotificationsModal()">×</button>
                        </div>
                    </div>
                    <div id="notificationsList" style="max-height: 400px; overflow-y: auto;">
                        <!-- سيتم تعبئة الإشعارات هنا -->
                    </div>
                </div>
            </div>
        `;

        // إضافة معالجات الأحداث للنوافذ
        setTimeout(() => {
            const checkoutForm = document.getElementById('checkoutForm');
            if (checkoutForm) {
                checkoutForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submitOrder();
                });
            }
        }, 100);

        this.showSection('dashboard');
        this.updateNotificationBadge();
    }

    getRoleName(role) {
        const roles = {
            'admin': 'مدير النظام',
            'employee': 'موظف',
            'customer': 'عميل'
        };
        return roles[role] || role;
    }

    async showSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[onclick="app.showSection('${section}')"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        const content = document.getElementById('main-content');
        content.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        try {
            let html = '';
            
            switch(section) {
                case 'dashboard':
                    html = await this.getDashboardContent();
                    break;
                case 'products':
                    html = await this.getProductsContent();
                    break;
                case 'cart':
                    html = await this.getCartContent();
                    break;
                case 'orders':
                    html = await this.getOrdersContent();
                    break;
                case 'reports':
                    if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee')) {
                        html = await this.getReportsContent();
                    } else {
                        html = '<div class="alert alert-error">صلاحيات غير كافية</div>';
                    }
                    break;
                case 'employees':
                    if (this.currentUser && this.currentUser.role === 'admin') {
                        html = await this.getEmployeesContent();
                    } else {
                        html = '<div class="alert alert-error">صلاحيات غير كافية</div>';
                    }
                    break;
                case 'products-management':
                    if (this.currentUser && this.currentUser.role === 'admin') {
                        html = await this.getProductsManagementContent();
                    } else {
                        html = '<div class="alert alert-error">صلاحيات غير كافية</div>';
                    }
                    break;
                case 'backup':
                    if (this.currentUser && this.currentUser.role === 'admin') {
                        html = await this.getBackupContent();
                    } else {
                        html = '<div class="alert alert-error">صلاحيات غير كافية</div>';
                    }
                    break;
                default:
                    html = await this.getDashboardContent();
            }
            
            content.innerHTML = html;
        } catch (error) {
            console.error('Show section error:', error);
            content.innerHTML = `
                <div class="alert alert-error">
                    <strong>خطأ:</strong> ${error.message}
                </div>
            `;
        }
    }

    async getDashboardContent() {
        let stats = {};
        
        if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee')) {
            try {
                stats = await this.apiCall('/stats');
            } catch (error) {
                console.error('Load stats error:', error);
            }
        }

        return `
            <div class="section">
                <div class="section-header">
                    <h2>لوحة التحكم</h2>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="app.loadNotifications(); app.showAlert('تم تحديث البيانات', 'success')">
                            🔄 تحديث
                        </button>
                    </div>
                </div>
                <div class="section-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalOrders || 0}</div>
                            <div class="stat-label">إجمالي الطلبات</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalRevenue || 0} ر.س</div>
                            <div class="stat-label">إجمالي الإيرادات</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.totalProducts || 0}</div>
                            <div class="stat-label">عدد المنتجات</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stats.pendingOrders || 0}</div>
                            <div class="stat-label">طلبات قيد الانتظار</div>
                        </div>
                        ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') ? `
                            <div class="stat-card">
                                <div class="stat-value">${stats.totalCustomers || 0}</div>
                                <div class="stat-label">عدد العملاء</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.lowStockProducts || 0}</div>
                                <div class="stat-label">منتجات منخفضة المخزون</div>
                            </div>
                        ` : ''}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
                        <div class="stat-card">
                            <h3 style="margin-bottom: 1rem; color: var(--primary);">إجراءات سريعة</h3>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <button class="btn btn-outline" onclick="app.showSection('products')">🛒 تسوق الآن</button>
                                <button class="btn btn-outline" onclick="app.showSection('cart')">🛒 عرض العربة</button>
                                ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') ? 
                                    `<button class="btn btn-outline" onclick="app.showSection('reports')">📈 عرض التقارير</button>` : 
                                    ''}
                                ${this.currentUser && this.currentUser.role === 'admin' ? 
                                    `<button class="btn btn-outline" onclick="app.showSection('employees')">👥 إدارة الموظفين</button>` : 
                                    ''}
                            </div>
                        </div>

                        <div class="stat-card">
                            <h3 style="margin-bottom: 1rem; color: var(--primary);">معلومات الحساب</h3>
                            <div style="text-align: right; line-height: 2;">
                                <div><strong>الاسم:</strong> ${this.currentUser ? this.currentUser.name : 'زائر'}</div>
                                <div><strong>البريد:</strong> ${this.currentUser ? this.currentUser.email : '---'}</div>
                                <div><strong>الدور:</strong> ${this.currentUser ? this.getRoleName(this.currentUser.role) : 'زائر'}</div>
                                ${this.currentUser && this.currentUser.phone ? `<div><strong>الهاتف:</strong> ${this.currentUser.phone}</div>` : ''}
                                <div><strong>الإشعارات غير المقروءة:</strong> ${this.unreadNotifications.count}</div>
                            </div>
                        </div>

                        ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') ? `
                            <div class="stat-card">
                                <h3 style="margin-bottom: 1rem; color: var(--primary);">آخر الإشعارات</h3>
                                <div style="max-height: 200px; overflow-y: auto;">
                                    ${this.notifications.slice(0, 5).map(notification => `
                                        <div style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                                <strong>${notification.title}</strong>
                                                <span style="font-size: 0.8rem; color: var(--text-light);">
                                                    ${new Date(notification.created_at).toLocaleDateString('ar-SA')}
                                                </span>
                                            </div>
                                            <div style="color: var(--text-light); margin-top: 0.25rem;">${notification.message}</div>
                                        </div>
                                    `).join('')}
                                    ${this.notifications.length === 0 ? '<p style="text-align: center; color: var(--text-light);">لا توجد إشعارات</p>' : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async getProductsContent() {
        await this.loadProducts();
        
        return `
            <div class="section">
                <div class="section-header">
                    <h2>🛒 المنتجات</h2>
                    <div class="header-actions">
                        <select id="categoryFilter" onchange="app.filterProducts()" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                            ${this.categories.map(cat => 
                                `<option value="${cat.id}">${cat.name}</option>`
                            ).join('')}
                        </select>
                        <input type="text" id="searchProducts" placeholder="🔍 بحث في المنتجات..." 
                               onkeyup="app.searchProducts()" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    </div>
                </div>
                <div class="section-body">
                    <div class="products-grid">
                        ${this.products.length > 0 ? 
                            this.products.map(product => {
                                let imageUrl = '';
                                if (product.image) {
                                    if (product.image.startsWith('/uploads/')) {
                                        imageUrl = product.image;
                                    } else if (product.image.startsWith('http')) {
                                        imageUrl = product.image;
                                    } else {
                                        imageUrl = `/uploads/products/${product.image}`;
                                    }
                                } else {
                                    imageUrl = '/uploads/products/default.jpg';
                                }
                                
                                return `
                                <div class="product-card">
                                    <div class="product-image">
                                        <img src="${imageUrl}" alt="${product.name}" 
                                             onerror="this.onerror=null; this.src='/uploads/products/default.jpg';"
                                             style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px;">
                                    </div>
                                    <div class="product-info">
                                        <h3 class="product-name">${product.name}</h3>
                                        <p class="product-description">${product.description || 'لا يوجد وصف'}</p>
                                        <div class="product-meta">
                                            <span class="product-category">${this.categories.find(c => c.id === product.category)?.name || product.category}</span>
                                            <span class="product-stock ${product.stock < 10 ? 'low-stock' : ''}">المخزون: ${product.stock}</span>
                                        </div>
                                        <div class="product-footer">
                                            <span class="product-price">${product.price} ر.س</span>
                                            <button class="btn btn-primary btn-sm" 
                                                    onclick="app.addToCart(${product.id})"
                                                    ${product.stock === 0 ? 'disabled' : ''}>
                                                ${product.stock === 0 ? '⛔ غير متوفر' : '🛒 إضافة'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `}).join('') :
                            '<div class="empty-state">لا توجد منتجات متاحة</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    async filterProducts() {
        const category = document.getElementById('categoryFilter').value;
        const search = document.getElementById('searchProducts').value;
        await this.loadProducts(category, search);
        
        const content = document.getElementById('main-content');
        content.innerHTML = await this.getProductsContent();
    }

    async searchProducts() {
        const search = document.getElementById('searchProducts').value;
        const category = document.getElementById('categoryFilter').value;
        await this.loadProducts(category, search);
        
        const content = document.getElementById('main-content');
        content.innerHTML = await this.getProductsContent();
    }

    async getCartContent() {
        if (this.isGuest) {
            return this.getGuestCartContent();
        } else {
            await this.loadCart();
            
            const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            return `
                <div class="section">
                    <div class="section-header">
                        <h2>🛒 عربة التسوق</h2>
                        <div class="header-actions">
                            ${this.cart.length > 0 ? `
                                <button class="btn btn-danger" onclick="app.clearCart()">🗑️ تفريغ العربة</button>
                                <button class="btn btn-success" onclick="app.showCheckoutModal()">💳 إتمام الطلب</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="section-body">
                        ${this.cart.length > 0 ? `
                            <div class="cart-items">
                                ${this.cart.map(item => {
                                    let imageUrl = '';
                                    if (item.image) {
                                        if (item.image.startsWith('/uploads/')) {
                                            imageUrl = item.image;
                                        } else if (item.image.startsWith('http')) {
                                            imageUrl = item.image;
                                        } else {
                                            imageUrl = `/uploads/products/${item.image}`;
                                        }
                                    } else {
                                        imageUrl = '/uploads/products/default.jpg';
                                    }
                                    
                                    return `
                                    <div class="cart-item">
                                        <div class="item-image">
                                            <img src="${imageUrl}" alt="${item.name}" 
                                                 onerror="this.onerror=null; this.src='/uploads/products/default.jpg';"
                                                 style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                                        </div>
                                        <div class="item-info">
                                            <h4>${item.name}</h4>
                                            <p class="item-price">${item.price} ر.س للوحدة</p>
                                        </div>
                                        <div class="item-controls">
                                            <button class="btn btn-outline btn-sm" onclick="app.updateCartItem(${item.product_id}, ${item.quantity - 1})">➖</button>
                                            <span class="quantity">${item.quantity}</span>
                                            <button class="btn btn-outline btn-sm" 
                                                    onclick="app.updateCartItem(${item.product_id}, ${item.quantity + 1})"
                                                    ${item.quantity >= item.stock ? 'disabled' : ''}>➕</button>
                                            <button class="btn btn-danger btn-sm" onclick="app.removeFromCart(${item.product_id})">🗑️</button>
                                        </div>
                                        <div class="item-total">${(item.price * item.quantity).toFixed(2)} ر.س</div>
                                    </div>
                                `}).join('')}
                            </div>
                            <div class="cart-summary">
                                <div class="summary-row">
                                    <span>الإجمالي:</span>
                                    <span><strong>${total.toFixed(2)} ر.س</strong></span>
                                </div>
                                <button class="btn btn-success btn-block" onclick="app.showCheckoutModal()">
                                    💳 إتمام الطلب (${this.cart.length} منتج)
                                </button>
                            </div>
                        ` : `
                            <div class="empty-state">
                                <div style="font-size: 4rem; margin-bottom: 1rem;">🛒</div>
                                <h3>عربة التسوق فارغة</h3>
                                <p>لم تقم بإضافة أي منتجات إلى العربة بعد</p>
                                <button class="btn btn-primary" onclick="app.showSection('products')">تسوق الآن</button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }
    }

    getGuestCartContent() {
        const total = this.guestCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        return `
            <div class="section">
                <div class="section-header">
                    <h2>🛒 عربة التسوق (زائر)</h2>
                    <div class="header-actions">
                        ${this.guestCart.length > 0 ? `
                            <button class="btn btn-danger" onclick="app.clearGuestCart()">🗑️ تفريغ العربة</button>
                            <button class="btn btn-success" onclick="app.showCheckoutModal()">💳 إتمام الطلب</button>
                        ` : ''}
                    </div>
                </div>
                <div class="section-body">
                    ${this.guestCart.length > 0 ? `
                        <div class="cart-items">
                            ${this.guestCart.map(item => {
                                let imageUrl = '';
                                if (item.image) {
                                    if (item.image.startsWith('/uploads/')) {
                                        imageUrl = item.image;
                                    } else if (item.image.startsWith('http')) {
                                        imageUrl = item.image;
                                    } else {
                                        imageUrl = `/uploads/products/${item.image}`;
                                    }
                                } else {
                                    imageUrl = '/uploads/products/default.jpg';
                                }
                                
                                return `
                                <div class="cart-item">
                                    <div class="item-image">
                                        <img src="${imageUrl}" alt="${item.name}" 
                                             onerror="this.onerror=null; this.src='/uploads/products/default.jpg';"
                                             style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                                    </div>
                                    <div class="item-info">
                                        <h4>${item.name}</h4>
                                        <p class="item-price">${item.price} ر.س للوحدة</p>
                                    </div>
                                    <div class="item-controls">
                                        <button class="btn btn-outline btn-sm" onclick="app.updateGuestCartItem(${item.product_id}, ${item.quantity - 1})">➖</button>
                                        <span class="quantity">${item.quantity}</span>
                                        <button class="btn btn-outline btn-sm" 
                                                onclick="app.updateGuestCartItem(${item.product_id}, ${item.quantity + 1})"
                                                ${item.quantity >= item.stock ? 'disabled' : ''}>➕</button>
                                        <button class="btn btn-danger btn-sm" onclick="app.removeFromGuestCart(${item.product_id})">🗑️</button>
                                    </div>
                                    <div class="item-total">${(item.price * item.quantity).toFixed(2)} ر.س</div>
                                </div>
                            `}).join('')}
                        </div>
                        <div class="cart-summary">
                            <div class="summary-row">
                                <span>الإجمالي:</span>
                                <span><strong>${total.toFixed(2)} ر.س</strong></span>
                            </div>
                            <button class="btn btn-success btn-block" onclick="app.showCheckoutModal()">
                                💳 إتمام الطلب (${this.guestCart.length} منتج)
                            </button>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <div style="font-size: 4rem; margin-bottom: 1rem;">🛒</div>
                            <h3>عربة التسوق فارغة</h3>
                            <p>لم تقم بإضافة أي منتجات إلى العربة بعد</p>
                            <button class="btn btn-primary" onclick="app.showSection('products')">تسوق الآن</button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    async getOrdersContent() {
        let orders = [];
        try {
            orders = await this.apiCall('/orders');
        } catch (error) {
            console.error('Load orders error:', error);
        }

        return `
            <div class="section">
                <div class="section-header">
                    <h2>📋 الطلبات</h2>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="app.refreshOrders()">🔄 تحديث</button>
                    </div>
                </div>
                <div class="section-body">
                    ${orders.length > 0 ? `
                        <div class="orders-list">
                            ${orders.map(order => `
                                <div class="order-card" id="order-${order.id}">
                                    <div class="order-header">
                                        <div class="order-info">
                                            <h4>طلب #${order.id} ${order.is_guest ? '<span style="background: #ffc107; color: black; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 8px;">زائر</span>' : ''}</h4>
                                            <span class="order-date">${new Date(order.created_at).toLocaleDateString('ar-SA')}</span>
                                        </div>
                                        <div class="order-status status-${order.status}">
                                            ${this.getOrderStatusText(order.status)}
                                        </div>
                                    </div>
                                    <div class="order-details">
                                        <div class="detail-row">
                                            <span>العميل:</span>
                                            <span>${order.customer_name} ${order.is_guest ? '(زائر)' : ''}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span>الهاتف:</span>
                                            <span>${order.customer_phone}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span>طريقة الدفع:</span>
                                            <span>${order.payment_method === 'cash' ? 'نقدي عند الاستلام' : 'محفظة إلكترونية'}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span>المبلغ الإجمالي:</span>
                                            <span><strong>${order.total_amount} ر.س</strong></span>
                                        </div>
                                        <div class="detail-row">
                                            <span>حالة الطلب:</span>
                                            <span><strong>${this.getOrderStatusText(order.status)}</strong></span>
                                        </div>
                                    </div>
                                    ${order.items && order.items.length > 0 ? `
                                        <div class="order-items">
                                            <h5>المنتجات (${order.items.length}):</h5>
                                            ${order.items.map(item => `
                                                <div class="order-item">
                                                    <span>${item.product_name}</span>
                                                    <span>${item.quantity} × ${item.product_price} ر.س</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                    ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') && order.status !== 'completed' && order.status !== 'cancelled' ? `
                                        <div class="order-actions">
                                            <label>تغيير الحالة:</label>
                                            <select id="status-${order.id}" 
                                                    style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; margin-top: 0.5rem; width: 100%;">
                                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>قيد التنفيذ</option>
                                                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>مكتمل</option>
                                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                                            </select>
                                            <button class="btn btn-primary btn-sm" onclick="app.applyStatusChange(${order.id})" 
                                                    style="margin-top: 0.5rem; width: 100%;">
                                                تطبيق التغيير
                                            </button>
                                        </div>
                                    ` : ''}
                                    ${this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'employee') && (order.status === 'completed' || order.status === 'cancelled') ? `
                                        <div class="order-final-status">
                                            <p><strong>الحالة النهائية:</strong> ${this.getOrderStatusText(order.status)}</p>
                                            <small>لا يمكن تغيير الحالة بعد اكتمال أو إلغاء الطلب</small>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <div style="font-size: 4rem; margin-bottom: 1rem;">📋</div>
                            <h3>لا توجد طلبات</h3>
                            <p>لم تقم بإجراء أي طلبات بعد</p>
                            <button class="btn btn-primary" onclick="app.showSection('products')">تسوق الآن</button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    async getEmployeesContent() {
        let users = [];
        try {
            users = await this.apiCall('/users');
        } catch (error) {
            console.error('Load users error:', error);
        }

        const employees = users.filter(user => user.role !== 'customer');

        return `
            <div class="section">
                <div class="section-header">
                    <h2>👥 إدارة الموظفين</h2>
                    <div class="header-actions">
                        <button class="btn btn-primary" onclick="app.showEmployeeModal()">➕ إضافة موظف</button>
                    </div>
                </div>
                <div class="section-body">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>البريد الإلكتروني</th>
                                    <th>الهاتف</th>
                                    <th>الدور</th>
                                    <th>تاريخ التسجيل</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.map(user => `
                                    <tr>
                                        <td>${user.name}</td>
                                        <td>${user.email}</td>
                                        <td>${user.phone || '---'}</td>
                                        <td><span class="role-badge role-${user.role}">${this.getRoleName(user.role)}</span></td>
                                        <td>${new Date(user.created_at).toLocaleDateString('ar-SA')}</td>
                                        <td>
                                            <div class="action-buttons">
                                                <button class="btn btn-outline btn-sm" onclick="app.editEmployee(${user.id})">✏️ تعديل</button>
                                                ${user.id !== 1 && user.id !== this.currentUser.id ? `
                                                    <button class="btn btn-danger btn-sm" onclick="app.deleteEmployee(${user.id})">🗑️ حذف</button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    async getProductsManagementContent() {
        await this.loadProducts();
        
        return `
            <div class="section">
                <div class="section-header">
                    <h2>📦 إدارة المنتجات</h2>
                    <div class="header-actions">
                        <button class="btn btn-primary" onclick="app.showProductModal()">➕ إضافة منتج</button>
                    </div>
                </div>
                <div class="section-body">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>الصورة</th>
                                    <th>اسم المنتج</th>
                                    <th>الفئة</th>
                                    <th>السعر</th>
                                    <th>المخزون</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.products.map(product => {
                                    let imageUrl = '';
                                    if (product.image) {
                                        if (product.image.startsWith('/uploads/')) {
                                            imageUrl = product.image;
                                        } else if (product.image.startsWith('http')) {
                                            imageUrl = product.image;
                                        } else {
                                            imageUrl = `/uploads/products/${product.image}`;
                                        }
                                    } else {
                                        imageUrl = '/uploads/products/default.jpg';
                                    }
                                    
                                    return `
                                    <tr>
                                        <td>
                                            <img src="${imageUrl}" alt="${product.name}" 
                                                 onerror="this.onerror=null; this.src='/uploads/products/default.jpg';"
                                                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                                        </td>
                                        <td>
                                            <div>
                                                <strong>${product.name}</strong>
                                                ${product.description ? `<br><small>${product.description}</small>` : ''}
                                            </div>
                                        </td>
                                        <td>${this.categories.find(c => c.id === product.category)?.name || product.category}</td>
                                        <td>${product.price} ر.س</td>
                                        <td>
                                            <span class="${product.stock < 10 ? 'low-stock' : 'in-stock'}">
                                                ${product.stock}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="status-badge ${product.is_active ? 'status-success' : 'status-danger'}">
                                                ${product.is_active ? 'نشط' : 'غير نشط'}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="action-buttons">
                                                <button class="btn btn-outline btn-sm" onclick="app.editProduct(${product.id})">✏️ تعديل</button>
                                                <button class="btn btn-danger btn-sm" onclick="app.deleteProduct(${product.id})">🗑️ حذف</button>
                                            </div>
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    async getReportsContent() {
        let salesReport = {};
        let inventoryReport = {};
        let customersReport = {};

        try {
            salesReport = await this.apiCall('/reports/sales?period=month');
            inventoryReport = await this.apiCall('/reports/inventory');
            customersReport = await this.apiCall('/reports/customers');
        } catch (error) {
            console.error('Load reports error:', error);
        }

        return `
            <div class="section">
                <div class="section-header">
                    <h2>التقارير والإحصائيات</h2>
                    <div class="header-actions">
                        <select id="reportPeriod" onchange="app.loadSalesReport()" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                            <option value="day">اليوم</option>
                            <option value="week" selected>الأسبوع</option>
                            <option value="month">الشهر</option>
                            <option value="year">السنة</option>
                        </select>
                    </div>
                </div>
                <div class="section-body">
                    <div class="tabs" style="margin-bottom: 2rem;">
                        <button class="tab-btn active" onclick="app.showReportTab('sales')">📈 تقارير المبيعات</button>
                        <button class="tab-btn" onclick="app.showReportTab('inventory')">📦 تقارير المخزون</button>
                        <button class="tab-btn" onclick="app.showReportTab('customers')">👥 تقارير العملاء</button>
                    </div>

                    <div id="salesReportTab" class="report-tab">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${salesReport.sales?.total_orders || 0}</div>
                                <div class="stat-label">عدد الطلبات</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${salesReport.sales?.total_revenue || 0} ر.س</div>
                                <div class="stat-label">إجمالي المبيعات</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${salesReport.sales?.average_order || 0} ر.س</div>
                                <div class="stat-label">متوسط قيمة الطلب</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem;">
                            <div class="stat-card">
                                <h4>المنتجات الأكثر مبيعاً</h4>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    ${salesReport.top_products && salesReport.top_products.length > 0 ? 
                                        salesReport.top_products.map(product => `
                                            <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                                                <span>${product.name}</span>
                                                <span><strong>${product.total_sold}</strong> (${product.revenue} ر.س)</span>
                                            </div>
                                        `).join('') :
                                        '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد بيانات</p>'
                                    }
                                </div>
                            </div>

                            <div class="stat-card">
                                <h4>أفضل العملاء</h4>
                                <div style="max-height: 300px; overflow-y: auto;">
                                    ${salesReport.top_customers && salesReport.top_customers.length > 0 ? 
                                        salesReport.top_customers.map(customer => `
                                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border);">
                                                <div><strong>${customer.name}</strong></div>
                                                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-light);">
                                                    <span>${customer.order_count} طلب</span>
                                                    <span>${customer.total_spent} ر.س</span>
                                                </div>
                                            </div>
                                        `).join('') :
                                        '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد بيانات</p>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="inventoryReportTab" class="report-tab" style="display: none;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="stat-card">
                                <h4>المنتجات منخفضة المخزون</h4>
                                <div style="max-height: 400px; overflow-y: auto;">
                                    ${inventoryReport.low_stock && inventoryReport.low_stock.length > 0 ? 
                                        inventoryReport.low_stock.map(product => `
                                            <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                                                <span>${product.name}</span>
                                                <span style="color: ${product.stock < 5 ? 'var(--danger)' : 'var(--warning)'}">
                                                    <strong>${product.stock}</strong>
                                                </span>
                                            </div>
                                        `).join('') :
                                        '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد منتجات منخفضة المخزون</p>'
                                    }
                                </div>
                            </div>

                            <div class="stat-card">
                                <h4>حركة المخزون</h4>
                                <div style="max-height: 400px; overflow-y: auto;">
                                    ${inventoryReport.inventory_movement && inventoryReport.inventory_movement.length > 0 ? 
                                        inventoryReport.inventory_movement.map(product => `
                                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border);">
                                                <div><strong>${product.name}</strong></div>
                                                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-light);">
                                                    <span>المخزون: ${product.current_stock}</span>
                                                    <span>مباع (30 يوم): ${product.sold_last_30_days || 0}</span>
                                                </div>
                                            </div>
                                        `).join('') :
                                        '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد بيانات</p>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="customersReportTab" class="report-tab" style="display: none;">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${customersReport.customer_stats?.total_customers || 0}</div>
                                <div class="stat-label">إجمالي العملاء</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${customersReport.customer_stats?.new_customers_30_days || 0}</div>
                                <div class="stat-label">عملاء جدد (30 يوم)</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${customersReport.customer_stats?.active_customers_30_days || 0}</div>
                                <div class="stat-label">عملاء نشطين (30 يوم)</div>
                            </div>
                        </div>

                        <div class="stat-card" style="margin-top: 1.5rem;">
                            <h4>أفضل العملاء من حيث الإنفاق</h4>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${customersReport.top_customers && customersReport.top_customers.length > 0 ? 
                                    customersReport.top_customers.map(customer => `
                                        <div style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <div>
                                                    <strong>${customer.name}</strong>
                                                    <div style="font-size: 0.9rem; color: var(--text-light);">
                                                        ${customer.email} • ${customer.phone || 'لا يوجد'}
                                                    </div>
                                                </div>
                                                <div style="text-align: left;">
                                                    <div><strong>${customer.total_spent} ر.س</strong></div>
                                                    <div style="font-size: 0.8rem; color: var(--text-light);">
                                                        ${customer.total_orders} طلب
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('') :
                                    '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد بيانات</p>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async getBackupContent() {
        let backupInfo = {};

        try {
            backupInfo = await this.apiCall('/backup/info');
        } catch (error) {
            console.error('Load backup info error:', error);
        }

        return `
            <div class="section">
                <div class="section-header">
                    <h2>النسخ الاحتياطي للنظام</h2>
                </div>
                <div class="section-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${backupInfo.database_info?.users_count || 0}</div>
                            <div class="stat-label">عدد المستخدمين</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${backupInfo.database_info?.products_count || 0}</div>
                            <div class="stat-label">عدد المنتجات</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${backupInfo.database_info?.orders_count || 0}</div>
                            <div class="stat-label">عدد الطلبات</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${backupInfo.database_info?.notifications_count || 0}</div>
                            <div class="stat-label">عدد الإشعارات</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem;">
                        <div class="stat-card">
                            <h4>إجراءات النسخ الاحتياطي</h4>
                            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                                <button class="btn btn-success" onclick="app.exportBackup()">
                                    📥 تصدير نسخة احتياطية
                                </button>
                                <button class="btn btn-warning" onclick="app.showImportBackup()">
                                    📤 استيراد نسخة احتياطية
                                </button>
                                <button class="btn btn-info" onclick="app.createAutoBackup()">
                                    💾 نسخ احتياطي تلقائي
                                </button>
                            </div>
                            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                                <p><strong>آخر نسخة احتياطية:</strong></p>
                                <p>${backupInfo.database_info?.last_backup ? new Date(backupInfo.database_info.last_backup).toLocaleString('ar-SA') : 'لم يتم بعد'}</p>
                            </div>
                        </div>

                        <div class="stat-card">
                            <h4>سجل النسخ الاحتياطي</h4>
                            <div style="max-height: 300px; overflow-y: auto;">
                                ${backupInfo.backup_logs && backupInfo.backup_logs.length > 0 ? 
                                    backupInfo.backup_logs.map(log => `
                                        <div style="padding: 0.75rem; border-bottom: 1px solid var(--border);">
                                            <div style="display: flex; justify-content: space-between;">
                                                <strong>${log.type === 'export' ? 'تصدير' : 'استيراد'}</strong>
                                                <span style="font-size: 0.9rem; color: var(--text-light);">
                                                    ${new Date(log.created_at).toLocaleDateString('ar-SA')}
                                                </span>
                                            </div>
                                            <div style="font-size: 0.9rem; color: var(--text-light);">
                                                ${log.file_name || 'يدوي'} • ${Math.round(log.data_size / 1024)} كيلوبايت
                                            </div>
                                        </div>
                                    `).join('') :
                                    '<p style="text-align: center; color: var(--text-light); padding: 1rem;">لا توجد سجلات</p>'
                                }
                            </div>
                        </div>
                    </div>

                    <div class="stat-card" style="margin-top: 1.5rem;">
                        <h4>نصائح مهمة</h4>
                        <ul style="list-style-type: disc; padding-right: 1.5rem; line-height: 1.8;">
                            <li>احفظ نسخة احتياطية بانتظام (أسبوعياً على الأقل)</li>
                            <li>خزّن النسخ الاحتياطية في مكان آمن</li>
                            <li>اختبر استعادة النسخ الاحتياطية بشكل دوري</li>
                            <li>النسخ الاحتياطي يشمل: المستخدمين، المنتجات، الطلبات، والإشعارات</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getOrderStatusText(status) {
        const statuses = {
            'pending': 'قيد الانتظار',
            'processing': 'قيد التنفيذ',
            'completed': 'مكتمل',
            'cancelled': 'ملغي'
        };
        return statuses[status] || status;
    }

    async addToCart(productId) {
        if (this.isGuest) {
            await this.addToGuestCart(productId);
        } else {
            try {
                await this.apiCall('/cart', {
                    method: 'POST',
                    body: { product_id: productId, quantity: 1 }
                });
                await this.loadCart();
                this.showAlert('تمت إضافة المنتج إلى العربة', 'success');
            } catch (error) {
                this.showAlert(error.message, 'error');
            }
        }
    }

    async addToGuestCart(productId) {
        try {
            const product = await this.apiCall(`/products/${productId}`);
            
            const existingItem = this.guestCart.find(item => item.product_id === productId);
            
            if (existingItem) {
                if (existingItem.quantity < product.stock) {
                    existingItem.quantity += 1;
                } else {
                    this.showAlert('الكمية المطلوبة غير متوفرة في المخزون', 'error');
                    return;
                }
            } else {
                if (product.stock > 0) {
                    this.guestCart.push({
                        product_id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        stock: product.stock,
                        quantity: 1
                    });
                } else {
                    this.showAlert('المنتج غير متوفر حالياً', 'error');
                    return;
                }
            }
            
            localStorage.setItem('guest_cart', JSON.stringify(this.guestCart));
            this.showAlert('تمت إضافة المنتج إلى العربة', 'success');
            
        } catch (error) {
            this.showAlert('خطأ في إضافة المنتج إلى العربة', 'error');
        }
    }

    async updateCartItem(productId, quantity) {
        try {
            await this.apiCall(`/cart/${productId}`, {
                method: 'PUT',
                body: { quantity }
            });
            await this.loadCart();
            this.showSection('cart');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    updateGuestCartItem(productId, quantity) {
        const item = this.guestCart.find(item => item.product_id === productId);
        if (!item) return;

        if (quantity === 0) {
            this.removeFromGuestCart(productId);
        } else if (quantity <= item.stock) {
            item.quantity = quantity;
            localStorage.setItem('guest_cart', JSON.stringify(this.guestCart));
            this.showSection('cart');
        } else {
            this.showAlert('الكمية المطلوبة غير متوفرة في المخزون', 'error');
        }
    }

    async removeFromCart(productId) {
        try {
            await this.apiCall(`/cart/${productId}`, {
                method: 'DELETE'
            });
            await this.loadCart();
            this.showSection('cart');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    removeFromGuestCart(productId) {
        this.guestCart = this.guestCart.filter(item => item.product_id !== productId);
        localStorage.setItem('guest_cart', JSON.stringify(this.guestCart));
        this.showSection('cart');
    }

    async clearCart() {
        try {
            await this.apiCall('/cart', {
                method: 'DELETE'
            });
            await this.loadCart();
            this.showSection('cart');
            this.showAlert('تم تفريغ العربة', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    clearGuestCart() {
        this.guestCart = [];
        localStorage.setItem('guest_cart', JSON.stringify(this.guestCart));
        this.showSection('cart');
        this.showAlert('تم تفريغ العربة', 'success');
    }

    showCheckoutModal() {
        document.getElementById('checkoutModal').style.display = 'flex';
    }

    closeCheckoutModal() {
        document.getElementById('checkoutModal').style.display = 'none';
    }

    async submitOrder() {
        const customer_name = document.getElementById('checkoutName').value;
        const customer_phone = document.getElementById('checkoutPhone').value;
        const customer_address = document.getElementById('checkoutAddress').value;
        const guest_email = document.getElementById('checkoutEmail').value;
        const payment_method = document.querySelector('input[name="paymentMethod"]:checked').value;

        if (!customer_name || !customer_phone || !customer_address) {
            this.showAlert('يرجى ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        try {
            let orderData = {
                customer_name,
                customer_phone,
                customer_address,
                guest_email,
                payment_method
            };

            // إذا كان زائراً، نرسل عربة التسوق مع الطلب
            if (this.isGuest) {
                orderData.cartItems = this.guestCart.map(item => ({
                    product_id: item.product_id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    stock: item.stock
                }));
            }

            const result = await this.apiCall('/orders', {
                method: 'POST',
                body: orderData
            });

            this.closeCheckoutModal();
            
            if (result.is_guest) {
                // عرض صفحة نجاح الطلب للزوار
                this.showGuestOrderSuccess(result);
            } else {
                this.showAlert('تم إنشاء الطلب بنجاح! رقم الطلب: ' + result.order_number, 'success');
                await this.loadCart();
                this.showSection('orders');
            }
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    showGuestOrderSuccess(orderResult) {
        window.lastGuestOrder = orderResult;
        
        document.getElementById('main-content').innerHTML = `
            <div class="section">
                <div class="section-header">
                    <h2>✅ تم إنشاء طلبك بنجاح</h2>
                </div>
                <div class="section-body">
                    <div class="order-success">
                        <div class="success-icon">🎉</div>
                        <h3>شكراً لتسوقك معنا!</h3>
                        
                        <div class="order-details-card">
                            <h4>تفاصيل الطلب:</h4>
                            <div class="detail-row">
                                <span>رقم الطلب:</span>
                                <strong>#${orderResult.order_number}</strong>
                            </div>
                            <div class="detail-row">
                                <span>كود المتابعة:</span>
                                <strong class="guest-code">${orderResult.guest_order_code}</strong>
                            </div>
                            <div class="detail-row">
                                <span>طريقة الدفع:</span>
                                <span>${document.querySelector('input[name="paymentMethod"]:checked').value === 'cash' ? 'نقدي عند الاستلام' : 'محفظة إلكترونية'}</span>
                            </div>
                        </div>

                        <div class="guest-actions">
                            <div class="action-card">
                                <h4>📱 متابعة الطلب</h4>
                                <p>احفظ كود المتابعة لمعرفة حالة طلبك في أي وقت</p>
                                <button class="btn btn-outline" onclick="app.showTrackOrder()">متابعة الطلب</button>
                            </div>
                            
                            <div class="action-card">
                                <h4>👤 إنشاء حساب</h4>
                                <p>أنشئ حساباً لحفظ طلباتك والاستفادة من العروض الحصرية</p>
                                <button class="btn btn-primary" onclick="app.showRegister()">إنشاء حساب</button>
                            </div>
                        </div>

                        <div class="success-note">
                            <p>📞 سنتصل بك على <strong>${document.getElementById('checkoutPhone').value}</strong> لتأكيد الطلب</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async showTrackOrder() {
        document.getElementById('main-content').innerHTML = `
            <div class="section">
                <div class="section-header">
                    <h2>📱 متابعة الطلب</h2>
                </div>
                <div class="section-body">
                    <div class="track-order-form">
                        <p>أدخل كود المتابعة ورقم الهاتف لمشاهدة حالة طلبك</p>
                        
                        <form id="trackOrderForm">
                            <div class="form-group">
                                <label for="trackCode">كود المتابعة</label>
                                <input type="text" id="trackCode" required placeholder="أدخل كود المتابعة">
                            </div>
                            <div class="form-group">
                                <label for="trackPhone">رقم الهاتف</label>
                                <input type="tel" id="trackPhone" required placeholder="أدخل رقم الهاتف">
                            </div>
                            <button type="submit" class="btn btn-primary btn-block">متابعة الطلب</button>
                        </form>

                        <div id="trackResult" style="margin-top: 2rem;"></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('trackOrderForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.trackGuestOrder();
        });
    }

    async trackGuestOrder() {
        const code = document.getElementById('trackCode').value;
        const phone = document.getElementById('trackPhone').value;
        const submitBtn = document.querySelector('#trackOrderForm button[type="submit"]');

        if (!code || !phone) {
            this.showAlert('يرجى ملء جميع الحقول', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري البحث...';

            const order = await this.apiCall(`/guest/orders/${code}?phone=${phone}`);
            
            const statusMessages = {
                'pending': '🟡 قيد الانتظار',
                'processing': '🔵 قيد التنفيذ', 
                'completed': '🟢 مكتمل',
                'cancelled': '🔴 ملغي'
            };

            document.getElementById('trackResult').innerHTML = `
                <div class="order-track-result">
                    <h3>حالة الطلب #${order.id}</h3>
                    <div class="order-status-large status-${order.status}" style="animation: pulse 2s infinite;">
                        ${statusMessages[order.status] || order.status}
                    </div>
                    
                    ${order.status === 'processing' ? `
                        <div class="status-update" style="background: #e7f3ff; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                            <p>🔄 الطلب قيد التجهيز والتوصيل</p>
                        </div>
                    ` : ''}
                    
                    ${order.status === 'completed' ? `
                        <div class="status-update" style="background: #d4edda; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                            <p>✅ تم توصيل الطلب بنجاح</p>
                        </div>
                    ` : ''}
                    
                    ${order.status === 'cancelled' ? `
                        <div class="status-update" style="background: #f8d7da; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                            <p>❌ تم إلغاء الطلب</p>
                        </div>
                    ` : ''}
                    
                    <div class="order-track-details">
                        <div class="detail-row">
                            <span>العميل:</span>
                            <span>${order.customer_name}</span>
                        </div>
                        <div class="detail-row">
                            <span>رقم الهاتف:</span>
                            <span>${order.customer_phone}</span>
                        </div>
                        <div class="detail-row">
                            <span>العنوان:</span>
                            <span>${order.customer_address}</span>
                        </div>
                        <div class="detail-row">
                            <span>المبلغ الإجمالي:</span>
                            <span><strong>${order.total_amount} ر.س</strong></span>
                        </div>
                        <div class="detail-row">
                            <span>تاريخ الطلب:</span>
                            <span>${new Date(order.created_at).toLocaleDateString('ar-SA')}</span>
                        </div>
                    </div>

                    ${order.items && order.items.length > 0 ? `
                        <div class="order-track-items">
                            <h4>المنتجات (${order.items_count})</h4>
                            ${order.items.map(item => `
                                <div class="track-item">
                                    <span>${item.product_name}</span>
                                    <span>${item.quantity} × ${item.product_price} ر.س</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="track-actions">
                        <button class="btn btn-outline" onclick="app.showWelcome()">العودة للرئيسية</button>
                        ${order.status !== 'completed' && order.status !== 'cancelled' ? `
                            <button class="btn btn-primary" onclick="app.showSection('products')">مواصلة التسوق</button>
                        ` : ''}
                    </div>
                </div>
            `;

        } catch (error) {
            document.getElementById('trackResult').innerHTML = `
                <div class="alert alert-error">
                    ${error.message}
                </div>
            `;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'متابعة الطلب';
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        console.log(`🔄 محاولة تحديث حالة الطلب #${orderId} إلى: ${newStatus}`);
        
        try {
            const result = await this.apiCall(`/orders/${orderId}/status`, {
                method: 'PUT',
                body: { status: newStatus }
            });

            this.showAlert('تم تحديث حالة الطلب بنجاح', 'success');
            console.log(`✅ تم تحديث حالة الطلب #${orderId} إلى: ${newStatus}`);
            
            await this.showSection('orders');
            
        } catch (error) {
            console.error('❌ خطأ في تحديث حالة الطلب:', error);
            this.showAlert(error.message, 'error');
            
            setTimeout(() => {
                this.showSection('orders');
            }, 1000);
        }
    }

    async applyStatusChange(orderId) {
        const selectElement = document.getElementById(`status-${orderId}`);
        if (selectElement) {
            const newStatus = selectElement.value;
            await this.updateOrderStatus(orderId, newStatus);
        }
    }

    async refreshOrders() {
        await this.showSection('orders');
        this.showAlert('تم تحديث قائمة الطلبات', 'success');
    }

    showEmployeeModal(employee = null) {
        const isEdit = !!employee;
        
        const modalHTML = `
            <div class="modal" id="employeeModal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'تعديل موظف' : 'إضافة موظف جديد'}</h3>
                        <button class="close-btn" onclick="app.closeEmployeeModal()">×</button>
                    </div>
                    <form id="employeeForm">
                        <div class="form-group">
                            <label for="empName">الاسم الكامل</label>
                            <input type="text" id="empName" value="${employee ? employee.name : ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="empEmail">البريد الإلكتروني</label>
                            <input type="email" id="empEmail" value="${employee ? employee.email : ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="empPhone">رقم الهاتف</label>
                            <input type="tel" id="empPhone" value="${employee ? employee.phone || '' : ''}">
                        </div>
                        <div class="form-group">
                            <label for="empAddress">العنوان</label>
                            <textarea id="empAddress" rows="3">${employee ? employee.address || '' : ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="empRole">الدور</label>
                            <select id="empRole" required>
                                <option value="employee" ${employee && employee.role === 'employee' ? 'selected' : ''}>موظف</option>
                                <option value="admin" ${employee && employee.role === 'admin' ? 'selected' : ''}>مدير</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="empPassword">${isEdit ? 'كلمة المرور الجديدة (اتركها فارغة للحفاظ على كلمة المرور الحالية)' : 'كلمة المرور'}</label>
                            <input type="password" id="empPassword" ${isEdit ? '' : 'required'}>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">${isEdit ? 'تحديث' : 'إضافة'}</button>
                            <button type="button" class="btn btn-outline" onclick="app.closeEmployeeModal()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('employeeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isEdit) {
                await this.updateEmployee(employee.id);
            } else {
                await this.createEmployee();
            }
        });
    }

    closeEmployeeModal() {
        const modal = document.getElementById('employeeModal');
        if (modal) {
            modal.remove();
        }
    }

    async createEmployee() {
        const form = document.getElementById('employeeForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const employeeData = {
            name: document.getElementById('empName').value,
            email: document.getElementById('empEmail').value,
            phone: document.getElementById('empPhone').value,
            address: document.getElementById('empAddress').value,
            role: document.getElementById('empRole').value,
            password: document.getElementById('empPassword').value
        };
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري الإضافة...';
            
            await this.apiCall('/users', {
                method: 'POST',
                body: employeeData
            });
            
            this.closeEmployeeModal();
            this.showAlert('تم إضافة الموظف بنجاح', 'success');
            this.showSection('employees');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إضافة';
        }
    }

    async updateEmployee(employeeId) {
        const form = document.getElementById('employeeForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const employeeData = {
            name: document.getElementById('empName').value,
            email: document.getElementById('empEmail').value,
            phone: document.getElementById('empPhone').value,
            address: document.getElementById('empAddress').value,
            role: document.getElementById('empRole').value
        };
        
        const password = document.getElementById('empPassword').value;
        if (password) {
            employeeData.password = password;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري التحديث...';
            
            await this.apiCall(`/users/${employeeId}`, {
                method: 'PUT',
                body: employeeData
            });
            
            this.closeEmployeeModal();
            this.showAlert('تم تحديث بيانات الموظف بنجاح', 'success');
            this.showSection('employees');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تحديث';
        }
    }

    async deleteEmployee(employeeId) {
        if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
            return;
        }
        
        try {
            await this.apiCall(`/users/${employeeId}`, {
                method: 'DELETE'
            });
            
            this.showAlert('تم حذف الموظف بنجاح', 'success');
            this.showSection('employees');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    async editEmployee(employeeId) {
        try {
            const employee = await this.apiCall(`/users/${employeeId}`);
            this.showEmployeeModal(employee);
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    showProductModal(product = null) {
        const isEdit = !!product;
        
        const modalHTML = `
            <div class="modal" id="productModal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
                        <button class="close-btn" onclick="app.closeProductModal()">×</button>
                    </div>
                    <form id="productForm">
                        <div class="form-group">
                            <label for="prodName">اسم المنتج</label>
                            <input type="text" id="prodName" value="${product ? product.name : ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="prodDescription">وصف المنتج</label>
                            <textarea id="prodDescription" rows="3">${product ? product.description || '' : ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="prodPrice">السعر (ريال)</label>
                            <input type="number" id="prodPrice" step="0.01" min="0" value="${product ? product.price : ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="prodCategory">الفئة</label>
                            <select id="prodCategory" required>
                                <option value="">اختر الفئة</option>
                                ${this.categories.filter(cat => cat.id !== 'all').map(cat => 
                                    `<option value="${cat.id}" ${product && product.category === cat.id ? 'selected' : ''}>${cat.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="prodStock">الكمية في المخزون</label>
                            <input type="number" id="prodStock" min="0" value="${product ? product.stock : '0'}" required>
                        </div>
                        <div class="form-group">
                            <label>صورة المنتج</label>
                            <div style="margin-top: 0.5rem;">
                                <div style="display: flex; gap: 1rem; align-items: center;">
                                    <input type="text" id="prodImageUrl" placeholder="رابط الصورة (اختياري)" 
                                           value="${product && product.image ? product.image : ''}" 
                                           style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                                    <button type="button" class="btn btn-outline btn-sm" onclick="app.showUploadModal(function(url){document.getElementById('prodImageUrl').value = url;})">
                                        📁 رفع صورة
                                    </button>
                                </div>
                            </div>
                        </div>
                        ${product && product.image ? `
                            <div class="current-image" style="margin-top: 1rem;">
                                <p style="margin-bottom: 0.5rem;"><strong>الصورة الحالية:</strong></p>
                                <img src="${product.image}" alt="${product.name}" 
                                     style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid var(--border);">
                            </div>
                        ` : ''}
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">${isEdit ? 'تحديث' : 'إضافة'}</button>
                            <button type="button" class="btn btn-outline" onclick="app.closeProductModal()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('productForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isEdit) {
                await this.updateProduct(product.id);
            } else {
                await this.createProduct();
            }
        });
    }

    closeProductModal() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.remove();
        }
    }

    async createProduct() {
        const form = document.getElementById('productForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const productData = {
            name: document.getElementById('prodName').value,
            description: document.getElementById('prodDescription').value,
            price: document.getElementById('prodPrice').value,
            category: document.getElementById('prodCategory').value,
            stock: document.getElementById('prodStock').value
        };
        
        const imageUrl = document.getElementById('prodImageUrl').value;
        if (imageUrl) {
            productData.image = imageUrl;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري الإضافة...';
            
            await this.apiCall('/products', {
                method: 'POST',
                body: productData
            });
            
            this.closeProductModal();
            this.showAlert('تم إضافة المنتج بنجاح', 'success');
            this.showSection('products-management');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إضافة';
        }
    }

    async updateProduct(productId) {
        const form = document.getElementById('productForm');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const productData = {
            name: document.getElementById('prodName').value,
            description: document.getElementById('prodDescription').value,
            price: document.getElementById('prodPrice').value,
            category: document.getElementById('prodCategory').value,
            stock: document.getElementById('prodStock').value
        };
        
        const imageUrl = document.getElementById('prodImageUrl').value;
        if (imageUrl) {
            productData.image = imageUrl;
        }
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري التحديث...';
            
            const result = await this.apiCall(`/products/${productId}`, {
                method: 'PUT',
                body: productData
            });
            
            this.closeProductModal();
            this.showAlert('تم تحديث المنتج بنجاح', 'success');
            this.showSection('products-management');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تحديث';
        }
    }

    async deleteProduct(productId) {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
            return;
        }
        
        try {
            await this.apiCall(`/products/${productId}`, {
                method: 'DELETE'
            });
            
            this.showAlert('تم حذف المنتج بنجاح', 'success');
            this.showSection('products-management');
            
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    async editProduct(productId) {
        try {
            const product = await this.apiCall(`/products/${productId}`);
            this.showProductModal(product);
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    showUploadModal(callback = null) {
        this.currentUploadCallback = callback;
        
        const modalHTML = `
            <div class="modal" id="uploadModal" style="display: flex;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>رفع صورة للمنتج</h3>
                        <button class="close-btn" onclick="app.closeUploadModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align: center; padding: 2rem;">
                            <input type="file" id="simpleImageInput" accept="image/*" 
                                   style="display: none;" onchange="app.handleSimpleImageSelect(this.files[0])">
                            
                            <div onclick="document.getElementById('simpleImageInput').click()" 
                                 style="border: 2px dashed #ccc; padding: 3rem; border-radius: 10px; cursor: pointer; margin-bottom: 1rem;">
                                <div style="font-size: 3rem;">📁</div>
                                <div>انقر لاختيار صورة</div>
                                <small style="color: #666;">JPG, PNG, GIF - حد أقصى 10MB</small>
                            </div>
                            
                            <div id="simplePreview" style="margin-top: 1rem; display: none;">
                                <img id="simplePreviewImg" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                            </div>
                            
                            <button id="simpleUploadBtn" class="btn btn-primary" onclick="app.uploadSimpleImage()" 
                                    style="margin-top: 1rem; width: 100%;" disabled>
                                رفع الصورة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    handleSimpleImageSelect(file) {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showAlert('يرجى اختيار صورة فقط', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            this.showAlert('حجم الملف كبير جداً (الحد الأقصى 10MB)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('simplePreview');
            const previewImg = document.getElementById('simplePreviewImg');
            const uploadBtn = document.getElementById('simpleUploadBtn');
            
            previewImg.src = e.target.result;
            preview.style.display = 'block';
            uploadBtn.disabled = false;
            
            this.currentFile = file;
        };
        reader.readAsDataURL(file);
    }

    async uploadSimpleImage() {
        if (!this.currentFile) {
            this.showAlert('لم يتم اختيار صورة', 'error');
            return;
        }
        
        const uploadBtn = document.getElementById('simpleUploadBtn');
        
        try {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'جاري الرفع...';
            
            const formData = new FormData();
            formData.append('image', this.currentFile);
            
            const result = await this.apiUpload('/upload/image', formData);
            
            this.showAlert('تم رفع الصورة بنجاح!', 'success');
            this.closeUploadModal();
            
            if (this.currentUploadCallback) {
                this.currentUploadCallback(result.imageUrl);
            }
            
        } catch (error) {
            this.showAlert(error.message, 'error');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'رفع الصورة';
        }
    }

    closeUploadModal() {
        const modal = document.getElementById('uploadModal');
        if (modal) {
            modal.remove();
        }
        this.currentFile = null;
        this.currentUploadCallback = null;
    }

    showReportTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.report-tab').forEach(tab => tab.style.display = 'none');
        
        event.target.classList.add('active');
        document.getElementById(`${tabName}ReportTab`).style.display = 'block';
    }

    async loadSalesReport() {
        const period = document.getElementById('reportPeriod').value;
        try {
            await this.apiCall(`/reports/sales?period=${period}`);
            this.showSection('reports');
        } catch (error) {
            this.showAlert('خطأ في تحميل التقرير', 'error');
        }
    }

    async exportBackup() {
        try {
            const data = await this.apiCall('/backup/export', {
                method: 'POST'
            });

            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.file_name;
            a.click();
            URL.revokeObjectURL(url);

            this.showAlert('تم تصدير النسخة الاحتياطية بنجاح', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    showImportBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!confirm('⚠️ تحذير: هذا الإجراء سيستبدل جميع البيانات الحالية. هل أنت متأكم؟')) {
                        return;
                    }

                    await this.apiCall('/backup/import', {
                        method: 'POST',
                        body: { data }
                    });

                    this.showAlert('تم استيراد النسخة الاحتياطية بنجاح', 'success');
                    location.reload();
                } catch (error) {
                    this.showAlert('خطأ في قراءة الملف', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async createAutoBackup() {
        try {
            await this.exportBackup();
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    async showNotifications() {
        await this.loadNotifications();
        
        const modal = document.getElementById('notificationsModal');
        const list = document.getElementById('notificationsList');
        
        list.innerHTML = this.notifications.length > 0 ? 
            this.notifications.map(notification => `
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: ${notification.is_read ? 'transparent' : 'rgba(44, 119, 68, 0.05)'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <strong>${notification.title}</strong>
                        <span style="font-size: 0.8rem; color: var(--text-light);">
                            ${new Date(notification.created_at).toLocaleString('ar-SA')}
                        </span>
                    </div>
                    <div style="color: var(--text-light); margin-bottom: 0.5rem;">${notification.message}</div>
                    ${!notification.is_read ? `
                        <button class="btn btn-outline btn-sm" onclick="app.markNotificationRead(${notification.id})">
                            تحديد كمقروء
                        </button>
                    ` : ''}
                </div>
            `).join('') :
            '<p style="text-align: center; padding: 2rem; color: var(--text-light);">لا توجد إشعارات</p>';
        
        modal.style.display = 'flex';
    }

    closeNotificationsModal() {
        document.getElementById('notificationsModal').style.display = 'none';
    }

    async markNotificationRead(notificationId) {
        try {
            await this.apiCall(`/notifications/${notificationId}/read`, {
                method: 'PUT'
            });
            
            await this.loadNotifications();
            this.showNotifications();
            this.updateNotificationBadge();
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    async markAllNotificationsRead() {
        try {
            await this.apiCall('/notifications/read-all', {
                method: 'PUT'
            });
            
            await this.loadNotifications();
            this.showNotifications();
            this.updateNotificationBadge();
            this.showAlert('تم تحديد جميع الإشعارات كمقروءة', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    showAlert(message, type = 'info') {
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <strong>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</strong> ${message}
            <button style="float: left; background: none; border: none; font-size: 1.2rem; cursor: pointer;" onclick="this.parentElement.remove()">×</button>
        `;

        const mainContent = document.querySelector('.app-main');
        if (mainContent) {
            mainContent.insertBefore(alert, mainContent.firstChild);
        }

        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    logout() {
        localStorage.removeItem('supermarket_token');
        localStorage.removeItem('supermarket_user');
        this.token = null;
        this.currentUser = null;
        this.cart = [];
        this.notifications = [];
        this.showWelcome();
        this.showAlert('تم تسجيل الخروج بنجاح', 'success');
    }
}

// إضافة الأنماط المفقودة
const styleElement = document.createElement('style');
styleElement.textContent = `
    .order-status {
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: bold;
        display: inline-block;
    }
    .status-pending {
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
    }
    .status-processing {
        background: #cce7ff;
        color: #004085;
        border: 1px solid #b3d7ff;
    }
    .status-completed {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    .status-cancelled {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    .order-actions {
        margin-top: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e9ecef;
    }
    .order-final-status {
        margin-top: 1rem;
        padding: 1rem;
        background: #e9ecef;
        border-radius: 8px;
        text-align: center;
    }
    .order-status-large {
        padding: 1rem 2rem;
        border-radius: 12px;
        font-size: 1.2rem;
        font-weight: bold;
        text-align: center;
        margin: 1rem 0;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
    
    .product-image img {
        width: 100%;
        height: 180px;
        object-fit: cover;
        border-radius: 8px;
        background: #f5f5f5;
        transition: transform 0.3s ease;
    }
    
    .product-image img:hover {
        transform: scale(1.03);
    }
    
    img {
        display: block;
        max-width: 100%;
        height: auto;
    }
    
    .item-image img {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 4px;
    }
    
    .data-table img {
        width: 50px;
        height: 50px;
        object-fit: cover;
        border-radius: 4px;
    }
    
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: white;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
    }
    
    .modal-header {
        padding: 1rem;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }
`;
document.head.appendChild(styleElement);

// تشغيل التطبيق
const app = new SupermarketApp();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const app = express();

// تخزين النشاطات
const activities = [];

// مسار ملف المستخدمين
const usersFilePath = path.join(__dirname, 'users.json');

// التحقق من وجود ملف المستخدمين وإنشائه إذا لم يكن موجوداً
let users = [];
try {
  if (fs.existsSync(usersFilePath)) {
    const usersData = fs.readFileSync(usersFilePath, 'utf8');
    users = JSON.parse(usersData);
  } else {
    // إنشاء ملف المستخدمين بالبيانات الافتراضية
    users = [
      { id: 1, username: 'admin', password: 'admin123', fullName: 'مدير النظام', role: 'admin', lastLogin: new Date().toISOString() }
    ];
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  }
} catch (error) {
  console.error('خطأ في قراءة/كتابة ملف المستخدمين:', error);
  // استخدام البيانات الافتراضية في حالة حدوث خطأ
  users = [
    { id: 1, username: 'admin', password: 'admin123', fullName: 'مدير النظام', role: 'admin', lastLogin: new Date().toISOString() }
  ];
}

// دالة لحفظ المستخدمين في الملف
function saveUsers() {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('خطأ في حفظ ملف المستخدمين:', error);
    return false;
  }
}

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// إضافة نشاط جديد
function addActivity(type, username, details) {
  const activity = {
    id: activities.length + 1,
    type,
    username,
    details,
    timestamp: new Date().toISOString()
  };
  activities.push(activity);
  
  // الاحتفاظ بآخر 100 نشاط فقط
  if (activities.length > 100) {
    activities.shift();
  }
  
  return activity;
}

// معالج API للوكيل
app.get('/api/proxy', async (req, res) => {
  const { unique } = req.query;

  if (!unique) {
    return res.status(400).json({ error: "يرجى إدخال الرقم الموحد." });
  }

  try {
    const response = await fetch(`http://176.241.95.201:8092/id?unique=${encodeURIComponent(unique)}`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic YWRtaW46MjQxMDY3ODkw',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `السيرفر رد بحالة ${response.status}` });
    }

    const data = await response.json();

    // التأكد من وجود البيانات المطلوبة
    if (data.trips && Array.isArray(data.trips)) {
      data.trips.forEach(trip => {
        // التأكد من وجود البيانات الأساسية
        if (!trip.driver_name) trip.driver_name = 'غير متوفر';
        if (!trip.truck_number) trip.truck_number = 'غير متوفر';
        if (!trip.container_number_export) trip.container_number_export = 'غير متوفر';
        if (!trip.manifest) trip.manifest = 'غير متوفر';
        if (!trip.sonar_date) trip.sonar_date = 'غير متوفر';
        if (!trip.sonar_image_url) trip.sonar_image_url = 'غير متوفر';
        
        // التأكد من وجود بيانات السونار
        if (trip.sonarData && trip.sonarData.manifests && trip.sonarData.manifests.length > 0) {
          const manifest = trip.sonarData.manifests[0];
          if (manifest.manifest_number) trip.manifest = manifest.manifest_number;
          if (manifest.sonar_date) trip.sonar_date = manifest.sonar_date;
          if (manifest.sonar_image_url) trip.sonar_image_url = manifest.sonar_image_url;
        } else {
          // إذا لم تكن بيانات السونار متوفرة، تأكد من تعيين القيم الافتراضية
          trip.sonar_date = 'غير متوفر';
          trip.sonar_image_url = 'غير متوفر';
        }
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "خطأ في الاتصال بالسيرفر الخارجي", details: err.message });
  }
});

// واجهة برمجة تطبيقات تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password, isAdmin } = req.body;
  
  if (isAdmin) {
    // تسجيل دخول المدير
    const adminUser = users.find(u => u.username === 'admin' && u.role === 'admin');
    
    if (adminUser && adminUser.password === password) {
      // تحديث وقت آخر تسجيل دخول
      adminUser.lastLogin = new Date().toISOString();
      saveUsers(); // حفظ التغييرات
      
      addActivity('login', username, 'تسجيل دخول مدير');
      return res.json({ success: true, username, role: 'admin' });
    } else {
      return res.status(401).json({ success: false, message: 'بيانات الاعتماد غير صالحة للمدير' });
    }
  } else {
    // تسجيل دخول المستخدم العادي
    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم غير موجود. يرجى التواصل مع المدير.' });
    }
    
    // التحقق من كلمة المرور
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    }
    
    // تحديث وقت آخر تسجيل دخول
    user.lastLogin = new Date().toISOString();
    saveUsers(); // حفظ التغييرات
    
    addActivity('login', username, 'تسجيل دخول مستخدم');
    return res.json({ success: true, username, role: user.role });
  }
});

// API لجلب الإحصائيات
app.get('/api/stats', (req, res) => {
  // حساب الإحصائيات الحقيقية
  const totalUsers = users.length;
  const activeUsers = users.filter(u => new Date(u.lastLogin) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const totalActivities = activities.length;
  const searchCount = activities.filter(a => a.type === 'search').length;
  
  // إحصائيات البحث اليومية (آخر 7 أيام)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const count = activities.filter(a => 
      a.type === 'search' && 
      new Date(a.timestamp) >= date && 
      new Date(a.timestamp) < nextDay
    ).length;
    
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      count
    });
  }
  
  res.json({
    totalUsers,
    activeUsers,
    totalActivities,
    searchCount,
    dailyStats
  });
});

// API لتسجيل عمليات البحث
app.post('/api/log-search', (req, res) => {
  const { username, query } = req.body;
  
  if (!username || !query) {
    return res.status(400).json({ error: "يجب توفير اسم المستخدم واستعلام البحث" });
  }
  
  const activity = addActivity('search', username, `بحث عن: ${query}`);
  res.json({ success: true, activity });
});

// API لجلب سجل النشاطات
app.get('/api/activities', (req, res) => {
  return res.status(200).json({ activities });
});

// API لجلب المستخدمين
app.get('/api/users', (req, res) => {
  return res.status(200).json({ users });
});

// API لإضافة مستخدم جديد
app.post('/api/users', (req, res) => {
  const { username, fullName, password, role } = req.body;
  
  // التحقق من وجود البيانات المطلوبة
  if (!username || !fullName || !password || !role) {
    return res.status(400).json({ 
      success: false, 
      message: "جميع الحقول مطلوبة (اسم المستخدم، الاسم الكامل، كلمة المرور، الصلاحية)" 
    });
  }
  
  // التحقق من عدم وجود مستخدم بنفس اسم المستخدم
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ 
      success: false, 
      message: "اسم المستخدم موجود بالفعل، يرجى اختيار اسم آخر" 
    });
  }
  
  // إنشاء مستخدم جديد
  const newUser = {
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username,
    fullName,
    password, // في التطبيق الحقيقي، يجب تشفير كلمة المرور
    role,
    lastLogin: new Date().toISOString()
  };
  
  // إضافة المستخدم إلى المصفوفة
  users.push(newUser);
  
  // حفظ التغييرات في الملف
  if (!saveUsers()) {
    return res.status(500).json({ 
      success: false, 
      message: "فشل في حفظ بيانات المستخدم" 
    });
  }
  
  // تسجيل نشاط إضافة المستخدم
  addActivity('user_add', req.body.adminUsername || 'admin', `تمت إضافة مستخدم جديد: ${username}`);
  
  return res.status(201).json({ 
    success: true, 
    message: "تمت إضافة المستخدم بنجاح",
    user: { ...newUser, password: undefined } // إرجاع بيانات المستخدم بدون كلمة المرور
  });
});

// API لتعديل مستخدم
app.put('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, fullName, password, role } = req.body;
  
  // البحث عن المستخدم
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: "المستخدم غير موجود" 
    });
  }
  
  // التحقق من عدم وجود مستخدم آخر بنفس اسم المستخدم الجديد
  if (username && username !== users[userIndex].username) {
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "اسم المستخدم موجود بالفعل، يرجى اختيار اسم آخر" 
      });
    }
  }
  
  // تحديث بيانات المستخدم
  if (username) users[userIndex].username = username;
  if (fullName) users[userIndex].fullName = fullName;
  if (password) users[userIndex].password = password; // في التطبيق الحقيقي، يجب تشفير كلمة المرور
  if (role) users[userIndex].role = role;
  
  // حفظ التغييرات في الملف
  if (!saveUsers()) {
    return res.status(500).json({ 
      success: false, 
      message: "فشل في حفظ بيانات المستخدم" 
    });
  }
  
  // تسجيل نشاط تعديل المستخدم
  addActivity('user_update', req.body.adminUsername || 'admin', `تم تعديل بيانات المستخدم: ${users[userIndex].username}`);
  
  return res.status(200).json({ 
    success: true, 
    message: "تم تعديل بيانات المستخدم بنجاح",
    user: { ...users[userIndex], password: undefined } // إرجاع بيانات المستخدم بدون كلمة المرور
  });
});

// API لحذف مستخدم
app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  // البحث عن المستخدم
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: "المستخدم غير موجود" 
    });
  }
  
  // حفظ اسم المستخدم قبل الحذف
  const username = users[userIndex].username;
  
  // حذف المستخدم
  users.splice(userIndex, 1);
  
  // حفظ التغييرات في الملف
  if (!saveUsers()) {
    return res.status(500).json({ 
      success: false, 
      message: "فشل في حذف المستخدم" 
    });
  }
  
  // تسجيل نشاط حذف المستخدم
  addActivity('user_delete', req.body.adminUsername || 'admin', `تم حذف المستخدم: ${username}`);
  
  return res.status(200).json({ 
    success: true, 
    message: "تم حذف المستخدم بنجاح" 
  });
});

// تشغيل الخادم
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
  console.log(`يمكنك الوصول إلى التطبيق على http://localhost:${PORT}`);
});
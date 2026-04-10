# Role-Based Access Control (RBAC) Implementation Plan
## Talk2Us Application

---

## 📋 Overview
Implement a two-tier access control system:
- **Regular Users** (isEmployee = false) → Regular User Dashboard
- **Employees** (isEmployee = true) → Employee Dashboard

---

## 🎯 Key Changes

### 1. **Registration Page Simplification**
**File:** `app/register.tsx`

**Changes:**
- ✅ Keep `isEmployee` boolean toggle (ON/OFF)
- ❌ **REMOVE** `employeeRole` field and `ROLE_OPTIONS` array
- ❌ **REMOVE** dropdown picker for roles
- Simplify UI: Only ask "Employee Account? YES/NO"

**Impact:** 
- Cleaner registration form
- Users select only: Employee or Non-Employee

---

### 2. **Firestore User Document Structure**
**Current:**
```javascript
{
  firstName, lastName, email, ...
  isEmployee: boolean,
  employeeRole: "day care services" // ❌ REMOVE THIS
}
```

**New:**
```javascript
{
  firstName, lastName, email, ...
  isEmployee: boolean,           // ✅ KEEP THIS
  userType: "employee" | "regular" // ✅ Optional helper
}
```

---

### 3. **App Folder Structure - NEW**

```
app/
├── index.tsx                 (Login Page - MODIFY)
├── register.tsx              (Registration - SIMPLIFY)
├── modal.tsx
├── (tabs)/                   (Regular User Tabs - KEEP AS IS)
│   ├── _layout.tsx
│   ├── home.tsx
│   ├── profile.tsx
│   ├── feedback.tsx
│   ├── complain.tsx
│   ├── emergency.tsx
│   └── FAQS.tsx
│
└── employee/                 (NEW - Employee Section)
    ├── _layout.tsx           (Employee bottom tabs navigation)
    ├── dashboard.tsx         (Employee home/dashboard)
    ├── manage-requests.tsx   (View & manage complaints/feedback)
    ├── reports.tsx           (View reports & analytics)
    ├── profile.tsx           (Employee profile)
    └── settings.tsx          (Employee settings)
```

---

## 🔄 Login Flow (Modified)

**Current Flow:**
```
Login Page → Authenticate → /(tabs)/home
```

**New Flow:**
```
Login Page 
    ↓
Authenticate with Firebase
    ↓
Fetch user doc from Firestore
    ↓
Check isEmployee flag
    ├─→ YES (true) → /employee/dashboard
    └─→ NO (false) → /(tabs)/home
```

---

## 📝 Implementation Steps

### **Step 1: Update Registration Page**
- Remove `employeeRole` state variable
- Remove `ROLE_OPTIONS` array
- Remove dropdown picker for roles
- Simplify the Employee toggle UI
- Update Firestore save to exclude `employeeRole`

### **Step 2: Create Employee Folder & Layout**
- Create `app/employee/` folder
- Create `app/employee/_layout.tsx` (Drawer or Tab navigation)
- Create `app/employee/dashboard.tsx` (Main employee page)
- Create other employee pages as needed

### **Step 3: Modify Login Logic**
- Update `app/index.tsx` `handleLogin` function
- After successful authentication:
  1. Get user document from Firestore
  2. Read `isEmployee` field
  3. Route accordingly using `router.replace()`

### **Step 4: Add Helper Function**
- Create utility function to determine user type
- Place in: `utils/authHelper.ts` or similar
- Function: `getUserTypeAndRoute(userId, router)`

### **Step 5: Create Auth Context (Optional but Recommended)**
- Store `isEmployee` in global context
- Accessible from any component
- File: `context/AuthContext.tsx`

---

## 🔐 Security Considerations

1. **Firestore Rules:** Set security rules to ensure:
   - Employees can only access their own data + public data
   - Employees can't modify other user records

2. **Client-side Check:**
   - Always verify `isEmployee` on login
   - Don't rely on local state alone

3. **Role Protection:**
   - Protect employee routes so non-employees can't access `/employee/*` paths
   - Consider adding a wrapper component for route protection

---

## 📱 Navigation Structure

### **Regular Users (isEmployee = false)**
- Bottom Tab Navigation
- Home
- Emergency
- FAQs
- Feedback
- Complaints
- Profile

### **Employees (isEmployee = true)**  
- (Suggested) Drawer + Tab hybrid OR Bottom Tabs
- Dashboard/Home
- Manage Requests
- Reports
- Profile
- Settings
- Logout

---

## ✅ Checklist

- [ ] Remove `employeeRole` and `ROLE_OPTIONS` from register.tsx
- [ ] Simplify registration UI
- [ ] Update Firestore data structure
- [ ] Create `app/employee/` directory structure
- [ ] Create `app/employee/_layout.tsx`
- [ ] Create `app/employee/dashboard.tsx`
- [ ] Modify login routing logic in `index.tsx`
- [ ] Test login as employee → redirects to `/employee/dashboard`
- [ ] Test login as regular user → redirects to `/(tabs)/home`
- [ ] Test registration form (no role dropdown)
- [ ] Verify Firestore documents are saved correctly
- [ ] Add route protection if needed

---

## 🎨 UI/UX Notes

1. **Employee Dashboard** should clearly indicate employee status
2. **Logout functionality** needed (especially for employee section)
3. **Back to User View** option (if switching roles later)
4. **Visual distinction** between user and employee interfaces

---

## 🔗 Files to Modify/Create

| File | Action | Priority |
|------|--------|----------|
| `app/register.tsx` | Modify - Remove roles | High |
| `app/index.tsx` | Modify - Add routing logic | High |
| `app/employee/_layout.tsx` | Create - New | High |
| `app/employee/dashboard.tsx` | Create - New | High |
| `context/AuthContext.tsx` | Create - Optional | Medium |
| `utils/authHelper.ts` | Create - Optional | Medium |

---

## 📊 Data Migration (If Existing Users)

If you have existing users with `employeeRole` field:
- Option 1: Keep it (won't be used)
- Option 2: Remove via Firestore console
- Option 3: Script to clean up (not critical)

---

## 🧪 Testing Scenarios

1. **Register as regular user** → Login → Should see `/(tabs)/home`
2. **Register as employee** → Login → Should see `/employee/dashboard`
3. **Database check** → Verify `isEmployee` field in Firestore
4. **Logout & switch** → Logout, login with different account type

---

## 📞 Questions/Next Steps

Once you approve this plan, we will:
1. Implement all changes step by step
2. Test each component thoroughly
3. Ensure seamless user experience
4. Deploy with confidence


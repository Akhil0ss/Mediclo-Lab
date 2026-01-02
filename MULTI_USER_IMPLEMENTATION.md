# Multi-User System Implementation Plan

## Overview
Implementing role-based access control (RBAC) for hospital staff management.

## User Roles

### 1. Receptionist (Super User)
- **Creation**: First user to sign up becomes receptionist
- **Permissions**: Full access to all features
- **Capabilities**:
  - Manage all users (create, delete, reset passwords)
  - Full CRUD on patients, samples, OPD, reports
  - Cannot edit OPD prescriptions marked as "Final" by doctors
- **Limitations**: Not root level (can be replaced)

### 2. Doctor
- **Creation**: Auto-created when internal doctor is added
- **Permissions**: Limited to assigned OPD cases
- **Capabilities**:
  - View/edit only their assigned OPD prescriptions
  - Mark prescriptions as "Final"
  - Can edit even after marking as final
  - Change own password
- **Limitations**: Cannot access other doctors' cases

### 3. Pharmacy
- **Creation**: Manually created by receptionist
- **Permissions**: View-only for final prescriptions
- **Capabilities**:
  - View final OPD prescriptions
  - View patient details and medicines
  - Change own password
- **Limitations**: Cannot edit anything, cannot see non-final prescriptions

## Data Structure

### Firebase Structure
```
users/
  {labOwnerId}/
    profile/
      role: "receptionist"
      name: "John Doe"
      email: "john@example.com"
      createdAt: timestamp
    
    staff/
      {staffId}/
        email: "doctor@example.com"
        passwordHash: "..."
        role: "doctor" | "pharmacy"
        name: "Dr. Smith"
        doctorId: "xyz" // if doctor role
        createdAt: timestamp
        createdBy: "receptionistId"
        isActive: true

doctors/
  {labOwnerId}/
    {doctorId}/
      ... existing fields ...
      userId: "staffId" // link to staff user

opd/
  {labOwnerId}/
    {opdId}/
      ... existing fields ...
      assignedDoctorId: "doctorId"
      isFinal: false
      finalizedAt: timestamp
      finalizedBy: "doctorUserId"
```

## Implementation Phases

### Phase 1: User Profile & Role Setup ✓
1. Add user role to existing user profile
2. Create staff management collection
3. Update auth context to include role

### Phase 2: Auto-Create Doctor Users
1. Modify Doctors page to auto-create user when doctor is added
2. Generate secure credentials
3. Store in staff collection

### Phase 3: Settings - Manage Users
1. Add "Manage Users" section in Settings
2. Create modal to list all users
3. Add user creation form (for pharmacy)
4. Add password reset functionality
5. Add delete user functionality

### Phase 4: OPD Updates
1. Add `isFinal` and `assignedDoctorId` fields
2. Add "Mark as Final" button for doctors
3. Add visual indicators for final status
4. Implement edit restrictions

### Phase 5: Role-Based Access Control
1. Filter OPD list based on user role
2. Disable editing based on role and final status
3. Create pharmacy-specific dashboard
4. Update navigation based on role

## Security Considerations
- Password hashing (use bcrypt or similar)
- Session management
- Role verification on all operations
- Audit log for user actions

## UI Components Needed
1. User Management Modal
2. Add User Form
3. Password Change Modal
4. Role Badge Component
5. Final Status Badge
6. Pharmacy Dashboard

## Next Steps
1. Start with Phase 1: Add role to user profile
2. Create staff management structure
3. Build user management UI in Settings

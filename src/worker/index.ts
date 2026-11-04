import { Hono } from 'hono';
import {
  getAllMembers,
  createNewMember,
  renewMemberPlan,
  updateMemberDetails,
  getMember,
  saveMemberPhoto,
  getMemberPhoto,
  updateMemberProfile,
} from './service';
import { login, logout, requireAuth } from './auth';

const app = new Hono<{ Bindings: Env }>();

// Public Auth Routes
app.post('/api/login', login);

app.post('/api/logout', logout);

// Protect all API routes
app.use('/api/*', requireAuth);

// Verify current session
app.get('/api/auth/me', (c) => {
  return c.json({ authenticated: true });
});

// Get all existing members
app.get('/api/members', (c) => getAllMembers(c));

// Get a specific member
app.get('/api/members/:id', (c) => getMember(c));

// Create a new member with plan
app.post('/api/members', (c) => createNewMember(c));

// Renew a member with plan
app.post('/api/members/:id/renewals', (c) => renewMemberPlan(c));

// Mark a specific member inactive
app.patch('/api/members/:id', (c) => updateMemberDetails(c));

// Update a member's profile details
app.put('/api/members/:id/details', (c) => updateMemberProfile(c));

// Save a member photo
app.put('/api/members/:id/photo', (c) => saveMemberPhoto(c));

// get a member photo
app.get('/api/members/:id/photo', (c) => getMemberPhoto(c));

export default app;
